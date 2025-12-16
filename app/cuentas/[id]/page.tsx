// src/app/cuentas/[id]/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { useAppData } from "@/components/AppDataProvider";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { TxForm, Transaccion } from "@/components/transactions/types";
import { TransaccionService } from "@/lib/services/TransaccionService";
// 1. IMPORTAR EL MODAL Y EL ICONO NUEVO
import { AccountModal } from "@/components/accounts/AccountModal";
import { 
  Wallet, 
  ChevronLeft, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Settings2, 
  Calculator,
  Edit3 // <--- Nuevo icono para editar
} from "lucide-react";

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
// 💡 COMPONENTE DE GRÁFICA DE FLUJO
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
        const monthLabel = new Date(`${month}-01`).toLocaleString('es-ES', { month: 'short' });
        const totalAbs = flowData.ingresos + flowData.egresos || 1;
        
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
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div className="h-full bg-emerald-400" style={{ width: `${ingresoPct}%` }} />
              <div className="h-full bg-rose-400" style={{ width: `${egresoPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// =========================================================================
// 💡 STAT CARD
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
  
  const cuenta = useMemo(() => cuentas.find((c) => c.id === cuentaId), [cuentas, cuentaId]);
  const filteredTxs = useMemo(() => transacciones.filter((tx) => tx.cuentaId === cuentaId), [transacciones, cuentaId]);
  const currency = cuenta?.moneda ?? "COP";

  // --- Estados de Transacción ---
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>(() => createEmptyTx(nowLocal, cuentaId));
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // --- Estados de Ajuste de Saldo ---
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [targetBalance, setTargetBalance] = useState<string>("");

  // 2. NUEVO ESTADO: Controla el modal de editar cuenta
  const [editAccountOpen, setEditAccountOpen] = useState(false);

  const txSummary = useMemo(() => {
    const ingresos = filteredTxs
      .filter((tx) => tx.direccion === "ENTRADA")
      .reduce((acc, tx) => acc + Number(tx.monto ?? 0), 0);
    const egresos = filteredTxs
      .filter((tx) => tx.direccion === "SALIDA")
      .reduce((acc, tx) => acc + Number(tx.monto ?? 0), 0);
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [filteredTxs]);

  const flowByMonth = useMemo(() => {
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

  // --- LÓGICA CRUD ---

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
      categoriaId: tx.categoria?.id ?? "",
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16)
    });
    setTxError(null);
    setTxModalOpen(true);
  };

  const saveTx = async () => {
    if (!accessToken) return setTxError("No hay sesión activa");
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

  // --- LÓGICA DE AJUSTE (RECONCILIACIÓN) ---
  const handleAdjustment = async () => {
    if (!accessToken || !cuenta) return;
    const target = Number(targetBalance);
    const current = Number(cuenta.saldo);
    
    if (isNaN(target)) {
      setTxError("Ingresa un monto válido");
      return;
    }

    const diff = target - current;
    
    if (Math.abs(diff) === 0) {
      setAdjustModalOpen(false);
      return;
    }

    setTxBusy(true);
    try {
      // Creamos una transacción automática para igualar el saldo
      await TransaccionService.crear({
        cuentaId: cuenta.id,
        monto: Math.abs(diff),
        direccion: diff > 0 ? "ENTRADA" : "SALIDA",
        descripcion: "Ajuste manual de saldo",
        ocurrioEn: nowLocal,
        isAjuste: true,
        isTransferencia: false
      }, { accessToken });
      
      setAdjustModalOpen(false);
      setTargetBalance("");
      await refresh({ force: true });
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Error al ajustar");
    } finally {
      setTxBusy(false);
    }
  };

  if (loadingSession) return <div className="flex justify-center pt-20">Cargando...</div>;
  if (!cuenta && !loadingSession) return <div className="p-6">Cuenta no encontrada</div>;

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/50 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/cuentas")} className="rounded-full border border-slate-300 p-2 text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">
              <ChevronLeft size={20} />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-500">
                <Wallet size={12} className="inline-block mr-1"/> Detalle
              </p>
              
              {/* 3. TÍTULO Y BOTÓN DE EDICIÓN AGRUPADOS */}
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {cuenta?.nombre}
                </h1>
                <button 
                  onClick={() => setEditAccountOpen(true)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  title="Editar cuenta"
                >
                  <Edit3 size={18} />
                </button>
              </div>

              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Saldo: <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(Number(cuenta?.saldo ?? 0), currency)}</span>
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* Botón de Ajuste (Mantenemos por si se quiere usar el acceso rápido) */}
            <button
             onClick={() => {
                // Agregamos ?. y ?? 0 para asegurar que siempre haya un número
                setTargetBalance(String(Number(cuenta?.saldo ?? 0))); 
                setAdjustModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              <Settings2 size={16} />
              Ajustar Saldo
            </button>
            
            <button
              onClick={startCreate}
              disabled={!accessToken || loadingData}
              className="flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-sky-500 disabled:opacity-50"
            >
              <Plus size={18} />
              Nueva transacción
            </button>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Ingresos" value={formatMoney(txSummary.ingresos, currency)} tone="emerald" />
          <StatCard label="Egresos" value={formatMoney(txSummary.egresos, currency)} tone="rose" />
          <StatCard label="Flujo Neto" value={formatMoney(txSummary.neto, currency)} tone={txSummary.neto >= 0 ? "emerald" : "rose"} />
        </div>

        {/* CUERPO PRINCIPAL */}
        <div className="grid gap-4 md:grid-cols-2">
          <FlowBarChart data={flowByMonth} moneda={currency} />
          
          <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Últimos Movimientos</p>
            <div className="mt-3 space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredTxs.map((tx) => (
                <TransactionListItem key={tx.id} tx={tx} onEdit={startEdit} onDelete={deleteTx} />
              ))}
              {filteredTxs.length === 0 && (
                <p className="text-sm text-center py-4 text-slate-500">Sin movimientos aún.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL DE TRANSACCIÓN --- */}
      {txModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                {editingTxId ? "Editar movimiento" : "Nuevo movimiento"}
              </h3>
              <button onClick={() => setTxModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">Cancelar</button>
            </div>
            {txError && <div className="mb-4 text-rose-500 text-sm">{txError}</div>}
            <TransactionForm
              form={txForm}
              cuentas={cuentas}
              categorias={categorias}
              nowLocal={nowLocal}
              busy={txBusy}
              isEditing={Boolean(editingTxId)}
              onChange={(p) => setTxForm(prev => ({ ...prev, ...p }))}
              onSubmit={saveTx}
              onDelete={editingTxId ? () => deleteTx(editingTxId) : undefined}
              onCancel={() => setTxModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* --- MODAL DE AJUSTE DE SALDO (RÁPIDO) --- */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-4 text-sky-500">
               <div className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-full">
                  <Calculator size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ajustar Saldo</h3>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
              Ingresa el monto real que tienes en esta cuenta. Crearemos automáticamente una transacción de ajuste para igualar el sistema.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Saldo en Sistema</label>
                <p className="text-lg font-mono font-medium text-slate-700 dark:text-zinc-300">
                  {formatMoney(Number(cuenta?.saldo), currency)}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Nuevo Saldo Real</label>
                <input
                   type="number"
                   value={targetBalance}
                   onChange={(e) => setTargetBalance(e.target.value)}
                   className="w-full mt-1 p-3 text-xl font-bold rounded-xl border border-slate-200 bg-slate-50 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none dark:border-white/10 dark:bg-black/40 dark:text-white"
                   placeholder="0.00"
                   autoFocus
                />
              </div>

              {/* Vista Previa del Ajuste */}
              {targetBalance && !isNaN(Number(targetBalance)) && (
                 <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5 text-sm">
                    <div className="flex justify-between">
                       <span>Diferencia:</span>
                       <span className={`font-bold ${Number(targetBalance) - Number(cuenta?.saldo) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {formatMoney(Number(targetBalance) - Number(cuenta?.saldo), currency)}
                       </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-right">
                       {Number(targetBalance) - Number(cuenta?.saldo) >= 0 
                         ? "(Se creará un Ingreso de Ajuste)" 
                         : "(Se creará un Gasto de Ajuste)"}
                    </p>
                 </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setAdjustModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full dark:text-zinc-400 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAdjustment}
                disabled={txBusy || !targetBalance}
                className="px-6 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-full shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {txBusy ? "Procesando..." : "Confirmar Ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL DE EDICIÓN COMPLETA (NOMBRE + SALDO) */}
      {accessToken && (
        <AccountModal
          open={editAccountOpen}
          onClose={() => setEditAccountOpen(false)}
          onSuccess={() => {
            refresh({ force: true });
            setEditAccountOpen(false);
            // Si el modal de edición borró la cuenta, redirigimos a la lista
            // Nota: En caso de borrado, la cuenta será undefined, pero el refresh lo manejará
            if (!cuentas.find(c => c.id === cuentaId)) {
                router.push("/cuentas");
            }
          }}
          accessToken={accessToken}
          initialData={cuenta}
    editingId={cuenta?.id}
  tipoCuentaId={cuenta?.tipoCuentaId}
        />
      )}

    </div>
  );
}