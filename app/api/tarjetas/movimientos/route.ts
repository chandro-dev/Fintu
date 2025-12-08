import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { Direccion } from "@prisma/client";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tarjetaId = searchParams.get("tarjetaId");
  if (!tarjetaId) return NextResponse.json({ error: "tarjetaId requerido" }, { status: 400 });

  const movimientos = await prisma.tarjetaMovimiento.findMany({
    where: { usuarioId: user.id, tarjetaId },
    orderBy: { ocurrioEn: "desc" },
    include: { transaccion: true, cuota: true },
  });
  return NextResponse.json(movimientos);
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const {
    tarjetaId,
    tipo,
    monto,
    descripcion,
    ocurrioEn,
    cuotaId,
    enCuotas,
    cuotasTotales,
    compraId,
  } = body ?? {};

  if (!tarjetaId || !tipo || !monto || Number(monto) <= 0) {
    return NextResponse.json(
      { error: "tarjetaId, tipo y monto > 0 son obligatorios" },
      { status: 400 },
    );
  }

  const tarjeta = await prisma.tarjetaCredito.findFirst({
    where: { id: tarjetaId, usuarioId: user.id },
    include: { cuenta: true },
  });
  if (!tarjeta)
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });

  const direction: Direccion =
    tipo === "PAGO" ? "ENTRADA" : tipo === "CUOTA" ? "ENTRADA" : "SALIDA";
  const delta =
    tipo === "PAGO" || tipo === "CUOTA" ? -Number(monto) : Number(monto);

  // manejar cuotas si aplica
  let cuotaRefId: string | null | undefined = cuotaId ?? undefined;
  let compraRefId: string | null | undefined = compraId ?? undefined;
  if (tipo === "COMPRA" && enCuotas && cuotasTotales && cuotasTotales > 1) {
    const nuevaCuota = await prisma.tarjetaCuota.create({
      data: {
        usuarioId: user.id,
        tarjetaId,
        descripcion: descripcion || "Compra en cuotas",
        montoOriginal: monto,
        saldoPendiente: monto,
        cuotasTotales,
        cuotaActual: 1,
        fechaInicio: new Date(ocurrioEn ?? Date.now()),
      },
    });
    cuotaRefId = nuevaCuota.id;
    const compra = await prisma.tarjetaCompra.create({
      data: {
        usuarioId: user.id,
        tarjetaId,
        descripcion: descripcion || "Compra en cuotas",
        montoTotal: monto,
        saldoPendiente: monto,
        cuotasTotales,
        ocurrioEn: ocurrioEn ? new Date(ocurrioEn) : new Date(),
      },
    });
    compraRefId = compra.id;
  }

  if (tipo === "CUOTA" && cuotaId) {
    const cuota = await prisma.tarjetaCuota.findFirst({
      where: { id: cuotaId, usuarioId: user.id, tarjetaId },
    });
    if (!cuota)
      return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });
    const nuevoSaldo = Number(cuota.saldoPendiente) - Number(monto);
    await prisma.tarjetaCuota.update({
      where: { id: cuotaId },
      data: {
        saldoPendiente: nuevoSaldo,
        cuotaActual: Math.min(cuota.cuotaActual + 1, cuota.cuotasTotales),
      },
    });
  }

  const movimientoFecha = ocurrioEn ? new Date(ocurrioEn) : new Date();

  const movimiento = await prisma.$transaction(async (tx) => {
    const transaccion = await tx.transaccion.create({
      data: {
        cuentaId: tarjeta.cuentaId,
        usuarioId: user.id,
        monto,
        moneda: tarjeta.moneda,
        descripcion,
        ocurrioEn: movimientoFecha,
        direccion: direction,
      },
    });

    const nuevoSaldo = Number(tarjeta.saldoActual) + delta;
    await tx.tarjetaCredito.update({
      where: { id: tarjetaId },
      data: { saldoActual: nuevoSaldo },
    });
    await tx.cuenta.update({
      where: { id: tarjeta.cuentaId },
      data: { saldo: nuevoSaldo },
    });

    return tx.tarjetaMovimiento.create({
      data: {
        usuarioId: user.id,
        tarjetaId,
        transaccionId: transaccion.id,
        tipo,
        monto,
        descripcion,
        ocurrioEn: movimientoFecha,
        cuotaId: cuotaRefId ?? undefined,
        compraId: compraRefId ?? undefined,
        saldoPosterior: nuevoSaldo,
      },
    });
  });

  return NextResponse.json(movimiento, { status: 201 });
}
