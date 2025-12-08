"use client";

import { useCallback, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { formatMoney } from "@/lib/formatMoney";
import { TransactionCreationPanel } from "./TransactionCreationPanel";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { InputField, SelectField } from "@/components/ui/Fields";
import type { Transaccion, TxForm } from "@/components/transactions/types";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransaccionService } from "@/lib/services/TransaccionService";

type Summary = { ingresos: number; egresos: number; total: number };

const createEmptyTxForm = (nowLocal: string, cuentaId = ""): TxForm => ({
  cuentaId,
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  categoriaId: undefined,
  ocurrioEn: nowLocal,
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TxForm>(() => createEmptyTxForm(new Date().toISOString().slice(0, 16)));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<"ALL" | "ENTRADA" | "SALIDA">("ALL");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterCuenta, setFilterCuenta] = useState("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  const accessToken = session?.access_token;
  const forceRefresh = useCallback(() => refresh({ force: true }), [refresh]);

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
      setActionMessage("Transacción actualizada");
      setShowEditModal(false);
      setEditingTxId(null);
      await forceRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
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
      setEditError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEditBusy(false);
    }
  };

  const filteredTxs = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const desdeDate = filterDesde ? new Date(filterDesde) : null;
    const hastaDate = filterHasta ? new Date(filterHasta) : null;
    return txs.filter((tx) => {
      if (filterTipo !== "ALL" && tx.direccion !== filterTipo) return false;
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

  const summary = useMemo(() => buildSummary(filteredTxs), [filteredTxs]);
  const flowByMonth = useMemo(() => buildMonthlyFlow(filteredTxs).slice(-6), [filteredTxs]);
  const categoriaStats = useMemo(
    () => buildCategoriaStats(filteredTxs).slice(0, 5),
    [filteredTxs],
  );
  const cuentaStats = useMemo(
    () =>
      [...cuentas]
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipoCuenta?.nombre ?? "-",
          saldo: Number(c.saldo ?? 0),
          moneda: c.moneda,
        }))
        .sort((a, b) => b.saldo - a.saldo),
    [cuentas],
  );
  const recientes = useMemo(() => filteredTxs.slice(0, 25), [filteredTxs]);
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);

  const isSignedIn = Boolean(accessToken);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Movimientos</p>
            <h1 className="text-3xl font-semibold text-white">Transacciones</h1>
            <p className="text-sm text-slate-400">
              Consulta ingresos, egresos y registra nuevos movimientos desde una sola vista.
            </p>
          </div>
          <div className="flex gap-3">
            {!isSignedIn && !loadingSession && (
              <a
                href="/dashboard"
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
              >
                Inicia sesión
              </a>
            )}
            {isSignedIn && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
              >
                Nueva transacción
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
            <button className="ml-2 text-xs underline" onClick={() => setEditError(null)}>
              cerrar
            </button>
          </div>
        )}

        {!isSignedIn ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            <p>Para ver tus transacciones, inicia sesión desde el dashboard.</p>
          </div>
        ) : (
          <>
            {actionMessage && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {actionMessage}
                <button className="ml-2 text-xs underline" onClick={() => setActionMessage(null)}>
                  cerrar
                </button>
              </div>
            )}

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Filtros</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <InputField label="Buscar" value={filterQuery} onChange={setFilterQuery} />
                <SelectField
                  label="Tipo"
                  value={filterTipo}
                  onChange={(v) => setFilterTipo(v as typeof filterTipo)}
                  options={[
                    { label: "Todos", value: "ALL" },
                    { label: "Ingresos", value: "ENTRADA" },
                    { label: "Gastos", value: "SALIDA" },
                  ]}
                />
                <SelectField
                  label="Categoría"
                  value={filterCategoria}
                  onChange={(v) => setFilterCategoria(v)}
                  options={[
                    { label: "Todas", value: "" },
                    ...categorias.map((cat) => ({ label: cat.nombre, value: cat.id })),
                  ]}
                />
                <SelectField
                  label="Cuenta"
                  value={filterCuenta}
                  onChange={(v) => setFilterCuenta(v)}
                  options={[
                    { label: "Todas", value: "" },
                    ...cuentas.map((cta) => ({ label: cta.nombre, value: cta.id })),
                  ]}
                />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <InputField
                  label="Desde"
                  type="date"
                  value={filterDesde}
                  onChange={setFilterDesde}
                />
                <InputField
                  label="Hasta"
                  type="date"
                  value={filterHasta}
                  onChange={setFilterHasta}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="Ingresos" value={summary.ingresos} tone="text-emerald-300" />
              <StatCard label="Egresos" value={summary.egresos} tone="text-rose-300" />
              <StatCard label="Neto" value={summary.ingresos - summary.egresos} tone="text-sky-300" />
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FlowChart title="Flujo mensual" data={flowByMonth} />
              <CategoriaChart data={categoriaStats} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Transacciones recientes</h2>
                  <p className="text-xs text-slate-400">Últimas {recientes.length} operaciones</p>
                </div>
                <span className="text-xs text-slate-400">
                  Total histórico: {summary.total} transacciones
                </span>
              </div>
              <div className="mt-4 divide-y divide-white/5">
                {recientes.length === 0 && !loadingData && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Registra tu primera transacción.
                  </p>
                )}
                {recientes.map((tx) => (
                  <TransactionListItem
                    key={tx.id}
                    tx={tx}
                    onEdit={startEdit}
                    onDelete={(id) => handleDeleteTransaction(id)}
                  />
                ))}
          </div>
        </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">Saldo por cuenta</h2>
                <div className="mt-4 space-y-3">
                  {cuentaStats.length === 0 && (
                    <p className="text-sm text-slate-400">No hay cuentas asociadas.</p>
                  )}
                  {cuentaStats.map((cta) => (
                    <div
                      key={cta.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{cta.nombre}</p>
                        <p className="text-xs text-slate-400">{cta.tipo}</p>
                      </div>
                      <p className="text-sm text-emerald-300">{formatMoney(cta.saldo, cta.moneda)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">Estado</h2>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  <li>• Los datos se cargan desde las APIs privadas usando tu sesión actual.</li>
                  <li>• Se excluyen transacciones internas de ajuste.</li>
                  <li>• Registra nuevas transacciones y la vista se refresca automáticamente.</li>
                </ul>
              </div>
            </section>
          </>
        )}
      </div>

      {showCreateModal && isSignedIn && (
        <Modal
          title="Registrar transacción"
          onClose={() => setShowCreateModal(false)}
        >
          <TransactionCreationPanel
            cuentas={cuentas}
            categorias={categorias}
            nowLocal={nowLocal}
            authToken={accessToken}
            onCreated={() => {
              setShowCreateModal(false);
              void forceRefresh();
            }}
          />
        </Modal>
      )}

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
            <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {editError}
              <button className="ml-2 text-xs underline" onClick={() => setEditError(null)}>
                cerrar
              </button>
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
    const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7);
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

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className={`text-2xl font-semibold ${tone}`}>{formatMoney(value)}</p>
    </div>
  );
}

function FlowChart({
  title,
  data,
}: {
  title: string;
  data: [string, { ingresos: number; egresos: number }][];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {data.length === 0 && <p className="text-sm text-slate-400">Sin registros.</p>}
        {data.map(([mes, valores]) => (
          <div key={mes} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{mes}</span>
              <span>
                <span className="text-emerald-300">{formatMoney(valores.ingresos)}</span>{" "}
                <span className="text-slate-500">/</span>{" "}
                <span className="text-rose-300">{formatMoney(valores.egresos)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                style={{
                  width: `${calcPercent(valores.ingresos, valores.ingresos + valores.egresos)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriaChart({ data }: { data: { nombre: string; total: number }[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold text-white">Gasto por categoría</h2>
      <div className="mt-4 space-y-3">
        {data.length === 0 && <p className="text-sm text-slate-400">Sin datos.</p>}
        {data.map((cat) => (
          <div key={cat.nombre} className="space-y-1">
            <div className="flex items-center justify-between text-sm text-white">
              <span>{cat.nombre}</span>
              <span>{formatMoney(cat.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-rose-400"
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

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
