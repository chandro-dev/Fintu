-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "tipoTransaccionId" TEXT;

-- CreateTable
CREATE TABLE "TipoTransaccion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoTransaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoTransaccion_codigo_key" ON "TipoTransaccion"("codigo");

-- CreateIndex
CREATE INDEX "Transaccion_tipoTransaccionId_idx" ON "Transaccion"("tipoTransaccionId");

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_tipoTransaccionId_fkey" FOREIGN KEY ("tipoTransaccionId") REFERENCES "TipoTransaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
