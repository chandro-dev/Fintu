import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { prisma } from "@/lib/db";

// POST /api/auth/register -> crea usuario en Supabase Auth con email/password y lo refleja en la tabla Usuario.
export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, name } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password son obligatorios" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "No se pudo crear el usuario" },
      { status: 500 },
    );
  }

  // Reflejar en la tabla Usuario (idempotente).
  await prisma.usuario.upsert({
    where: { id: data.user.id },
    update: {
      correo: email,
      nombre: name ?? data.user.user_metadata?.full_name ?? null,
    },
    create: {
      id: data.user.id,
      correo: email,
      nombre: name ?? data.user.user_metadata?.full_name ?? null,
    },
  });

  return NextResponse.json({ ok: true, userId: data.user.id });
}
