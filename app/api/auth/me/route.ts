import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

// GET /api/auth/me -> devuelve datos del usuario basados en el JWT (cookie o Bearer)
export async function GET(request: Request) {
  const authUser = await getUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Datos mínimos guardados en nuestra tabla de dominio.
  const usuario = await prisma.usuario.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      correo: true,
      nombre: true,
      avatarUrl: true,
      authProvider: true,
      telefono: true,
      ultimoLogin: true,
      creadoEn: true,
      actualizadoEn: true,
    },
  });

  // El JWT ya viene del cliente (Supabase), lo reenviamos para facilidad en el front.
  return NextResponse.json({
    authUser: {
      id: authUser.id,
      email: authUser.email,
      metadata: authUser.user_metadata ?? null,
    },
    usuario,
  });
}
