// src/components/transactions/types.ts

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
  cerradaEn?: string | null;
  limiteCredito?: number | null;
  tasaApr?: number | null;
  diaCorte?: number | null;
  diaPago?: number | null;
  plazoMeses?: number | null;
  institucion?: string | null; 
  tipoCuenta?: TipoCuenta | null;
};

export type Categoria = {
  id: string;
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA"; // Importante para lógica de colores
  color?: string | null;
  icono?: string | null; // <--- AGREGADO: Necesario para CategoryBadge
};

export type TxForm = {
  cuentaId: string;
  monto: number;
  direccion: "ENTRADA" | "SALIDA";
  descripcion: string;
  categoriaId?: string;
  categoriaIds?: string[]; // Permite múltiples categorías (la primera actúa como principal)
  ocurrioEn?: string; // ISO string date
  isAjuste?: boolean;
  // Campos para Transferencias y Lógica extra
  isTransferencia?: boolean; // <--- AGREGADO: Para el switch del modal
  cuentaDestinoId?: string;  // <--- AGREGADO: Para transferencias
  conciliada?: boolean;      // <--- AGREGADO: Para conciliación futura
  etiquetas?: string[];      // <--- AGREGADO: Para etiquetas libres (tags)
};

export type Transaccion = {
  id: string;
  monto: number;
  moneda: string;
  descripcion: string | null;
  ocurrioEn: string;
  direccion: "ENTRADA" | "SALIDA";
  
  // Relaciones y Tipos
  tipoTransaccionId?: string | null;
  tipoTransaccion?: { // <--- VITAL: Usado en los filtros de la página
    id: string;
    codigo: string; // "NORMAL" | "TRANSFERENCIA" | "AJUSTE"
    nombre: string;
  } | null;

  transaccionRelacionadaId?: string | null; // <--- VITAL: Para detectar parejas de transferencia

  cuentaId: string;
  cuenta?: {
    nombre: string;
    tipoCuentaId?: string;
    tipoCuenta?: TipoCuenta | null;
    moneda: string;
  };
  
  categoria?: Categoria | null;
  categoriasPivot?: { categoriaId: string; categoria: Categoria }[]; // tags extra (incluye la principal si se guarda)
  etiquetas?: string[]; // Array de strings simple
  
  createdAt?: string;
  updatedAt?: string;
};

// Tipos para Tarjetas de Crédito (si los usas más adelante)
type DireccionUI = "ENTRADA" | "SALIDA";

export type TarjetaMovimientoUI = {
  id: string;
  monto: number;
  descripcion?: string | null;
  ocurrioEn: string;
  tipo: "COMPRA" | "PAGO" | "INTERES" | "CUOTA" | "AJUSTE";
  transaccion?: { direccion: DireccionUI } | null;
};
