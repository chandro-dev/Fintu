"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { formatMoney } from "@/lib/formatMoney";

// Componentes UI
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionCreationPanel } from "./TransactionCreationPanel"; 
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { SelectField } from "@/components/ui/Fields"; 
import { TransaccionService } from "@/lib/services/TransaccionService";
import { Loading } from "@/components/ui/Loading";

// Tipos
import type { Transaccion, TxForm } from "@/components/transactions/types";

// Iconos
import { 
  Search, Filter, SlidersHorizontal, X,
  TrendingUp, TrendingDown, ArrowRightLeft, Activity, Layers, Scale, ChevronDown, CreditCard
} from "lucide-react";

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================
type Summary = { ingresos: number; egresos: number; total: number };

// Definimos los filtros basados en tu lógica de negocio
type FilterType =
  | "REAL"
  | "ALL"
  | "INGRESO"
  | "GASTO"
  | "TRANSFERENCIA"
  | "AJUSTE"
  | "TARJETA_CREDITO";

const CODIGO_TIPO_CUENTA_TARJETA_CREDITO = "TARJETA_CREDITO";

const createEmptyTxForm = (nowLocal: string, cuentaId = ""): TxForm => ({
  cuentaId, monto: 0, direccion: "SALIDA", descripcion: "", categoriaId: undefined, ocurrioEn: nowLocal,
});

export default function TransaccionesPage() {
  const {
    session,
    loadingSession,
    loadingData,
    error,
    cuentas,
    categorias,
    transacciones: txs,
    refresh,
  } = useAppData();

  // Estados UI
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados Edición
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TxForm>(() => createEmptyTxForm(new Date().toISOString().slice(0, 16)));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // --- FILTROS ---
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<FilterType>("REAL"); // Por defecto: NORMAL (Ingresos y Gastos)
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterCuenta, setFilterCuenta] = useState("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  const [visibleCount, setVisibleCount] = useState(50);
  const ITEMS_PER_LOAD = 50;

  const accessToken = session?.access_token;
  const isSignedIn = Boolean(accessToken);
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);
  const forceRefresh = useCallback(() => refresh({ force: true }), [refresh]);

  useEffect(() => { setVisibleCount(ITEMS_PER_LOAD); }, [filterQuery, filterTipo, filterCategoria, filterCuenta, filterDesde, filterHasta]);

  // --------------------------------------------------------------------------
  // LÓGICA DE FILTRADO (ACTUALIZADA SEGÚN CÓDIGOS DE BD)
  // --------------------------------------------------------------------------
 const filteredTxs = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const desdeDate = filterDesde ? new Date(filterDesde) : null;
    const hastaDate = filterHasta ? new Date(filterHasta) : null;

    return txs.filter((tx) => {
      const codigoTipoCuenta = tx.cuenta?.tipoCuenta?.codigo;

      if (filterTipo === "TARJETA_CREDITO") {
        if (codigoTipoCuenta !== CODIGO_TIPO_CUENTA_TARJETA_CREDITO) return false;
      } else if (filterTipo !== "ALL") {
        if (codigoTipoCuenta === CODIGO_TIPO_CUENTA_TARJETA_CREDITO) return false;
      }

      // 1. DEDUCCIÓN INTELIGENTE DEL TIPO
      // Prioridad: 
      // A. Lo que diga la BD (si existe).
      // B. Si tiene ID relacionado -> es TRANSFERENCIA.
      // C. Si dice "ajuste" -> es AJUSTE.
      // D. Si no es nada de lo anterior -> es NORMAL.
      
      let codigoTipo = tx.tipoTransaccion?.codigo;

      if (!codigoTipo) {
         if (tx.transaccionRelacionadaId) {
             codigoTipo = "TRANSFERENCIA";
         } else if (tx.descripcion?.toLowerCase().includes("ajuste")) {
             codigoTipo = "AJUSTE";
         } else {
             codigoTipo = "NORMAL";
         }
      }

      // 2. APLICACIÓN DEL FILTRO SEGÚN EL TIPO DEDUCIDO
      if (filterTipo === "REAL") {
        // REAL = Solo Ingresos y Gastos operativos (NORMAL)
        if (codigoTipo !== "NORMAL") return false;
      }
      else if (filterTipo === "TARJETA_CREDITO") {
        // Ya filtrado arriba por tipo de cuenta; aquí no filtramos por tipo de transacción
      }
      else if (filterTipo === "INGRESO") {
        // Solo NORMALES de tipo ENTRADA
        if (codigoTipo !== "NORMAL" || tx.direccion !== "ENTRADA") return false;
      }
      else if (filterTipo === "GASTO") {
        // Solo NORMALES de tipo SALIDA
        if (codigoTipo !== "NORMAL" || tx.direccion !== "SALIDA") return false;
      }
      else if (filterTipo === "TRANSFERENCIA") {
        if (codigoTipo !== "TRANSFERENCIA") return false;
      }
      else if (filterTipo === "AJUSTE") {
        if (codigoTipo !== "AJUSTE") return false;
      }
      // "ALL" muestra todo lo que pase los siguientes filtros

      // 3. FILTROS ESTÁNDAR (Categoría, Cuenta, Fecha, Texto)
      if (filterCategoria && tx.categoria?.id !== filterCategoria) return false;
      if (filterCuenta && tx.cuentaId !== filterCuenta) return false;
      
      const txDate = new Date(tx.ocurrioEn);
      if (desdeDate && txDate < desdeDate) return false;
      if (hastaDate && txDate > hastaDate) return false;

      if (query) {
        const text = `${tx.descripcion ?? ""} ${tx.categoria?.nombre ?? ""} ${tx.cuenta?.nombre ?? ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [txs, filterQuery, filterTipo, filterCategoria, filterCuenta, filterDesde, filterHasta]);
  // Cálculo de totales (Solo suma lo que está visible en el filtro actual)
const summary = useMemo(() => {
     return filteredTxs.reduce<Summary>((acc, tx) => {
        const valor = Number(tx.monto || 0);
        
        // 1. OBTENER CÓDIGO
        // Ahora confiamos en que el backend envía el objeto correctamente.
        // Si es undefined (datos muy viejos), asumimos NORMAL, pero 
        // los datos nuevos vendrán con "AJUSTE" gracias al paso 2.
        const codigo = tx.tipoTransaccion?.codigo || "NORMAL";

        // 2. REGLA DE NEGOCIO:
        // Solo sumamos al "Flujo de Caja" (Ingresos/Gastos) si es una operación NORMAL.
        // - "AJUSTE": No es dinero real que ganaste o perdiste operativamente.
        // - "TRANSFERENCIA": No cambia tu patrimonio.
       
        if (codigo === "NORMAL") { 
            if (tx.direccion === "ENTRADA") {
                acc.ingresos += valor;
            } else if (tx.direccion === "SALIDA") {
                acc.egresos += valor;
            }
        }
        
        acc.total += 1;
        return acc;
     }, { ingresos: 0, egresos: 0, total: 0 });
  }, [filteredTxs]);

  // Handlers CRUD
  const startEdit = (tx: Transaccion) => {
    setEditingTxId(tx.id);
    setEditForm({
      cuentaId: tx.cuentaId, monto: Number(tx.monto ?? 0), direccion: tx.direccion,
      descripcion: tx.descripcion ?? "", categoriaId: tx.categoria?.id ?? undefined,
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16),
    });
    setEditError(null);
    setShowEditModal(true);
  };
  const handleEditSubmit = async () => {
    if (!editingTxId || !accessToken) return;
    setEditBusy(true);
    try {
      await TransaccionService.actualizar(editingTxId, editForm, { accessToken });
      setActionMessage("Actualizado correctamente");
      setShowEditModal(false);
      await forceRefresh();
    } catch (err) { setEditError(err instanceof Error ? err.message : "Error"); } 
    finally { setEditBusy(false); setTimeout(() => setActionMessage(null), 3000); }
  };
  const handleDeleteTransaction = async (id: string) => {
    if (!accessToken || !confirm("¿Eliminar transacción?")) return;
    setEditBusy(true);
    try {
      await TransaccionService.eliminar(id, { accessToken });
      setActionMessage("Eliminado correctamente");
      setShowEditModal(false);
      await forceRefresh();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); } 
    finally { setEditBusy(false); setTimeout(() => setActionMessage(null), 3000); }
  };

  if (loadingSession) return <Loading message="Cargando..." />;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-zinc-100 transition-colors duration-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:px-6 py-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400 font-bold mb-1">Finanzas</p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Transacciones</h1>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             <button onClick={() => setShowFilters(!showFilters)} className="md:hidden flex-1 flex items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <SlidersHorizontal size={16} />
                {showFilters ? "Ocultar" : "Filtros"}
             </button>
             {isSignedIn && (
              <button onClick={() => setShowCreateModal(true)} className="flex-1 md:flex-none rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 hover:bg-sky-500 transition-transform active:scale-95">
                + Nueva
              </button>
            )}
          </div>
        </header>

        {error && <div className="text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-3 rounded-lg text-sm">{error}</div>}

        {!isSignedIn ? (
          <div className="text-center py-20 opacity-50">Inicia sesión para ver tus datos.</div>
        ) : (
          <>
            {actionMessage && <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{actionMessage}</div>}

            {/* --- SECCIÓN DE FILTROS --- */}
            <section className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-sm transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 md:max-h-[none] md:opacity-100'}`}>
              <div className="flex flex-col gap-6">
                 
                 {/* TABS DE TIPO */}
                 <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-100 dark:border-white/5">
                    
                    {/* Default: REAL (NORMAL) */}
                    <FilterTab active={filterTipo === "REAL"} onClick={() => setFilterTipo("REAL")} icon={Activity} label="Ingresos y Gastos" colorClass="text-sky-500" />

                    <FilterTab active={filterTipo === "INGRESO"} onClick={() => setFilterTipo("INGRESO")} icon={TrendingUp} label="Ingresos" colorClass="text-emerald-500" />
                    <FilterTab active={filterTipo === "GASTO"} onClick={() => setFilterTipo("GASTO")} icon={TrendingDown} label="Gastos" colorClass="text-rose-500" />
                    
                    {/* Otros tipos */}
                    <FilterTab active={filterTipo === "TRANSFERENCIA"} onClick={() => setFilterTipo("TRANSFERENCIA")} icon={ArrowRightLeft} label="Transferencias" colorClass="text-slate-500 dark:text-slate-400" />
                    <FilterTab active={filterTipo === "AJUSTE"} onClick={() => setFilterTipo("AJUSTE")} icon={Scale} label="Ajustes" colorClass="text-amber-500" />
                    <FilterTab active={filterTipo === "TARJETA_CREDITO"} onClick={() => setFilterTipo("TARJETA_CREDITO")} icon={CreditCard} label="Tarjetas crédito" colorClass="text-violet-500" />
                    
                    <FilterTab active={filterTipo === "ALL"} onClick={() => setFilterTipo("ALL")} icon={Layers} label="Todo" />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Buscar..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 py-2.5 pl-10 pr-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all" />
                    </div>
                    <SelectField label="Categoría" value={filterCategoria} onChange={setFilterCategoria} options={[{ label: "Todas", value: "" }, ...categorias.map(c => ({ label: c.nombre, value: c.id }))]} />
                    <SelectField
                      label="Cuenta"
                      value={filterCuenta}
                      onChange={setFilterCuenta}
                      options={[
                        { label: "Todas", value: "" },
                        ...cuentas
                          .filter((c) =>
                            filterTipo === "TARJETA_CREDITO"
                              ? c?.tipoCuenta?.codigo ===
                                CODIGO_TIPO_CUENTA_TARJETA_CREDITO
                              : c?.tipoCuenta?.codigo !==
                                CODIGO_TIPO_CUENTA_TARJETA_CREDITO,
                          )
                          .map((c) => ({ label: c.nombre, value: c.id })),
                      ]}
                    />
                    <div className="flex gap-2 items-end">
                        <input type="date" className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-2.5 text-xs text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
                        <span className="text-slate-400 mb-2">➔</span>
                        <input type="date" className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-2.5 text-xs text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
                    </div>
                 </div>
              </div>

              {(filterQuery || filterTipo !== "REAL" || filterCategoria || filterCuenta || filterDesde || filterHasta) && (
                <div className="mt-4 flex justify-end">
                    <button onClick={() => { setFilterQuery(""); setFilterTipo("REAL"); setFilterCategoria(""); setFilterCuenta(""); setFilterDesde(""); setFilterHasta(""); }} className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400">
                        <X size={12} /> Limpiar filtros
                    </button>
                </div>
              )}
            </section>

            {/* --- RESUMEN --- */}
            {/* Ocultamos KPIs en Transferencias porque no representan flujo neto */}
            {filterTipo !== "TRANSFERENCIA" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <KPICard label="Ingresos" value={summary.ingresos} color="text-emerald-500" />
                    <KPICard label="Gastos" value={summary.egresos} color="text-rose-500" />
                    <KPICard label="Neto" value={summary.ingresos - summary.egresos} color="text-sky-500" />
                    <div className="hidden md:block rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                        <p className="text-[10px] uppercase text-slate-400">Total</p>
                        <p className="text-xl font-mono font-bold text-slate-700 dark:text-slate-300">{summary.total}</p>
                    </div>
                </div>
            )}

            {/* --- LISTA --- */}
            <section className="space-y-3">
              {filteredTxs.slice(0, visibleCount).map((tx) => (
                <TransactionListItem key={tx.id} tx={tx} onEdit={startEdit} onDelete={(id) => handleDeleteTransaction(id)} />
              ))}

              {loadingData && <div className="py-8 text-center text-sm text-sky-500 animate-pulse">Sincronizando...</div>}
              
              {!loadingData && filteredTxs.length === 0 && (
                <div className="py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                    <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-full mb-3">
                        <Filter className="text-slate-300 dark:text-slate-600" size={32} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No hay resultados</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                        {filterTipo === "REAL" ? "No hay ingresos ni gastos 'NORMALES'." : "Ajusta los filtros."}
                    </p>
                </div>
              )}

              {filteredTxs.length > visibleCount && (
                  <div className="flex justify-center pt-4">
                      <button onClick={() => setVisibleCount(p => p + ITEMS_PER_LOAD)} className="flex items-center gap-2 px-6 py-2 rounded-full bg-slate-200 dark:bg-white/10 text-sm font-medium hover:bg-slate-300 dark:hover:bg-white/20 transition-colors">
                          Cargar más <ChevronDown size={14} />
                      </button>
                  </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* MODALES */}
      {showCreateModal && isSignedIn && (
        <Modal title="Nueva transacción" onClose={() => setShowCreateModal(false)}>
          <TransactionCreationPanel cuentas={cuentas} categorias={categorias} nowLocal={nowLocal} authToken={accessToken} onCreated={() => { setShowCreateModal(false); forceRefresh(); setActionMessage("Creado exitosamente"); }} />
        </Modal>
      )}
      {showEditModal && editingTxId && (
        <Modal title="Editar" onClose={() => { setShowEditModal(false); setEditingTxId(null); }}>
          {editError && <div className="mb-4 p-2 bg-rose-500/10 text-rose-500 rounded text-sm">{editError}</div>}
          <TransactionForm form={editForm} cuentas={cuentas} categorias={categorias} nowLocal={nowLocal} busy={editBusy} isEditing onChange={p => setEditForm(prev => ({ ...prev, ...p }))} onSubmit={handleEditSubmit} onDelete={() => handleDeleteTransaction(editingTxId)} onCancel={() => { setShowEditModal(false); setEditingTxId(null); }} />
        </Modal>
      )}
    </div>
  );
}

// Subcomponentes
function FilterTab({ active, onClick, icon: Icon, label, colorClass = "text-sky-500" }: any) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border ${active ? `bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 shadow-sm ${colorClass}` : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
            <Icon size={14} /> {label}
        </button>
    )
}

function KPICard({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`text-xl font-bold ${color} mt-1`}>{formatMoney(value)}</p>
        </div>
    )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
            <h3 className="font-bold text-lg dark:text-white">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
