import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

// === OPTIMIZACIÓN DE CACHÉ ===
// 
// Esta información (tipos de cuenta) es esencialmente estática.
// No cambia por usuario, pero DEBE ser verificada al inicio de la sesión.
// Usamos force-dynamic (o revalidate=0) y nos aseguramos de que getUserFromRequest
// filtre por autenticación, evitando que Next.js entregue una respuesta cacheada
// de un usuario a otro.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// ===============================


// GET /api/tipos-cuenta -> Lista los tipos de cuenta disponibles
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    // **CRÍTICO:** Bloqueamos si no hay usuario autenticado. 
    // Esto es manejado por el AppDataProvider, pero es una buena práctica de seguridad.
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const tipos = await prisma.tipoCuenta.findMany({
      orderBy: { nombre: "asc" },
    });

    console.log("[api/tipos-cuenta] found", tipos.length, "for user", user.id);

    return NextResponse.json(tipos);
    
  } catch (error) {
    console.error("[GET tipos-cuenta] Error:", error);
    return NextResponse.json({ error: "Error al obtener tipos de cuenta" }, { status: 500 });
  }
}