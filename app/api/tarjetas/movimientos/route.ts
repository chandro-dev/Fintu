import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { allocatePaymentToInterestThenCapital } from "@/lib/creditCard";

const cleanId = (id: any) => (id && typeof id === "string" && id.trim() !== "" ? id : null);

function daysBetween(a: Date, b: Date) {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function tasaDiariaDesdeTEA(tasaEfectivaAnualPct: number) {
  const tea = Number(tasaEfectivaAnualPct) || 0;
  if (tea <= 0) return 0;
  return Math.pow(1 + tea / 100, 1 / 365) - 1;
}

async function getTransactionTypeId(codigo: string, nombreDefault: string, descripcionDefault: string) {
  let tipo = await prisma.tipoTransaccion.findFirst({ where: { codigo } });
  if (!tipo) {
    tipo = await prisma.tipoTransaccion.create({
      data: { codigo, nombre: nombreDefault, descripcion: descripcionDefault }
    });
  }
  return tipo.id;
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tarjetaId = searchParams.get("tarjetaId");
  
  if (!tarjetaId) return NextResponse.json({ error: "tarjetaId requerido" }, { status: 400 });

  try {
    const movimientos = await prisma.tarjetaMovimiento.findMany({
      where: { usuarioId: user.id, tarjetaId },
      orderBy: { ocurrioEn: "desc" },
      include: { transaccion: true, cuota: true, compra: true },
    });
    return NextResponse.json(movimientos);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener movimientos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    // Compat: si el Prisma Client no está regenerado, estos campos pueden no existir aún.
    // Evita PrismaClientValidationError por argumentos desconocidos.
    const tarjetaCreditoFields = (prisma as any)?.tarjetaCredito?.fields ?? {};
    const tarjetaMovimientoFields = (prisma as any)?.tarjetaMovimiento?.fields ?? {};
    const hasSaldoInteres = Boolean(tarjetaCreditoFields.saldoInteres);
    const hasSaldoCapital = Boolean(tarjetaCreditoFields.saldoCapital);
    const hasAplicadoInteres = Boolean(tarjetaMovimientoFields.aplicadoInteres);
    const hasAplicadoCapital = Boolean(tarjetaMovimientoFields.aplicadoCapital);

    const body = await request.json();
    console.log("📥 [API] Recibiendo movimiento:", body); // <--- DEBUG 1

    const {
      tarjetaId,
      tipo,
      monto,
      descripcion,
      ocurrioEn,
      enCuotas,
      cuotasTotales,
      cuentaOrigenId, // ESTE ES EL DATO CRÍTICO
      cuotaId,
      autoCalcularInteres,
    } = body ?? {};

    if (!tarjetaId || !tipo) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const fechaMovimiento = ocurrioEn ? new Date(ocurrioEn) : new Date();

    // Validar Tarjeta
    const tarjeta = await prisma.tarjetaCredito.findFirst({
      where: { id: tarjetaId, usuarioId: user.id },
      include: { cuenta: true },
    });

    if (!tarjeta) return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });

    let montoNum = Number(monto);

    if (tipo === "INTERES") {
      const shouldAuto = Boolean(autoCalcularInteres);
      if (shouldAuto) {
        const ultimoInteres = await prisma.tarjetaMovimiento.findFirst({
          where: { usuarioId: user.id, tarjetaId, tipo: "INTERES" },
          orderBy: { ocurrioEn: "desc" },
          select: { ocurrioEn: true },
        });
        const baseDate = ultimoInteres?.ocurrioEn ?? tarjeta.abiertaEn ?? tarjeta.creadaEn;
        const dias = daysBetween(baseDate, fechaMovimiento);
        const tasaDiaria = tasaDiariaDesdeTEA(Number(tarjeta.tasaEfectivaAnual));

        // Interés simple estimado por días (aprox. al mundo real sin saldo diario promedio).
        montoNum = Math.max(0, Number(tarjeta.saldoActual) * tasaDiaria * dias);
      }

      if (!montoNum || !Number.isFinite(montoNum) || montoNum <= 0) {
        return NextResponse.json(
          { error: "Monto inválido para interés (o no hay interés a cobrar aún)." },
          { status: 400 },
        );
      }
    } else {
      if (!montoNum || !Number.isFinite(montoNum) || montoNum <= 0) {
        return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
      }
    }

    // Validar Cuenta de Origen si es Pago
    if (["PAGO", "CUOTA", "ABONO_CAPITAL"].includes(tipo)) {
        if (!cuentaOrigenId) {
            console.error("❌ [API] Error: Intento de pago sin cuenta de origen");
            return NextResponse.json({ error: "Falta la cuenta de origen para descontar el dinero." }, { status: 400 });
        }
        console.log(`✅ [API] Validado pago desde cuenta: ${cuentaOrigenId} por monto: ${montoNum}`);
    }

    // Obtener Tipos
    const TIPO_COMPRA_TC_ID = await getTransactionTypeId("COMPRA_TC", "Compra Tarjeta Crédito", "Gasto con TC");
    const TIPO_PAGO_TC_ID = await getTransactionTypeId("PAGO_TC", "Abono Tarjeta Crédito", "Pago deuda TC");

    // --- INICIO TRANSACCIÓN DB ---
    const resultado = await prisma.$transaction(async (tx) => {
        let nuevoSaldoInteres = Number((tarjeta as any).saldoInteres ?? 0);
        let nuevoSaldoCapital = Number((tarjeta as any).saldoCapital ?? 0);
        let nuevoSaldoTarjeta = Number(tarjeta.saldoActual);
        let transaccionId: string | null = null;
        let cuotaRefId: string | null = null;
        let compraRefId: string | null = null;
        let aplicadoInteres = 0;
        let aplicadoCapital = 0;

        const compraObjetivoId = cleanId(cuotaId);

        // ====================================================================
        // CASO A: GASTO (AUMENTA DEUDA)
        // ====================================================================
        if (["COMPRA", "AVANCE", "INTERES"].includes(tipo)) {
            if (tipo !== "INTERES" && (Number(tarjeta.saldoActual) + montoNum) > Number(tarjeta.cupoTotal)) {
                throw new Error("Cupo insuficiente");
            }

            const nuevaTx = await tx.transaccion.create({
                data: {
                    usuarioId: user.id,
                    cuentaId: tarjeta.cuentaId,
                    monto: montoNum,
                    moneda: tarjeta.moneda,
                    direccion: "SALIDA",
                    descripcion:
                      descripcion ||
                      (tipo === "INTERES"
                        ? `Interés (${tarjeta.nombre})`
                        : `${tipo} Tarjeta`),
                    ocurrioEn: fechaMovimiento,
                    tipoTransaccionId: TIPO_COMPRA_TC_ID
                }
            });
            transaccionId = nuevaTx.id;

            if (tipo === "COMPRA" && enCuotas && Number(cuotasTotales) > 1) {
                 const nuevaCuota = await tx.tarjetaCuota.create({
                    data: {
                        usuarioId: user.id, tarjetaId, descripcion: descripcion || "Compra diferida",
                        montoOriginal: montoNum, saldoPendiente: montoNum, cuotasTotales: Number(cuotasTotales),
                        cuotaActual: 1, fechaInicio: fechaMovimiento
                    }
                });
                cuotaRefId = nuevaCuota.id;
                
                const nuevaCompra = await tx.tarjetaCompra.create({
                    data: {
                        usuarioId: user.id, tarjetaId, descripcion: descripcion || "Compra diferida",
                        montoTotal: montoNum, saldoPendiente: montoNum, cuotasTotales: Number(cuotasTotales),
                        ocurrioEn: fechaMovimiento
                    }
                });
                compraRefId = nuevaCompra.id;
            }
            if (tipo === "INTERES") {
              nuevoSaldoInteres += montoNum;
            } else {
              nuevoSaldoCapital += montoNum;
            }
            nuevoSaldoTarjeta = Math.max(0, nuevoSaldoInteres + nuevoSaldoCapital);
        }

        // ====================================================================
        // CASO B: PAGO (DISMINUYE DEUDA Y RESTA BANCO)
        // ====================================================================
        else if (["PAGO", "CUOTA", "ABONO_CAPITAL"].includes(tipo)) {
            
            console.log("🔄 [DB] Iniciando proceso de pago/abono...");

            if (tipo === "CUOTA" && !compraObjetivoId) {
              throw new Error("Para pagar una cuota específica, envía 'cuotaId' (id de la compra diferida).");
            }

            const deudaTotal = Math.max(0, nuevoSaldoInteres + nuevoSaldoCapital);
            if (tipo !== "ABONO_CAPITAL" && montoNum > deudaTotal) {
              throw new Error("El pago excede la deuda actual de la tarjeta.");
            }
            if (tipo === "ABONO_CAPITAL" && montoNum > Math.max(0, nuevoSaldoCapital)) {
              throw new Error("El abono excede el capital pendiente de la tarjeta.");
            }

            // 1. DESCONTAR DINERO DE LA CUENTA BANCARIA (CRÍTICO)
            // Lo hacemos primero para asegurar que falle si no hay cuenta
            try {
                const cuentaOrigen = await tx.cuenta.findFirst({
                  where: { id: cuentaOrigenId, usuarioId: user.id },
                  select: { saldo: true },
                });
                if (!cuentaOrigen) throw new Error("La cuenta de origen no existe o no pertenece al usuario.");
                if (Number(cuentaOrigen.saldo) < montoNum) throw new Error("Saldo insuficiente en la cuenta de origen.");

                await tx.cuenta.update({
                  where: { id: cuentaOrigenId },
                  data: { saldo: { decrement: montoNum } },
                });
                console.log("💰 [DB] Saldo descontado de cuenta origen");
            } catch (e) {
                throw new Error(e instanceof Error ? e.message : "No se pudo descontar de la cuenta origen.");
            }

            // 2. Registrar la SALIDA en el historial del Banco
            const txSalidaBanco = await tx.transaccion.create({
                data: {
                    usuarioId: user.id,
                    cuentaId: cuentaOrigenId,
                    monto: montoNum,
                    moneda: tarjeta.moneda,
                    direccion: "SALIDA",
                    descripcion: descripcion || `Pago Tarjeta ${tarjeta.nombre}`,
                    ocurrioEn: fechaMovimiento,
                    tipoTransaccionId: TIPO_PAGO_TC_ID
                }
            });

            // 3. Registrar la ENTRADA en la Tarjeta (Baja Pasivo)
            const txEntradaTarjeta = await tx.transaccion.create({
                data: {
                    usuarioId: user.id,
                    cuentaId: tarjeta.cuentaId,
                    monto: montoNum,
                    moneda: tarjeta.moneda,
                    direccion: "ENTRADA",
                    descripcion:
                      tipo === "CUOTA"
                        ? "Abono a Cuota"
                        : tipo === "ABONO_CAPITAL"
                          ? "Abono a Capital"
                          : "Abono General",
                    ocurrioEn: fechaMovimiento,
                    transaccionRelacionadaId: txSalidaBanco.id,
                    tipoTransaccionId: TIPO_PAGO_TC_ID
                }
            });
            
            // Vincular
            await tx.transaccion.update({
                where: { id: txSalidaBanco.id },
                data: { transaccionRelacionadaId: txEntradaTarjeta.id }
            });

            transaccionId = txEntradaTarjeta.id;

            if (tipo === "ABONO_CAPITAL") {
              aplicadoInteres = 0;
              aplicadoCapital = Math.min(montoNum, Math.max(0, nuevoSaldoCapital));
              nuevoSaldoCapital = Math.max(0, nuevoSaldoCapital - aplicadoCapital);
              nuevoSaldoTarjeta = Math.max(0, nuevoSaldoInteres + nuevoSaldoCapital);
            } else {
              // 4. Aplicación realista del pago: primero interés, luego capital.
              const allocation = allocatePaymentToInterestThenCapital(montoNum, {
                saldoInteres: nuevoSaldoInteres,
                saldoCapital: nuevoSaldoCapital,
              });
              aplicadoInteres = allocation.aplicadoInteres;
              aplicadoCapital = allocation.aplicadoCapital;
              nuevoSaldoInteres = allocation.nuevoSaldoInteres;
              nuevoSaldoCapital = allocation.nuevoSaldoCapital;
              nuevoSaldoTarjeta = allocation.nuevoSaldoTotal;
            }

            // 5. Si hay compras diferidas, el capital se aplica como abono a capital (y/o a la compra objetivo).
            let capitalParaAplicar = aplicadoCapital;

            // Para CUOTA el objetivo es requerido; para ABONO_CAPITAL es opcional (si viene, se prioriza).
            if ((tipo === "CUOTA" || tipo === "ABONO_CAPITAL") && compraObjetivoId && capitalParaAplicar > 0) {
              const compra = await tx.tarjetaCompra.findFirst({
                where: { id: compraObjetivoId, usuarioId: user.id, tarjetaId },
                select: { id: true, saldoPendiente: true },
              });
              if (!compra) throw new Error("La compra diferida seleccionada no existe.");

              const pendiente = Number(compra.saldoPendiente);
              const aplica = Math.min(capitalParaAplicar, Math.max(0, pendiente));
              if (aplica > 0) {
                await tx.tarjetaCompra.update({
                  where: { id: compra.id },
                  data: { saldoPendiente: { decrement: aplica } },
                });
                capitalParaAplicar -= aplica;
                compraRefId = compra.id;
              }
            }

            if (capitalParaAplicar > 0) {
              const compras = await tx.tarjetaCompra.findMany({
                where: {
                  usuarioId: user.id,
                  tarjetaId,
                  saldoPendiente: { gt: 0 },
                  ...(compraObjetivoId ? { id: { not: compraObjetivoId } } : {}),
                },
                orderBy: { ocurrioEn: "asc" },
                select: { id: true, saldoPendiente: true },
              });

              for (const c of compras) {
                if (capitalParaAplicar <= 0) break;
                const pendiente = Number(c.saldoPendiente);
                const aplica = Math.min(capitalParaAplicar, Math.max(0, pendiente));
                if (aplica <= 0) continue;
                await tx.tarjetaCompra.update({
                  where: { id: c.id },
                  data: { saldoPendiente: { decrement: aplica } },
                });
                capitalParaAplicar -= aplica;
              }
            }
        }

        // ====================================================================
        // CASO C: AJUSTE
        // ====================================================================
        else if (tipo === "AJUSTE") {
             const nuevaTx = await tx.transaccion.create({
                data: {
                    usuarioId: user.id,
                    cuentaId: tarjeta.cuentaId,
                    monto: Math.abs(montoNum),
                    moneda: tarjeta.moneda,
                    direccion: montoNum >= 0 ? "SALIDA" : "ENTRADA",
                    descripcion: descripcion || "Ajuste manual",
                    ocurrioEn: fechaMovimiento,
                    tipoTransaccionId: null 
                }
            });
            transaccionId = nuevaTx.id;
            // Ajuste manual afecta el capital por defecto.
            nuevoSaldoCapital = Math.max(0, nuevoSaldoCapital + montoNum);
            nuevoSaldoTarjeta = Math.max(0, nuevoSaldoInteres + nuevoSaldoCapital);
        }

        // Actualizar saldos globales de la tarjeta
        const tarjetaUpdateData: any = { saldoActual: nuevoSaldoTarjeta };
        if (hasSaldoInteres) tarjetaUpdateData.saldoInteres = nuevoSaldoInteres;
        if (hasSaldoCapital) tarjetaUpdateData.saldoCapital = nuevoSaldoCapital;

        await tx.tarjetaCredito.update({
          where: { id: tarjetaId },
          data: tarjetaUpdateData,
        });
        await tx.cuenta.update({ where: { id: tarjeta.cuentaId }, data: { saldo: nuevoSaldoTarjeta } });

        // Crear registro en TarjetaMovimiento
        const movimientoData: any = {
          usuarioId: user.id,
          tarjetaId,
          transaccionId,
          tipo,
          monto: montoNum,
          descripcion: descripcion || tipo,
          ocurrioEn: fechaMovimiento,
          saldoPosterior: nuevoSaldoTarjeta,
          compraId: compraRefId,
          cuotaId: cuotaRefId, // Debería ser null para pagos
        };
        if (hasAplicadoInteres) movimientoData.aplicadoInteres = aplicadoInteres;
        if (hasAplicadoCapital) movimientoData.aplicadoCapital = aplicadoCapital;

        let nuevoMovimiento: any = null;
        try {
          nuevoMovimiento = await tx.tarjetaMovimiento.create({ data: movimientoData });
        } catch (e) {
          // Compat: si el enum en BD/Client no incluye ABONO_CAPITAL aún, persistimos como PAGO.
          const msg = e instanceof Error ? e.message : String(e);
          if (tipo === "ABONO_CAPITAL" && msg.includes("Expected TipoMovimientoTarjeta")) {
            nuevoMovimiento = await tx.tarjetaMovimiento.create({
              data: { ...movimientoData, tipo: "PAGO", descripcion: descripcion || "ABONO_CAPITAL" },
            });
          } else {
            throw e;
          }
        }

        console.log("✅ [API] Movimiento creado exitosamente");
        return nuevoMovimiento;
    });

    return NextResponse.json(resultado, { status: 201 });

  } catch (error) {
    console.error("❌ [API] Error Fatal en POST:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
