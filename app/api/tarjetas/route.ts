import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

const CODIGO_TIPO_CUENTA_TARJETA_CREDITO = "TARJETA_CREDITO";

// Helper para obtener (o crear) el tipo de cuenta de Tarjeta de Crédito
async function getTipoCuentaTarjeta() {
  const tipo = await prisma.tipoCuenta.findUnique({
    where: { codigo: CODIGO_TIPO_CUENTA_TARJETA_CREDITO },
  });
  if (tipo) return tipo;

  return prisma.tipoCuenta.create({
    data: {
      codigo: CODIGO_TIPO_CUENTA_TARJETA_CREDITO,
      nombre: "Tarjeta de Crédito",
      descripcion: "Cuenta sombra asociada a una tarjeta de crédito",
      requiereCorte: true,
    },
  });
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tarjetas = await prisma.tarjetaCredito.findMany({
    where: { usuarioId: user.id },
    orderBy: { creadaEn: "desc" },
    include: { 
      cuenta: {
        select: {
          id: true,
          nombre: true,
          moneda: true,
          saldo: true // El saldo de la cuenta debe coincidir con el de la tarjeta
        }
      } 
    },
  });
  return NextResponse.json(tarjetas);
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      nombre,
      emisor,
      moneda = "USD",
      cupoTotal = 0,
      tasaEfectivaAnual,
      diaCorte,
      diaPago,
      pagoMinimoPct = 0,
      saldoInicial = 0, // Se ignora (siempre 0 al crear)
      cuentaId, // Opcional: si el usuario ya creó la cuenta manual antes
      saldoInteres = 0,
      saldoCapital,
    } = body ?? {};

    // Validaciones básicas
    if (!nombre || !tasaEfectivaAnual || !diaCorte || !diaPago) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (nombre, TEA, corte, pago)" },
        { status: 400 },
      );
    }

    // Requisito: la tarjeta debe iniciar sin deuda.
    if (Number(saldoInicial) > 0) {
      return NextResponse.json(
        { error: "La tarjeta debe iniciar con saldo inicial 0." },
        { status: 400 },
      );
    }
    const saldoInicialNum = 0;
    const saldoInteresNum = Math.max(0, Number(saldoInteres) || 0);
    const saldoCapitalNum =
      saldoCapital !== undefined && saldoCapital !== null
        ? Math.max(0, Number(saldoCapital) || 0)
        : Math.max(0, saldoInicialNum - saldoInteresNum);
    const saldoActualNum = Math.max(0, saldoInteresNum + saldoCapitalNum);
    const cupoTotalNum = Number(cupoTotal) || 0;

    if (cupoTotalNum < 0) {
      return NextResponse.json({ error: "El cupo no puede ser negativo." }, { status: 400 });
    }
    if (moneda === "COP" && cupoTotalNum > 500_000) {
      return NextResponse.json(
        { error: "Para COP, el cupo no puede superar $500.000." },
        { status: 400 },
      );
    }

    // LÓGICA CORE: Transacción para crear Tarjeta + Cuenta Sombra
    const result = await prisma.$transaction(async (tx) => {
      let cuentaAsociadaId = cuentaId;

      // 1. Si no se envió cuentaId, creamos una CUENTA SOMBRA automáticamente
      if (!cuentaAsociadaId) {
         const tipoCuenta = await getTipoCuentaTarjeta();
         if (!tipoCuenta) throw new Error("No hay tipos de cuenta configurados en el sistema");

         const nuevaCuenta = await tx.cuenta.create({
            data: {
              usuarioId: user.id,
              nombre: `TC - ${nombre}`, // Ej: "TC - Visa Oro"
              moneda,
              saldo: saldoActualNum, // La deuda inicial total
              institucion: emisor,
              tipoCuentaId: tipoCuenta.id,
            }
         });
         cuentaAsociadaId = nuevaCuenta.id;
      } else {
         // Si el usuario eligió una cuenta existente, verificamos que sea suya
         const cuentaExistente = await tx.cuenta.findFirst({
            where: { id: cuentaId, usuarioId: user.id },
            include: { tipoCuenta: { select: { codigo: true } } },
         });
         if (!cuentaExistente) throw new Error("La cuenta seleccionada no existe");

         if (cuentaExistente.tipoCuenta?.codigo !== CODIGO_TIPO_CUENTA_TARJETA_CREDITO) {
           throw new Error(`La cuenta seleccionada debe ser de tipo ${CODIGO_TIPO_CUENTA_TARJETA_CREDITO}`);
         }
         
         // Opcional: Actualizar el saldo de esa cuenta al saldo inicial indicado
         if (saldoActualNum !== Number(cuentaExistente.saldo)) {
             await tx.cuenta.update({
                 where: { id: cuentaAsociadaId },
                 data: { saldo: saldoActualNum }
             });
         }
      }

      // 2. Crear la Tarjeta de Crédito vinculada
      const nuevaTarjeta = await tx.tarjetaCredito.create({
        data: {
          usuarioId: user.id,
          cuentaId: cuentaAsociadaId,
          nombre,
          emisor,
          moneda,
          cupoTotal: cupoTotalNum,
          saldoInteres: saldoInteresNum,
          saldoCapital: saldoCapitalNum,
          saldoActual: saldoActualNum, // saldoInteres + saldoCapital
          tasaEfectivaAnual: Number(tasaEfectivaAnual),
          diaCorte: Number(diaCorte),
          diaPago: Number(diaPago),
          pagoMinimoPct: Number(pagoMinimoPct),
          estado: "ACTIVA"
        },
      });

      return nuevaTarjeta;
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error("[POST Tarjeta] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error creando tarjeta" }, 
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...rest } = body ?? {};
    if (!id) return NextResponse.json({ error: "Id requerido" }, { status: 400 });

    const existing = await prisma.tarjetaCredito.findUnique({ where: { id } });
    if (!existing || existing.usuarioId !== user.id) {
      return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
    }

    // Validar y parsear datos numéricos si vienen en el request
    const dataToUpdate: any = {
      nombre: rest.nombre,
      emisor: rest.emisor,
      moneda: rest.moneda,
      estado: rest.estado,
    };

    if (rest.cupoTotal !== undefined) dataToUpdate.cupoTotal = Number(rest.cupoTotal);
    if (rest.saldoInteres !== undefined) dataToUpdate.saldoInteres = Math.max(0, Number(rest.saldoInteres) || 0);
    if (rest.saldoCapital !== undefined) dataToUpdate.saldoCapital = Math.max(0, Number(rest.saldoCapital) || 0);
    if (rest.saldoActual !== undefined) dataToUpdate.saldoActual = Math.max(0, Number(rest.saldoActual) || 0);
    if (rest.tasaEfectivaAnual !== undefined) dataToUpdate.tasaEfectivaAnual = Number(rest.tasaEfectivaAnual);
    if (rest.diaCorte !== undefined) dataToUpdate.diaCorte = Number(rest.diaCorte);
    if (rest.diaPago !== undefined) dataToUpdate.diaPago = Number(rest.diaPago);
    if (rest.pagoMinimoPct !== undefined) dataToUpdate.pagoMinimoPct = Number(rest.pagoMinimoPct);
    if (rest.cerradaEn) dataToUpdate.cerradaEn = new Date(rest.cerradaEn);

    // Transacción: Si actualizo el saldo de la tarjeta, debo actualizar la cuenta sombra
    const result = await prisma.$transaction(async (tx) => {
        // Mantener consistencia entre desgloses y saldo total.
        const willUpdateBreakdown =
          rest.saldoInteres !== undefined || rest.saldoCapital !== undefined;

        if (willUpdateBreakdown) {
          const baseInteres =
            rest.saldoInteres !== undefined
              ? Math.max(0, Number(rest.saldoInteres) || 0)
              : Number(existing.saldoInteres || 0);
          const baseCapital =
            rest.saldoCapital !== undefined
              ? Math.max(0, Number(rest.saldoCapital) || 0)
              : Number(existing.saldoCapital || 0);
          dataToUpdate.saldoActual = Math.max(0, baseInteres + baseCapital);
        } else if (rest.saldoActual !== undefined) {
          // Si solo se fuerza saldoActual, asumimos que es capital (interés 0).
          dataToUpdate.saldoInteres = 0;
          dataToUpdate.saldoCapital = Math.max(0, Number(rest.saldoActual) || 0);
        }

        const updatedTarjeta = await tx.tarjetaCredito.update({
            where: { id },
            data: dataToUpdate
        });

        // Sincronización de Saldo (Integridad)
        if (
          rest.saldoActual !== undefined ||
          rest.saldoInteres !== undefined ||
          rest.saldoCapital !== undefined
        ) {
            await tx.cuenta.update({
                where: { id: existing.cuentaId },
                data: { saldo: Number(updatedTarjeta.saldoActual) }
            });
        }
        return updatedTarjeta;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Error actualizando tarjeta" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body ?? {};
    if (!id) return NextResponse.json({ error: "Id requerido" }, { status: 400 });

    const existing = await prisma.tarjetaCredito.findUnique({ where: { id } });
    if (!existing || existing.usuarioId !== user.id) {
      return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
    }

    // Eliminación en Cascada
    await prisma.$transaction(async (tx) => {
        // 1. Eliminar Movimientos
        await tx.tarjetaMovimiento.deleteMany({ where: { tarjetaId: id } });
        // 2. Eliminar Cuotas y Compras
        await tx.tarjetaCuota.deleteMany({ where: { tarjetaId: id } });
        await tx.tarjetaCompra.deleteMany({ where: { tarjetaId: id } });
        
        // 3. Eliminar la Tarjeta
        await tx.tarjetaCredito.delete({ where: { id } });

        // 4. (Opcional) Eliminar la Cuenta Sombra si ya no se necesita
        // Esto mantiene limpio el dashboard de cuentas
        // Verificamos si la cuenta tiene otras transacciones ajenas a la tarjeta antes de borrarla
        // Para simplificar, asumimos que si se borra la tarjeta, se borra su cuenta asociada
        try {
            await tx.cuenta.delete({ where: { id: existing.cuentaId } });
        } catch (e) {
            // Si falla (por constraints de otras tablas), no importa, dejamos la cuenta
            console.log("Nota: La cuenta asociada no se pudo eliminar o tenía otras relaciones.");
        }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al eliminar la tarjeta" }, { status: 500 });
  }
}
