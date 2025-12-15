// src/app/cuentas/[id]/page.tsx (Contenido principal)
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { useAppData } from "@/components/AppDataProvider";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { TxForm, Transaccion } from "@/components/transactions/types";
import { TransaccionService } from "@/lib/services/TransaccionService";
import { Wallet, ChevronLeft, Plus, TrendingUp, TrendingDown } from "lucide-react";


// =========================================================================
// 💡 LÓGICA DE ESTADO BASE
// =========================================================================

const createEmptyTx = (now: string, cuentaId: string): TxForm => ({
  cuentaId,
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  categoriaId: undefined,
  ocurrioEn: now
});

// =========================================================================
// 💡 COMPONENTE DE GRÁFICA DE FLUJO (Extraído para limpieza)
// =========================================================================

interface FlowBarProps {
  data: [string, { ingresos: number; egresos: number }][];
  moneda: string;
}

const FlowBarChart = ({ data, moneda }: FlowBarProps) => (
  <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
      Flujo 6 meses
    </p>
    <div className="mt-3 space-y-3">
      {data.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Sin transacciones suficientes para análisis de flujo.
        </p>
      )}
      {data.map(([month, flowData]) => {
        // Obtenemos el mes en formato "Ene", "Feb", etc.
        const monthLabel = new Date(`${month}-01`).toLocaleString('es-ES', { month: 'short' });
        const totalAbs = flowData.ingresos + flowData.egresos || 1;
        
        // La barra representa la proporción entre ingresos y egresos respecto al total del flujo.
        const ingresoPct = Math.min(100, (flowData.ingresos / totalAbs) * 100);
        const egresoPct = Math.min(100, (flowData.egresos / totalAbs) * 100);

        const netValue = flowData.ingresos - flowData.egresos;
        const netClass = netValue >= 0 ? "text-emerald-500" : "text-rose-500";
        
        return (
          <div key={month} className="space-y-1 rounded-lg bg-slate-100/60 p-2 dark:bg-white/5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
              <span className="capitalize">{monthLabel}. {month.slice(0, 4)}</span>
              <span className={netClass}>
                {formatMoney(netValue, moneda)}
              </span>
            </div>
            
            {/* Barra de progreso visual */}
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${ingresoPct}%` }}
                title={`Ingresos: ${formatMoney(flowData.ingresos, moneda)}`}
              />
              <div
                className="h-full bg-rose-400"
                style={{ width: `${egresoPct}%` }}
                title={`Egresos: ${formatMoney(flowData.egresos, moneda)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// =========================================================================
// 💡 STAT CARD (Simplificado con iconos)
// =========================================================================

function StatCard({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose"; }) {
  const Icon = tone === "emerald" ? TrendingUp : TrendingDown;
  const toneClasses = tone === "emerald"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "bg-rose-500/10 text-rose-500 dark:text-rose-400";
    
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">{label}</p>
      <div className="flex items-center gap-2 mt-2">
        <Icon size={24} className={toneClasses.split('/10')[1]} />
        <p className={`text-xl font-semibold ${toneClasses}`}>{value}</p>
      </div>
    </div>
  );
}


// =========================================================================
// 💡 COMPONENTE PRINCIPAL
// =========================================================================

export default function CuentaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cuentaId = params?.id ?? "";
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);

  const {
    session,
    cuentas,
    categorias,
    transacciones,
    refresh,
    loadingSession,
    loadingData
  } = useAppData();

  const accessToken = session?.access_token;
  
  // Usamos useMemo para obtener la cuenta y las transacciones filtradas
  const cuenta = useMemo(() => cuentas.find((c) => c.id === cuentaId), [cuentas, cuentaId]);
  const filteredTxs = useMemo(() => transacciones.filter((tx) => tx.cuentaId === cuentaId), [transacciones, cuentaId]);
  const currency = cuenta?.moneda ?? "COP";

  const txSummary = useMemo(() => {
    // Cálculo optimizado ya existente
    const ingresos = filteredTxs
      .filter((tx) => tx.direccion === "ENTRADA")
      .reduce((acc, tx) => acc + Number(tx.monto ?? 0), 0);
    const egresos = filteredTxs
      .filter((tx) => tx.direccion === "SALIDA")
      .reduce((acc, tx) => acc + Number(tx.monto ?? 0), 0);
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [filteredTxs]);

  const flowByMonth = useMemo(() => {
    // Cálculo optimizado ya existente
    const map = new Map<string, { ingresos: number; egresos: number }>();
    filteredTxs.forEach((tx) => {
      const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7);
      const current = map.get(key) ?? { ingresos: 0, egresos: 0 };
      if (tx.direccion === "ENTRADA") current.ingresos += Number(tx.monto ?? 0);
      else current.egresos += Number(tx.monto ?? 0);
      map.set(key, current);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [filteredTxs]);


  // --- ESTADO Y LÓGICA DEL MODAL ---
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>(() => createEmptyTx(nowLocal, cuentaId));
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingTxId(null);
    setTxForm(createEmptyTx(nowLocal, cuentaId));
    setTxError(null);
    setTxModalOpen(true);
  };

  const startEdit = (tx: Transaccion) => {
    setEditingTxId(tx.id);
    setTxForm({
      cuentaId: tx.cuentaId,
      monto: Number(tx.monto ?? 0),
      direccion: tx.direccion,
      descripcion: tx.descripcion ?? "",
      categoriaId: tx.categoria?.id ?? "", // Aseguramos que sea string o ""
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16)
    });
    setTxError(null);
    setTxModalOpen(true);
  };

  const saveTx = async () => {
    if (!accessToken) return setTxError("No hay sesión activa");
    // Añadir validación simple aquí
    if (!txForm.monto || txForm.monto <= 0) return setTxError("El monto debe ser positivo.");

    setTxBusy(true);
    try {
      if (editingTxId) {
        await TransaccionService.actualizar(editingTxId, txForm, { accessToken });
      } else {
        await TransaccionService.crear(txForm, { accessToken });
      }
      setTxModalOpen(false);
      setEditingTxId(null);
      await refresh({ force: true });
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setTxBusy(false);
    }
  };

  const deleteTx = async (id?: string) => {
    const target = id ?? editingTxId;
    if (!target) return;
    if (!accessToken) return setTxError("No hay sesión activa");
    if (!confirm("¿Eliminar esta transacción? Esta acción es irreversible.")) return;
    setTxBusy(true);
    try {
      await TransaccionService.eliminar(target, { accessToken });
      setTxModalOpen(false);
      setEditingTxId(null);
      await refresh({ force: true });
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setTxBusy(false);
    }
  };
  // --- FIN LÓGICA DEL MODAL ---


  // 1) Mientras la sesión carga
  if (loadingSession) {
    return (
      <div className="flex justify-center items-center min-h-screen">
         <p className="text-xl text-slate-500 dark:text-zinc-400">Cargando sesión...</p>
      </div>
    );
  }

  // 2) Ya terminó de cargar sesión y NO hay cuenta
  if (!cuenta && !loadingSession) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow dark:border-white/10 dark:bg-black/40 dark:text-zinc-100">
          <p className="text-lg font-semibold">❌ Error: Cuenta no encontrada</p>
          <button
            onClick={() => router.push("/cuentas")}
            className="mt-3 flex items-center gap-1 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
          >
            <ChevronLeft size={16} /> Volver a Cuentas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        
        {/* HEADER DE LA CUENTA */}
        <div className="flex items-center justify-between border-b border-slate-200/50 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/cuentas")}
              className="rounded-full border border-slate-300 p-2 text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              title="Volver a Cuentas"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-500">
                <Wallet size={12} className="inline-block mr-1"/> Detalle
              </p>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {cuenta?.nombre ?? "Cuenta"}
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Saldo actual:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatMoney(Number(cuenta?.saldo ?? 0), currency)}
                </span>
                {loadingData && <span className="ml-2 animate-pulse text-xs text-sky-400">(Sincronizando...)</span>}
              </p>
            </div>
          </div>
          <button
            onClick={startCreate}
            disabled={!accessToken || loadingData}
            className="flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 disabled:opacity-50 transition-all"
          >
            <Plus size={18} />
            Nueva transacción
          </button>
        </div>

        {/* METRICAS (STAT CARDS) */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Ingresos (Total)"
            value={formatMoney(txSummary.ingresos, currency)}
            tone="emerald"
          />
          <StatCard
            label="Egresos (Total)"
            value={formatMoney(txSummary.egresos, currency)}
            tone="rose"
          />
          <StatCard
            label="Flujo Neto"
            value={formatMoney(txSummary.neto, currency)}
            tone={txSummary.neto >= 0 ? "emerald" : "rose"}
          />
        </div>

        {/* GRÁFICA DE FLUJO Y LISTA DE TRANSACCIONES */}
        <div className="grid gap-4 md:grid-cols-2">
          
          {/* Gráfica de Flujo Mensual */}
          <FlowBarChart data={flowByMonth} moneda={currency} />
          
          {/* Transacciones Recientes */}
          <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Últimas {filteredTxs.length} Transacciones
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
              Movimientos recientes en esta cuenta.
            </p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredTxs.map((tx) => (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  onEdit={startEdit}
                  onDelete={deleteTx}
                />
              ))}
              {filteredTxs.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-zinc-400 py-4 text-center border border-dashed rounded-lg mt-3">
                  Aún no hay movimientos registrados.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE TRANSACCIÓN */}
      {txModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
                  {editingTxId ? "Editar transaccion" : "Registrar transaccion"}
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Movimiento en {cuenta?.nombre ?? "Cuenta"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setTxModalOpen(false);
                  setEditingTxId(null);
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            {txError && (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                {txError}
              </div>
            )}

            <TransactionForm
              form={txForm}
              cuentas={cuentas}
              categorias={categorias}
              nowLocal={nowLocal}
              busy={txBusy}
              isEditing={Boolean(editingTxId)}
              onChange={(partial) => setTxForm((prev) => ({ ...prev, ...partial }))}
              onSubmit={saveTx}
              onDelete={editingTxId ? () => deleteTx(editingTxId) : undefined}
              onCancel={() => {
                setTxModalOpen(false);
                setEditingTxId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}