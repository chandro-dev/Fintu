import { formatMoney } from "@/lib/formatMoney";

type Segment = {
  label: string;
  value: number;
  color: string;
};

interface DonutChartProps {
  segments: Segment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number; // px
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 160,
}: DonutChartProps) {
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);

  if (!total) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-center text-sm text-slate-400 dark:border-white/10 dark:text-zinc-500">
        Sin datos para graficar
      </div>
    );
  }

  let current = 0;
  const gradient = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = (s.value / total) * 100;
      const start = current;
      const end = current + pct;
      current = end;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${gradient})` }}
      >
        <div
          className="absolute rounded-full bg-white/90 text-center shadow-sm backdrop-blur dark:bg-zinc-900/90"
          style={{ width: size * 0.58, height: size * 0.58 }}
        >
          <div className="flex h-full flex-col items-center justify-center px-2 text-xs text-slate-500 dark:text-zinc-400">
            {centerLabel && <span className="mb-1 font-semibold text-slate-600 dark:text-zinc-200">{centerLabel}</span>}
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {centerValue || formatMoney(total)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-2 text-xs">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-slate-700 dark:text-zinc-200">{s.label}</span>
            </div>
            <span className="font-mono text-slate-600 dark:text-zinc-400">{formatMoney(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
