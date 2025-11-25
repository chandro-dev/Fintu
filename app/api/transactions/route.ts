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
