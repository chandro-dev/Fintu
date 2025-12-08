import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tarjetas = await prisma.tarjetaCredito.findMany({
    where: { usuarioId: user.id },
    orderBy: { creadaEn: "desc" },
    include: { cuenta: true },
  });
  return NextResponse.json(tarjetas);
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const {
    nombre,
    cuentaId,
    emisor,
    moneda = "USD",
    cupoTotal = 0,
    tasaEfectivaAnual,
    diaCorte,
    diaPago,
    pagoMinimoPct = 0,
  } = body ?? {};

  if (!nombre || !cuentaId || !tasaEfectivaAnual || !diaCorte || !diaPago) {
    return NextResponse.json(
      { error: "nombre, cuentaId, tasaEfectivaAnual, diaCorte y diaPago son obligatorios" },
      { status: 400 },
    );
  }

  const cuenta = await prisma.cuenta.findFirst({
    where: { id: cuentaId, usuarioId: user.id },
  });
  if (!cuenta) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

  const tarjeta = await prisma.tarjetaCredito.create({
    data: {
      usuarioId: user.id,
      cuentaId,
      nombre,
      emisor,
      moneda,
      cupoTotal,
      saldoActual: cuenta.saldo,
      tasaEfectivaAnual,
      diaCorte,
      diaPago,
      pagoMinimoPct,
    },
  });
  return NextResponse.json(tarjeta, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { id, ...rest } = body ?? {};
  if (!id) return NextResponse.json({ error: "Id requerido" }, { status: 400 });

  const existing = await prisma.tarjetaCredito.findUnique({ where: { id } });
  if (!existing || existing.usuarioId !== user.id) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }

  const updated = await prisma.tarjetaCredito.update({
    where: { id },
    data: {
      nombre: rest.nombre ?? undefined,
      emisor: rest.emisor ?? undefined,
      moneda: rest.moneda ?? undefined,
      cupoTotal: rest.cupoTotal ?? undefined,
      saldoActual: rest.saldoActual ?? undefined,
      tasaEfectivaAnual: rest.tasaEfectivaAnual ?? undefined,
      diaCorte: rest.diaCorte ?? undefined,
      diaPago: rest.diaPago ?? undefined,
      pagoMinimoPct: rest.pagoMinimoPct ?? undefined,
      estado: rest.estado ?? undefined,
      cerradaEn: rest.cerradaEn ? new Date(rest.cerradaEn) : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { id } = body ?? {};
  if (!id) return NextResponse.json({ error: "Id requerido" }, { status: 400 });

  const existing = await prisma.tarjetaCredito.findUnique({ where: { id } });
  if (!existing || existing.usuarioId !== user.id) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.tarjetaMovimiento.deleteMany({ where: { tarjetaId: id } }),
    prisma.tarjetaCuota.deleteMany({ where: { tarjetaId: id } }),
    prisma.tarjetaCredito.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
