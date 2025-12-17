import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

const cleanId = (id: any) => (id && typeof id === "string" && id.trim() !== "" ? id : null);

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
      cuotaId 
    } = body ?? {};

    if (!tarjetaId || !tipo || !monto || Number(monto) <= 0) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const montoNum = Number(monto);
    const fechaMovimiento = ocurrioEn ? new Date(ocurrioEn) : new Date();

    // Validar Tarjeta
    const tarjeta = await prisma.tarjetaCredito.findFirst({
      where: { id: tarjetaId, usuarioId: user.id },
      include: { cuenta: true },
    });

    if (!tarjeta) return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });

    // Validar Cuenta de Origen si es Pago
    if (["PAGO", "CUOTA"].includes(tipo)) {
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
        let nuevoSaldoTarjeta = Number(tarjeta.saldoActual);
        let transaccionId: string | null = null;
        let cuotaRefId: string | null = null;
        let compraRefId: string | null = null;

        // Corrección de IDs
        if (tipo === "CUOTA") {
            compraRefId = cleanId(cuotaId);
        }

        // ====================================================================
        // CASO A: GASTO (AUMENTA DEUDA)
        // ====================================================================
        if (["COMPRA", "AVANCE", "INTERES"].includes(tipo)) {
            if ((Number(tarjeta.saldoActual) + montoNum) > Number(tarjeta.cupoTotal)) {
                throw new Error("Cupo insuficiente");
            }

            const nuevaTx = await tx.transaccion.create({
                data: {
                    usuarioId: user.id,
                    cuentaId: tarjeta.cuentaId,
                    monto: montoNum,
                    moneda: tarjeta.moneda,
                    direccion: "SALIDA",
                    descripcion: descripcion || `${tipo} Tarjeta`,
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
            nuevoSaldoTarjeta += montoNum;
        }

        // ====================================================================
        // CASO B: PAGO (DISMINUYE DEUDA Y RESTA BANCO)
        // ====================================================================
        else if (["PAGO", "CUOTA"].includes(tipo)) {
            
            console.log("🔄 [DB] Iniciando proceso de pago/abono...");

            // 1. DESCONTAR DINERO DE LA CUENTA BANCARIA (CRÍTICO)
            // Lo hacemos primero para asegurar que falle si no hay cuenta
            try {
                await tx.cuenta.update({ 
                    where: { id: cuentaOrigenId }, 
                    data: { saldo: { decrement: montoNum } } 
                });
                console.log("💰 [DB] Saldo descontado de cuenta origen");
            } catch (e) {
                throw new Error(`No se pudo descontar de la cuenta origen (${cuentaOrigenId}). Verifica que exista.`);
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
                    descripcion: tipo === "CUOTA" ? "Abono a Cuota" : "Abono General",
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
            nuevoSaldoTarjeta = Math.max(0, nuevoSaldoTarjeta - montoNum);

            // 4. Si es Cuota, reducir deuda específica
            if (tipo === "CUOTA" && compraRefId) {
                try {
                    await tx.tarjetaCompra.update({
                        where: { id: compraRefId },
                        data: { saldoPendiente: { decrement: montoNum } }
                    });
                } catch (e) {
                    console.warn("⚠️ No se encontró la Compra para actualizar saldo pendiente, pero el pago se procesó.");
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
            nuevoSaldoTarjeta += montoNum;
        }

        // Actualizar saldos globales de la tarjeta
        await tx.tarjetaCredito.update({ where: { id: tarjetaId }, data: { saldoActual: nuevoSaldoTarjeta } });
        await tx.cuenta.update({ where: { id: tarjeta.cuentaId }, data: { saldo: nuevoSaldoTarjeta } });

        // Crear registro en TarjetaMovimiento
        const nuevoMovimiento = await tx.tarjetaMovimiento.create({
            data: {
                usuarioId: user.id,
                tarjetaId,
                transaccionId,
                tipo,
                monto: montoNum,
                descripcion: descripcion || tipo,
                ocurrioEn: fechaMovimiento,
                saldoPosterior: nuevoSaldoTarjeta,
                compraId: compraRefId,
                cuotaId: cuotaRefId // Debería ser null para pagos
            }
        });

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