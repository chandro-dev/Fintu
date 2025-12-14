import { StatCard } from "@/components/ui/charts/StatCard";

interface SummaryProps {
  ingresos: number;
  egresos: number;
  neto: number;
  onNewTransaction: () => void;
}

export function SummaryWidget({ ingresos, egresos, neto, onNewTransaction }: SummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resumen</h2>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <StatCard label="Ingresos" value={ingresos} colorClass="text-emerald-300" />
        <StatCard label="Egresos" value={egresos} colorClass="text-rose-300" />
        <StatCard label="Neto" value={neto} colorClass="text-sky-300" />
      </div>
      <button
        onClick={onNewTransaction}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
      >
        Nueva transacción
      </button>
    </div>
  );
}