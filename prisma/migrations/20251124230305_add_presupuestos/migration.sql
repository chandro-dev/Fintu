-- CreateEnum
CREATE TYPE "PeriodoPlan" AS ENUM ('MENSUAL', 'ANUAL');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'supabase',
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "ultimoLogin" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoLimite" DECIMAL(65,30) NOT NULL,
    "periodo" "PeriodoPlan" NOT NULL DEFAULT 'MENSUAL',
    "categoriaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_usuarioId_idx" ON "Plan"("usuarioId");

-- CreateIndex
CREATE INDEX "Plan_categoriaId_idx" ON "Plan"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_usuarioId_nombre_periodo_key" ON "Plan"("usuarioId", "nombre", "periodo");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
