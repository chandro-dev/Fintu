"use client";

import { useEffect, useState } from "react";
import { InputField, SelectField } from "@/components/ui/Fields";
import type { Categoria, Cuenta, TxForm } from "./types";
import { ArrowDown, ArrowUp, ArrowRightLeft } from "lucide-react";
import { formatMoneyInput, normalizeMoneyInput } from "@/lib/moneyInput";

const MIN_MONTO = 100;
const MAX_MONTO = 100_000_000;

type Props = {
  form: TxForm;
  cuentas: Cuenta[];
  categorias: Categoria[];
  busy?: boolean;
  isEditing?: boolean;
  onChange: (partial: Partial<TxForm>) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  nowLocal?: string;
};

type Mode = "SALIDA" | "ENTRADA" | "TRANSFERENCIA";

export function TransactionForm({
  form,
  cuentas,
  categorias,
  busy,
  isEditing,
  onChange,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  
  const [mode, setMode] = useState<Mode>(
    form.isTransferencia ? "TRANSFERENCIA" : (form.direccion as Mode) || "SALIDA"
  );

  const [displayMonto, setDisplayMonto] = useState("");

  useEffect(() => {
    if (form.monto && form.monto > 0) {
      setDisplayMonto(formatMoneyInput(String(form.monto)));
    } else if (!isEditing && form.monto === 0) {
        setDisplayMonto("");
    }
  }, [form.monto, isEditing]);

  useEffect(() => {
    // Si estamos editando y ya era transferencia, mantenemos el modo
    if (isEditing && form.isTransferencia) return;

    if (mode === "TRANSFERENCIA") {
      onChange({ 
        isTransferencia: true, 
        direccion: "SALIDA",
        descripcion: "", 
        categoriaId: undefined 
      });
    } else {
      onChange({ 
        isTransferencia: false, 
        direccion: mode, 
        cuentaDestinoId: undefined 
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeMoneyInput(e.target.value, { decimals: 2 });
    if (normalized === "") {
      setDisplayMonto("");
      onChange({ monto: 0 });
      return;
    }
    const numericValue = Number(normalized);
    if (!Number.isFinite(numericValue)) {
      setDisplayMonto("");
      onChange({ monto: 0 });
      return;
    }

    const clamped = Math.min(MAX_MONTO, Math.max(MIN_MONTO, numericValue));
    const normalizedClamped = clamped.toFixed(2);
    setDisplayMonto(formatMoneyInput(normalizedClamped));
    onChange({ monto: clamped });
  };

  const cuentasOrigenOptions = cuentas
    .filter((c) => !c.cerradaEn || c.id === form.cuentaId)
    .map((c) => ({ label: c.nombre, value: c.id }));
  const cuentasDestinoOptions = cuentas
    .filter((c) => c.id !== form.cuentaId && (!c.cerradaEn || c.id === form.cuentaDestinoId))
    .map((c) => ({ label: c.nombre, value: c.id }));

  const categoriasOptions = [
    { label: "Sin categoría", value: "" },
    ...categorias.map((c) => ({ label: c.nombre, value: c.id })),
  ];

  return (
    <div className="space-y-5">
      
      {/* TABS DE SELECCIÓN */}
      {/* Si es una transferencia existente, no mostramos tabs para evitar romper la integridad */}
      {(!isEditing || !form.isTransferencia) && (
        <div className={`grid gap-2 p-1 bg-slate-100 dark:bg-black/40 rounded-xl ${isEditing ? "grid-cols-2" : "grid-cols-3"}`}>
          <button
            type="button"
            onClick={() => setMode("SALIDA")}
            className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
              mode === "SALIDA"
                ? "bg-white dark:bg-zinc-800 text-rose-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"
            }`}
          >
            <ArrowUp size={16} /> Gasto
          </button>
          
          <button
            type="button"
            onClick={() => setMode("ENTRADA")}
            className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
              mode === "ENTRADA"
                ? "bg-white dark:bg-zinc-800 text-emerald-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"
            }`}
          >
            <ArrowDown size={16} /> Ingreso
          </button>
          
          {/* Ocultamos el botón "Transferir" si estamos editando */}
          {!isEditing && (
            <button
              type="button"
              onClick={() => setMode("TRANSFERENCIA")}
              className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "TRANSFERENCIA"
                  ? "bg-white dark:bg-zinc-800 text-sky-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400"
              }`}
            >
              <ArrowRightLeft size={16} /> Transferir
            </button>
          )}
        </div>
      )}

      {/* Si estamos editando una transferencia, mostramos un aviso */}
      {isEditing && form.isTransferencia && (
        <div className="bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
           <ArrowRightLeft size={16} />
           <span className="font-medium">Editando Transferencia</span>
        </div>
      )}

      {/* INPUT MONTO */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">
            Monto
        </label>
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
            <input
                type="text"
                value={displayMonto}
                onChange={handleMoneyChange}
                placeholder="0"
                autoFocus={!isEditing}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-4 text-xl font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:ring-white/5"
            />
        </div>
      </div>

      {/* GRID DE CUENTAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={mode === "TRANSFERENCIA" ? "col-span-1" : "md:col-span-2"}>
          <SelectField
            label={mode === "TRANSFERENCIA" ? "Desde (Origen)" : "Cuenta"}
            value={form.cuentaId}
            onChange={(v) => onChange({ cuentaId: v })}
            options={cuentasOrigenOptions}
            placeholder="Selecciona cuenta"
            // Deshabilitamos cambio de cuenta si es transferencia existente para evitar inconsistencias
            disabled={isEditing && form.isTransferencia} 
          />
        </div>

        {mode === "TRANSFERENCIA" && !isEditing && (
          <div className="col-span-1 animate-in slide-in-from-left-2 fade-in duration-300">
            <SelectField
              label="Hacia (Destino)"
              value={form.cuentaDestinoId || ""}
              onChange={(v) => onChange({ cuentaDestinoId: v })}
              options={cuentasDestinoOptions}
              placeholder="Selecciona destino"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="Fecha y Hora"
          type="datetime-local"
          value={form.ocurrioEn ?? ""}
          onChange={(v) => onChange({ ocurrioEn: v })}
        />

        {mode !== "TRANSFERENCIA" && (
            <SelectField
            label="Categoría"
            value={form.categoriaId ?? ""}
            onChange={(v) => onChange({ categoriaId: v })}
            options={categoriasOptions}
            placeholder="Sin categoría"
            />
        )}
      </div>

      {mode !== "TRANSFERENCIA" && (
        <InputField
            label="Descripción / Nota"
            value={form.descripcion}
            onChange={(v) => onChange({ descripcion: v })}
            placeholder="Ej: Compras del super"
        />
      )}

      {/* BOTONES */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10 mt-2">
        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-sm font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-2 rounded-lg transition-colors"
          >
            Eliminar
          </button>
        ) : (
          <div /> 
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className={`
              px-6 py-2 text-sm font-semibold text-white rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100
              ${mode === "SALIDA" ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20" : ""}
              ${mode === "ENTRADA" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : ""}
              ${mode === "TRANSFERENCIA" ? "bg-sky-500 hover:bg-sky-600 shadow-sky-500/20" : ""}
            `}
          >
            {busy ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
