import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

export const dynamic = 'force-dynamic';

// 1. GET: Obtener todas
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const categorias = await prisma.categoria.findMany({
    where: { usuarioId: user.id },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(categorias);
}

// 2. POST: Crear nueva
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

// 3. PATCH: Actualizar existente (NUEVO)
export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, nombre, tipo, color, icono } = body;

    if (!id) {
      return NextResponse.json({ error: "ID es obligatorio para actualizar" }, { status: 400 });
    }

    // PASO DE SEGURIDAD:
    // Verificar que la categoría exista Y pertenezca al usuario actual.
    // Prisma .update solo filtra por ID único, así que hacemos un findFirst antes para validar propiedad.
    const exists = await prisma.categoria.findFirst({
      where: { 
        id: id,
        usuarioId: user.id 
      }
    });

    if (!exists) {
      return NextResponse.json({ error: "Categoría no encontrada o no autorizada" }, { status: 404 });
    }

    // Ejecutar la actualización
    const updatedCategory = await prisma.categoria.update({
      where: { id },
      data: {
        nombre,
        tipo,
        color,
        icono
      },
    });

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json({ error: "Error al actualizar la categoría" }, { status: 500 });
  }
}

// 4. DELETE: Eliminar
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

    await prisma.categoria.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "No se puede eliminar una categoría en uso" }, { status: 400 });
  }
}