"use client";

import { useMemo, useState } from "react";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { Categoria, Cuenta, TxForm } from "@/components/transactions/types";

type Props = {
  cuentas: Cuenta[];
  categorias: Categoria[];
  nowLocal: string;
  onCreated?: () => void;
  authToken?: string | null;
};

const emptyTx = (cuentaId: string, nowLocal: string): TxForm => ({
  cuentaId,
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  categoriaId: undefined,
  ocurrioEn: nowLocal,
});

export function TransactionCreationPanel({
  cuentas,
  categorias,
  nowLocal,
  onCreated,
  authToken,
}: Props) {
  const defaultCuentaId = useMemo(() => cuentas[0]?.id ?? "", [cuentas]);
  const [form, setForm] = useState<TxForm>(() => emptyTx(defaultCuentaId, nowLocal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setForm(emptyTx(defaultCuentaId, new Date().toISOString().slice(0, 16)));
  };

  const validate = () => {
    if (!form.cuentaId) return "Selecciona una cuenta";
    if (!form.monto || Number(form.monto) <= 0) return "Monto debe ser mayor a 0";
    return null;
  };

  const handleSubmit = async () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        ...form,
        ocurrioEn: form.ocurrioEn
          ? new Date(form.ocurrioEn).toISOString()
          : new Date().toISOString(),
      };
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No se pudo registrar la transacción");
      }
      setSuccess("Transacción registrada");
      resetForm();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg">
      {error && (
        <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
          <button className="ml-2 text-xs underline" onClick={() => setError(null)}>
            cerrar
          </button>
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
          <button className="ml-2 text-xs underline" onClick={() => setSuccess(null)}>
            ok
          </button>
        </div>
      )}
      <TransactionForm
        form={form}
        cuentas={cuentas}
        categorias={categorias}
        nowLocal={nowLocal}
        busy={busy}
        isEditing={false}
        onChange={(partial) => setForm((prev) => ({ ...prev, ...partial }))}
        onSubmit={handleSubmit}
        onCancel={resetForm}
      />
    </div>
  );
}
