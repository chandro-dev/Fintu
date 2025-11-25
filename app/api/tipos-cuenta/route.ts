import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

// Lista los tipos de cuenta disponibles (requiere usuario autenticado para mantener consistencia).
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const tipos = await prisma.tipoCuenta.findMany({
    orderBy: { nombre: "asc" },
  });

  console.log("[api/tipos-cuenta] found", tipos.length);

  return NextResponse.json(tipos);
}
