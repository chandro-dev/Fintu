import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

// Helper para obtener el tipo de cuenta adecuado (asume que tienes un tipo 'TARJETA' o 'PASIVO' en tu DB)
async function getTipoCuentaTarjeta() {
  // Intenta buscar por código 'TARJETA', 'CREDITO' o el primero que encuentre
  const tipo = await prisma.tipoCuenta.findFirst({
    where: { 
      OR: [{ codigo: "TARJETA" }, { codigo: "CREDITO" }, { codigo: "PASIVO" }] 
    }
  });
  
  // Si no existe, busca cualquiera o lanza error (ajusta según tus semillas de BD)
  return tipo || await prisma.tipoCuenta.findFirst();
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
      saldoInicial = 0, // Nueva propiedad opcional: si traes deuda de antes
      cuentaId, // Opcional: si el usuario ya creó la cuenta manual antes
    } = body ?? {};

    // Validaciones básicas
    if (!nombre || !tasaEfectivaAnual || !diaCorte || !diaPago) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (nombre, TEA, corte, pago)" },
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
              saldo: Number(saldoInicial), // La deuda inicial
              institucion: emisor,
              tipoCuentaId: tipoCuenta.id,
            }
         });
         cuentaAsociadaId = nuevaCuenta.id;
      } else {
         // Si el usuario eligió una cuenta existente, verificamos que sea suya
         const cuentaExistente = await tx.cuenta.findFirst({
            where: { id: cuentaId, usuarioId: user.id }
         });
         if (!cuentaExistente) throw new Error("La cuenta seleccionada no existe");
         
         // Opcional: Actualizar el saldo de esa cuenta al saldo inicial indicado
         if (Number(saldoInicial) !== Number(cuentaExistente.saldo)) {
             await tx.cuenta.update({
                 where: { id: cuentaAsociadaId },
                 data: { saldo: Number(saldoInicial) }
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
          cupoTotal: Number(cupoTotal),
          saldoActual: Number(saldoInicial), // ¡IMPORTANTE! Inicia con la deuda indicada, no hereda mágicamente
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
    if (rest.saldoActual !== undefined) dataToUpdate.saldoActual = Number(rest.saldoActual);
    if (rest.tasaEfectivaAnual !== undefined) dataToUpdate.tasaEfectivaAnual = Number(rest.tasaEfectivaAnual);
    if (rest.diaCorte !== undefined) dataToUpdate.diaCorte = Number(rest.diaCorte);
    if (rest.diaPago !== undefined) dataToUpdate.diaPago = Number(rest.diaPago);
    if (rest.pagoMinimoPct !== undefined) dataToUpdate.pagoMinimoPct = Number(rest.pagoMinimoPct);
    if (rest.cerradaEn) dataToUpdate.cerradaEn = new Date(rest.cerradaEn);

    // Transacción: Si actualizo el saldo de la tarjeta, debo actualizar la cuenta sombra
    const result = await prisma.$transaction(async (tx) => {
        const updatedTarjeta = await tx.tarjetaCredito.update({
            where: { id },
            data: dataToUpdate
        });

        // Sincronización de Saldo (Integridad)
        if (rest.saldoActual !== undefined) {
            await tx.cuenta.update({
                where: { id: existing.cuentaId },
                data: { saldo: Number(rest.saldoActual) }
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