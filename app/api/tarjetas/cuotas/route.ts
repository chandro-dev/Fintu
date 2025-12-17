import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tarjetaId = searchParams.get("tarjetaId");

  if (!tarjetaId) return NextResponse.json({ error: "tarjetaId requerido" }, { status: 400 });

  try {
    // Buscamos compras que aún tengan saldo pendiente
    const comprasActivas = await prisma.tarjetaCompra.findMany({
      where: {
        usuarioId: user.id,
        tarjetaId: tarjetaId,
        saldoPendiente: { gt: 0 } // Mayor a 0
      },
      orderBy: { ocurrioEn: "desc" }
    });

    return NextResponse.json(comprasActivas);
  } catch (error) {
    return NextResponse.json({ error: "Error obteniendo cuotas" }, { status: 500 });
  }
}