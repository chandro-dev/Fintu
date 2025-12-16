import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { getTipoTransaccionId } from "@/lib/tipoTransaccion";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const limpiarCategoriaId = (id: any) => {
  if (!id || id === "") return null;
  return id;
};

// GET /api/transactions
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // 💡 MEJORA: Parsear Query Params para filtros
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const month = searchParams.get("month"); // Formato "YYYY-MM"
  const limit = Number(searchParams.get("limit")) || 50;

  try {
    const whereClause: any = { usuarioId: user.id };

    // Filtro por Cuenta
    if (accountId) whereClause.cuentaId = accountId;

    // 💡 MEJORA: Filtro por Mes (esencial para Dashboard)
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
        
        // 👇 ESTO ES LO QUE TIENES AHORA (Correcto)
        cuenta: {
          select: {
            nombre: true,
            moneda: true,
            tipoCuentaId: true,
            tipoCuenta: { select: { codigo: true, nombre: true } },
          },
        },

        // 👇 ESTO ES LO QUE TE FALTA. AGRÉGALO AQUÍ:
        tipoTransaccion: {
          select: {
            codigo: true, // Necesitamos que devuelva "NORMAL", "TRANSFERENCIA" o "AJUSTE"
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
    } = body ?? {};

    if (!cuentaId || !monto) {
      return NextResponse.json({ error: "Cuenta y monto requeridos" }, { status: 400 });
    }

    const categoriaIdFinal = limpiarCategoriaId(categoriaId);
    const fecha = ocurrioEn ? new Date(ocurrioEn) : new Date();

    // 💡 LÓGICA TRANSFERENCIA (Sin cambios mayores, ya estaba bien)
    if (isTransferencia && cuentaDestinoId) {
      if (cuentaId === cuentaDestinoId) {
        return NextResponse.json({ error: "Cuentas deben ser diferentes" }, { status: 400 });
      }

      const tipoTransferenciaId = await getTipoTransaccionId("TRANSFERENCIA", "Transferencia", "Interna");

      const result = await prisma.$transaction(async (tx) => {
        // Salida
        const salida = await tx.transaccion.create({
          data: {
            usuarioId: user.id, cuentaId, monto: Number(monto), moneda, direccion: "SALIDA",
            ocurrioEn: fecha, descripcion: descripcion || "Transferencia enviada",
            categoriaId: categoriaIdFinal, tipoTransaccionId: tipoTransferenciaId,
          }
        });
        // Entrada
        const entrada = await tx.transaccion.create({
          data: {
            usuarioId: user.id, cuentaId: cuentaDestinoId, monto: Number(monto), moneda, direccion: "ENTRADA",
            ocurrioEn: fecha, descripcion: descripcion || "Transferencia recibida",
            transaccionRelacionadaId: salida.id, tipoTransaccionId: tipoTransferenciaId,
          }
        });
        // Link bidireccional
        await tx.transaccion.update({ where: { id: salida.id }, data: { transaccionRelacionadaId: entrada.id } });
        // Saldos
        await tx.cuenta.update({ where: { id: cuentaId }, data: { saldo: { decrement: Number(monto) } } });
        await tx.cuenta.update({ where: { id: cuentaDestinoId }, data: { saldo: { increment: Number(monto) } } });

        return salida;
      });
      return NextResponse.json(result, { status: 201 });
    }

    // 💡 LÓGICA NORMAL
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

    // 💡 MEJORA: Manejo Inteligente de Transferencias
    if (existing.transaccionRelacionadaId) {
      // Si intentan cambiar Monto o Cuenta en una transferencia, bloqueamos (demasiado complejo de reconciliar)
      if (nextMonto !== Number(existing.monto) || nextCuenta !== existing.cuentaId) {
        return NextResponse.json({ error: "Para cambiar monto o cuenta de una transferencia, elimínela y créela de nuevo." }, { status: 400 });
      }

      // PERO, si solo cambian descripción, fecha o categoría, permitimos el cambio en AMBAS transacciones
      // Esto mejora mucho la UX.
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

    // 💡 LÓGICA NORMAL (Actualización de Saldo si cambia monto/cuenta)
    const nextDireccion = direccion ?? existing.direccion;
    const oldDelta = existing.direccion === "ENTRADA" ? Number(existing.monto) : -Number(existing.monto);
    const newDelta = nextDireccion === "ENTRADA" ? nextMonto : -nextMonto;
    const categoriaIdFinal = body.hasOwnProperty('categoriaId') ? limpiarCategoriaId(categoriaId) : existing.categoriaId;

    const dataToUpdate = {
      cuentaId: nextCuenta, monto: nextMonto, direccion: nextDireccion,
      ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
      descripcion: descripcion ?? existing.descripcion, categoriaId: categoriaIdFinal,
    };

    // Caso 1: Misma cuenta, solo cambia monto/dirección
    if (existing.cuentaId === nextCuenta) {
      const diff = newDelta - oldDelta;
      await prisma.$transaction([
        prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
        ...(diff !== 0 ? [prisma.cuenta.update({ where: { id: nextCuenta }, data: { saldo: { increment: diff } } })] : [])
      ]);
    } 
    // Caso 2: Cambio de cuenta (Revertir saldo en antigua, aplicar en nueva)
    else {
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

    // 💡 LÓGICA TRANSFERENCIA (Borrar en cascada y revertir ambos saldos)
    if (existing.transaccionRelacionadaId) {
      const pareja = await prisma.transaccion.findUnique({ where: { id: existing.transaccionRelacionadaId }});
      
      if (pareja) {
        const delta1 = existing.direccion === "ENTRADA" ? -Number(existing.monto) : Number(existing.monto);
        const delta2 = pareja.direccion === "ENTRADA" ? -Number(pareja.monto) : Number(pareja.monto);

        await prisma.$transaction([
          prisma.transaccion.delete({ where: { id: existing.id } }),
          prisma.transaccion.delete({ where: { id: pareja.id } }),
          prisma.cuenta.update({ where: { id: existing.cuentaId }, data: { saldo: { increment: delta1 } } }),
          prisma.cuenta.update({ where: { id: pareja.cuentaId }, data: { saldo: { increment: delta2 } } })
        ]);
        return NextResponse.json({ ok: true });
      }
    }

    // Lógica Normal
    const delta = existing.direccion === "ENTRADA" ? -Number(existing.monto) : Number(existing.monto);
    await prisma.$transaction([
      prisma.transaccion.delete({ where: { id } }),
      prisma.cuenta.update({ where: { id: existing.cuentaId }, data: { saldo: { increment: delta } } })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE] Error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}