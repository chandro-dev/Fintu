import { formatMoney } from "@/lib/formatMoney";

interface StatCardProps {
  label: string;
  value: number;
  colorClass?: string; // Ej: "text-emerald-500"
}

export function StatCard({ label, value, colorClass = "text-slate-900" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-black/30">
      <p className="text-sm text-black dark:text-zinc-400">{label}</p>
      <p className={`text-2xl font-semibold ${colorClass}`}>{formatMoney(value)}</p>
    </div>
  );
}