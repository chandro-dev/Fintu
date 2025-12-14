import { formatMoney } from "@/lib/formatMoney";

interface FlowChartProps {
  // Aceptamos la estructura que devuelve tu hook useFinancialMetrics
  data: [string, { ingresos: number; egresos: number }][];
}

export function FlowChart({ data }: FlowChartProps) {
  
  // 1. Estado Vacío: Si no hay datos, mostramos un mensaje amigable
  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-center dark:border-white/10">
        <p className="text-sm text-slate-400 dark:text-zinc-500">
          No hay actividad reciente para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map(([label, values]) => {
        // Matemáticas seguras para calcular porcentajes visuales
        const total = (values.ingresos + values.egresos) || 1; // Evitar división por 0
        
        // Calculamos qué porcentaje del total representa el INGRESO
        // Esto determinará qué tan "verde" se ve la barra
        const incomePct = Math.min(100, Math.max(0, (values.ingresos / total) * 100));
        
        // El porcentaje de egreso es simplemente el resto (100 - ingreso)
        // Pero para efectos visuales, a veces queremos ver dos barras separadas o una barra dividida.
        // En tu diseño original usabas una barra dividida. Vamos a mejorarla.

        return (
          <div key={label} className="group space-y-1.5">
            {/* Cabecera: Etiqueta (Mes) y Valores */}
            <div className="flex items-end justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-zinc-300">
                {/* Convertimos "2023-10" a algo más legible si es necesario, o lo dejamos así */}
                {label}
              </span>
              
              <div className="flex items-center gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatMoney(values.ingresos)}
                </span>
                <span className="text-slate-300 dark:text-zinc-600">/</span>
                <span className="text-rose-500 dark:text-rose-400 font-mono">
                  {formatMoney(values.egresos)}
                </span>
              </div>
            </div>

            {/* La Barra Visual */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-rose-500/20 dark:bg-rose-500/20">
              {/* Fondo base = Color de EGRESOS (Rojo tenue)
                 Barra superior = Color de INGRESOS (Degradado Verde/Azul)
                 
                 Si incomePct es 60%, significa que 60% es verde y el 40% restante (fondo) es rojo.
              */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                style={{ width: `${incomePct}%` }}
              />
              
              {/* Línea divisoria pequeña para marcar el punto exacto (opcional, detalle estético) */}
              <div 
                className="absolute top-0 h-full w-[2px] bg-white mix-blend-overlay" 
                style={{ left: `${incomePct}%` }} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}