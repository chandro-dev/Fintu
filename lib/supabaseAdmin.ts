import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { prisma } from "./db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente admin para tareas especiales (semillas/cron). Evita usarlo para auth de usuario normal.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Obtiene el usuario autenticado desde las cookies de Supabase (App Router).
// Si no hay sesión en cookies, intenta usar Authorization: Bearer <token> como respaldo.
export async function getUserFromRequest(req?: Request) {
  // En Next 16 cookies() es async; debemos resolver antes de usarlo.
  const cookieStore = await cookies();

  // 1) Intentar obtener el token de las cookies (sb-access-token) y validar con service role.
  // 1) Intentar refrescar con auth-helpers (usa refresh token si hace falta).
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (accessToken) {
    const { data: adminUser } = await supabaseAdmin.auth.getUser(accessToken);
    if (adminUser?.user) {
      console.log("[auth] user via session", adminUser.user.id);
      await ensureAppUser(adminUser.user);
      return adminUser.user;
    }
  }

  // 2) Respaldo: token directo en cookies
  const cookieToken =
    cookieStore.get("sb-access-token")?.value ||
    cookieStore.get("sb:token")?.value;
  if (cookieToken) {
    const { data: adminUser } = await supabaseAdmin.auth.getUser(cookieToken);
    if (adminUser?.user) {
      console.log("[auth] user via cookie token", adminUser.user.id);
      await ensureAppUser(adminUser.user);
      return adminUser.user;
    }
  }

  // 3) Respaldo: header Authorization con service role para llamadas directas (p.ej. tests).
  if (req) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/Bearer\s*/i, "").trim();
    if (token) {
      const { data: adminUser } = await supabaseAdmin.auth.getUser(token);
      if (adminUser?.user) {
        console.log("[auth] user via bearer", adminUser.user.id);
        await ensureAppUser(adminUser.user);
        return adminUser.user;
      }
    }
  }

  console.log("[auth] no user found");
  return null;
}

// Crea el registro de Usuario en la base si aún no existe (idempotente).
async function ensureAppUser(user: { id: string; email?: string | null; user_metadata?: any }) {
  const id = user.id;
  const correo = user.email ?? user.user_metadata?.email ?? `user-${id}@local`;
  const nombre = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  await prisma.usuario.upsert({
    where: { id },
    update: { correo, nombre },
    create: { id, correo, nombre },
  });
}
