"use client";

type FetchOptions = {
  accessToken?: string | null;
};

type CuentaPayload = {
  nombre?: string;
  tipoCuentaId?: string;
  moneda?: string;
  saldo?: number;
  institucion?: string | null;
  limiteCredito?: number | null;
  tasaApr?: number | null;
  diaCorte?: number | null;
  diaPago?: number | null;
  plazoMeses?: number | null;
  ajusteSaldo?: number;
  ajusteDescripcion?: string;
  cerradaEn?: string | null;
};

export class CuentasService {
  private static headers({ accessToken }: FetchOptions) {
    return {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  private static validate(payload: CuentaPayload) {
    if (!payload.nombre?.trim()) return "Nombre obligatorio";
    if (!payload.tipoCuentaId) return "Tipo de cuenta requerido";
    if (!payload.moneda || payload.moneda.trim().length > 5)
      return "Moneda invalida";
    if (
      payload.limiteCredito !== undefined &&
      payload.limiteCredito !== null &&
      Number(payload.limiteCredito) < 0
    )
      return "Límite no puede ser negativo";
    return null;
  }

  static async crear(payload: CuentaPayload, opts: FetchOptions) {
    const err = this.validate(payload);
    if (err) throw new Error(err);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: this.headers(opts),
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo crear la cuenta");
    }
    return res.json().catch(() => null);
  }

  static async actualizar(id: string, payload: Partial<CuentaPayload>, opts: FetchOptions) {
    const res = await fetch("/api/accounts", {
      method: "PATCH",
      headers: this.headers(opts),
      body: JSON.stringify({ id, ...payload }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo actualizar la cuenta");
    }
    return res.json().catch(() => null);
  }

  static async eliminar(id: string, opts: FetchOptions) {
    const res = await fetch("/api/accounts", {
      method: "DELETE",
      headers: this.headers(opts),
      body: JSON.stringify({ id }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo eliminar la cuenta");
    }
    return res.json().catch(() => null);
  }
}

export default CuentasService;
