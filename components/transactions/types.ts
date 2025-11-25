export type TipoCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

export type Cuenta = {
  id: string;
  nombre: string;
  tipoCuentaId: string;
  moneda: string;
  saldo: number;
  limiteCredito?: number | null;
  tasaApr?: number | null;
  diaCorte?: number | null;
  diaPago?: number | null;
  plazoMeses?: number | null;
  limite?: number | null;
  tipoCuenta?: TipoCuenta | null;
};

export type Categoria = {
  id: string;
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string | null;
};

export type TxForm = {
  cuentaId: string;
  monto: number;
  direccion: "ENTRADA" | "SALIDA";
  descripcion: string;
  categoriaId?: string;
  ocurrioEn?: string;
};

export type Transaccion = {
  id: string;
  monto: number;
  moneda: string;
  descripcion: string | null;
  ocurrioEn: string;
  direccion: "ENTRADA" | "SALIDA";
  cuentaId: string;
  cuenta?: {
    nombre: string;
    tipoCuentaId?: string;
    tipoCuenta?: TipoCuenta | null;
    moneda: string;
  };
  categoria?: Categoria | null;
};
