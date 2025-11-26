"use client";

import { useMemo } from "react";
import { Categoria, Cuenta, TxForm } from "./types";
import { InputField, SelectField } from "../ui/Fields";
import { formatMoney } from "@/lib/formatMoney";
import { TransactionPreview } from "./TransactionPreview";

type Props = {
  form: TxForm;
  cuentas: Cuenta[];
  categorias: Categoria[];
  nowLocal: string;
  busy: boolean;
  isEditing: boolean;
  onChange: (partial: Partial<TxForm>) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  onCancel: () => void;
};

export function TransactionForm({
  form,
  cuentas,
  categorias,
  nowLocal,
  busy,
  isEditing,
  onChange,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  const isEntrada = form.direccion === "ENTRADA";

  const cuentaSeleccionada = useMemo(
    () => cuentas.find((c) => c.id === form.cuentaId),
    [cuentas, form.cuentaId]
  );
  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === form.categoriaId),
    [categorias, form.categoriaId]
  );

  const montoAbsoluto = Math.abs(form.monto || 0);
  const currency = cuentaSeleccionada?.moneda ?? "USD";

  const handleMontoInputChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const numero = digits ? Number(digits) : 0;
    onChange({ monto: numero });
  };

  const montoDisplay = montoAbsoluto ? formatMoney(montoAbsoluto, currency) : "";

  return (
    <div className="space-y-4 text-slate-900 dark:text-zinc-100">
      {/* Toggle visual Ingreso / Gasto */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/40">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Tipo de movimiento
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ direccion: "ENTRADA" })}
            className={
              "flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition " +
              (isEntrada
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-transparent dark:bg-black/40 dark:text-zinc-400 dark:hover:bg-white/5")
            }
          >
            <div className="flex flex-col text-left">
              <span>Ingreso</span>
              <span className="text-[0.65rem] font-normal text-emerald-800/80">
                Aumenta el saldo
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-500">
              +
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChange({ direccion: "SALIDA" })}
            className={
              "flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition " +
              (!isEntrada
                ? "border-rose-400 bg-rose-500/15 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-transparent dark:bg-black/40 dark:text-zinc-400 dark:hover:bg-white/5")
            }
          >
            <div className="flex flex-col text-left">
              <span>Gasto</span>
              <span className="text-[0.65rem] font-normal text-rose-800/80">
                Disminuye el saldo
              </span>
            </div>
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-400">
              −
            </span>
          </button>
        </div>
      </div>

      {/* Campos del formulario */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField
          label="Cuenta"
          value={form.cuentaId}
          onChange={(v) => onChange({ cuentaId: v })}
          options={[
            { label: "Selecciona cuenta", value: "" },
            ...cuentas.map((c) => ({ label: c.nombre, value: c.id })),
          ]}
        />

        <InputField
          label="Fecha y hora"
          value={form.ocurrioEn || nowLocal}
          onChange={(v) => onChange({ ocurrioEn: v })}
          type="datetime-local"
        />

        {/* Monto: input texto, solo números, formateado tipo moneda */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-black/50">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Monto
              </p>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold " +
                  (isEntrada
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-rose-500/15 text-rose-500")
                }
              >
                {isEntrada ? "Ingreso" : "Gasto"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={
                  "flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold " +
                  (isEntrada
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "bg-rose-500/20 text-rose-500")
                }
              >
                {isEntrada ? "+" : "−"}
              </div>

              <div className="flex-1">
                <InputField
                  label=""
                  type="text"
                  // si tu InputField no pasa inputMode al <input>, puedes agregarlo allí en su implementación
                  inputMode="numeric"
                  value={montoDisplay}
                  onChange={handleMontoInputChange}
                  placeholder="$ 0"
                />
                <div className="mt-1 text-[0.7rem] uppercase tracking-widest text-zinc-500">
                  {montoAbsoluto ? formatMoney(montoAbsoluto) : "Sin monto"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <SelectField
          label="Categoría (opcional)"
          value={form.categoriaId ?? ""}
          onChange={(v) => onChange({ categoriaId: v || undefined })}
          options={[
            { label: "Sin categoría", value: "" },
            ...categorias.map((c) => ({ label: c.nombre, value: c.id })),
          ]}
        />

        <InputField
          label="Descripción"
          value={form.descripcion}
          onChange={(v) => onChange({ descripcion: v })}
        />
      </div>

      <TransactionPreview
        form={form}
        cuenta={cuentaSeleccionada}
        categoria={categoriaSeleccionada}
        nowLocal={nowLocal}
        currency={currency}
      />

      {/* Botones */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
        </button>
        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy ? "Borrando..." : "Eliminar"}
          </button>
        )}
      </div>
    </div>
  );
}
