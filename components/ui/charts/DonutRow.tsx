import { formatMoney } from "@/lib/formatMoney";

interface DonutRowProps {
  label: string;
  value: number;
  total: number;
  color?: string; // Opcional: para personalizar el color del anillo
}

export function DonutRow({ 
  label, 
  value, 
  total, 
  color = "#38bdf8" // Default: Sky-400
}: DonutRowProps) {
  // Evitamos división por cero
  const safeTotal = total === 0 ? 1 : total;
  
  // Calculamos porcentaje (clamp entre 0 y 100)
  const pct = Math.min(100, Math.max(0, (value / safeTotal) * 100));

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10">
      
      {/* El Gráfico Circular (CSS Conic Gradient) */}
      <div className="relative h-12 w-12 flex-shrink-0">
        <div
          className="absolute inset-0 rounded-full transition-all duration-500"
          style={{
            background: `conic-gradient(${color} ${pct}%, rgba(128,128,128,0.1) ${pct}% 100%)`
          }}
        />
        {/* Círculo interior para crear efecto 'Donut' */}
        <div className="absolute inset-2 rounded-full bg-slate-50 dark:bg-zinc-900" />
        
        {/* Texto de porcentaje centrado */}
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700 dark:text-zinc-300">
          {Math.round(pct)}%
        </div>
      </div>

      {/* Textos */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {label}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
          {formatMoney(value)}
        </p>
      </div>
    </div>
  );
}