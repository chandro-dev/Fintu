"use client";

import { useEffect, useMemo, useState } from "react";
import { InputField, MoneyField, MultiSelectField, SelectField } from "@/components/ui/Fields";
import type { Categoria, Cuenta, TxForm } from "./types";
import { ArrowDown, ArrowUp, ArrowRightLeft } from "lucide-react";
import { parseMoneyInputToNumber } from "@/lib/moneyInput";
import { formatMoney } from "@/lib/formatMoney";

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

  useEffect(() => {
    // Si estamos editando y ya era transferencia, mantenemos el modo
    if (isEditing && form.isTransferencia) return;

    if (mode === "TRANSFERENCIA") {
      onChange({ 
        isTransferencia: true, 
        direccion: "SALIDA",
        descripcion: "", 
        categoriaId: undefined,
        categoriaIds: [] 
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

  const selectedCurrency = useMemo(() => {
    const account = cuentas.find((c) => c.id === form.cuentaId);
    return account?.moneda || "COP";
  }, [cuentas, form.cuentaId]);

  const selectedAccount = useMemo(
    () => cuentas.find((c) => c.id === form.cuentaId),
    [cuentas, form.cuentaId],
  );

  const cuentasOrigenOptions = cuentas
    .filter((c) => !c.cerradaEn || c.id === form.cuentaId)
    .map((c) => ({
      label: `${c.nombre} · ${formatMoney(Number(c.saldo ?? 0), c.moneda)}`,
      value: c.id,
    }));
  const cuentasDestinoOptions = cuentas
    .filter((c) => c.id !== form.cuentaId && (!c.cerradaEn || c.id === form.cuentaDestinoId))
    .map((c) => ({
      label: `${c.nombre} · ${formatMoney(Number(c.saldo ?? 0), c.moneda)}`,
      value: c.id,
    }));

  const categoriasFiltradas = categorias.filter((c) => {
    if (mode === "SALIDA") return c.tipo === "GASTO";
    if (mode === "ENTRADA") return c.tipo === "INGRESO";
    return true;
  });

  const categoriasOptions = categoriasFiltradas.map((c) => ({
    label: c.nombre,
    value: c.id,
  }));

  const categoriaIds =
    form.categoriaIds && Array.isArray(form.categoriaIds)
      ? form.categoriaIds
      : form.categoriaId
        ? [form.categoriaId]
        : [];

  const selectedCategoriaLabels = useMemo(() => {
    if (categoriaIds.length === 0) return [];
    const byId = new Map(categorias.map((c) => [c.id, c.nombre]));
    return categoriaIds.map((id) => ({ id, nombre: byId.get(id) ?? "Categoría" }));
  }, [categoriaIds, categorias]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSubmit();
      }}
    >
      
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
      <MoneyField
        label="Monto"
        value={form.monto > 0 ? String(form.monto) : ""}
        onChange={(raw) => {
          const value = parseMoneyInputToNumber(raw, { decimals: 2 });
          onChange({ monto: Math.max(0, value) });
        }}
        currency={selectedCurrency}
        placeholder="0"
      />
      {selectedAccount ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-black/30">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Cuenta
            </p>
            <p className="truncate font-semibold text-slate-800 dark:text-zinc-100">
              {selectedAccount.nombre}
            </p>
          </div>
          <div className="ml-4 text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Saldo
            </p>
            <p className="font-mono font-bold text-slate-800 dark:text-zinc-100">
              {formatMoney(Number(selectedAccount.saldo ?? 0), selectedAccount.moneda)}
            </p>
          </div>
        </div>
      ) : null}

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
          <div className="space-y-2">
            <MultiSelectField
              label={mode === "SALIDA" ? "Categorías (Gastos)" : "Categorías (Ingresos)"}
              values={categoriaIds}
              onChange={(vals) => onChange({ categoriaIds: vals, categoriaId: vals[0] ?? "" })}
              options={categoriasOptions}
              hint="Tip: Ctrl/Cmd + click para seleccionar varias"
              size={6}
            />
            {selectedCategoriaLabels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCategoriaLabels.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange({ categoriaIds: categoriaIds.filter((x) => x !== c.id) })}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    title="Quitar"
                  >
                    {c.nombre} ×
                  </button>
                ))}
              </div>
            )}
          </div>
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
            type="submit"
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
    </form>
  );
}
