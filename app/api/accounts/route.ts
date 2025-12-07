import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { getTipoTransaccionId } from "@/lib/tipoTransaccion";

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
      abiertaEn: abiertaEn ? new Date(abiertaEn) : new Date(),
    },
    include: { tipoCuenta: true },
  });

  return NextResponse.json(cuenta, { status: 201 });
}

// PATCH /api/accounts -> actualiza una cuenta existente del usuario
export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    nombre,
    tipoCuentaId,
    moneda,
    limiteCredito,
    tasaApr,
    diaCorte,
    diaPago,
    pagoMinimo,
    plazoMeses,
    institucion,
    abiertaEn,
    cerradaEn,
    ajusteSaldo,
    ajusteDescripcion,
  } = body ?? {};

  if (!id) {
    return NextResponse.json(
      { error: "Id de cuenta es obligatorio" },
      { status: 400 },
    );
  }

  const existing = await prisma.cuenta.findUnique({ where: { id } });
  if (!existing || existing.usuarioId !== user.id) {
    return NextResponse.json(
      { error: "Cuenta no encontrada" },
      { status: 404 },
    );
  }

  const dataToUpdate: Prisma.CuentaUpdateInput = {};
  if (nombre !== undefined) dataToUpdate.nombre = nombre;
  if (tipoCuentaId !== undefined) {
    dataToUpdate.tipoCuenta = { connect: { id: tipoCuentaId } };
  }
  if (moneda !== undefined) dataToUpdate.moneda = moneda;
  if (limiteCredito !== undefined) dataToUpdate.limiteCredito = limiteCredito;
  if (tasaApr !== undefined) dataToUpdate.tasaApr = tasaApr;
  if (diaCorte !== undefined) dataToUpdate.diaCorte = diaCorte;
  if (diaPago !== undefined) dataToUpdate.diaPago = diaPago;
  if (pagoMinimo !== undefined) dataToUpdate.pagoMinimo = pagoMinimo;
  if (plazoMeses !== undefined) dataToUpdate.plazoMeses = plazoMeses;
  if (institucion !== undefined) dataToUpdate.institucion = institucion;
  if (abiertaEn !== undefined)
    dataToUpdate.abiertaEn = abiertaEn ? new Date(abiertaEn) : null;
  if (cerradaEn !== undefined)
    dataToUpdate.cerradaEn = cerradaEn ? new Date(cerradaEn) : null;

  const ajusteValorRaw =
    ajusteSaldo !== undefined && ajusteSaldo !== null
      ? Number(ajusteSaldo)
      : 0;
  if (Number.isNaN(ajusteValorRaw)) {
    return NextResponse.json(
      { error: "Ajuste de saldo invalido" },
      { status: 400 },
    );
  }
  const hasAdjustment = ajusteValorRaw !== 0;

  if (!hasAdjustment && Object.keys(dataToUpdate).length === 0) {
    return NextResponse.json(
      { error: "Nada que actualizar" },
      { status: 400 },
    );
  }

  const descripcionAjuste =
    ajusteDescripcion?.toString()?.trim() || "Ajuste manual de saldo";

  const updated = await prisma.$transaction(async (tx) => {
    const cuentaActualizada = await tx.cuenta.update({
      where: { id },
      data: {
        ...dataToUpdate,
        ...(hasAdjustment ? { saldo: { increment: ajusteValorRaw } } : {}),
      },
      include: { tipoCuenta: true },
    });

    if (hasAdjustment) {
      const tipoAjusteId = await getTipoTransaccionId(
        "AJUSTE",
        "Ajuste de saldo",
        "Transacciones internas de ajuste de cuenta",
      );

      await tx.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId: id,
          monto: Math.abs(ajusteValorRaw),
          moneda: cuentaActualizada.moneda,
          direccion: ajusteValorRaw > 0 ? "ENTRADA" : "SALIDA",
          descripcion: descripcionAjuste,
          categoriaId: null,
          referencia: "AJUSTE_SALDO",
          etiquetas: ["ajuste"],
          tipoTransaccionId: tipoAjusteId,
          ocurrioEn: new Date(),
        },
      });
    }

    return cuentaActualizada;
  });

  return NextResponse.json(updated);
}

// DELETE /api/accounts -> elimina una cuenta y sus transacciones asociadas del usuario
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body ?? {};

  if (!id) {
    return NextResponse.json(
      { error: "Id de cuenta es obligatorio" },
      { status: 400 },
    );
  }

  const cuenta = await prisma.cuenta.findUnique({ where: { id } });
  if (!cuenta || cuenta.usuarioId !== user.id) {
    return NextResponse.json(
      { error: "Cuenta no encontrada" },
      { status: 404 },
    );
  }

  const [txResult] = await prisma.$transaction([
    prisma.transaccion.deleteMany({ where: { cuentaId: id, usuarioId: user.id } }),
    prisma.cuenta.delete({ where: { id } }),
  ]);

  console.log(
    "[api/accounts] deleted cuenta",
    id,
    "with",
    txResult.count,
    "tx for",
    user.id,
  );

  return NextResponse.json({ ok: true, transaccionesEliminadas: txResult.count });
}
