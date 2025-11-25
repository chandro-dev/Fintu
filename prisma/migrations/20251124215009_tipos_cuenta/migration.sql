/*
  Warnings:

  - You are about to drop the column `tipo` on the `Cuenta` table. All the data in the column will be lost.
  - Added the required column `tipoCuentaId` to the `Cuenta` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Cuenta_tipo_idx";

-- AlterTable
ALTER TABLE "Cuenta" DROP COLUMN "tipo",
ADD COLUMN     "tipoCuentaId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "TipoCuenta";

-- CreateTable
CREATE TABLE "TipoCuenta" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "requiereCorte" BOOLEAN NOT NULL DEFAULT false,
    "tasaInteresAnual" DECIMAL(65,30),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoCuenta_codigo_key" ON "TipoCuenta"("codigo");

-- CreateIndex
CREATE INDEX "Cuenta_tipoCuentaId_idx" ON "Cuenta"("tipoCuentaId");

-- AddForeignKey
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_tipoCuentaId_fkey" FOREIGN KEY ("tipoCuentaId") REFERENCES "TipoCuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
