import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

export const dynamic = 'force-dynamic';

// GET y POST (Mantenlos igual que tu código original)...
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const categorias = await prisma.categoria.findMany({
    where: { usuarioId: user.id },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(categorias);
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { nombre, tipo, color, icono } = body ?? {};

  if (!nombre || !tipo) {
    return NextResponse.json({ error: "Nombre y tipo obligatorios" }, { status: 400 });
  }

  try {
    const categoria = await prisma.categoria.create({
      data: { usuarioId: user.id, nombre, tipo, color, icono },
    });
    return NextResponse.json(categoria, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error creando categoría" }, { status: 500 });
  }
}

// NUEVO: DELETE
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const { id } = await request.json();
    
    // Validar que la categoría pertenezca al usuario
    const count = await prisma.categoria.count({
      where: { id, usuarioId: user.id }
    });

    if (count === 0) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

    // Opcional: Verificar si tiene transacciones antes de borrar (Prisma lanzará error si hay FK constraint, pero es mejor controlar)
    // Por ahora, permitimos el borrado directo (Prisma puede requerir configurar onDelete: SetNull o Cascade en el schema)
    await prisma.categoria.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "No se puede eliminar una categoría en uso" }, { status: 400 });
  }
}