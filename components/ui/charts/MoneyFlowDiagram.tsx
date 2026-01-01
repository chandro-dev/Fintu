import { formatMoney } from "@/lib/formatMoney";

interface FlowSnapshot {
  ingresos: number;
  gastos: number;
  transferIn: number;
  transferOut: number;
  ajustes: number;
  neto: number;
}

interface Props {
  data: FlowSnapshot;
}

export function MoneyFlowDiagram({ data }: Props) {
  const items = [
    { key: "ingresos", label: "Entradas", value: Math.abs(data.ingresos), color: "from-emerald-500 to-teal-400" },
    { key: "transferIn", label: "Transferencias recibidas", value: Math.abs(data.transferIn), color: "from-sky-500 to-blue-500" },
    { key: "transferOut", label: "Transferencias enviadas", value: Math.abs(data.transferOut), color: "from-indigo-500 to-purple-500" },
    { key: "gastos", label: "Gastos", value: Math.abs(data.gastos), color: "from-rose-500 to-orange-400" },
    { key: "ajustes", label: "Ajustes", value: Math.abs(data.ajustes), color: "from-amber-500 to-yellow-400" },
  ].filter((i) => i.value > 0);

  const total = items.reduce((acc, i) => acc + i.value, 0) || 1;
  const netoColor =
    data.neto > 0 ? "text-emerald-600 bg-emerald-500/10" : data.neto < 0 ? "text-rose-600 bg-rose-500/10" : "text-slate-600 bg-slate-200/50";

  if (items.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
        Sin movimiento suficiente para el diagrama.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3">
            <div className="w-44 rounded-md bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 dark:bg-white/5 dark:text-white dark:ring-white/10">
              {item.label}
            </div>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${item.color}`}
                style={{ width: `${Math.max(6, (item.value / total) * 100)}%` }}
              />
            </div>
            <div className="w-28 text-right font-mono text-xs text-slate-700 dark:text-zinc-200">
              {formatMoney(item.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
        <span className="font-semibold text-slate-700 dark:text-white">Neto (flujo filtrado)</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${netoColor}`}>
          {formatMoney(data.neto)}
        </span>
      </div>
    </div>
  );
}
