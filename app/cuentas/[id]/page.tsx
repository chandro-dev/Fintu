"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { useAppData } from "@/components/AppDataProvider";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { TxForm, Transaccion } from "@/components/transactions/types";
import { TransaccionService } from "@/lib/services/TransaccionService";
import { AccountModal } from "@/components/accounts/AccountModal";
import { CuentasService } from "@/lib/services/CuentasService";

import { 
  Wallet, ChevronLeft, Plus, TrendingUp, TrendingDown, 
  Settings2, Calculator, Edit3, Search, X, 
  ArrowRightLeft, Scale, Layers, Filter, Activity,
  AlertCircle, Power
} from "lucide-react";

// =========================================================================
// 💡 TIPOS Y UTILIDADES
// =========================================================================

type FilterType = "REAL" | "ALL" | "INGRESO" | "GASTO" | "TRANSFERENCIA" | "AJUSTE";

const createEmptyTx = (now: string, cuentaId: string): TxForm => ({
  cuentaId,
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  categoriaId: undefined,
  ocurrioEn: now
});

// =========================================================================
// 💡 COMPONENTES UI DE GRÁFICAS Y CARDS
// =========================================================================

interface FlowBarProps {
  data: [string, { ingresos: number; egresos: number }][];
  moneda: string;
}

const FlowBarChart = ({ data, moneda }: FlowBarProps) => (
  <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
      Flujo Filtrado (6 meses)
    </p>
    <div className="mt-3 space-y-3">
      {data.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Sin transacciones visibles en este filtro.
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
              <span className={netClass}>{formatMoney(netValue, moneda)}</span>
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

function StatCard({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "sky"; }) {
  const Icon = tone === "emerald" ? TrendingUp : (tone === "rose" ? TrendingDown : Activity);
  const colorClass = tone === "emerald" 
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
    : tone === "rose"
      ? "text-rose-500 dark:text-rose-400 bg-rose-500/10"
      : "text-sky-500 dark:text-sky-400 bg-sky-500/10";
    
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">{label}</p>
      <div className="flex items-center gap-2 mt-2">
        <Icon size={24} className={colorClass.split(" ")[0]} />
        <p className={`text-xl font-semibold ${colorClass.split(" ")[0]}`}>{value}</p>
      </div>
    </div>
  );
}

// Botón de filtro
function FilterTab({ active, onClick, icon: Icon, label, colorClass = "text-sky-500" }: any) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${active ? `bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 shadow-sm ${colorClass}` : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
            <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
        </button>
    )
}

// =========================================================================
// 💡 COMPONENTE PRINCIPAL
// =========================================================================

export default function CuentaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cuentaId = params?.id ?? "";
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);

  const { session, cuentas, categorias, transacciones, refresh, loadingSession, loadingData } = useAppData();
  const accessToken = session?.access_token;
  
  const cuenta = useMemo(() => cuentas.find((c) => c.id === cuentaId), [cuentas, cuentaId]);
  const currency = cuenta?.moneda ?? "COP";

  // --- Estados de Filtro (Igual que TransaccionesPage) ---
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<FilterType>("REAL");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // --- Estados Modales ---
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>(() => createEmptyTx(nowLocal, cuentaId));
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [targetBalance, setTargetBalance] = useState<string>("");
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);

  // --------------------------------------------------------------------------
  // 1. LÓGICA DE FILTRADO INTELIGENTE (Copiada de TransaccionesPage)
  // --------------------------------------------------------------------------
  const filteredTxs = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const desdeDate = filterDesde ? new Date(filterDesde) : null;
    const hastaDate = filterHasta ? new Date(filterHasta) : null;

    // A. Filtramos primero por la cuenta actual
    const accountTxs = transacciones.filter(tx => tx.cuentaId === cuentaId);

    return accountTxs.filter((tx) => {
      // DEDUCCIÓN DEL TIPO
      let codigoTipo = tx.tipoTransaccion?.codigo;

      // Parche visual para datos antiguos o inconsistentes
      if (codigoTipo === "NORMAL" && tx.descripcion?.toLowerCase().includes("ajuste")) {
          codigoTipo = "AJUSTE";
      }

      if (!codigoTipo) {
         if (tx.transaccionRelacionadaId) codigoTipo = "TRANSFERENCIA";
         else if (tx.descripcion?.toLowerCase().includes("ajuste")) codigoTipo = "AJUSTE";
         else codigoTipo = "NORMAL";
      }

      // FILTRO POR TIPO
      if (filterTipo === "REAL") {
        if (codigoTipo !== "NORMAL") return false;
      }
      else if (filterTipo === "INGRESO") {
        if (codigoTipo !== "NORMAL" || tx.direccion !== "ENTRADA") return false;
      }
      else if (filterTipo === "GASTO") {
        if (codigoTipo !== "NORMAL" || tx.direccion !== "SALIDA") return false;
      }
      else if (filterTipo === "TRANSFERENCIA") {
        if (codigoTipo !== "TRANSFERENCIA") return false;
      }
      else if (filterTipo === "AJUSTE") {
        if (codigoTipo !== "AJUSTE") return false;
      }

      // FILTROS DE FECHA Y TEXTO
      const txDate = new Date(tx.ocurrioEn);
      if (desdeDate && txDate < desdeDate) return false;
      if (hastaDate && txDate > hastaDate) return false;

      if (query) {
        const text = `${tx.descripcion ?? ""} ${tx.categoria?.nombre ?? ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [transacciones, cuentaId, filterQuery, filterTipo, filterDesde, filterHasta]);

  // --------------------------------------------------------------------------
  // 2. RESUMEN ESTRICTO (Solo suma NORMALES del filtro actual)
  // --------------------------------------------------------------------------
  const txSummary = useMemo(() => {
    return filteredTxs.reduce((acc, tx) => {
       const valor = Number(tx.monto || 0);
       let codigo = tx.tipoTransaccion?.codigo || "NORMAL";
       
       // Aplicamos la misma deducción que en el filtro para ser consistentes
       if (codigo === "NORMAL" && tx.descripcion?.toLowerCase().includes("ajuste")) codigo = "AJUSTE";

       // Solo sumamos al KPI si es NORMAL (Flujo real)
       if (codigo === "NORMAL") {
           if (tx.direccion === "ENTRADA") acc.ingresos += valor;
           else acc.egresos += valor;
       }
       
       return acc;
    }, { ingresos: 0, egresos: 0 });
  }, [filteredTxs]);

  // --------------------------------------------------------------------------
  // 3. DATOS PARA GRÁFICA (Basados en lo filtrado)
  // --------------------------------------------------------------------------
  const flowByMonth = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    filteredTxs.forEach((tx) => {
      // Para la gráfica usamos la misma lógica estricta (o visualizamos lo que el usuario filtró)
      // Si el usuario filtra "AJUSTE", la gráfica mostrará barras de ajustes.
      // Si filtra "REAL", mostrará flujo real.
      const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7);
      const current = map.get(key) ?? { ingresos: 0, egresos: 0 };
      if (tx.direccion === "ENTRADA") current.ingresos += Number(tx.monto ?? 0);
      else current.egresos += Number(tx.monto ?? 0);
      map.set(key, current);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [filteredTxs]);

  // --- HANDLERS CRUD ---

  const cuentaDeshabilitada = Boolean(cuenta?.cerradaEn);

  const startCreate = () => {
    if (cuentaDeshabilitada) return;
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
      if (editingTxId) await TransaccionService.actualizar(editingTxId, txForm, { accessToken });
      else await TransaccionService.crear(txForm, { accessToken });
      setTxModalOpen(false);
      setEditingTxId(null);
      await refresh({ force: true });
    } catch (err) { setTxError(err instanceof Error ? err.message : "Error desconocido"); } 
    finally { setTxBusy(false); }
  };

  const deleteTx = async (id?: string) => {
    const target = id ?? editingTxId;
    if (!target || !accessToken) return;
    if (!confirm("¿Eliminar esta transacción?")) return;
    setTxBusy(true);
    try {
      await TransaccionService.eliminar(target, { accessToken });
      setTxModalOpen(false);
      setEditingTxId(null);
      await refresh({ force: true });
    } catch (err) { setTxError(err instanceof Error ? err.message : "Error"); } 
    finally { setTxBusy(false); }
  };

  const handleAdjustment = async () => {
    if (!accessToken || !cuenta || cuentaDeshabilitada) return;
    const target = Number(targetBalance);
    const current = Number(cuenta.saldo);
    if (isNaN(target)) return setTxError("Monto inválido");
    const diff = target - current;
    if (Math.abs(diff) === 0) return setAdjustModalOpen(false);

    setTxBusy(true);
    try {
      await TransaccionService.crear({
        cuentaId: cuenta.id,
        monto: Math.abs(diff),
        direccion: diff > 0 ? "ENTRADA" : "SALIDA",
        descripcion: "Ajuste manual de saldo",
        ocurrioEn: nowLocal,
        isAjuste: true, // Importante para la lógica de tipos
        isTransferencia: false
      }, { accessToken });
      
      setAdjustModalOpen(false);
      setTargetBalance("");
      await refresh({ force: true });
    } catch (err) { setTxError("Error al ajustar"); } 
    finally { setTxBusy(false); }
  };

  const handleToggleCuenta = async () => {
    if (!cuenta || !accessToken) return;
    const activar = cuentaDeshabilitada;
    const confirmed = confirm(
      activar
        ? "¿Deseas habilitar nuevamente esta cuenta?"
        : "¿Seguro deseas deshabilitar esta cuenta? No podrás registrar nuevas transacciones hasta habilitarla."
    );
    if (!confirmed) return;
    setAccountBusy(true);
    try {
      await CuentasService.actualizar(
        cuenta.id,
        { cerradaEn: activar ? null : new Date().toISOString() },
        { accessToken }
      );
      await refresh({ force: true });
    } catch (err) {
      alert("No se pudo cambiar el estado de la cuenta");
    } finally {
      setAccountBusy(false);
    }
  };

  if (loadingSession) return <div className="flex justify-center pt-20">Cargando...</div>;
  if (!cuenta && !loadingSession) return <div className="p-6">Cuenta no encontrada</div>;

  return (
    <div className="min-h-screen px-4 md:px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/50 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/cuentas")} className="rounded-full border border-slate-300 p-2 hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10">
              <ChevronLeft size={20} />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-500 flex items-center gap-1">
                <Wallet size={12}/> Detalle
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{cuenta?.nombre}</h1>
                <button onClick={() => setEditAccountOpen(true)} className="p-1.5 rounded-full text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <Edit3 size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Saldo: <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(Number(cuenta?.saldo ?? 0), currency)}</span>
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => { setTargetBalance(String(Number(cuenta?.saldo ?? 0))); setAdjustModalOpen(true); }}
              disabled={cuentaDeshabilitada}
              className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              <Settings2 size={16} /> <span className="hidden sm:inline">Ajustar</span>
            </button>
            <button
              onClick={handleToggleCuenta}
              disabled={accountBusy}
              className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              <Power size={16} /> {cuentaDeshabilitada ? "Habilitar" : "Deshabilitar"}
            </button>
            <button
              onClick={startCreate}
              disabled={cuentaDeshabilitada}
              className="flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} /> <span className="hidden sm:inline">Nueva</span>
            </button>
          </div>
        </div>

        {cuentaDeshabilitada && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
            <AlertCircle size={18} />
            <div>
              <p className="text-sm font-semibold">Cuenta deshabilitada</p>
              <p className="text-xs">Las nuevas transacciones y ajustes están bloqueados hasta que la habilites nuevamente.</p>
            </div>
          </div>
        )}

        {/* --- SECCIÓN DE FILTROS (NUEVO) --- */}
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <FilterTab active={filterTipo === "REAL"} onClick={() => setFilterTipo("REAL")} icon={Activity} label="Real" colorClass="text-sky-500" />
                <FilterTab active={filterTipo === "INGRESO"} onClick={() => setFilterTipo("INGRESO")} icon={TrendingUp} label="Ingresos" colorClass="text-emerald-500" />
                <FilterTab active={filterTipo === "GASTO"} onClick={() => setFilterTipo("GASTO")} icon={TrendingDown} label="Gastos" colorClass="text-rose-500" />
                <FilterTab active={filterTipo === "TRANSFERENCIA"} onClick={() => setFilterTipo("TRANSFERENCIA")} icon={ArrowRightLeft} label="Transf." colorClass="text-slate-500" />
                <FilterTab active={filterTipo === "AJUSTE"} onClick={() => setFilterTipo("AJUSTE")} icon={Scale} label="Ajustes" colorClass="text-amber-500" />
                <FilterTab active={filterTipo === "ALL"} onClick={() => setFilterTipo("ALL")} icon={Layers} label="Todo" />
                
                <div className="ml-auto flex items-center gap-2">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="Buscar..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} className="w-[120px] md:w-[180px] rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-sky-500/20 outline-none" />
                     </div>
                     <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-full border ${showFilters ? 'bg-sky-50 border-sky-200 text-sky-600' : 'border-slate-200 dark:border-white/10'}`}>
                        <Filter size={16} />
                     </button>
                </div>
            </div>

            {/* Filtros avanzados de fecha */}
            {showFilters && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2">
                     <span className="text-xs font-bold text-slate-500">Rango:</span>
                     <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)} className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs" />
                     <span className="text-slate-400">➔</span>
                     <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)} className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs" />
                     
                     <button onClick={() => { setFilterQuery(""); setFilterTipo("REAL"); setFilterDesde(""); setFilterHasta(""); }} className="ml-auto text-xs text-rose-500 hover:underline flex items-center gap-1">
                        <X size={12} /> Limpiar
                     </button>
                </div>
            )}
        </div>

        {/* MÉTRICAS (Responden al filtro) */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Ingresos" value={formatMoney(txSummary.ingresos, currency)} tone="emerald" />
          <StatCard label="Egresos" value={formatMoney(txSummary.egresos, currency)} tone="rose" />
          <StatCard label="Flujo Neto" value={formatMoney(txSummary.ingresos - txSummary.egresos, currency)} tone="sky" />
        </div>

        {/* CUERPO PRINCIPAL */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* La gráfica responde al filtro (si filtras GASTO, ves la evolución de gastos) */}
          <FlowBarChart data={flowByMonth} moneda={currency} />
          
          <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
            <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Movimientos ({filteredTxs.length})</p>
                {/* Indicador visual del filtro activo */}
                {filterTipo !== "ALL" && <span className="text-[10px] uppercase font-bold text-sky-500 bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded">{filterTipo}</span>}
            </div>
            
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredTxs.map((tx) => (
                <TransactionListItem key={tx.id} tx={tx} onEdit={startEdit} onDelete={deleteTx} />
              ))}
              {filteredTxs.length === 0 && (
                <div className="text-center py-10 opacity-60">
                    <Layers className="mx-auto mb-2 text-slate-300" size={32} />
                    <p className="text-sm text-slate-500">No hay movimientos con este filtro.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODALES */}
      {txModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            {/* ... Contenido del modal (igual) ... */}
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold dark:text-white">{editingTxId ? "Editar" : "Nuevo"}</h3>
              <button onClick={() => setTxModalOpen(false)} className="text-sm text-slate-500">Cancelar</button>
            </div>
            {txError && <div className="mb-4 text-rose-500 text-sm">{txError}</div>}
            <TransactionForm form={txForm} cuentas={cuentas} categorias={categorias} nowLocal={nowLocal} busy={txBusy} isEditing={Boolean(editingTxId)} onChange={(p) => setTxForm(prev => ({ ...prev, ...p }))} onSubmit={saveTx} onDelete={editingTxId ? () => deleteTx(editingTxId) : undefined} onCancel={() => setTxModalOpen(false)} />
          </div>
        </div>
      )}

      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
             {/* ... Header Ajuste ... */}
             <div className="flex items-center gap-3 mb-6 text-sky-500">
               <div className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-full"><Calculator size={24} /></div>
               <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ajustar Saldo</h3>
            </div>
            {/* Inputs de Ajuste */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Saldo en Sistema</label>
                <p className="text-lg font-mono font-medium dark:text-zinc-300">{formatMoney(Number(cuenta?.saldo), currency)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Nuevo Saldo Real</label>
                <input type="number" value={targetBalance} onChange={(e) => setTargetBalance(e.target.value)} className="w-full mt-1 p-3 text-xl font-bold rounded-xl border border-slate-200 bg-slate-50 outline-none dark:border-white/10 dark:bg-black/40 dark:text-white" placeholder="0.00" autoFocus />
              </div>
              {/* Vista Previa */}
              {targetBalance && !isNaN(Number(targetBalance)) && (
                 <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5 text-sm">
                    <div className="flex justify-between">
                       <span>Diferencia:</span>
                       <span className={`font-bold ${Number(targetBalance) - Number(cuenta?.saldo ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {formatMoney(Number(targetBalance) - Number(cuenta?.saldo ?? 0), currency)}
                       </span>
                    </div>
                 </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setAdjustModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full">Cancelar</button>
              <button onClick={handleAdjustment} disabled={txBusy || !targetBalance} className="px-6 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-full shadow-lg disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {accessToken && (
        <AccountModal
          open={editAccountOpen}
          onClose={() => setEditAccountOpen(false)}
          onSuccess={() => {
            refresh({ force: true });
            setEditAccountOpen(false);
            if (!cuentas.find(c => c.id === cuentaId)) router.push("/cuentas");
          }}
          accessToken={accessToken}
          initialData={cuenta}
          editingId={cuenta?.id ?? ""}
          tipoCuentaId={cuenta?.tipoCuentaId ?? ""}
        />
      )}
    </div>
  );
}
