import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

// 1. FORZAR RUNTIME DE NODEJS (Soluciona "fetch failed" en Windows)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Helper para obtener usuario de forma segura usando el Token del Header
async function getUserSecure(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  // Creamos un cliente temporal solo para validar el token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/accounts -> lista cuentas con saldo
export async function GET(request: Request) {
  // Usamos nuestra función segura en vez de la importada que fallaba
  const user = await getUserSecure(request);

  if (!user) {
    console.log("[api/accounts] Error: No se pudo autenticar al usuario");
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // PRISMA: Como Prisma tiene permisos de admin, filtramos manualmente por usuarioId
  const cuentas = await prisma.cuenta.findMany({
    where: { usuarioId: user.id }, // <--- Aquí usamos el ID real recuperado
    orderBy: { creadaEn: "desc" },
    include: { tipoCuenta: true, transacciones: false },
  });

  console.log(`[api/accounts] Encontradas ${cuentas.length} cuentas para el usuario ${user.id}`);
  return NextResponse.json(cuentas);
}

// POST /api/accounts -> crea una cuenta
export async function POST(request: Request) {
  const user = await getUserSecure(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    nombre,
    tipoCuentaId,
    moneda = "COP",
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
      usuarioId: user.id, // Aseguramos que se crea con el ID correcto
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

// PATCH /api/accounts -> actualiza una cuenta existente
export async function PATCH(request: Request) {
  const user = await getUserSecure(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  // ... resto de tu lógica de destructuring ...
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

  if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

  // Verificamos que la cuenta pertenezca al usuario antes de tocarla
  const existing = await prisma.cuenta.findUnique({ where: { id } });
  if (!existing || existing.usuarioId !== user.id) {
    return NextResponse.json({ error: "Cuenta no encontrada o no autorizada" }, { status: 404 });
  }

  // --- TU LÓGICA DE ACTUALIZACIÓN ORIGINAL SE MANTIENE IGUAL DESDE AQUÍ ---
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
  
  // ... lógica de ajuste saldo igual ...

  // Mantenemos tu lógica de transacción intacta:
  /* Nota: Necesitas importar getTipoTransaccionId arriba si no está en este archivo, 
     o asegurarte de que la ruta del import sea correcta */
  
  // (Asumo que getTipoTransaccionId está importado correctamente al inicio)
  const hasAdjustment = ajusteValorRaw !== 0;

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
      // NOTA: Asegúrate de importar getTipoTransaccionId al inicio del archivo
      const { getTipoTransaccionId } = require("@/lib/tipoTransaccion"); // Import dinámico por si acaso

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

// DELETE /api/accounts
export async function DELETE(request: Request) {
  const user = await getUserSecure(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body ?? {};

  if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

  const cuenta = await prisma.cuenta.findUnique({ where: { id } });
  if (!cuenta || cuenta.usuarioId !== user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const [txResult] = await prisma.$transaction([
    prisma.transaccion.deleteMany({ where: { cuentaId: id, usuarioId: user.id } }),
    prisma.cuenta.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true, transaccionesEliminadas: txResult.count });
}