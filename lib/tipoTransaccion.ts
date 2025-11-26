import { prisma } from "./db";

const cache = new Map<string, string>();

export async function getTipoTransaccionId(
  codigo: string,
  nombre: string,
  descripcion?: string,
) {
  if (cache.has(codigo)) {
    return cache.get(codigo)!;
  }
  const tipo = await prisma.tipoTransaccion.upsert({
    where: { codigo },
    update: { nombre, descripcion },
    create: { codigo, nombre, descripcion },
  });
  cache.set(codigo, tipo.id);
  return tipo.id;
}
