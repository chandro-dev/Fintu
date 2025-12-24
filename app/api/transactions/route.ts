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

const normalizeCategoriaIds = (raw: any): string[] => {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return Array.from(new Set(ids));
};

async function syncCategoriasPivot(
  tx: Prisma.TransactionClient,
  {
    usuarioId,
    transaccionIds,
    categoriaIds,
  }: { usuarioId: string; transaccionIds: string[]; categoriaIds: string[] },
) {
  await tx.transaccionCategoria.deleteMany({
    where: { usuarioId, transaccionId: { in: transaccionIds } },
  });
  if (categoriaIds.length === 0) return;
  await tx.transaccionCategoria.createMany({
    data: transaccionIds.flatMap((transaccionId) =>
      categoriaIds.map((categoriaId) => ({ usuarioId, transaccionId, categoriaId })),
    ),
    skipDuplicates: true,
  });
}

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
  const aplicadoInteres = Number((movimiento as any).aplicadoInteres ?? 0);
  const aplicadoCapital = Number((movimiento as any).aplicadoCapital ?? 0);
  const aplicadoTotal =
    aplicadoInteres + aplicadoCapital > 0 ? aplicadoInteres + aplicadoCapital : monto;

  // delta = cuánto hay que "deshacer" en saldoActual (increment) al borrar el movimiento:
  // - Compras/avances/interés suben deuda (+monto) => al borrar, bajamos deuda (-monto)
  // - Pagos bajan deuda (-aplicadoTotal) => al borrar, subimos deuda (+aplicadoTotal)
  let delta = -monto;
  if (movimiento.tipo === "PAGO" || movimiento.tipo === "CUOTA") delta = aplicadoTotal;

  await tx.tarjetaMovimiento.delete({ where: { id: movimiento.id } });

  await tx.tarjetaCredito.update({
    where: { id: movimiento.tarjetaId },
    data:
      movimiento.tipo === "INTERES"
        ? { saldoInteres: { increment: -monto }, saldoActual: { increment: -monto } }
        : movimiento.tipo === "COMPRA" || movimiento.tipo === "AVANCE"
          ? { saldoCapital: { increment: -monto }, saldoActual: { increment: -monto } }
          : movimiento.tipo === "PAGO" || movimiento.tipo === "CUOTA"
            ? {
                saldoInteres: { increment: aplicadoInteres },
                saldoCapital: { increment: aplicadoCapital || Math.max(0, aplicadoTotal - aplicadoInteres) },
                saldoActual: { increment: aplicadoTotal },
              }
            : { saldoCapital: { increment: -monto }, saldoActual: { increment: -monto } }, // AJUSTE: se trató como capital
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
        data: { saldoPendiente: { increment: aplicadoCapital || monto } },
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
        categoriasPivot: {
          select: {
            categoriaId: true,
            categoria: true,
          },
        },
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
    const categoriaIds = normalizeCategoriaIds(body?.categoriaIds);
    const categoriaIdPrimaria = categoriaIds[0] ?? categoriaIdFinal;
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
            categoriaId: categoriaIdPrimaria, tipoTransaccionId: tipoTransferenciaId,
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

        await syncCategoriasPivot(tx, {
          usuarioId: user.id,
          transaccionIds: [salida.id, entrada.id],
          categoriaIds:
            categoriaIds.length > 0
              ? categoriaIds
              : categoriaIdPrimaria
                ? [categoriaIdPrimaria]
                : [],
        });

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

        const txn = await prisma.$transaction(async (tx) => {
          const created = await tx.transaccion.create({
            data: {
              usuarioId: user.id,
              cuentaId,
              monto: Number(monto),
              moneda,
              direccion, // ENTRADA o SALIDA
              ocurrioEn: fecha,
              descripcion: descripcion || "Ajuste de saldo",
              categoriaId: categoriaIdPrimaria,
              // AQUÍ ASIGNAMOS EL TIPO CORRECTO PARA QUE EL SUMMARY LO IGNORE:
              tipoTransaccionId: tipoAjusteId,
              conciliada: true, // Los ajustes suelen nacer conciliados
            },
          });

          await syncCategoriasPivot(tx, {
            usuarioId: user.id,
            transaccionIds: [created.id],
            categoriaIds:
              categoriaIds.length > 0
                ? categoriaIds
                : categoriaIdPrimaria
                  ? [categoriaIdPrimaria]
                  : [],
          });

          await tx.cuenta.update({
            where: { id: cuentaId },
            data: { saldo: { increment: delta } },
          });

          return created;
        });

        return NextResponse.json(txn, { status: 201 });
    }

    // ========================================================================
    // CASO 3: TRANSACCIÓN NORMAL (Ingreso/Gasto)
    // ========================================================================
    if (!direccion) return NextResponse.json({ error: "Dirección requerida" }, { status: 400 });

    const tipoNormalId = await getTipoTransaccionId("NORMAL", "Normal", "Usuario");
    const delta = direccion === "ENTRADA" ? Number(monto) : -Number(monto);

    const txn = await prisma.$transaction(async (tx) => {
      const created = await tx.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId,
          monto: Number(monto),
          moneda,
          direccion,
          ocurrioEn: fecha,
          descripcion,
          categoriaId: categoriaIdPrimaria,
          tipoTransaccionId: tipoNormalId,
        },
      });

      await syncCategoriasPivot(tx, {
        usuarioId: user.id,
        transaccionIds: [created.id],
        categoriaIds:
          categoriaIds.length > 0
            ? categoriaIds
            : categoriaIdPrimaria
              ? [categoriaIdPrimaria]
              : [],
      });

      await tx.cuenta.update({
        where: { id: cuentaId },
        data: { saldo: { increment: delta } },
      });

      return created;
    });

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
    const incomingCategoriaIds = normalizeCategoriaIds(body?.categoriaIds);

    if (existing.transaccionRelacionadaId) {
      if (nextMonto !== Number(existing.monto) || nextCuenta !== existing.cuentaId) {
        return NextResponse.json({ error: "Para cambiar monto o cuenta de una transferencia, elimínela y créela de nuevo." }, { status: 400 });
      }

      const relatedId = existing.transaccionRelacionadaId;
      const categoriaIdFinal =
        incomingCategoriaIds[0] ??
        (body.hasOwnProperty("categoriaId")
          ? limpiarCategoriaId(categoriaId)
          : existing.categoriaId);

      const commonData = {
        descripcion: descripcion ?? existing.descripcion,
        ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
        categoriaId: categoriaIdFinal,
      };

      await prisma.$transaction(async (tx) => {
        await tx.transaccion.update({ where: { id: existing.id }, data: commonData });
        await tx.transaccion.update({
          where: { id: relatedId },
          data: commonData,
        });

        if (incomingCategoriaIds.length > 0 || body.hasOwnProperty("categoriaId")) {
          await syncCategoriasPivot(tx, {
            usuarioId: user.id,
            transaccionIds: [existing.id, relatedId],
            categoriaIds:
              incomingCategoriaIds.length > 0
                ? incomingCategoriaIds
                : categoriaIdFinal
                  ? [categoriaIdFinal]
                  : [],
          });
        }
      });

      return NextResponse.json({ ok: true, message: "Transferencia actualizada" });
    }

    const nextDireccion = direccion ?? existing.direccion;
    const oldDelta = existing.direccion === "ENTRADA" ? Number(existing.monto) : -Number(existing.monto);
    const newDelta = nextDireccion === "ENTRADA" ? nextMonto : -nextMonto;
    const categoriaIdFinal =
      incomingCategoriaIds[0] ??
      (body.hasOwnProperty("categoriaId")
        ? limpiarCategoriaId(categoriaId)
        : existing.categoriaId);

    const dataToUpdate = {
      cuentaId: nextCuenta, monto: nextMonto, direccion: nextDireccion,
      ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
      descripcion: descripcion ?? existing.descripcion, categoriaId: categoriaIdFinal,
    };

    if (existing.cuentaId === nextCuenta) {
      const diff = newDelta - oldDelta;
      await prisma.$transaction(async (tx) => {
        await tx.transaccion.update({ where: { id }, data: dataToUpdate });
        if (diff !== 0) {
          await tx.cuenta.update({
            where: { id: nextCuenta },
            data: { saldo: { increment: diff } },
          });
        }

        if (incomingCategoriaIds.length > 0 || body.hasOwnProperty("categoriaId")) {
          await syncCategoriasPivot(tx, {
            usuarioId: user.id,
            transaccionIds: [id],
            categoriaIds:
              incomingCategoriaIds.length > 0
                ? incomingCategoriaIds
                : categoriaIdFinal
                  ? [categoriaIdFinal]
                  : [],
          });
        }
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.transaccion.update({ where: { id }, data: dataToUpdate });
        await tx.cuenta.update({
          where: { id: existing.cuentaId },
          data: { saldo: { increment: -oldDelta } },
        });
        await tx.cuenta.update({
          where: { id: nextCuenta },
          data: { saldo: { increment: newDelta } },
        });

        if (incomingCategoriaIds.length > 0 || body.hasOwnProperty("categoriaId")) {
          await syncCategoriasPivot(tx, {
            usuarioId: user.id,
            transaccionIds: [id],
            categoriaIds:
              incomingCategoriaIds.length > 0
                ? incomingCategoriaIds
                : categoriaIdFinal
                  ? [categoriaIdFinal]
                  : [],
          });
        }
      });
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

          await tx.transaccionCategoria.deleteMany({
            where: { usuarioId: user.id, transaccionId: { in: [existing.id, pareja.id] } },
          });

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
      await tx.transaccionCategoria.deleteMany({
        where: { usuarioId: user.id, transaccionId: existing.id },
      });
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
