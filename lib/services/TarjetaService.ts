"use client";

import type { Decimal } from "@prisma/client/runtime/library";

type FetchOptions = {
  accessToken?: string | null;
};

export type TarjetaPayload = {
  nombre: string;
  cuentaId: string;
  emisor?: string | null;
  moneda?: string;
  cupoTotal?: Decimal | number;
  saldoActual?: Decimal | number;
  tasaEfectivaAnual: Decimal | number;
  diaCorte: number;
  diaPago: number;
  pagoMinimoPct?: Decimal | number | null;
};

export type MovimientoTarjetaPayload = {
  tarjetaId: string;
  tipo: "COMPRA" | "PAGO" | "INTERES" | "CUOTA" | "AJUSTE";
  monto: number;
  descripcion?: string;
  ocurrioEn?: string;
  cuotaId?: string | null;
  enCuotas?: boolean;
  cuotasTotales?: number;
};

export class TarjetaService {
  private static headers(opts: FetchOptions) {
    return {
      "Content-Type": "application/json",
      ...(opts.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
    };
  }

  static async listar(opts: FetchOptions) {
    const res = await fetch("/api/tarjetas", {
      headers: this.headers(opts),
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudieron cargar las tarjetas");
    return res.json();
  }

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
    return res.json();
  }

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

  static async registrarMovimiento(payload: MovimientoTarjetaPayload, opts: FetchOptions) {
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
}

export default TarjetaService;
