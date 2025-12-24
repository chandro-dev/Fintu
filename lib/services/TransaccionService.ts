"use client";

import type { TxForm } from "@/components/transactions/types";

type FetchOptions = {
  accessToken?: string | null;
};

export class TransaccionService {
  private static headers({ accessToken }: FetchOptions) {
    return {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  private static validate(form: TxForm) {
    if (!form.cuentaId) return "Selecciona la cuenta";
    if (!form.monto || Number(form.monto) <= 0)
      return "Monto debe ser mayor a 0";
    return null;
  }

  private static normalizePayload(form: TxForm, id?: string) {
    const categoriaIds =
      Array.isArray(form.categoriaIds) && form.categoriaIds.length > 0
        ? form.categoriaIds.filter(Boolean)
        : form.categoriaId
          ? [form.categoriaId]
          : [];

    const categoriaId = categoriaIds[0] ?? (form.categoriaId ?? "");

    return {
      ...form,
      id,
      monto: Number(form.monto),
      categoriaId,
      categoriaIds,
      ocurrioEn: form.ocurrioEn
        ? new Date(form.ocurrioEn).toISOString()
        : new Date().toISOString(),
    };
  }

  static async crear(form: TxForm, opts: FetchOptions) {
    const err = this.validate(form);
    if (err) throw new Error(err);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: this.headers(opts),
      body: JSON.stringify(this.normalizePayload(form)),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo crear la transacción");
    }
    return res.json().catch(() => null);
  }

  static async actualizar(id: string, form: TxForm, opts: FetchOptions) {
    const err = this.validate(form);
    if (err) throw new Error(err);
    const res = await fetch("/api/transactions", {
      method: "PATCH",
      headers: this.headers(opts),
      body: JSON.stringify(this.normalizePayload(form, id)),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo actualizar la transacción");
    }
    return res.json().catch(() => null);
  }

  static async eliminar(id: string, opts: FetchOptions) {
    const res = await fetch("/api/transactions", {
      method: "DELETE",
      headers: this.headers(opts),
      body: JSON.stringify({ id }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "No se pudo eliminar la transacción");
    }
    return res.json().catch(() => null);
  }
}

export default TransaccionService;
