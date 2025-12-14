import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// GET /api/categorias -> lista categorías del usuario
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const categorias = await prisma.categoria.findMany({
    where: { usuarioId: user.id },
    orderBy: { nombre: "asc" },
  });

  console.log("[api/categorias] found", categorias.length, "for", user.id);
  return NextResponse.json(categorias);
}

// POST /api/categorias -> crea una categoría
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { nombre, tipo, color, icono } = body ?? {};

  if (!nombre || !tipo) {
    return NextResponse.json(
      { error: "Nombre y tipo son obligatorios" },
      { status: 400 },
    );
  }

  const categoria = await prisma.categoria.create({
    data: {
      usuarioId: user.id,
      nombre,
      tipo,
      color,
      icono,
    },
  });

  return NextResponse.json(categoria, { status: 201 });
}
