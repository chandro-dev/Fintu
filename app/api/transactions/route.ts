import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

// GET /api/transactions -> últimas transacciones del usuario
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const transacciones = await prisma.transaccion.findMany({
    where: { usuarioId: user.id },
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

  console.log("[api/transactions] found", transacciones.length, "for", user.id);
  return NextResponse.json(transacciones);
}

// POST /api/transactions -> crear transacción
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cuentaId,
    monto,
    direccion,
    moneda = "USD",
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

  const delta = direccion === "ENTRADA" ? Number(monto) : -Number(monto);

  const [txn] = await prisma.$transaction([
    prisma.transaccion.create({
      data: {
        usuarioId: user.id,
        cuentaId,
        monto,
        moneda,
        direccion,
        ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : new Date(),
        descripcion,
        categoriaId,
        referencia,
        etiquetas,
        conciliada,
      },
    }),
    prisma.cuenta.update({
      where: { id: cuentaId, usuarioId: user.id },
      data: { saldo: { increment: delta } },
    }),
  ]);

  return NextResponse.json(txn, { status: 201 });
}

// PATCH /api/transactions -> actualizar transacción y re-balancear cuentas si cambian monto/direccion/cuenta
export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

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

  const existing = await prisma.transaccion.findUnique({ where: { id, usuarioId: user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Transaccion no encontrada" }, { status: 404 });
  }

  const nextCuentaId = cuentaId ?? existing.cuentaId;
  const nextDireccion = direccion ?? existing.direccion;
  const nextMonto = monto ?? existing.monto;

  if (!nextCuentaId || !nextMonto || !nextDireccion) {
    return NextResponse.json({ error: "Cuenta, monto y direccion son obligatorios" }, { status: 400 });
  }

  const oldDelta = existing.direccion === "ENTRADA" ? Number(existing.monto) : -Number(existing.monto);
  const newDelta = nextDireccion === "ENTRADA" ? Number(nextMonto) : -Number(nextMonto);

  const dataToUpdate = {
    cuentaId: nextCuentaId,
    monto: nextMonto,
    moneda: moneda ?? existing.moneda,
    direccion: nextDireccion,
    ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : existing.ocurrioEn,
    descripcion: descripcion ?? existing.descripcion,
    categoriaId: categoriaId ?? existing.categoriaId,
    referencia: referencia ?? existing.referencia,
    etiquetas: etiquetas ?? existing.etiquetas,
    conciliada: conciliada ?? existing.conciliada,
  };

  let updated;
  if (existing.cuentaId === nextCuentaId) {
    const diff = newDelta - oldDelta;
    [updated] = await prisma.$transaction([
      prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
      prisma.cuenta.update({
        where: { id: nextCuentaId, usuarioId: user.id },
        data: { saldo: { increment: diff } },
      }),
    ]);
  } else {
    [updated] = await prisma.$transaction([
      prisma.transaccion.update({ where: { id }, data: dataToUpdate }),
      prisma.cuenta.update({
        where: { id: existing.cuentaId, usuarioId: user.id },
        data: { saldo: { increment: -oldDelta } },
      }),
      prisma.cuenta.update({
        where: { id: nextCuentaId, usuarioId: user.id },
        data: { saldo: { increment: newDelta } },
      }),
    ]);
  }

  return NextResponse.json(updated);
}

// DELETE /api/transactions -> elimina transacción y revierte su efecto en el saldo
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
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
}
