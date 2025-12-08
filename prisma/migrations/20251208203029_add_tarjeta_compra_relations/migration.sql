-- CreateEnum
CREATE TYPE "EstadoCompraTarjeta" AS ENUM ('ABIERTA', 'PAGADA');

-- AlterTable
ALTER TABLE "TarjetaMovimiento" ADD COLUMN     "compraId" TEXT;

-- CreateTable
CREATE TABLE "TransaccionCategoria" (
    "id" TEXT NOT NULL,
    "transaccionId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransaccionCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarjetaCompra" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "descripcion" TEXT,
    "montoTotal" DECIMAL(65,30) NOT NULL,
    "saldoPendiente" DECIMAL(65,30) NOT NULL,
    "cuotasTotales" INTEGER,
    "estado" "EstadoCompraTarjeta" NOT NULL DEFAULT 'ABIERTA',
    "ocurrioEn" TIMESTAMP(3) NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransaccionCategoria_usuarioId_idx" ON "TransaccionCategoria"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TransaccionCategoria_transaccionId_categoriaId_key" ON "TransaccionCategoria"("transaccionId", "categoriaId");

-- CreateIndex
CREATE INDEX "TarjetaCompra_usuarioId_idx" ON "TarjetaCompra"("usuarioId");

-- CreateIndex
CREATE INDEX "TarjetaCompra_tarjetaId_idx" ON "TarjetaCompra"("tarjetaId");

-- CreateIndex
CREATE INDEX "TarjetaMovimiento_compraId_idx" ON "TarjetaMovimiento"("compraId");

-- AddForeignKey
ALTER TABLE "TarjetaMovimiento" ADD CONSTRAINT "TarjetaMovimiento_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "TarjetaCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaccionCategoria" ADD CONSTRAINT "TransaccionCategoria_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaccionCategoria" ADD CONSTRAINT "TransaccionCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaccionCategoria" ADD CONSTRAINT "TransaccionCategoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaCompra" ADD CONSTRAINT "TarjetaCompra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaCompra" ADD CONSTRAINT "TarjetaCompra_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
