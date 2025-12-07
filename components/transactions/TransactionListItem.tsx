"use client";

import { Transaccion } from "./types";
import { formatMoney } from "@/lib/formatMoney";

type Props = {
  tx: Transaccion;
  onEdit: (tx: Transaccion) => void;
  onDelete?: (id: string) => void;
};

export function TransactionListItem({ tx, onEdit, onDelete }: Props) {
  const isEntrada = tx.direccion === "ENTRADA";
  const montoAbs = Math.abs(Number(tx.monto) || 0);
  const chipClass = isEntrada ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-200" : "bg-rose-500/15 text-rose-400 dark:text-rose-200";

  return (
    <div className="rounded-xl border border-black/5 bg-white/80 p-4 shadow dark:border-white/10 dark:bg-black/30">
      <div className="grid gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-black/50 dark:text-zinc-300">
        <div className="flex items-center justify-between">
          <span className="text-[0.9rem] uppercase tracking-wide text-zinc-400">💳 {tx.cuenta?.nombre ?? tx.cuentaId}</span>
          <span
            className={
              "rounded-full px-2 py-1 text-xl font-semibold " + chipClass
            }
          >
            {isEntrada ? "+" : "-"}
            {formatMoney(montoAbs, tx.moneda)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-[1.0rem]">
          {tx.cuenta && <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-zinc-200">🏦 {tx.cuenta.nombre}</span>}
          {tx.categoria && <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-zinc-300">🏷️ {tx.categoria.nombre}</span>}
        </div>

        <div className="text-zinc-200 text-sm">{tx.descripcion || "Sin descripcion"}</div>

        <div className="text-[1.0rem] text-zinc-500">
          {tx.ocurrioEn ? new Date(tx.ocurrioEn).toLocaleString() : new Date().toLocaleString()}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onEdit(tx)}
            className="rounded-full border border-sky-400/50 px-3 py-1 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
            title="Editar transacción"
          >
            ✏️ Editar
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(tx.id)}
              className="rounded-full border border-red-400/60 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20"
              title="Eliminar transacción"
            >
              🗑️ Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
