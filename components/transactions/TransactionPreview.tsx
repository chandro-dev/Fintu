"use client";

import { Categoria, Cuenta, TxForm } from "./types";
import { formatMoney } from "@/lib/formatMoney";

type Props = {
  form: TxForm;
  cuenta?: Cuenta | null;
  categoria?: Categoria | null;
  nowLocal: string;
  currency?: string;
};

export function TransactionPreview({ form, cuenta, categoria, nowLocal, currency }: Props) {
  const isEntrada = form.direccion === "ENTRADA";
  const montoAbsoluto = Math.abs(form.monto || 0);
  const displayCurrency = currency || cuenta?.moneda || "USD";

  return (
    <div className="grid gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-black/50 dark:text-zinc-300">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] uppercase tracking-wide text-zinc-400">Previsualizacion</span>
        <span
          className={
            "rounded-full px-2 py-1 text-sm font-semibold " +
            (isEntrada ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")
          }
        >
          {isEntrada ? "+" : "-"}
          {formatMoney(montoAbsoluto, displayCurrency)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-[0.7rem]">
        {cuenta && <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-zinc-200">{cuenta.nombre}</span>}
        {categoria && <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-zinc-300">{categoria.nombre}</span>}
      </div>

      <div className="text-zinc-200">{form.descripcion || "Sin descripcion"}</div>

      <div className="text-[0.7rem] text-zinc-500">
        {form.ocurrioEn ? new Date(form.ocurrioEn).toLocaleString() : new Date(nowLocal).toLocaleString()}
      </div>
    </div>
  );
}
