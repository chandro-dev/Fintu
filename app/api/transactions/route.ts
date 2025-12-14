import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { getTipoTransaccionId } from "@/lib/tipoTransaccion";

// Configuraciones para evitar caché estática en Vercel/Next.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Helper para convertir strings vacíos a null.
 * Evita el error de Foreign Key Constraint en Prisma.
 */
const limpiarCategoriaId = (id: any) => {
  if (!id || id === "") return null;
  return id;
};

// GET /api/transactions
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const transacciones = await prisma.transaccion.findMany({
      where: {
        usuarioId: user.id,
        tipoTransaccion: { codigo: "NORMAL" },
      },
      orderBy: { ocurrioEn: "desc" },
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
      },
      take: 50,
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
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      cuentaId,
      monto,
      direccion,
      moneda = "COP",
      ocurrioEn,
      descripcion,
      categoriaId,
      referencia,
      etiquetas = [],
      conciliada = false,
    } = body ?? {};

    if (!cuentaId || !monto || !direccion) {
      return NextResponse.json(
        { error: "Cuenta, monto y direccion son obligatorios" },
        { status: 400 },
      );
    }

    const categoriaIdFinal = limpiarCategoriaId(categoriaId);
    const delta = direccion === "ENTRADA" ? Number(monto) : -Number(monto);

    const tipoNormalId = await getTipoTransaccionId(
      "NORMAL",
      "Transacción normal",
      "Movimiento registrado por el usuario",
    );

    const existingCuenta = await prisma.cuenta.findUnique({
      where: { id: cuentaId, usuarioId: user.id },
    });

    if (!existingCuenta) {
      return NextResponse.json(
        { error: "Cuenta no encontrada para este usuario" },
        { status: 404 },
      );
    }

    const [txn] = await prisma.$transaction([
      prisma.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId,
          monto: Number(monto),
          moneda,
          direccion,
          ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : new Date(),
          descripcion,
          categoriaId: categoriaIdFinal,
          referencia,
          etiquetas,
          tipoTransaccionId: tipoNormalId,
          conciliada,
        },
      }),
      prisma.cuenta.update({
        where: { id: cuentaId },
        data: { saldo: { increment: delta } },
      }),
    ]);

    return NextResponse.json(txn, { status: 201 });
  } catch (error) {
    console.error("[POST Transaction] Error:", error);
    return NextResponse.json({ error: "Error al crear la transacción" }, { status: 500 });
  }
}

// PATCH /api/transactions
export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      cuentaId,
      monto,
      direccion,
      moneda,
      ocurrioEn,
      descripcion,
      categoriaId,
      referencia,
      etiquetas,
      conciliada,
    } = body ?? {};

    if (!id) {
      return NextResponse.json({ error: "Id de transaccion es obligatorio" }, { status: 400 });
    }

    const existing = await prisma.transaccion.findUnique({ 
        where: { id, usuarioId: user.id } 
    });
    
    if (!existing) {
      return NextResponse.json({ error: "Transaccion no encontrada" }, { status: 404 });
    }

    const nextCuentaId = cuentaId ?? existing.cuentaId;
    const nextDireccion = direccion ?? existing.direccion;
    const nextMonto = monto !== undefined ? Number(monto) : Number(existing.monto);

    if (!nextCuentaId || !nextMonto || !nextDireccion) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const oldDelta = existing.direccion === "ENTRADA" ? Number(existing.monto) : -Number(existing.monto);
    const newDelta = nextDireccion === "ENTRADA" ? nextMonto : -nextMonto;

    const categoriaIdFinal = body.hasOwnProperty('categoriaId') 
        ? limpiarCategoriaId(categoriaId) 
        : existing.categoriaId;

    const dataToUpdate = {
      cuentaId: nextCuentaId,
      monto: nextMonto,
      moneda: moneda ?? existing.moneda,
      direccion: nextDireccion,
      ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
      descripcion: descripcion ?? existing.descripcion,
      categoriaId: categoriaIdFinal,
      referencia: referencia ?? existing.referencia,
      etiquetas: etiquetas ?? existing.etiquetas,
      conciliada: conciliada ?? existing.conciliada,
    };

    let updated;
    
    // CASO 1: Misma cuenta
    if (existing.cuentaId === nextCuentaId) {
      const diff = newDelta - oldDelta;
      
      // 🔴 CORRECCIÓN AQUÍ: Definimos el array como 'any[]' para permitir tipos mixtos
      const operations: any[] = [
        prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
      ];

      if (diff !== 0) {
        operations.push(
          prisma.cuenta.update({
            where: { id: nextCuentaId, usuarioId: user.id },
            data: { saldo: { increment: diff } },
          })
        );
      }

      // Ejecutamos la transacción y tomamos el primer resultado (la transacción actualizada)
      const results = await prisma.$transaction(operations);
      updated = results[0];

    } else {
      // CASO 2: Cambio de cuenta
      const results = await prisma.$transaction([
        prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
        // Revertir saldo en cuenta vieja
        prisma.cuenta.update({
          where: { id: existing.cuentaId, usuarioId: user.id },
          data: { saldo: { increment: -oldDelta } },
        }),
        // Aplicar saldo en cuenta nueva
        prisma.cuenta.update({
          where: { id: nextCuentaId, usuarioId: user.id },
          data: { saldo: { increment: newDelta } },
        }),
      ]);
      updated = results[0];
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === 'P2003') {
        return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
    }
    console.error("[PATCH Transaction] Error:", error);
    return NextResponse.json({ error: "Error al actualizar transacción" }, { status: 500 });
  }
}

// DELETE /api/transactions
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body ?? {};
    if (!id) {
      return NextResponse.json({ error: "Id de transaccion es obligatorio" }, { status: 400 });
    }

    const existing = await prisma.transaccion.findUnique({ where: { id, usuarioId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Transaccion no encontrada" }, { status: 404 });
    }

    const delta = existing.direccion === "ENTRADA" ? -Number(existing.monto) : Number(existing.monto);

    await prisma.$transaction([
      prisma.transaccion.delete({ where: { id } }),
      prisma.cuenta.update({
        where: { id: existing.cuentaId, usuarioId: user.id },
        data: { saldo: { increment: delta } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE Transaction] Error:", error);
    return NextResponse.json({ error: "Error al eliminar transacción" }, { status: 500 });
  }
}