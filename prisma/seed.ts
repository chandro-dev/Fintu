import { PrismaClient, TipoCategoria } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tipos = [
    {
      codigo: "NORMAL",
      nombre: "Cuenta normal",
      descripcion: "Cuenta corriente o de ahorro",
      requiereCorte: false,
      tasaInteresAnual: null,
    },
    {
      codigo: "TARJETA_CREDITO",
      nombre: "Tarjeta de credito",
      descripcion: "Linea revolving con corte y fecha de pago",
      requiereCorte: true,
      tasaInteresAnual: 60.0,
    },
    {
      codigo: "PRESTAMO",
      nombre: "Prestamo",
      descripcion: "Prestamo personal/hipotecario",
      requiereCorte: false,
      tasaInteresAnual: 20.0,
    },
  ];

  for (const t of tipos) {
    await prisma.tipoCuenta.upsert({
      where: { codigo: t.codigo },
      update: t,
      create: t,
    });
  }

  const categorias = [
    { nombre: "Salario", tipo: TipoCategoria.INGRESO, color: "#22c55e" },
    { nombre: "Ventas", tipo: TipoCategoria.INGRESO, color: "#0ea5e9" },
    { nombre: "Supermercado", tipo: TipoCategoria.GASTO, color: "#f97316" },
    { nombre: "Renta", tipo: TipoCategoria.GASTO, color: "#ef4444" },
    { nombre: "Servicios", tipo: TipoCategoria.GASTO, color: "#a855f7" },
    { nombre: "Transferencia interna", tipo: TipoCategoria.TRANSFERENCIA, color: "#38bdf8" },
  ];

  const demoUserId = "00000000-0000-0000-0000-000000000000";

  // Crear usuario demo si no existe para asignar categorias.
  await prisma.usuario.upsert({
    where: { id: demoUserId },
    update: {},
    create: {
      id: demoUserId,
      correo: "demo@fintu.local",
      nombre: "Demo",
    },
  });

  // Seed de categorias solo para un usuario de ejemplo.
  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: {
        usuarioId_nombre_tipo: {
          usuarioId: demoUserId,
          nombre: cat.nombre,
          tipo: cat.tipo,
        },
      },
      update: cat,
      create: { ...cat, usuarioId: demoUserId },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
