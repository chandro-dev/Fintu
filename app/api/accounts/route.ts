import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

// GET /api/accounts -> lista cuentas con saldo
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const cuentas = await prisma.cuenta.findMany({
    where: { usuarioId: user.id },
    orderBy: { creadaEn: "desc" },
    include: { tipoCuenta: true, transacciones: false },
  });

  console.log("[api/accounts] found", cuentas.length, "for", user.id);
  return NextResponse.json(cuentas);
}

// POST /api/accounts -> crea una cuenta
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    nombre,
    tipoCuentaId,
    moneda = "USD",
    saldo = 0,
    limiteCredito,
    tasaApr,
    diaCorte,
    diaPago,
    pagoMinimo,
    plazoMeses,
    institucion,
    abiertaEn,
  } = body ?? {};

  if (!nombre || !tipoCuentaId) {
    return NextResponse.json(
      { error: "Nombre y tipoCuentaId son obligatorios" },
      { status: 400 },
    );
  }

  const cuenta = await prisma.cuenta.create({
    data: {
      usuarioId: user.id,
      nombre,
      tipoCuentaId,
      moneda,
      saldo,
      limiteCredito,
      tasaApr,
      diaCorte,
      diaPago,
      pagoMinimo,
      plazoMeses,
      institucion,
      abiertaEn: abiertaEn ? new Date(abiertaEn) : undefined,
    },
    include: { tipoCuenta: true },
  });

  return NextResponse.json(cuenta, { status: 201 });
}
