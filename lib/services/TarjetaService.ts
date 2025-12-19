"use client";

// Definimos FetchOptions para pasar el token
type FetchOptions = {
  accessToken?: string | null;
};

// ============================================================================
// TIPOS (DTOs)
// ============================================================================

/**
 * Datos necesarios para crear o actualizar una tarjeta.
 * Nota: 'saldoInicial' se usa solo al crear.
 * Nota: 'cuentaId' es opcional; si no se envía, el backend crea una cuenta sombra.
 */
export type TarjetaPayload = {
  nombre: string;
  cuentaId?: string; // Opcional ahora (el backend puede crearla auto)
  emisor?: string | null;
  moneda?: string;
  cupoTotal: number;
  saldoInicial?: number; // <--- NUEVO: Para migrar deudas existentes
  saldoActual?: number;  // Para actualizaciones
  tasaEfectivaAnual: number;
  diaCorte: number;
  diaPago: number;
  pagoMinimoPct?: number | null;
  estado?: "ACTIVA" | "BLOQUEADA" | "CERRADA";
  cerradaEn?: Date | string | null;
};

/**
 * Datos para registrar un movimiento (Compra, Pago, etc.)
 */
export type MovimientoTarjetaPayload = {
  tarjetaId: string;
  tipo: "COMPRA" | "PAGO" | "INTERES" | "CUOTA" | "AJUSTE" | "AVANCE";
  monto: number;
  descripcion?: string;
  ocurrioEn?: string; // ISO Date String
  autoCalcularInteres?: boolean;
  
  // Específico para Compras en Cuotas
  enCuotas?: boolean;
  cuotasTotales?: number;
  cuotaId?: string | null; // Si se paga una cuota específica

  // Específico para Pagos (Origen de fondos)
  cuentaOrigenId?: string; // <--- NUEVO: Requerido si tipo === "PAGO"
};

// ============================================================================
// SERVICIO CLASE
// ============================================================================

export class TarjetaService {
  
  // Helper privado para headers con Auth
  private static headers(opts: FetchOptions) {
    return {
      "Content-Type": "application/json",
      ...(opts.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
    };
  }

  /**
   * Obtiene todas las tarjetas del usuario logueado.
   */
  static async listar(opts: FetchOptions) {
    const res = await fetch("/api/tarjetas", {
      method: "GET",
      headers: this.headers(opts),
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudieron cargar las tarjetas");
    return res.json(); // Retorna Tarjeta[]
  }

  /**
   * Crea una nueva tarjeta de crédito.
   */
  static async crear(payload: TarjetaPayload, opts: FetchOptions) {
    const res = await fetch("/api/tarjetas", {
      method: "POST",
      headers: this.headers(opts),
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo crear la tarjeta");
    }
    return res.json(); // Retorna la tarjeta creada
  }

  /**
   * Actualiza datos de configuración de la tarjeta.
   */
  static async actualizar(id: string, payload: Partial<TarjetaPayload>, opts: FetchOptions) {
    const res = await fetch("/api/tarjetas", {
      method: "PATCH",
      headers: this.headers(opts),
      body: JSON.stringify({ id, ...payload }),
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo actualizar la tarjeta");
    }
    return res.json();
  }

  /**
   * Elimina una tarjeta y todos sus movimientos asociados (Cuidado).
   */
  static async eliminar(id: string, opts: FetchOptions) {
    const res = await fetch("/api/tarjetas", {
      method: "DELETE",
      headers: this.headers(opts),
      body: JSON.stringify({ id }),
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo eliminar la tarjeta");
    }
    return res.json();
  }

  /**
   * Registra un movimiento (Compra, Pago, etc.) transaccional.
   */
  static async registrarMovimiento(payload: MovimientoTarjetaPayload, opts: FetchOptions) {
    // Pequeña validación preventiva en el cliente
    if (payload.tipo === "PAGO" && !payload.cuentaOrigenId) {
        throw new Error("Se requiere una cuenta de origen para realizar un pago.");
    }

    const res = await fetch("/api/tarjetas/movimientos", {
      method: "POST",
      headers: this.headers(opts),
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo registrar el movimiento");
    }
    return res.json();
  }
  static async listarComprasActivas(tarjetaId: string, opts: FetchOptions) {
    const res = await fetch(`/api/tarjetas/cuotas?tarjetaId=${tarjetaId}`, {
      method: "GET",
      headers: this.headers(opts),
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudieron cargar las compras diferidas");
    return res.json();
  }
}

export default TarjetaService;
