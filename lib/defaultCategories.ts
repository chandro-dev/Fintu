import type { PrismaClient } from "@prisma/client";

type DefaultCategory = {
  nombre: string;
  tipo: "INGRESO" | "GASTO";
  color: string;
  icono: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // GASTOS
  { nombre: "Comida", tipo: "GASTO", color: "#f97316", icono: "food" },
  { nombre: "Transporte", tipo: "GASTO", color: "#3b82f6", icono: "transport" },
  { nombre: "Hogar", tipo: "GASTO", color: "#6366f1", icono: "home" },
  { nombre: "Servicios", tipo: "GASTO", color: "#06b6d4", icono: "bills" },
  { nombre: "Salud", tipo: "GASTO", color: "#ef4444", icono: "health" },
  { nombre: "Compras", tipo: "GASTO", color: "#8b5cf6", icono: "shopping" },
  { nombre: "Entretenimiento", tipo: "GASTO", color: "#f59e0b", icono: "entertainment" },
  { nombre: "Educación", tipo: "GASTO", color: "#84cc16", icono: "education" },
  { nombre: "Café", tipo: "GASTO", color: "#a16207", icono: "coffee" },
  { nombre: "Otros", tipo: "GASTO", color: "#64748b", icono: "other" },

  // INGRESOS
  { nombre: "Salario", tipo: "INGRESO", color: "#10b981", icono: "salary" },
  { nombre: "Trabajo", tipo: "INGRESO", color: "#22c55e", icono: "work" },
  { nombre: "Regalos", tipo: "INGRESO", color: "#f43f5e", icono: "gift" },
  { nombre: "Otros", tipo: "INGRESO", color: "#64748b", icono: "other" },
];

export async function ensureDefaultCategories(prisma: PrismaClient, usuarioId: string) {
  if (!usuarioId) return;

  await prisma.categoria.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      usuarioId,
      nombre: c.nombre,
      tipo: c.tipo,
      color: c.color,
      icono: c.icono,
    })),
    // @@unique([usuarioId, nombre, tipo]) => evita duplicados por usuario
    skipDuplicates: true,
  });
}

