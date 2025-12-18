import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { getTipoTransaccionId } from "@/lib/tipoTransaccion";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const limpiarCategoriaId = (id: any) => {
  if (!id || id === "") return null;
  return id;
};

async function cleanupTarjetaMovimiento(
  tx: Prisma.TransactionClient,
  transaccionId: string
) {
  const movimiento = await tx.tarjetaMovimiento.findFirst({
    where: { transaccionId },
    include: { tarjeta: { select: { id: true, cuentaId: true } } },
  });
  if (!movimiento) return false;

  const monto = Number(movimiento.monto);
  let delta = -monto;
  if (movimiento.tipo === "PAGO" || movimiento.tipo === "CUOTA") {
    delta = monto;
  } else if (movimiento.tipo === "AJUSTE") {
    delta = -monto;
  }

  await tx.tarjetaMovimiento.delete({ where: { id: movimiento.id } });

  await tx.tarjetaCredito.update({
    where: { id: movimiento.tarjetaId },
    data: { saldoActual: { increment: delta } },
  });
  await tx.cuenta.update({
    where: { id: movimiento.tarjeta.cuentaId },
    data: { saldo: { increment: delta } },
  });

  if (movimiento.tipo === "COMPRA") {
    if (movimiento.cuotaId) {
      await tx.tarjetaCuota
        .deleteMany({ where: { id: movimiento.cuotaId } })
        .catch(() => null);
    }
    if (movimiento.compraId) {
      await tx.tarjetaCompra
        .deleteMany({ where: { id: movimiento.compraId } })
        .catch(() => null);
    }
  }

  if (
    (movimiento.tipo === "PAGO" || movimiento.tipo === "CUOTA") &&
    movimiento.compraId
  ) {
    await tx.tarjetaCompra
      .update({
        where: { id: movimiento.compraId },
        data: { saldoPendiente: { increment: monto } },
      })
      .catch(() => null);
  }

  return true;
}

// GET /api/transactions
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const month = searchParams.get("month");
  const limit = Number(searchParams.get("limit")) || 50;

  try {
    const whereClause: any = { usuarioId: user.id };

    if (accountId) whereClause.cuentaId = accountId;

    if (month) {
      const [year, m] = month.split("-");
      const startDate = new Date(Number(year), Number(m) - 1, 1);
      const endDate = new Date(Number(year), Number(m), 0, 23, 59, 59);
      whereClause.ocurrioEn = { gte: startDate, lte: endDate };
    }

    const transacciones = await prisma.transaccion.findMany({
      where: whereClause,
      orderBy: { ocurrioEn: "desc" },
      take: limit,
      include: {
        categoria: true,
        cuenta: {
          select: {
            nombre: true,
            moneda: true,
            tipoCuentaId: true,
            tipoCuenta: { select: { codigo: true, nombre: true } },
          },
        },
        // Incluimos el tipo para poder filtrar en el frontend
        tipoTransaccion: {
          select: {
            codigo: true,
            nombre: true
          }
        }
      },
    });

    return NextResponse.json(transacciones);
  } catch (error) {
    console.error("[GET Transaction] Error:", error);
    return NextResponse.json({ error: "Error al obtener transacciones" }, { status: 500 });
  }
}

// POST /api/transactions
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      cuentaId,
      cuentaDestinoId,
      monto,
      direccion,
      moneda = "COP",
      ocurrioEn,
      descripcion,
      categoriaId,
      isTransferencia,
      isAjuste, // <--- 1. Extraemos la bandera
    } = body ?? {};

    if (!cuentaId || !monto) {
      return NextResponse.json({ error: "Cuenta y monto requeridos" }, { status: 400 });
    }

    const categoriaIdFinal = limpiarCategoriaId(categoriaId);
    const fecha = ocurrioEn ? new Date(ocurrioEn) : new Date();

    // ========================================================================
    // CASO 1: TRANSFERENCIA
    // ========================================================================
    if (isTransferencia && cuentaDestinoId) {
      if (cuentaId === cuentaDestinoId) {
        return NextResponse.json({ error: "Cuentas deben ser diferentes" }, { status: 400 });
      }

      const tipoTransferenciaId = await getTipoTransaccionId("TRANSFERENCIA", "Transferencia", "Interna");

      const result = await prisma.$transaction(async (tx) => {
        const salida = await tx.transaccion.create({
          data: {
            usuarioId: user.id, cuentaId, monto: Number(monto), moneda, direccion: "SALIDA",
            ocurrioEn: fecha, descripcion: descripcion || "Transferencia enviada",
            categoriaId: categoriaIdFinal, tipoTransaccionId: tipoTransferenciaId,
          }
        });
        const entrada = await tx.transaccion.create({
          data: {
            usuarioId: user.id, cuentaId: cuentaDestinoId, monto: Number(monto), moneda, direccion: "ENTRADA",
            ocurrioEn: fecha, descripcion: descripcion || "Transferencia recibida",
            transaccionRelacionadaId: salida.id, tipoTransaccionId: tipoTransferenciaId,
          }
        });
        await tx.transaccion.update({ where: { id: salida.id }, data: { transaccionRelacionadaId: entrada.id } });
        await tx.cuenta.update({ where: { id: cuentaId }, data: { saldo: { decrement: Number(monto) } } });
        await tx.cuenta.update({ where: { id: cuentaDestinoId }, data: { saldo: { increment: Number(monto) } } });

        return salida;
      });
      return NextResponse.json(result, { status: 201 });
    }

    // ========================================================================
    // CASO 2: AJUSTE DE SALDO (NUEVO)
    // ========================================================================
    if (isAjuste) {
        // Obtenemos el ID del tipo "AJUSTE" (lo crea si no existe)
        const tipoAjusteId = await getTipoTransaccionId(
            "AJUSTE",
            "Ajuste de Saldo",
            "Corrección manual del saldo"
        );
        
        const delta = direccion === "ENTRADA" ? Number(monto) : -Number(monto);

        const [txn] = await prisma.$transaction([
            prisma.transaccion.create({
                data: {
                    usuarioId: user.id,
                    cuentaId,
                    monto: Number(monto),
                    moneda,
                    direccion, // ENTRADA o SALIDA
                    ocurrioEn: fecha,
                    descripcion: descripcion || "Ajuste de saldo",
                    categoriaId: categoriaIdFinal,
                    // AQUÍ ASIGNAMOS EL TIPO CORRECTO PARA QUE EL SUMMARY LO IGNORE:
                    tipoTransaccionId: tipoAjusteId, 
                    conciliada: true, // Los ajustes suelen nacer conciliados
                },
            }),
            prisma.cuenta.update({
                where: { id: cuentaId },
                data: { saldo: { increment: delta } },
            }),
        ]);

        return NextResponse.json(txn, { status: 201 });
    }

    // ========================================================================
    // CASO 3: TRANSACCIÓN NORMAL (Ingreso/Gasto)
    // ========================================================================
    if (!direccion) return NextResponse.json({ error: "Dirección requerida" }, { status: 400 });

    const tipoNormalId = await getTipoTransaccionId("NORMAL", "Normal", "Usuario");
    const delta = direccion === "ENTRADA" ? Number(monto) : -Number(monto);

    const [txn] = await prisma.$transaction([
      prisma.transaccion.create({
        data: {
          usuarioId: user.id, cuentaId, monto: Number(monto), moneda, direccion,
          ocurrioEn: fecha, descripcion, categoriaId: categoriaIdFinal, tipoTransaccionId: tipoNormalId,
        },
      }),
      prisma.cuenta.update({
        where: { id: cuentaId },
        data: { saldo: { increment: delta } },
      }),
    ]);

    return NextResponse.json(txn, { status: 201 });

  } catch (error) {
    console.error("[POST] Error:", error);
    return NextResponse.json({ error: "Error creando transacción" }, { status: 500 });
  }
}

// PATCH /api/transactions
export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, cuentaId, monto, direccion, ocurrioEn, descripcion, categoriaId } = body;

    const existing = await prisma.transaccion.findUnique({ where: { id, usuarioId: user.id } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const nextMonto = monto !== undefined ? Number(monto) : Number(existing.monto);
    const nextCuenta = cuentaId ?? existing.cuentaId;

    if (existing.transaccionRelacionadaId) {
      if (nextMonto !== Number(existing.monto) || nextCuenta !== existing.cuentaId) {
        return NextResponse.json({ error: "Para cambiar monto o cuenta de una transferencia, elimínela y créela de nuevo." }, { status: 400 });
      }

      const commonData = {
        descripcion: descripcion ?? existing.descripcion,
        ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
        categoriaId: body.hasOwnProperty('categoriaId') ? limpiarCategoriaId(categoriaId) : existing.categoriaId,
      };

      await prisma.$transaction([
        prisma.transaccion.update({ where: { id: existing.id }, data: commonData }),
        prisma.transaccion.update({ where: { id: existing.transaccionRelacionadaId }, data: commonData })
      ]);

      return NextResponse.json({ ok: true, message: "Transferencia actualizada" });
    }

    const nextDireccion = direccion ?? existing.direccion;
    const oldDelta = existing.direccion === "ENTRADA" ? Number(existing.monto) : -Number(existing.monto);
    const newDelta = nextDireccion === "ENTRADA" ? nextMonto : -nextMonto;
    const categoriaIdFinal = body.hasOwnProperty('categoriaId') ? limpiarCategoriaId(categoriaId) : existing.categoriaId;

    const dataToUpdate = {
      cuentaId: nextCuenta, monto: nextMonto, direccion: nextDireccion,
      ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
      descripcion: descripcion ?? existing.descripcion, categoriaId: categoriaIdFinal,
    };

    if (existing.cuentaId === nextCuenta) {
      const diff = newDelta - oldDelta;
      await prisma.$transaction([
        prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
        ...(diff !== 0 ? [prisma.cuenta.update({ where: { id: nextCuenta }, data: { saldo: { increment: diff } } })] : [])
      ]);
    } else {
      await prisma.$transaction([
        prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
        prisma.cuenta.update({ where: { id: existing.cuentaId }, data: { saldo: { increment: -oldDelta } } }),
        prisma.cuenta.update({ where: { id: nextCuenta }, data: { saldo: { increment: newDelta } } }),
      ]);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("[PATCH] Error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE /api/transactions
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const { id } = await request.json();
    const existing = await prisma.transaccion.findUnique({ where: { id, usuarioId: user.id } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (existing.transaccionRelacionadaId) {
      const pareja = await prisma.transaccion.findUnique({ where: { id: existing.transaccionRelacionadaId }});
      
      if (pareja) {
        const delta1 = existing.direccion === "ENTRADA" ? -Number(existing.monto) : Number(existing.monto);
        const delta2 = pareja.direccion === "ENTRADA" ? -Number(pareja.monto) : Number(pareja.monto);

        await prisma.$transaction(async (tx) => {
          const handled1 = await cleanupTarjetaMovimiento(tx, existing.id);
          const handled2 = await cleanupTarjetaMovimiento(tx, pareja.id);

          await tx.transaccion.delete({ where: { id: existing.id } });
          await tx.transaccion.delete({ where: { id: pareja.id } });

          if (!handled1) {
            await tx.cuenta.update({
              where: { id: existing.cuentaId },
              data: { saldo: { increment: delta1 } },
            });
          }
          if (!handled2) {
            await tx.cuenta.update({
              where: { id: pareja.cuentaId },
              data: { saldo: { increment: delta2 } },
            });
          }
        });
        return NextResponse.json({ ok: true });
      }
    }

    const delta = existing.direccion === "ENTRADA" ? -Number(existing.monto) : Number(existing.monto);
    await prisma.$transaction(async (tx) => {
      const handled = await cleanupTarjetaMovimiento(tx, existing.id);
      await tx.transaccion.delete({ where: { id } });
      if (!handled) {
        await tx.cuenta.update({
          where: { id: existing.cuentaId },
          data: { saldo: { increment: delta } },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE] Error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
