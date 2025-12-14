import { formatMoney } from "@/lib/formatMoney";

interface CategoryBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

export function CategoryBar({ label, value, maxValue, color }: CategoryBarProps) {
  const width = Math.min(100, Math.max(8, (value / Math.max(maxValue, 1)) * 100));
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-900 dark:text-white">{label}</span>
        <span className="text-slate-600 dark:text-zinc-400">{formatMoney(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}