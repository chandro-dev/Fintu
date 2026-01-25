import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
import { getTipoTransaccionId } from "@/lib/tipoTransaccion";
import { ensureLoanTipoCuenta, LOAN_TIPO_CODIGO } from "@/lib/loanHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parseDate = (value?: string) => (value ? new Date(value) : new Date());

// GET: Lista cuentas de préstamo
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const loans = await prisma.cuenta.findMany({
    where: {
      usuarioId: user.id,
      tipoCuenta: { codigo: LOAN_TIPO_CODIGO },
    },
    include: { tipoCuenta: true },
    orderBy: { creadaEn: "desc" },
  });

  return NextResponse.json(loans);
}

// POST: crea préstamo o registra pago
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const kind = body?.kind ?? "create";

  if (kind === "create") {
    const {
      nombre,
      monto,
      cuentaOrigenId,
      moneda = "COP",
      tasaApr,
      plazoMeses,
      descripcion,
      ocurrioEn,
    } = body ?? {};

    if (!nombre || !monto || !cuentaOrigenId) {
      return NextResponse.json(
        { error: "nombre, monto y cuentaOrigenId son obligatorios" },
        { status: 400 },
      );
    }

    const fecha = parseDate(ocurrioEn);
    const tipoPrestamoId = await ensureLoanTipoCuenta();
    const tipoTransferenciaId = await getTipoTransaccionId(
      "TRANSFERENCIA",
      "Transferencia",
      "Movimientos internos",
    );

    const result = await prisma.$transaction(async (tx) => {
      const cuentaOrigen = await tx.cuenta.findFirst({
        where: { id: cuentaOrigenId, usuarioId: user.id },
      });
      if (!cuentaOrigen) throw new Error("Cuenta origen no encontrada");

      const cuentaPrestamo = await tx.cuenta.create({
        data: {
          usuarioId: user.id,
          nombre,
          tipoCuentaId: tipoPrestamoId,
          moneda,
          saldo: 0,
          tasaApr: tasaApr ?? null,
          plazoMeses: plazoMeses ?? null,
        },
        include: { tipoCuenta: true },
      });

      const salida = await tx.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId: cuentaOrigenId,
          monto: Number(monto),
          moneda,
          direccion: "SALIDA",
          ocurrioEn: fecha,
          descripcion: descripcion || `Desembolso préstamo a ${nombre}`,
          tipoTransaccionId: tipoTransferenciaId,
        },
      });

      const entrada = await tx.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId: cuentaPrestamo.id,
          monto: Number(monto),
          moneda,
          direccion: "ENTRADA",
          ocurrioEn: fecha,
          descripcion: descripcion || `Desembolso préstamo a ${nombre}`,
          tipoTransaccionId: tipoTransferenciaId,
          transaccionRelacionadaId: salida.id,
        },
      });

      await tx.transaccion.update({
        where: { id: salida.id },
        data: { transaccionRelacionadaId: entrada.id },
      });

      await tx.cuenta.update({
        where: { id: cuentaOrigenId },
        data: { saldo: { decrement: Number(monto) } },
      });
      await tx.cuenta.update({
        where: { id: cuentaPrestamo.id },
        data: { saldo: { increment: Number(monto) } },
      });

      return { cuentaPrestamo, transaccionSalida: salida, transaccionEntrada: entrada };
    });

    return NextResponse.json(result, { status: 201 });
  }

  if (kind === "payment") {
    const { loanAccountId, destinoCuentaId, monto, descripcion, ocurrioEn, moneda = "COP" } =
      body ?? {};

    if (!loanAccountId || !destinoCuentaId || !monto) {
      return NextResponse.json(
        { error: "loanAccountId, destinoCuentaId y monto son obligatorios" },
        { status: 400 },
      );
    }

    const fecha = parseDate(ocurrioEn);
    const tipoTransferenciaId = await getTipoTransaccionId(
      "TRANSFERENCIA",
      "Transferencia",
      "Movimientos internos",
    );

    const result = await prisma.$transaction(async (tx) => {
      const cuentaPrestamo = await tx.cuenta.findFirst({
        where: { id: loanAccountId, usuarioId: user.id },
        include: { tipoCuenta: true },
      });
      if (!cuentaPrestamo || cuentaPrestamo.tipoCuenta.codigo !== LOAN_TIPO_CODIGO) {
        throw new Error("Cuenta de préstamo inválida");
      }

      const cuentaDestino = await tx.cuenta.findFirst({
        where: { id: destinoCuentaId, usuarioId: user.id },
      });
      if (!cuentaDestino) throw new Error("Cuenta destino no encontrada");

      const salida = await tx.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId: loanAccountId,
          monto: Number(monto),
          moneda,
          direccion: "SALIDA",
          ocurrioEn: fecha,
          descripcion: descripcion || "Pago recibido (reduce préstamo)",
          tipoTransaccionId: tipoTransferenciaId,
        },
      });

      const entrada = await tx.transaccion.create({
        data: {
          usuarioId: user.id,
          cuentaId: destinoCuentaId,
          monto: Number(monto),
          moneda,
          direccion: "ENTRADA",
          ocurrioEn: fecha,
          descripcion: descripcion || "Pago recibido (reduce préstamo)",
          tipoTransaccionId: tipoTransferenciaId,
          transaccionRelacionadaId: salida.id,
        },
      });

      await tx.transaccion.update({
        where: { id: salida.id },
        data: { transaccionRelacionadaId: entrada.id },
      });

      await tx.cuenta.update({
        where: { id: loanAccountId },
        data: { saldo: { decrement: Number(monto) } },
      });
      await tx.cuenta.update({
        where: { id: destinoCuentaId },
        data: { saldo: { increment: Number(monto) } },
      });

      return { salida, entrada };
    });

    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json({ error: "kind inválido" }, { status: 400 });
}
