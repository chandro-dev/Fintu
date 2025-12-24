"use client";

import { formatMoney } from "@/lib/formatMoney";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  ArrowRightLeft, 
  Calendar, 
  Edit2, 
  Trash2,
  Wallet
} from "lucide-react";
import type { Transaccion } from "./types";

interface Props {
  tx: Transaccion;
  onEdit: (tx: Transaccion) => void;
  onDelete?: (id: string) => void;
}

export function TransactionListItem({ tx, onEdit, onDelete }: Props) {
  // 1. Detectar si es transferencia
  const isTransfer = Boolean(tx.transaccionRelacionadaId);
  const isIncome = tx.direccion === "ENTRADA";

  // 2. Definir estilos basados en la DIRECCIÓN (Entrada vs Salida)
  let iconColorClass = "";
  let amountColorClass = "";
  let bgClass = "";
  let Icon = isIncome ? ArrowDownRight : ArrowUpRight; // Icono por defecto
  let sign = isIncome ? "+ " : "- ";

  if (isIncome) {
    // === ESTILO DE ENTRADA (Verde) ===
    iconColorClass = "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400";
    amountColorClass = "text-emerald-600 dark:text-emerald-400";
    bgClass = "hover:bg-emerald-50/30 dark:hover:bg-emerald-500/10";
  } else {
    // === ESTILO DE SALIDA (Rojo) ===
    iconColorClass = "text-rose-600 bg-rose-100 dark:bg-rose-500/20 dark:text-rose-400";
    amountColorClass = "text-rose-600 dark:text-rose-400";
    bgClass = "hover:bg-rose-50/30 dark:hover:bg-rose-500/10";
  }

  // 3. Ajuste específico si es Transferencia
  // Mantenemos el color rojo/verde, pero cambiamos el icono para indicar que es movimiento interno
  if (isTransfer) {
    Icon = ArrowRightLeft; 
    // Opcional: Si quieres diferenciarlo un poco más, podrías usar un tono intermedio, 
    // pero si quieres que se vea "parecido a entrar o salir", dejar los colores rojo/verde es lo mejor.
  }

  // 4. Formato de Moneda y Fecha
  const currency = tx.moneda || "COP";
  const dateObj = new Date(tx.ocurrioEn);
  const day = dateObj.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const time = dateObj.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`group flex flex-col gap-3 rounded-2xl border border-transparent px-4 py-3 transition-all duration-200 ${bgClass} border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex items-center gap-4 overflow-hidden">
        {/* Icono */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconColorClass}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>

        {/* Info Principal */}
        <div className="flex flex-col overflow-hidden">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {tx.descripcion || (isTransfer ? (isIncome ? "Transferencia Recibida" : "Transferencia Enviada") : "Sin descripción")}
          </p>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {/* Cuenta */}
            <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md">
              <Wallet size={10} />
              {tx.cuenta?.nombre}
            </span>
            
            <span className="text-slate-300">•</span>

            {/* Categoría */}
            {tx.categoria ? (
              <span 
                className="flex items-center gap-1"
                style={{ color: tx.categoria.color || undefined }}
              >
                {tx.categoria.nombre}
              </span>
            ) : (
              <span>General</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1 sm:pl-2">
        <div className="flex flex-col gap-1">
          {/* Monto con color y signo dinámico */}
          <p className={`text-base font-bold tabular-nums tracking-tight ${amountColorClass}`}>
            {sign}
            {formatMoney(Number(tx.monto), currency)}
          </p>

          {/* Fecha */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <Calendar size={10} />
            <span>
              {day}, {time}
            </span>
          </div>
        </div>

        {/* Acciones: visibles en móvil (no hay hover), hover en desktop */}
        <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={() => onEdit(tx)}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-200 hover:text-sky-600 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
            title="Editar"
          >
            <Edit2 size={16} />
          </button>

          {onDelete && (
            <button
              onClick={() => onDelete(tx.id)}
              className="rounded-md p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 transition-colors"
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
