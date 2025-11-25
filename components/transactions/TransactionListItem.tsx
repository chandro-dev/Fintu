"use client";

import { Transaccion } from "./types";
import { formatMoney } from "@/lib/formatMoney";

type Props = {
  tx: Transaccion;
  onEdit: (tx: Transaccion) => void;
};

export function TransactionListItem({ tx, onEdit }: Props) {
  const isEntrada = tx.direccion === "ENTRADA";
  const montoAbs = Math.abs(Number(tx.monto) || 0);
  const chipClass = isEntrada ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-200" : "bg-rose-500/15 text-rose-400 dark:text-rose-200";

  return (
    <div className="rounded-xl border border-black/5 bg-white/80 p-4 shadow dark:border-white/10 dark:bg-black/30">
      <div className="grid gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-black/50 dark:text-zinc-300">
        <div className="flex items-center justify-between">
          <span className="text-[0.9rem] uppercase tracking-wide text-zinc-400">{tx.cuenta?.nombre ?? tx.cuentaId}</span>
          <span
            className={
              "rounded-full px-2 py-1 text-sm font-semibold " + chipClass
            }
          >
            {isEntrada ? "+" : "-"}
            {formatMoney(montoAbs, tx.moneda)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-[0.7rem]">
          {tx.cuenta && <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-zinc-200">{tx.cuenta.nombre}</span>}
          {tx.categoria && <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-zinc-300">{tx.categoria.nombre}</span>}
        </div>

        <div className="text-zinc-200">{tx.descripcion || "Sin descripcion"}</div>

        <div className="text-[0.7rem] text-zinc-500">
          {tx.ocurrioEn ? new Date(tx.ocurrioEn).toLocaleString() : new Date().toLocaleString()}
        </div>
        <button
          onClick={() => onEdit(tx)}
          className="mt-3 text-xs font-semibold text-sky-300 underline underline-offset-4"
        >
          Editar
        </button>
      </div>
    </div>
  );
}
