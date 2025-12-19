"use client";

import { useMemo, useState, useEffect } from "react";
import { formatMoney } from "@/lib/formatMoney";
import { 
  Calculator, 
  TrendingDown, 
  AlertTriangle, 
  PiggyBank, 
  Clock, 
  BadgePercent,
  Wallet,
  CreditCard,
  Sparkles
} from "lucide-react";
import { MoneyField } from "@/components/ui/Fields";

type Props = {
  tasaEfectivaAnual: number;
  moneda: string;
  saldoActual: number;
  cupoTotal: number;
};

type ScheduleRow = {
  mes: number;
  saldo: number;
  interesPagado: number;
  capitalPagado: number;
  cuota: number;
};

// ============================================================================
// COMPONENTE: MINI GRÁFICO DE BARRAS APILADAS (CAPITAL VS INTERÉS)
// ============================================================================
function StackedBarChart({ capital, interes }: { capital: number; interes: number }) {
  const total = capital + interes;
  const safeTotal = total || 1;
  const pctCapital = (capital / safeTotal) * 100;
  const pctInteres = (interes / safeTotal) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
        <div 
            className="h-full bg-emerald-500 transition-all duration-500" 
            style={{ width: `${pctCapital}%` }} 
        />
        <div 
            className="h-full bg-rose-500 transition-all duration-500" 
            style={{ width: `${pctInteres}%` }} 
        />
      </div>
      <div className="flex justify-between text-xs font-medium">
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
           <div className="h-2 w-2 rounded-full bg-emerald-500" /> Capital ({pctCapital.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
           <div className="h-2 w-2 rounded-full bg-rose-500" /> Intereses ({pctInteres.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

export default function CreditSimulator({ tasaEfectivaAnual, moneda, saldoActual, cupoTotal }: Props) {
  // 1. ESTADO DEL FORMULARIO
  // Inicializamos con el saldo actual de la tarjeta
  const [monto, setMonto] = useState(saldoActual);
  const [cuotaMensual, setCuotaMensual] = useState(0);
  const [tasaEA, setTasaEA] = useState<number>(() => Number(tasaEfectivaAnual) || 0);

  useEffect(() => {
    setTasaEA(Number(tasaEfectivaAnual) || 0);
  }, [tasaEfectivaAnual]);

  // Calcular Tasa Mensual (TEM) desde la Anual (TEA)
  // Fórmula: (1 + TEA)^(1/12) - 1
  const tasaMensual = useMemo(() => {
    const tea = Number(tasaEA) || 0;
    return Math.pow(1 + tea / 100, 1 / 12) - 1;
  }, [tasaEA]);

  // Pago Mínimo Sugerido (Intuitivo: Intereses + 1.5% capital aprox) para inicializar
  useEffect(() => {
     if (saldoActual > 0 && cuotaMensual === 0) {
        const minInteres = saldoActual * tasaMensual;
        const minCapital = saldoActual * 0.015; // Asumimos abono del 1.5%
        setCuotaMensual(Math.ceil(minInteres + minCapital));
     }
  }, [saldoActual, tasaMensual]);

  const disponible = useMemo(
    () => Math.max(Number(cupoTotal || 0) - Number(saldoActual || 0), 0),
    [cupoTotal, saldoActual],
  );

  const usagePct = useMemo(() => {
    const cupo = Number(cupoTotal || 0);
    const saldo = Number(saldoActual || 0);
    if (cupo <= 0) return 0;
    return Math.min(100, Math.max(0, (saldo / cupo) * 100));
  }, [cupoTotal, saldoActual]);

  const interesEstimadoMes = useMemo(
    () => Math.max(0, Number(monto || 0) * tasaMensual),
    [monto, tasaMensual],
  );

  const pagoMinimoSugerido = useMemo(() => {
    const saldo = Math.max(0, Number(monto || 0));
    if (!saldo) return 0;
    const minInteres = saldo * tasaMensual;
    const minCapital = saldo * 0.015;
    return Math.ceil(minInteres + minCapital);
  }, [monto, tasaMensual]);

  // 2. MOTOR DE SIMULACIÓN (AMORTIZACIÓN)
  const simulacion = useMemo(() => {
    if (monto <= 0 || cuotaMensual <= 0) return null;

    let saldo = monto;
    let totalIntereses = 0;
    let meses = 0;
    const historial: ScheduleRow[] = [];
    let esInfinito = false;

    // Límite de seguridad de 360 meses (30 años) para evitar loops infinitos
    while (saldo > 0 && meses < 360) {
        const interesMes = saldo * tasaMensual;
        
        // Si la cuota no cubre ni los intereses, la deuda crece infinitamente
        if (cuotaMensual <= interesMes) {
            esInfinito = true;
            break;
        }

        const capitalMes = cuotaMensual - interesMes;
        let pagoReal = cuotaMensual;

        // Ajuste último mes
        if (saldo < capitalMes) {
            pagoReal = saldo + interesMes;
            saldo = 0;
        } else {
            saldo -= capitalMes;
        }

        totalIntereses += interesMes;
        meses++;
        
        historial.push({
            mes: meses,
            saldo: Math.max(0, saldo),
            interesPagado: interesMes,
            capitalPagado: pagoReal - interesMes,
            cuota: pagoReal
        });
    }

    const totalPagado = monto + totalIntereses;
    const costoPorCadaDolar = totalPagado / monto;

    return {
        meses,
        totalIntereses,
        totalPagado,
        historial,
        esInfinito,
        costoPorCadaDolar
    };

  }, [monto, cuotaMensual, tasaMensual]);

  // 3. RENDERIZADO
  if (!simulacion) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900">
      
      {/* HEADER: TITULO Y RESUMEN RÁPIDO */}
      <div className="relative overflow-hidden bg-slate-50 p-6 dark:bg-white/5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-black/20">
              <Calculator size={22} className="text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Simulación de pago (Tarjeta de crédito)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Ajusta tu cuota y mira tiempo, intereses y costo total.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
              <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                <BadgePercent size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  TEA / TEM
                </span>
              </div>
              <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {(Number(tasaEA) || 0).toFixed(2)}% / {((Number(tasaMensual) || 0) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
              <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                <CreditCard size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Uso / Disponible
                </span>
              </div>
              <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {usagePct.toFixed(1)}% · {formatMoney(disponible, moneda)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
              <Wallet size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Saldo actual
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {formatMoney(saldoActual, moneda)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
              <Sparkles size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Interés mes (est.)
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {formatMoney(interesEstimadoMes, moneda)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
              <PiggyBank size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Pago mínimo (est.)
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {formatMoney(pagoMinimoSugerido, moneda)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Tiempo (con cuota)
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {simulacion.esInfinito ? "No baja" : `${simulacion.meses} meses`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
          
          {/* COLUMNA IZQUIERDA: CONTROLES */}
          <div className="border-r border-slate-100 p-6 dark:border-white/5 lg:col-span-5 space-y-6">
              
              <div className="space-y-4">
                  <MoneyField
                      label="Monto de la Deuda"
                      value={monto}
                      onChange={(v) => setMonto(Number(v))}
                      currency={moneda}
                      minValue={100}
                      maxValue={100_000_000}
                  />
                  
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Cuota mensual (control)
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {formatMoney(cuotaMensual, moneda)}
                        </p>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setCuotaMensual(Math.max(100, pagoMinimoSugerido))}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/5"
                        >
                          Mínimo
                        </button>
                        <button
                          type="button"
                          onClick={() => setCuotaMensual(Math.ceil(Math.max(100, Number(monto || 0) * 0.1)))}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/5"
                        >
                          10%
                        </button>
                        <button
                          type="button"
                          onClick={() => setCuotaMensual(Math.ceil(Math.max(100, Number(monto || 0) * 0.2)))}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/5"
                        >
                          20%
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <input
                        type="range"
                        min={Math.max(100, Math.floor(Number(monto || 0) * 0.01))}
                        max={Math.max(100, Math.ceil(Number(monto || 0) * 0.5))}
                        step={1000}
                        value={cuotaMensual}
                        onChange={(e) => setCuotaMensual(Number(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-600 dark:bg-white/10"
                      />
                      <p className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                        <span>Min: {formatMoney(Number(monto || 0) * 0.01, moneda)}</span>
                        <span>Max: {formatMoney(Number(monto || 0) * 0.5, moneda)}</span>
                      </p>
                    </div>
                  </div>

                  <MoneyField
                      label="Cuota Mensual Exacta"
                      value={cuotaMensual}
                      onChange={(v) => setCuotaMensual(Number(v))}
                      currency={moneda}
                      minValue={100}
                      maxValue={100_000_000}
                  />
              </div>

              {simulacion.esInfinito ? (
                  <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-2 font-bold mb-1">
                          <AlertTriangle size={18} />
                          <span>¡Peligro Financiero!</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                          Tu cuota actual ({formatMoney(cuotaMensual, moneda)}) no cubre los intereses mensuales. 
                          <br/><br/>
                          Tu deuda <strong>nunca bajará</strong>, solo crecerá infinitamente. Aumenta la cuota inmediatamente.
                      </p>
                  </div>
              ) : (
                  <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-100 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-200">
                      <div className="flex items-center gap-2 font-bold mb-1 text-sm">
                          <PiggyBank size={16} />
                          <span>Consejo Financiero</span>
                      </div>
                      <p className="text-xs opacity-80">
                         Si aumentas tu cuota en <strong>{formatMoney(cuotaMensual * 0.2, moneda)}</strong>, 
                         terminarías de pagar <strong>{Math.ceil(simulacion.meses * 0.2)} meses antes</strong>.
                      </p>
                  </div>
              )}
          </div>

          {/* COLUMNA DERECHA: RESULTADOS VISUALES */}
          <div className="p-6 lg:col-span-7 bg-slate-50/50 dark:bg-black/20">
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm dark:bg-white/5 dark:border-white/5">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <Clock size={16} />
                          <span className="text-xs font-bold uppercase">Tiempo Total</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800 dark:text-white">
                          {Math.floor(simulacion.meses / 12) > 0 && <span className="text-lg">{Math.floor(simulacion.meses / 12)} años </span>}
                          {simulacion.meses % 12} meses
                      </p>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm dark:bg-white/5 dark:border-white/5">
                      <div className="flex items-center gap-2 text-rose-400 mb-1">
                          <TrendingDown size={16} />
                          <span className="text-xs font-bold uppercase">Intereses Totales</span>
                      </div>
                      <p className="text-2xl font-bold text-rose-600">
                          {formatMoney(simulacion.totalIntereses, moneda)}
                      </p>
                  </div>
              </div>

              {/* VISUALIZACIÓN DE COSTO */}
              <div className="mb-6 space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-500">Distribución de tus pagos</p>
                  <StackedBarChart capital={monto} interes={simulacion.totalIntereses} />
              </div>

              {/* TABLA DE AMORTIZACIÓN RESUMIDA */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-white/10 dark:bg-zinc-900">
                  <div className="flex justify-between p-3 bg-slate-100 text-xs font-bold text-slate-500 dark:bg-white/5">
                      <span>Proyección</span>
                      <span>Saldo Restante</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {[
                          simulacion.historial[Math.floor(simulacion.meses * 0.25)], 
                          simulacion.historial[Math.floor(simulacion.meses * 0.5)], 
                          simulacion.historial[Math.floor(simulacion.meses * 0.75)]
                      ].filter(Boolean).map((h, i) => (
                          <div key={i} className="flex justify-between p-3 text-sm">
                              <span className="text-slate-500">Mes {h.mes}</span>
                              <span className="font-mono font-medium">{formatMoney(h.saldo, moneda)}</span>
                          </div>
                      ))}
                       <div className="flex justify-between p-3 text-sm bg-emerald-50/50 dark:bg-emerald-900/10">
                              <span className="text-emerald-600 font-bold">Mes {simulacion.meses} (Final)</span>
                              <span className="font-mono font-bold text-emerald-600">{formatMoney(0, moneda)}</span>
                       </div>
                  </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-4 text-center">
                  * Proyección estimada basada en una tasa fija constante. El costo real por cada {formatMoney(1, moneda)} prestado será de {formatMoney(simulacion.costoPorCadaDolar, moneda)}.
              </p>

          </div>
      </div>
    </div>
  );
}
