"use client";

import { useMemo } from "react";
import { Transaccion } from "./types";
import { formatMoney } from "@/lib/formatMoney";
import {
  Pencil,
  Trash2,
  Wallet,
  Tag,
  CalendarClock,
  ArrowDownRight,
  ArrowUpRight
} from "lucide-react";

type Props = {
  tx: Transaccion;
  onEdit: (tx: Transaccion) => void;
  onDelete?: (id: string) => void;
};

export function TransactionListItem({ tx, onEdit, onDelete }: Props) {
  // Lógica de presentación
  const isEntrada = tx.direccion === "ENTRADA";
  const montoAbs = Math.abs(Number(tx.monto) || 0);

  // Formateo de fecha más limpio (Ej: "14 oct, 15:30")
  const fechaFormateada = useMemo(() => {
    const date = tx.ocurrioEn ? new Date(tx.ocurrioEn) : new Date();
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }, [tx.ocurrioEn]);

  // Colores dinámicos para el monto
  const amountClass = isEntrada
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-slate-900 dark:text-slate-100";

  // Color de fondo para el icono de categoría
  const categoryColor = tx.categoria?.color || "#71717a"; // Zinc-500 default

  return (
    <div className="group relative flex items-center gap-4 rounded-2xl border border-transparent bg-white p-4 transition-all hover:border-slate-200 hover:shadow-md dark:bg-white/5 dark:hover:border-white/10 dark:hover:bg-white/10">
      {/* 1. ICONO VISUAL (Izquierda) */}
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5"
        style={{
          backgroundColor: `${categoryColor}20`, // 20 = 12% opacidad hex
          color: categoryColor
        }}
      >
        {isEntrada ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
      </div>

      {/* 2. DETALLES (Centro) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Descripción / Título */}
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-slate-900 dark:text-zinc-100">
            {tx.descripcion || "Sin descripción"}
          </p>
          {tx.categoria && (
            <span
              className="hidden rounded-full px-1.5 py-0.5 text-[10px] font-medium opacity-70 sm:inline-block"
              style={{
                backgroundColor: `${categoryColor}30`,
                color: categoryColor
              }}
            >
              {tx.categoria.nombre}
            </span>
          )}
        </div>

        {/* Metadatos: Cuenta y Fecha */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
          <span className="flex items-center gap-1" title="Cuenta">
            <Wallet size={12} className="opacity-70" />
            {tx.cuenta?.nombre || "Cuenta desconocida"}
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-600" />
          <span className="flex items-center gap-1" title="Fecha">
            <CalendarClock size={12} className="opacity-70" />
            {fechaFormateada}
          </span>
        </div>
      </div>

      {/* 3. MONTO Y ACCIONES (Derecha) */}
      <div className="flex flex-col items-end gap-1">
        {/* Monto */}
        <span
          className={`font-mono text-base font-bold tracking-tight ${amountClass}`}
        >
          {isEntrada ? "+" : "-"} {formatMoney(montoAbs, tx.moneda)}
        </span>

        {/* Botones de Acción (Visibles en hover o en móvil si se ajusta CSS) */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(tx);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300"
            title="Editar"
          >
            <Pencil size={16} />
          </button>

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(tx.id);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-300"
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
