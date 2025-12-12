"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/formatMoney";

type Props = {
  tasaEfectivaAnual: number;
  moneda: string;
  saldoActual: number;
  cupoTotal: number;
};

type SimForm = {
  monto: number;
  pagoMensual: number;
  abonoExtra: number;
  plazoMax: number;
  tasa: number;
};

type ScheduleRow = {
  mes: number;
  saldo: number;
  interes: number;
  pagoTotal: number;
  abonoCapital: number;
};

function BalanceChart({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const points = values.map((v, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - (v / max) * 100;
    return { x, y };
  });

  const areaPoints = [
    `${points[0].x},100`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},100`,
  ].join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-32 w-full overflow-visible">
      <defs>
        <linearGradient id="saldoGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="url(#saldoGradient)"
        stroke="none"
        points={areaPoints}
      />
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CreditSimulator({ tasaEfectivaAnual, moneda, saldoActual, cupoTotal }: Props) {
  const [form, setForm] = useState<SimForm>({
    monto: Math.max(saldoActual, 0),
    pagoMensual: Math.max(Math.round(saldoActual / 12), 1),
    abonoExtra: 0,
    plazoMax: 36,
    tasa: tasaEfectivaAnual,
  });

  const monthlyRate = useMemo(() => {
    const t = Number(form.tasa);
    if (!t || t <= 0) return 0;
    return Math.pow(1 + t / 100, 1 / 12) - 1;
  }, [form.tasa]);

  const schedule = useMemo(() => {
    let saldo = Math.max(0, Number(form.monto));
    const rows: ScheduleRow[] = [];
    let totalInteres = 0;
    let mes = 1;
    let stuck = false;

    const maxMonths = Math.max(1, form.plazoMax);
    while (saldo > 0 && mes <= maxMonths) {
      const interes = saldo * monthlyRate;
      const pagoCapital = Math.max(form.pagoMensual - interes, 0);
      const extra = Math.max(form.abonoExtra, 0);
      const abonoCapital = pagoCapital + extra;
      const pagoTotal = abonoCapital + interes;
      totalInteres += interes;

      saldo = Math.max(saldo + interes - (form.pagoMensual + extra), 0);
      rows.push({ mes, saldo, interes, pagoTotal, abonoCapital });

      if (form.pagoMensual + extra <= interes + 1e-2 && monthlyRate > 0) {
        stuck = true;
        break;
      }
      mes += 1;
    }

    return {
      rows,
      totalInteres,
      totalPagado: rows.reduce((acc, r) => acc + r.pagoTotal, 0),
      saldoRestante: saldo,
      stuck,
    };
  }, [form.abonoExtra, form.monto, form.pagoMensual, form.plazoMax, monthlyRate]);

  const valoresGrafico = useMemo(() => {
    if (schedule.rows.length === 0) return [form.monto];
    return [form.monto, ...schedule.rows.map((r) => r.saldo)];
  }, [form.monto, schedule.rows]);

  const mesesProyectados = schedule.rows.length;
  const tem = monthlyRate * 100;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow dark:border-white/10 dark:bg-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-500">Simulador</p>
          <h3 className="text-xl font-semibold">Credito con esta tarjeta</h3>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Calcula intereses compuestos y el tiempo estimado para pagar usando la TEA de la tarjeta.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>TEA: {tasaEfectivaAnual}%</p>
          <p>TEM aprox: {tem.toFixed(2)}%</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Monto a financiar</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: Math.max(0, Number(e.target.value)) }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Pago mensual</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                value={form.pagoMensual}
                onChange={(e) => setForm((f) => ({ ...f, pagoMensual: Math.max(0, Number(e.target.value)) }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Abono extra mensual</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                value={form.abonoExtra}
                onChange={(e) => setForm((f) => ({ ...f, abonoExtra: Math.max(0, Number(e.target.value)) }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Plazo max (meses)</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                value={form.plazoMax}
                onChange={(e) => setForm((f) => ({ ...f, plazoMax: Math.max(1, Number(e.target.value)) }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">TEA personalizada (%)</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                value={form.tasa}
                onChange={(e) => setForm((f) => ({ ...f, tasa: Math.max(0, Number(e.target.value)) }))}
              />
              <p className="text-[11px] text-slate-500">Usa la TEA del banco o ajusta para escenarios.</p>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Cupo disponible: {formatMoney(Math.max(cupoTotal - saldoActual, 0), moneda)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-inner dark:border-white/10 dark:bg-black/20">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-slate-500">Tiempo estimado</p>
              <p className="text-lg font-semibold">{mesesProyectados} meses</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Intereses proyectados</p>
              <p className="text-lg font-semibold">{formatMoney(schedule.totalInteres, moneda)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total pagado</p>
              <p className="text-lg font-semibold">{formatMoney(schedule.totalPagado, moneda)}</p>
            </div>
          </div>
          <BalanceChart values={valoresGrafico} />
          {schedule.stuck && (
            <p className="text-xs text-amber-600">
              El pago mensual es menor al interes generado; aumenta el pago o abono extra para reducir saldo.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white p-4 text-sm shadow dark:border-white/10 dark:bg-black/20">
          <p className="text-xs text-slate-500">Primer mes</p>
          <p className="text-lg font-semibold">{formatMoney(schedule.rows[0]?.pagoTotal ?? 0, moneda)}</p>
          <p className="text-xs text-slate-500">Pago total (capital + interes)</p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white p-4 text-sm shadow dark:border-white/10 dark:bg-black/20">
          <p className="text-xs text-slate-500">Saldo esperado mes 6</p>
          <p className="text-lg font-semibold">
            {formatMoney(
              schedule.rows[5]?.saldo ??
                (schedule.rows.length > 0
                  ? schedule.rows[schedule.rows.length - 1].saldo
                  : 0),
              moneda,
            )}
          </p>
          <p className="text-xs text-slate-500">Seguimiento al semestre</p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white p-4 text-sm shadow dark:border-white/10 dark:bg-black/20">
          <p className="text-xs text-slate-500">Saldo final proyectado</p>
          <p className="text-lg font-semibold">{formatMoney(schedule.saldoRestante, moneda)}</p>
          <p className="text-xs text-slate-500">Con los parametros actuales</p>
        </div>
      </div>
    </div>
  );
}
