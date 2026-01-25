import { prisma } from "@/lib/db";

const LOAN_CODE = "PRESTAMO";

export async function ensureLoanTipoCuenta() {
  const tipo = await prisma.tipoCuenta.upsert({
    where: { codigo: LOAN_CODE },
    update: {},
    create: {
      codigo: LOAN_CODE,
      nombre: "Préstamo a terceros",
      descripcion: "Cuenta usada para llevar la cartera de préstamos otorgados",
      requiereCorte: false,
    },
  });
  return tipo.id;
}

export const LOAN_TIPO_CODIGO = LOAN_CODE;
