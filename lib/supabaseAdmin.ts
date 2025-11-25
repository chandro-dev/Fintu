import { createClient } from "@supabase/supabase-js";
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

  return null;
}

// Crea el registro de Usuario en la base si aún no existe (idempotente).
async function ensureAppUser(user: { id: string; email?: string | null; user_metadata?: any }) {
  const id = user.id;
  const correo = user.email ?? user.user_metadata?.email ?? `user-${id}@local`;
  const nombre = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  await prisma.usuario.upsert({
    where: { id },
    update: { correo, nombre, ultimoLogin: new Date() },
    create: { id, correo, nombre, ultimoLogin: new Date() },
  });
}
