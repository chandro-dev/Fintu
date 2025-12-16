// src/lib/tipoTransaccion.ts
import { prisma } from "@/lib/db";

export async function getTipoTransaccionId(
  codigo: "NORMAL" | "TRANSFERENCIA" | "AJUSTE", // <--- Agregamos AJUSTE a los tipos permitidos
  nombreDefecto: string,
  descripcionDefecto: string
) {
  // Buscamos si existe, si no, lo creamos (Upsert)
  const tipo = await prisma.tipoTransaccion.upsert({
    where: { 
      codigo: codigo 
    },
    update: {}, // Si existe, no hacemos nada
    create: {
      codigo,
      nombre: nombreDefecto,
      descripcion: descripcionDefecto,
    },
  });

  return tipo.id;
}