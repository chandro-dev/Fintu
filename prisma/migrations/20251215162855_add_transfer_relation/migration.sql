/*
  Warnings:

  - A unique constraint covering the columns `[transaccionRelacionadaId]` on the table `Transaccion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "transaccionRelacionadaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_transaccionRelacionadaId_key" ON "Transaccion"("transaccionRelacionadaId");

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_transaccionRelacionadaId_fkey" FOREIGN KEY ("transaccionRelacionadaId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
