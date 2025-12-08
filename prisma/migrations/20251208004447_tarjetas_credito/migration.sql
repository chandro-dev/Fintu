-- CreateEnum
CREATE TYPE "EstadoTarjeta" AS ENUM ('ACTIVA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoTarjeta" AS ENUM ('COMPRA', 'PAGO', 'INTERES', 'CUOTA', 'AJUSTE');

-- CreateTable
CREATE TABLE "TarjetaCredito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "emisor" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "cupoTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saldoActual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tasaEfectivaAnual" DECIMAL(65,30) NOT NULL,
    "diaCorte" INTEGER NOT NULL,
    "diaPago" INTEGER NOT NULL,
    "pagoMinimoPct" DECIMAL(65,30) DEFAULT 0,
    "estado" "EstadoTarjeta" NOT NULL DEFAULT 'ACTIVA',
    "abiertaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarjetaMovimiento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "transaccionId" TEXT,
    "tipo" "TipoMovimientoTarjeta" NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "descripcion" TEXT,
    "ocurrioEn" TIMESTAMP(3) NOT NULL,
    "cuotaId" TEXT,
    "saldoPosterior" DECIMAL(65,30),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarjetaCuota" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "descripcion" TEXT,
    "montoOriginal" DECIMAL(65,30) NOT NULL,
    "saldoPendiente" DECIMAL(65,30) NOT NULL,
    "cuotasTotales" INTEGER NOT NULL,
    "cuotaActual" INTEGER NOT NULL DEFAULT 1,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaProximaPago" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaCuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TarjetaCredito_cuentaId_key" ON "TarjetaCredito"("cuentaId");

-- CreateIndex
CREATE INDEX "TarjetaCredito_usuarioId_idx" ON "TarjetaCredito"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TarjetaMovimiento_transaccionId_key" ON "TarjetaMovimiento"("transaccionId");

-- CreateIndex
CREATE INDEX "TarjetaMovimiento_usuarioId_idx" ON "TarjetaMovimiento"("usuarioId");

-- CreateIndex
CREATE INDEX "TarjetaMovimiento_tarjetaId_idx" ON "TarjetaMovimiento"("tarjetaId");

-- CreateIndex
CREATE INDEX "TarjetaMovimiento_transaccionId_idx" ON "TarjetaMovimiento"("transaccionId");

-- CreateIndex
CREATE INDEX "TarjetaCuota_usuarioId_idx" ON "TarjetaCuota"("usuarioId");

-- CreateIndex
CREATE INDEX "TarjetaCuota_tarjetaId_idx" ON "TarjetaCuota"("tarjetaId");

-- AddForeignKey
ALTER TABLE "TarjetaCredito" ADD CONSTRAINT "TarjetaCredito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaCredito" ADD CONSTRAINT "TarjetaCredito_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaMovimiento" ADD CONSTRAINT "TarjetaMovimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaMovimiento" ADD CONSTRAINT "TarjetaMovimiento_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaMovimiento" ADD CONSTRAINT "TarjetaMovimiento_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaMovimiento" ADD CONSTRAINT "TarjetaMovimiento_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "TarjetaCuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaCuota" ADD CONSTRAINT "TarjetaCuota_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaCuota" ADD CONSTRAINT "TarjetaCuota_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
