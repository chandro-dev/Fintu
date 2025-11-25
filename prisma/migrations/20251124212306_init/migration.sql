-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('NORMAL', 'TARJETA_CREDITO', 'PRESTAMO');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('INGRESO', 'GASTO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "Direccion" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "nombre" TEXT,
    "avatarUrl" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "institucion" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "saldo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "limiteCredito" DECIMAL(65,30),
    "tasaApr" DECIMAL(65,30),
    "diaCorte" INTEGER,
    "diaPago" INTEGER,
    "pagoMinimo" DECIMAL(65,30),
    "plazoMeses" INTEGER,
    "abiertaEn" TIMESTAMP(3),
    "cerradaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCategoria" NOT NULL,
    "color" TEXT,
    "icono" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "descripcion" TEXT,
    "categoriaId" TEXT,
    "ocurrioEn" TIMESTAMP(3) NOT NULL,
    "conciliada" BOOLEAN NOT NULL DEFAULT false,
    "direccion" "Direccion" NOT NULL,
    "referencia" TEXT,
    "etiquetas" TEXT[],
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Cuenta_usuarioId_idx" ON "Cuenta"("usuarioId");

-- CreateIndex
CREATE INDEX "Cuenta_tipo_idx" ON "Cuenta"("tipo");

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_tipo_idx" ON "Categoria"("usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_usuarioId_nombre_tipo_key" ON "Categoria"("usuarioId", "nombre", "tipo");

-- CreateIndex
CREATE INDEX "Transaccion_cuentaId_idx" ON "Transaccion"("cuentaId");

-- CreateIndex
CREATE INDEX "Transaccion_usuarioId_ocurrioEn_idx" ON "Transaccion"("usuarioId", "ocurrioEn");

-- CreateIndex
CREATE INDEX "Transaccion_categoriaId_idx" ON "Transaccion"("categoriaId");

-- AddForeignKey
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
