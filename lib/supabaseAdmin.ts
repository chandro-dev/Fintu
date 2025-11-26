import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { prisma } from "./db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente admin para tareas especiales (semillas/cron). Evita usarlo para auth de usuario normal.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Obtiene el usuario autenticado desde cookies o bearer y lo asegura en la tabla Usuario.
export async function getUserFromRequest(req?: Request) {
  // Token en cookies (sb-access-token o sb:token)
  const cookieStore = await cookies();
  const cookieToken =
    cookieStore.get("sb-access-token")?.value ||
    cookieStore.get("sb:token")?.value;
  if (cookieToken) {
    const { data: adminUser } = await supabaseAdmin.auth.getUser(cookieToken);
    if (adminUser?.user) {
      await ensureAppUser(adminUser.user);
      return adminUser.user;
    }
  }

  // Respaldo: Authorization Bearer
  if (req) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/Bearer\s*/i, "").trim();
    if (token) {
      const { data: adminUser } = await supabaseAdmin.auth.getUser(token);
      if (adminUser?.user) {
        await ensureAppUser(adminUser.user);
        return adminUser.user;
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const fallback = await getFallbackDevUser();
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

// Crea el registro de Usuario en la base si aún no existe (idempotente).
async function ensureAppUser(user: User) {
  const id = user.id;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const correo = user.email ?? (metadata.email as string | undefined) ?? `user-${id}@local`;
  const nombre =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    null;
  await prisma.usuario.upsert({
    where: { id },
    update: { correo, nombre, ultimoLogin: new Date() },
    create: { id, correo, nombre, ultimoLogin: new Date() },
  });
}

async function getFallbackDevUser(): Promise<User | null> {
  const fallbackId = process.env.DEV_DEFAULT_USER_ID;
  const record = fallbackId
    ? await prisma.usuario.findUnique({ where: { id: fallbackId } })
    : await prisma.usuario.findFirst({ orderBy: { creadoEn: "asc" } });

  if (!record) return null;

  return {
    id: record.id,
    app_metadata: { provider: "dev" },
    user_metadata: { full_name: record.nombre },
    aud: "authenticated",
    created_at: record.creadoEn.toISOString(),
    email: record.correo,
    email_confirmed_at: record.creadoEn.toISOString(),
    last_sign_in_at: record.actualizadoEn.toISOString(),
    phone: record.telefono ?? undefined,
    phone_confirmed_at: record.telefono ? record.actualizadoEn.toISOString() : undefined,
    role: "authenticated",
    updated_at: record.actualizadoEn.toISOString(),
    identities: [],
    factors: [],
  } as User;
}
