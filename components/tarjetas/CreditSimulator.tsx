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
  saldoInteres?: number;
  saldoCapital?: number;
  cupoTotal: number;
  diaCorte?: number;
  diaPago?: number;
  comprasActivas?: {
    id: string;
    descripcion?: string | null;
    montoTotal: number;
    saldoPendiente: number;
    cuotasTotales?: number | null;
    ocurrioEn: string;
  }[];
};

type ScheduleRow = {
  mes: number;
  saldoInicio: number;
  pago: number;
  pagoInteres: number;
  pagoCapital: number;
  interesGenerado: number;
  saldoFin: number;
  pagaTodo: boolean;
  cuotasCubiertas: number;
  cuotasPendientes: number;
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

export default function CreditSimulator({
  tasaEfectivaAnual,
  moneda,
  saldoActual,
  saldoInteres = 0,
  saldoCapital,
  cupoTotal,
  comprasActivas = [],
}: Props) {
  // 1. ESTADO DEL FORMULARIO
  // Saldos base (si el backend manda desglose, mejor)
  const baseInteres = Math.max(0, Number(saldoInteres) || 0);
  const baseCapital = Math.max(
    0,
    saldoCapital !== undefined && saldoCapital !== null
      ? Number(saldoCapital) || 0
      : Math.max(0, Number(saldoActual) - baseInteres),
  );

  // Inicializamos con el saldo actual de la tarjeta como referencia
  const [monto, setMonto] = useState(saldoActual);
  const [cuotaMensual, setCuotaMensual] = useState(0);
  const [tasaEA, setTasaEA] = useState<number>(() => Number(tasaEfectivaAnual) || 0);
  const [graciaSiPagaTodo, setGraciaSiPagaTodo] = useState(true);

  useEffect(() => {
    setTasaEA(Number(tasaEfectivaAnual) || 0);
  }, [tasaEfectivaAnual]);

  // Calcular Tasa Mensual (TEM) desde la Anual (TEA)
  // Fórmula: (1 + TEA)^(1/12) - 1
  const tasaMensual = useMemo(() => {
    const tea = Number(tasaEA) || 0;
    return Math.pow(1 + tea / 100, 1 / 12) - 1;
  }, [tasaEA]);

  // Pago Mínimo Sugerido (aprox: interés mes + 1.5% de capital)
  useEffect(() => {
     if (saldoActual > 0 && cuotaMensual === 0) {
        const minInteres = Math.max(0, baseCapital) * tasaMensual;
        const minCapital = Math.max(0, baseCapital) * 0.015;
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

  const interesEstimadoMes = useMemo(() => {
    const capital = Math.max(0, baseCapital);
    return Math.max(0, capital * tasaMensual);
  }, [baseCapital, tasaMensual]);

  const pagoMinimoSugerido = useMemo(() => {
    const saldo = Math.max(0, Number(monto || 0));
    if (!saldo) return 0;
    const minInteres = Math.max(0, baseCapital) * tasaMensual;
    const minCapital = Math.max(0, baseCapital) * 0.015;
    return Math.ceil(minInteres + minCapital);
  }, [monto, tasaMensual, baseCapital]);

  const comprasOrdenadas = useMemo(() => {
    return [...(comprasActivas || [])].sort(
      (a, b) => new Date(a.ocurrioEn).getTime() - new Date(b.ocurrioEn).getTime(),
    );
  }, [comprasActivas]);

  const cuotasInfo = useMemo(() => {
    const items = comprasOrdenadas
      .filter((c) => Number(c.saldoPendiente) > 0)
      .map((c) => {
        const total = Math.max(0, Number(c.montoTotal) || 0);
        const pendiente = Math.max(0, Number(c.saldoPendiente) || 0);
        const cuotasTotales = Math.max(1, Math.trunc(Number(c.cuotasTotales || 1)));
        const cuotaBase = cuotasTotales > 0 ? total / cuotasTotales : total;
        const restantes = cuotaBase > 0 ? Math.max(1, Math.ceil(pendiente / cuotaBase)) : 1;
        const cuotaMinAprox = Math.min(pendiente, cuotaBase);

        return {
          id: c.id,
          descripcion: c.descripcion || "Compra diferida",
          ocurrioEn: c.ocurrioEn,
          pendiente,
          cuotaBase,
          restantes,
          cuotaMinAprox,
        };
      });

    const pagoMinCuotasAprox = items.reduce((acc, i) => acc + i.cuotaMinAprox, 0);
    return { items, pagoMinCuotasAprox };
  }, [comprasOrdenadas]);

  const allocation = (pago: number, interes: number, capital: number) => {
    const pagoNum = Math.max(0, Number(pago) || 0);
    const i = Math.max(0, Number(interes) || 0);
    const c = Math.max(0, Number(capital) || 0);
    const pagoInteres = Math.min(pagoNum, i);
    const resto = pagoNum - pagoInteres;
    const pagoCapital = Math.min(resto, c);
    return {
      pagoInteres,
      pagoCapital,
      interesRestante: i - pagoInteres,
      capitalRestante: c - pagoCapital,
      pagoReal: pagoInteres + pagoCapital,
    };
  };

  // 2. MOTOR DE SIMULACIÓN (ciclos mensuales estilo tarjeta)
  const simulacion = useMemo(() => {
    if (monto <= 0 || cuotaMensual <= 0) return null;

    let interes = Math.max(0, baseInteres);
    let capital = Math.max(0, baseCapital);
    let saldo = Math.max(0, interes + capital);
    let totalIntereses = 0;
    let meses = 0;
    const historial: ScheduleRow[] = [];
    let esInfinito = false;

    const cuotasState = cuotasInfo.items.map((c) => ({
      ...c,
      pendiente: c.pendiente,
    }));

    while (saldo > 0 && meses < 360) {
      const saldoInicio = saldo;
      const pagoDeseado = Math.max(0, Number(cuotaMensual) || 0);

      // Si el usuario intenta pagar más que la deuda, limitamos al saldo.
      const pago = Math.min(pagoDeseado, saldoInicio);
      const a = allocation(pago, interes, capital);
      interes = a.interesRestante;
      capital = a.capitalRestante;

      const pagaTodo = a.pagoReal >= saldoInicio - 0.01;

      let capitalDisponible = a.pagoCapital;
      let cuotasCubiertas = 0;
      let cuotasPendientes = cuotasState.filter((c) => c.pendiente > 0).length;

      if (cuotasState.length > 0 && capitalDisponible > 0) {
        // 1) cubrir cuota mínima aprox (FIFO)
        for (const compra of cuotasState) {
          if (capitalDisponible <= 0) break;
          if (compra.pendiente <= 0) continue;
          const cuotaMin = Math.min(compra.pendiente, compra.cuotaMinAprox);
          const pagoCuota = Math.min(capitalDisponible, cuotaMin);
          compra.pendiente = Math.max(0, compra.pendiente - pagoCuota);
          capitalDisponible -= pagoCuota;
          if (pagoCuota + 0.01 >= cuotaMin) cuotasCubiertas += 1;
        }

        // 2) excedente: abono a capital a compras (FIFO)
        if (capitalDisponible > 0) {
          for (const compra of cuotasState) {
            if (capitalDisponible <= 0) break;
            if (compra.pendiente <= 0) continue;
            const pagoExtra = Math.min(capitalDisponible, compra.pendiente);
            compra.pendiente = Math.max(0, compra.pendiente - pagoExtra);
            capitalDisponible -= pagoExtra;
          }
        }
      }

      // Interés del siguiente ciclo:
      // - Si paga todo y hay gracia, el interés del próximo corte lo aproximamos en 0.
      // - Si "revolve" (no paga todo), se genera interés mensual sobre el capital restante.
      const interesGenerado =
        graciaSiPagaTodo && pagaTodo ? 0 : Math.max(0, capital * tasaMensual);

      interes = Math.max(0, interes + interesGenerado);
      saldo = Math.max(0, interes + capital);

      totalIntereses += interesGenerado;
      meses++;

      // Si el pago no cubre al menos el interés generado (y se está revolviendo), se hace infinito.
      if (!pagaTodo && cuotaMensual <= interesGenerado) {
        esInfinito = true;
        historial.push({
          mes: meses,
          saldoInicio,
          pago,
          pagoInteres: a.pagoInteres,
          pagoCapital: a.pagoCapital,
          interesGenerado,
          saldoFin: saldo,
          pagaTodo,
          cuotasCubiertas,
          cuotasPendientes,
        });
        break;
      }

      historial.push({
        mes: meses,
        saldoInicio,
        pago,
        pagoInteres: a.pagoInteres,
        pagoCapital: a.pagoCapital,
        interesGenerado,
        saldoFin: saldo,
        pagaTodo,
        cuotasCubiertas,
        cuotasPendientes,
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

	  }, [monto, cuotaMensual, tasaMensual, baseInteres, baseCapital, graciaSiPagaTodo, cuotasInfo]);

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
                Aproximación por ciclos: si pagas todo antes del pago y hay gracia, el interés se reduce a 0.
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
                              <span className="font-mono font-medium">{formatMoney(h.saldoFin, moneda)}</span>
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
