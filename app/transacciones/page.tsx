"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { formatMoney } from "@/lib/formatMoney";

// Componentes UI
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionCreationPanel } from "./TransactionCreationPanel"; // Asumiendo que este archivo existe, si no, usa TransactionForm
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { InputField, SelectField } from "@/components/ui/Fields";
import { TransaccionService } from "@/lib/services/TransaccionService";
import { Loading } from "@/components/ui/Loading";

// Tipos
import type { Transaccion, TxForm } from "@/components/transactions/types";

// Iconos
import { Search, Filter, Calendar, ChevronDown } from "lucide-react";

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================
type Summary = { ingresos: number; egresos: number; total: number };

const createEmptyTxForm = (nowLocal: string, cuentaId = ""): TxForm => ({
  cuentaId,
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  categoriaId: undefined,
  ocurrioEn: nowLocal,
});

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
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

  // Estados de UI (Modales)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Estados de Edición
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TxForm>(() => createEmptyTxForm(new Date().toISOString().slice(0, 16)));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Mensajes de feedback
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Estados de Filtros
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<"ALL" | "ENTRADA" | "SALIDA">("ALL");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterCuenta, setFilterCuenta] = useState("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  // Estado de Paginación
  const [visibleCount, setVisibleCount] = useState(50);
  const ITEMS_PER_LOAD = 50;

  const accessToken = session?.access_token;
  const isSignedIn = Boolean(accessToken);
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);

  const forceRefresh = useCallback(() => refresh({ force: true }), [refresh]);

  // Resetear paginación cuando cambian los filtros
  useEffect(() => {
    setVisibleCount(ITEMS_PER_LOAD);
  }, [filterQuery, filterTipo, filterCategoria, filterCuenta, filterDesde, filterHasta]);

  // --------------------------------------------------------------------------
  // LÓGICA DE FILTRADO
  // --------------------------------------------------------------------------
  const filteredTxs = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const desdeDate = filterDesde ? new Date(filterDesde) : null;
    const hastaDate = filterHasta ? new Date(filterHasta) : null;

    return txs.filter((tx) => {
      // Filtro Tipo
      if (filterTipo !== "ALL" && tx.direccion !== filterTipo) return false;
      // Filtro Categoría
      if (filterCategoria && tx.categoria?.id !== filterCategoria) return false;
      // Filtro Cuenta
      if (filterCuenta && tx.cuentaId !== filterCuenta) return false;
      
      // Filtro Fecha
      const txDate = new Date(tx.ocurrioEn);
      if (desdeDate && txDate < desdeDate) return false;
      if (hastaDate && txDate > hastaDate) return false;

      // Filtro Texto (Búsqueda)
      if (query) {
        const text = `${tx.descripcion ?? ""} ${tx.categoria?.nombre ?? ""} ${tx.cuenta?.nombre ?? ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      
      return true;
    });
  }, [txs, filterQuery, filterTipo, filterCategoria, filterCuenta, filterDesde, filterHasta]);

  // --------------------------------------------------------------------------
  // CÁLCULOS DE ESTADÍSTICAS (Memoizados)
  // --------------------------------------------------------------------------
  const summary = useMemo(() => buildSummary(filteredTxs), [filteredTxs]);
  const flowByMonth = useMemo(() => buildMonthlyFlow(filteredTxs).slice(-6), [filteredTxs]);
  const categoriaStats = useMemo(() => buildCategoriaStats(filteredTxs).slice(0, 5), [filteredTxs]);
  
  const cuentaStats = useMemo(() => 
    [...cuentas]
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipoCuenta?.nombre ?? "-",
        saldo: Number(c.saldo ?? 0),
        moneda: c.moneda,
      }))
      .sort((a, b) => b.saldo - a.saldo),
    [cuentas]
  );

  // --------------------------------------------------------------------------
  // HANDLERS (CRUD)
  // --------------------------------------------------------------------------
  const startEdit = (tx: Transaccion) => {
    setEditingTxId(tx.id);
    setEditForm({
      cuentaId: tx.cuentaId,
      monto: Number(tx.monto ?? 0),
      direccion: tx.direccion,
      descripcion: tx.descripcion ?? "",
      categoriaId: tx.categoria?.id ?? undefined,
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16),
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const validateForm = (form: TxForm) => {
    if (!form.cuentaId) return "Selecciona una cuenta";
    if (!form.monto || Number(form.monto) <= 0) return "Monto debe ser mayor a 0";
    return null;
  };

  const handleEditSubmit = async () => {
    if (!editingTxId) return;
    const validation = validateForm(editForm);
    if (validation) {
      setEditError(validation);
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      if (!accessToken) throw new Error("No hay sesión activa");
      await TransaccionService.actualizar(editingTxId, editForm, { accessToken });
      setActionMessage("Transacción actualizada exitosamente");
      setShowEditModal(false);
      setEditingTxId(null);
      await forceRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEditBusy(false);
      // Limpiar mensaje de éxito después de 3 seg
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta transacción? El saldo de la cuenta será revertido.")) return;
    setEditBusy(true);
    setEditError(null);
    try {
      if (!accessToken) throw new Error("No hay sesión activa");
      await TransaccionService.eliminar(id, { accessToken });
      setActionMessage("Transacción eliminada");
      setShowEditModal(false);
      setEditingTxId(null);
      await forceRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEditBusy(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  if (loadingSession) {
    return <Loading message="Cargando tus finanzas..." />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
        
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400 font-bold">Movimientos</p>
            <h1 className="text-3xl font-bold text-white">Transacciones</h1>
            <p className="text-sm text-slate-400 mt-1">
              Historial completo y gestión de ingresos y egresos.
            </p>
          </div>
          <div className="flex gap-3">
            {!isSignedIn ? (
              <a
                href="/login"
                className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 shadow-lg shadow-sky-900/20"
              >
                Inicia sesión
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 shadow-lg shadow-sky-900/20 hover:scale-105 active:scale-95"
              >
                + Nueva transacción
              </button>
            )}
          </div>
        </header>

        {/* ERROR GLOBAL */}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            ⚠️ {error}
          </div>
        )}

        {/* CONTENIDO PRINCIPAL (SOLO SI LOGUEADO) */}
        {!isSignedIn ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
            <p className="text-lg">🔒 Acceso restringido</p>
            <p className="text-sm text-slate-500 mt-2">Por favor, inicia sesión para ver tus movimientos.</p>
          </div>
        ) : (
          <>
            {/* FEEDBACK ACTION */}
            {actionMessage && (
              <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/80 backdrop-blur-md px-6 py-4 text-emerald-200 shadow-xl">
                  ✅ {actionMessage}
                </div>
              </div>
            )}

            {/* SECCIÓN 1: FILTROS */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-300">
                <Filter size={16} className="text-sky-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">Filtros Avanzados</h2>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
                <div className="md:col-span-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar descripción..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
                        />
                    </div>
                </div>
                
                <SelectField
                  label=""
                  value={filterTipo}
                  onChange={(v) => setFilterTipo(v as typeof filterTipo)}
                  options={[
                    { label: "Tipo: Todos", value: "ALL" },
                    { label: "Solo Ingresos", value: "ENTRADA" },
                    { label: "Solo Gastos", value: "SALIDA" },
                  ]}
                />
                <SelectField
                  label=""
                  value={filterCategoria}
                  onChange={(v) => setFilterCategoria(v)}
                  options={[
                    { label: "Categoría: Todas", value: "" },
                    ...categorias.map((cat) => ({ label: cat.nombre, value: cat.id })),
                  ]}
                />
                <SelectField
                  label=""
                  value={filterCuenta}
                  onChange={(v) => setFilterCuenta(v)}
                  options={[
                    { label: "Cuenta: Todas", value: "" },
                    ...cuentas.map((cta) => ({ label: cta.nombre, value: cta.id })),
                  ]}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-white/5 pt-4">
                 <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <Calendar size={14} /> Rango de Fechas
                 </div>
                 <div className="flex gap-2">
                    <input type="date" className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-sky-500 focus:outline-none" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
                    <span className="text-slate-600 self-center">➔</span>
                    <input type="date" className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-sky-500 focus:outline-none" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
                 </div>
                 {(filterQuery || filterTipo !== "ALL" || filterCategoria || filterCuenta || filterDesde || filterHasta) && (
                     <button 
                        onClick={() => {
                            setFilterQuery("");
                            setFilterTipo("ALL");
                            setFilterCategoria("");
                            setFilterCuenta("");
                            setFilterDesde("");
                            setFilterHasta("");
                        }}
                        className="ml-auto text-xs text-rose-400 hover:text-rose-300 hover:underline"
                     >
                        Limpiar filtros
                     </button>
                 )}
              </div>
            </section>

            {/* SECCIÓN 2: KPIs */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="Ingresos Totales" value={summary.ingresos} tone="emerald" />
              <StatCard label="Egresos Totales" value={summary.egresos} tone="rose" />
              <StatCard label="Balance del periodo" value={summary.ingresos - summary.egresos} tone="sky" />
            </section>

            {/* SECCIÓN 3: GRÁFICAS */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FlowChart title="Flujo mensual" data={flowByMonth} />
              <CategoriaChart data={categoriaStats} />
            </section>

            {/* SECCIÓN 4: LISTA DE TRANSACCIONES (Con Paginación) */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Transacciones</h2>
                  <p className="text-xs text-slate-400">
                    Mostrando {Math.min(visibleCount, filteredTxs.length)} de {filteredTxs.length} resultados filtrados.
                  </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Total Histórico</p>
                    <p className="text-sm font-mono text-slate-300">{summary.total}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* LISTA */}
                {filteredTxs.slice(0, visibleCount).map((tx) => (
                  <TransactionListItem
                    key={tx.id}
                    tx={tx}
                    onEdit={startEdit}
                    onDelete={(id) => handleDeleteTransaction(id)}
                  />
                ))}

                {/* EMPTY STATES */}
                {filteredTxs.length === 0 && !loadingData && (
                  <div className="py-12 text-center rounded-xl border border-dashed border-slate-700 bg-white/5">
                    <p className="text-slate-400">No se encontraron transacciones.</p>
                    <p className="text-xs text-slate-600 mt-1">Intenta ajustar los filtros o crea una nueva.</p>
                  </div>
                )}
                
                {/* LOADING STATE */}
                {loadingData && (
                    <div className="py-4 text-center">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></span>
                        <span className="ml-2 text-sm text-sky-400">Sincronizando...</span>
                    </div>
                )}
              </div>

              {/* PAGINACIÓN */}
              {filteredTxs.length > visibleCount && (
                  <div className="mt-8 text-center border-t border-white/5 pt-4">
                      <button
                          onClick={() => setVisibleCount(prev => prev + ITEMS_PER_LOAD)}
                          className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-slate-800 px-6 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white hover:ring-2 hover:ring-sky-500/50"
                      >
                          <span>Cargar siguientes {ITEMS_PER_LOAD}</span>
                          <ChevronDown size={14} className="transition-transform group-hover:translate-y-0.5" />
                      </button>
                      <p className="mt-2 text-xs text-slate-600">
                          Restan {filteredTxs.length - visibleCount} movimientos
                      </p>
                  </div>
              )}
            </section>

            {/* SECCIÓN 5: INFORMACIÓN LATERAL (Saldos y Notas) */}
            <section className="grid">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-base font-semibold text-white mb-4">Saldos actuales por cuenta</h2>
                <div className="space-y-3">
                  {cuentaStats.length === 0 && (
                    <p className="text-sm text-slate-400">No tienes cuentas registradas.</p>
                  )}
                  {cuentaStats.map((cta) => (
                    <div
                      key={cta.id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3 hover:bg-black/40 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-200">{cta.nombre}</p>
                        <p className="text-[10px] uppercase text-slate-500 tracking-wider">{cta.tipo}</p>
                      </div>
                      <p className={`text-sm font-mono ${cta.saldo < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatMoney(cta.saldo, cta.moneda)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* --- MODALES --- */}

      {/* Modal Crear */}
      {showCreateModal && isSignedIn && (
        <Modal
          title="Registrar transacción"
          onClose={() => setShowCreateModal(false)}
        >
          {/* Usamos el Panel si existe, o el Formulario directo */}
          <TransactionCreationPanel
            cuentas={cuentas}
            categorias={categorias}
            nowLocal={nowLocal}
            authToken={accessToken}
            onCreated={() => {
              setShowCreateModal(false);
              void forceRefresh(); // Forzamos recarga para ver el cambio inmediato
              setActionMessage("Transacción creada exitosamente");
              setTimeout(() => setActionMessage(null), 3000);
            }}
          />
        </Modal>
      )}

      {/* Modal Editar */}
      {showEditModal && editingTxId && (
        <Modal
          title="Editar transacción"
          onClose={() => {
            setShowEditModal(false);
            setEditingTxId(null);
            setEditError(null);
          }}
        >
          {editError && (
            <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {editError}
            </div>
          )}
          <TransactionForm
            form={editForm}
            cuentas={cuentas}
            categorias={categorias}
            nowLocal={nowLocal}
            busy={editBusy}
            isEditing
            onChange={(partial) => setEditForm((prev) => ({ ...prev, ...partial }))}
            onSubmit={handleEditSubmit}
            onDelete={() => handleDeleteTransaction(editingTxId)}
            onCancel={() => {
              setShowEditModal(false);
              setEditingTxId(null);
              setEditError(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS & COMPONENTES LOCALES
// ============================================================================

function buildSummary(transacciones: Transaccion[]): Summary {
  return transacciones.reduce<Summary>(
    (acc, tx) => {
      const valor = Number(tx.monto ?? 0);
      if (tx.direccion === "ENTRADA") acc.ingresos += valor;
      else acc.egresos += valor;
      acc.total += 1;
      return acc;
    },
    { ingresos: 0, egresos: 0, total: 0 },
  );
}

function buildMonthlyFlow(transacciones: Transaccion[]) {
  const map = new Map<string, { ingresos: number; egresos: number }>();
  transacciones.forEach((tx) => {
    const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7); // YYYY-MM
    const current = map.get(key) ?? { ingresos: 0, egresos: 0 };
    const valor = Number(tx.monto ?? 0);
    if (tx.direccion === "ENTRADA") current.ingresos += valor;
    else current.egresos += valor;
    map.set(key, current);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function buildCategoriaStats(transacciones: Transaccion[]) {
  const map = new Map<string, number>();
  transacciones
    .filter((tx) => tx.direccion === "SALIDA")
    .forEach((tx) => {
      const key = tx.categoria?.nombre ?? "Sin categoría";
      map.set(key, (map.get(key) ?? 0) + Number(tx.monto ?? 0));
    });
  return Array.from(map.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total);
}

// UI Components locales
function StatCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "sky" }) {
  const colorClass = 
    tone === "emerald" ? "text-emerald-400" : 
    tone === "rose" ? "text-rose-400" : "text-sky-400";
    
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${colorClass}`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}

function FlowChart({ title, data }: { title: string; data: [string, { ingresos: number; egresos: number }][]; }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div className="space-y-4">
        {data.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin datos suficientes.</p>}
        {data.map(([mes, valores]) => {
            const total = valores.ingresos + valores.egresos;
            const pct = total > 0 ? (valores.ingresos / total) * 100 : 0;
            return (
              <div key={mes} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wide">
                  <span>{mes}</span>
                  <div className="font-mono">
                    <span className="text-emerald-400">{formatMoney(valores.ingresos)}</span>
                    <span className="mx-1 opacity-50">/</span>
                    <span className="text-rose-400">{formatMoney(valores.egresos)}</span>
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                  {/* El fondo gris actúa como la parte de egresos si llenas el resto */}
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}

function CategoriaChart({ data }: { data: { nombre: string; total: number }[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Top Gastos por Categoría</h2>
      <div className="space-y-4">
        {data.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin gastos registrados.</p>}
        {data.map((cat) => (
          <div key={cat.nombre} className="space-y-1">
            <div className="flex items-center justify-between text-sm text-white">
              <span className="font-medium">{cat.nombre}</span>
              <span className="text-slate-300 font-mono text-xs">{formatMoney(cat.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                style={{
                  width: `${calcPercent(cat.total, data[0]?.total || 1)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calcPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}