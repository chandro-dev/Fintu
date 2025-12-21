-- AlterEnum
ALTER TYPE "TipoMovimientoTarjeta" ADD VALUE 'AVANCE';

-- AlterTable
ALTER TABLE "TarjetaCredito" ADD COLUMN     "saldoCapital" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "saldoInteres" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TarjetaMovimiento" ADD COLUMN     "aplicadoCapital" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "aplicadoInteres" DECIMAL(65,30) DEFAULT 0;
