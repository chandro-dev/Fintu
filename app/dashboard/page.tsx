"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/formatMoney";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import {
  TxForm,
  Cuenta,
  Transaccion,
  Categoria
} from "@/components/transactions/types";
import { InputField, SelectField } from "@/components/ui/Fields";
import { useCachedResource } from "@/lib/useCachedResource";
import { TransaccionService } from "@/lib/services/TransaccionService";
import { Loading } from "@/components/ui/Loading";

type CategoriaForm = {
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string;
};

const emptyTx: TxForm = {
  cuentaId: "",
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  ocurrioEn: ""
};

const emptyCategoria: CategoriaForm = {
  nombre: "",
  tipo: "GASTO",
  color: "#0ea5e9"
};

export default function Dashboard() {
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [txForm, setTxForm] = useState<TxForm>(emptyTx);
  const [categoriaForm, setCategoriaForm] =
    useState<CategoriaForm>(emptyCategoria);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const isSignedIn = useMemo(
    () => Boolean(session?.access_token),
    [session?.access_token]
  );

  useEffect(() => {
    if (!loadingSession && !isSignedIn) {
      router.replace("/login");
    }
  }, [isSignedIn, loadingSession, router]);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabaseClient.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const accessToken = session?.access_token;
  const authHeaders = useMemo(
    () =>
      accessToken
        ? {
            credentials: "include" as const,
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        : { credentials: "include" as const },
    [accessToken]
  );

  const userKey = session?.user?.id ?? "anon";

  const {
    data: cuentas = [],
    loading: loadingCuentas,
    error: cuentasError,
    refresh: refreshCuentas,
    invalidate: invalidateCuentas
  } = useCachedResource<Cuenta[]>(
    `cuentas:${userKey}`,
    async () => {
      if (!accessToken) return [];
      const res = await fetch("/api/accounts", authHeaders);
      if (!res.ok) throw new Error("No se pudo cargar cuentas");
      return res.json();
    },
    { refreshOnMount: false }
  );

  const {
    data: categorias = [],
    loading: loadingCategorias,
    error: categoriasError,
    refresh: refreshCategorias,
    invalidate: invalidateCategorias
  } = useCachedResource<Categoria[]>(
    `categorias:${userKey}`,
    async () => {
      if (!accessToken) return [];
      const res = await fetch("/api/categorias", authHeaders);
      if (!res.ok) throw new Error("No se pudo cargar categorias");
      return res.json();
    },
    { refreshOnMount: false }
  );

  const {
    data: txs = [],
    loading: loadingTxs,
    error: txsError,
    refresh: refreshTxs,
    invalidate: invalidateTxs
  } = useCachedResource<Transaccion[]>(
    `txs:${userKey}`,
    async () => {
      if (!accessToken) return [];
      const res = await fetch("/api/transactions", authHeaders);
      if (!res.ok) throw new Error("No se pudo cargar transacciones");
      return res.json();
    },
    { refreshOnMount: false }
  );

  useEffect(() => {
    if (!accessToken) {
      invalidateCuentas();
      invalidateCategorias();
      invalidateTxs();
      return;
    }
    void Promise.all([refreshCuentas(), refreshCategorias(), refreshTxs()]);
  }, [
    accessToken,
    invalidateCategorias,
    invalidateCuentas,
    invalidateTxs,
    refreshCategorias,
    refreshCuentas,
    refreshTxs
  ]);

  const loadingData = loadingCuentas || loadingCategorias || loadingTxs;
  const displayError =
    error ?? (cuentasError || categoriasError || txsError || null);
  const errorMessage =
    displayError instanceof Error
      ? displayError.message
      : displayError?.toString() ?? null;

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    setSession(null);
    setTxForm(emptyTx);
    setCategoriaForm(emptyCategoria);
    invalidateCuentas();
    invalidateCategorias();
    invalidateTxs();
    router.replace("/login");
  };

  const saveTx = async () => {
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    try {
      const isEditing = Boolean(editingTxId);
      if (isEditing) {
        await TransaccionService.actualizar(editingTxId!, txForm, {
          accessToken
        });
      } else {
        await TransaccionService.crear(txForm, { accessToken });
      }
      setTxForm(emptyTx);
      setEditingTxId(null);
      setShowTxModal(false);
      await Promise.all([refreshCuentas(), refreshTxs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const deleteTx = async (id?: string) => {
    const targetId = id ?? editingTxId;
    if (!targetId) return;
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    try {
      await TransaccionService.eliminar(targetId, { accessToken });
      setTxForm(emptyTx);
      setEditingTxId(null);
      setShowTxModal(false);
      await Promise.all([refreshCuentas(), refreshTxs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const validateCategoria = () => {
    if (!categoriaForm.nombre.trim()) return "Nombre obligatorio";
    if (!categoriaForm.tipo) return "Tipo obligatorio";
    return null;
  };

  const createCategoria = async () => {
    const validation = validateCategoria();
    if (validation) return setError(validation);
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(categoriaForm),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "No se pudo crear la categoria");
      }
      setCategoriaForm(emptyCategoria);
      setShowCatModal(false);
      await refreshCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const ingresos = txs
      .filter((tx) => tx.direccion === "ENTRADA")
      .reduce((acc, tx) => acc + Number(tx.monto), 0);
    const egresos = txs
      .filter((tx) => tx.direccion === "SALIDA")
      .reduce((acc, tx) => acc + Number(tx.monto), 0);
    const neto = ingresos - egresos;
    return { ingresos, egresos, neto };
  }, [txs]);

  const totalSaldo = useMemo(
    () => cuentas.reduce((acc, c) => acc + Number(c.saldo || 0), 0),
    [cuentas]
  );
  const flowByMonth = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    txs.forEach((tx) => {
      const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7);
      const current = map.get(key) ?? { ingresos: 0, egresos: 0 };
      if (tx.direccion === "ENTRADA") current.ingresos += Number(tx.monto);
      else current.egresos += Number(tx.monto);
      map.set(key, current);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4);
  }, [txs]);

  const saldoPorTipoCuenta = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number }>();
    cuentas.forEach((c) => {
      const key = c.tipoCuenta?.codigo ?? c.tipoCuentaId;
      const label = c.tipoCuenta?.nombre ?? c.tipoCuentaId;
      const current = map.get(key) ?? { nombre: label, total: 0 };
      current.total += Number(c.saldo ?? 0);
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cuentas]);

  const gastosPorCategoria = useMemo(() => {
    const map = new Map<
      string,
      { nombre: string; total: number; color?: string | null }
    >();
    txs
      .filter((tx) => tx.direccion === "SALIDA" && tx.categoria)
      .forEach((tx) => {
        const key = tx.categoria!.id;
        const current = map.get(key) ?? {
          nombre: tx.categoria!.nombre,
          total: 0,
          color: tx.categoria!.color
        };
        current.total += Number(tx.monto);
        map.set(key, current);
      });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [txs]);

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          Cargando sesion...
        </p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          Redirigiendo al login...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 text-slate-900 dark:text-zinc-50">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">
              Fintu Dashboard
            </p>
            <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">
              Finanzas personales
            </h1>
            <p className="text-sm text-slate-800 dark:text-zinc-300">
              Gestiona cuentas, transacciones, categorias y autenticacion con
              Supabase.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loadingData && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Actualizando datos...
              </span>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-950 dark:text-zinc-300">
                {session?.user.email ?? "Usuario"}
              </span>
              <button
                onClick={signOut}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Salir
              </button>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-100 px-4 py-3 text-sm text-amber-900 shadow dark:bg-amber-500/10 dark:text-amber-100">
            {errorMessage}{" "}
            <button className="underline" onClick={() => setError(null)}>
              cerrar
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Cuentas
              </h2>
              <span className="text-sm text-slate-500 dark:text-zinc-400">
                Total: {formatMoney(totalSaldo, cuentas[0]?.moneda ?? "")}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {loadingData && cuentas.length === 0 ? (
                <Loading message="Cargando tu información financiera..." />
              ) : (
                cuentas.map((c) => (
                  <a
                    key={c.id}
                    href={`/cuentas/${c.id}`}
                    className="rounded-xl border border-slate-500/80 bg-white p-4 shadow-md transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-black/30 dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {c.nombre}
                        </p>
                        <p className="text-sm text-zinc-400">
                          {c.tipoCuenta?.nombre ?? c.tipoCuentaId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-emerald-300">
                          {formatMoney(Number(c.saldo ?? 0), c.moneda)}
                        </p>
                        {c.tasaApr && (
                          <p className="text-xs text-zinc-400">
                            {c.tasaApr}% APR
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                ))
              )}
              {cuentas.length === 0 && (
                <p className="text-sm text-zinc-400">Crea tu primera cuenta.</p>
              )}
            </div>
            <div className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
              Selecciona una cuenta para ver detalle y transacciones en la
              seccion de Cuentas.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Categorias
              </h2>
              <span className="text-sm text-slate-500 dark:text-zinc-400">
                {categorias.length} definidas
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {loadingData && categorias.length === 0 ? (
                <Loading message="Cargando tu información financiera..." />
              ) : (
                categorias.map((cat) => (
                  <span
                    key={cat.id}
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: cat.color ?? "rgba(255,255,255,0.08)",
                      color: "#0a0a0a"
                    }}
                  >
                    {cat.nombre} / {cat.tipo}
                  </span>
                ))
              )}
              {categorias.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Crea tu primera categoria.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowCatModal(true)}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 dark:text-white"
            >
              Nueva categoria
            </button>
          </div>

          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Resumen
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {loadingData && saldoPorTipoCuenta.length === 0 ? (
                <Loading message="Cargando tu información financiera..." />
              ) : (
                <>
                  <StatCard
                    label="Ingresos"
                    value={totals.ingresos}
                    color="text-emerald-300"
                  />
                  <StatCard
                    label="Egresos"
                    value={totals.egresos}
                    color="text-rose-300"
                  />
                  <StatCard
                    label="Neto"
                    value={totals.neto}
                    color="text-sky-300"
                  />
                </>
              )}
            </div>
            <button
              onClick={() => {
                setEditingTxId(null);
                setTxForm({ ...emptyTx, ocurrioEn: nowLocal });
                setShowTxModal(true);
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 dark:text-white"
            >
              Nueva transaccion
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border-slate-500/80 border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Flujo ultimos meses
              </h2>
              <span className="text-xs text-zinc-400">Ingresos vs egresos</span>
            </div>
            {loadingData && saldoPorTipoCuenta.length === 0 ? (
              <Loading message="Cargando tu información financiera..." />
            ) : (
              <>
                <div className="mt-4">
                  <FlowChart data={flowByMonth} />
                </div>
                </>
            )}
          </div>
          <div className="rounded-2xl border border-slate-500/80 bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Gasto por categoria
              </h2>
              <span className="text-xs text-zinc-400">Top 4</span>
            </div>

            <div className="mt-4 space-y-3">
              {loadingData && gastosPorCategoria.length === 0 ? (
                <Loading message="Cargando tu información financiera..." />
              ) : gastosPorCategoria.length === 0 ? (
                <p className="text-sm text-zinc-400">Aun no hay gastos.</p>
              ) : (
                gastosPorCategoria.map((cat) => (
                  <CategoryBar
                    key={cat.nombre}
                    label={cat.nombre}
                    value={cat.total}
                    maxValue={gastosPorCategoria[0]?.total ?? 1}
                    color={cat.color ?? "#0ea5e9"}
                  />
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Saldo por tipo
              </h2>
              <span className="text-xs text-zinc-400">
                {saldoPorTipoCuenta.length} tipos
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {loadingData && saldoPorTipoCuenta.length === 0 ? (
                <Loading message="Cargando tu información financiera..." />
              ) : (
                saldoPorTipoCuenta.length === 0 && (
                  <p className="text-sm text-zinc-400">
                    No hay cuentas creadas.
                  </p>
                )
              )}
              {saldoPorTipoCuenta.map((item) => (
                <DonutRow
                  key={item.nombre}
                  label={item.nombre}
                  value={item.total}
                  total={totalSaldo || 1}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Transacciones
              </h2>
              <p className="text-sm text-zinc-400">Ultimas 50</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {loadingData && txs.length === 0 ? (
              <Loading message="Cargando tu información financiera..." />
            ) : (
              txs.map((tx) => (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  onEdit={(selected) => {
                    setEditingTxId(selected.id);
                    setTxForm({
                      cuentaId: selected.cuentaId,
                      monto: Number(selected.monto),
                      direccion: selected.direccion,
                      descripcion: selected.descripcion ?? "",
                      categoriaId: selected.categoria?.id ?? undefined,
                      ocurrioEn: new Date(selected.ocurrioEn)
                        .toISOString()
                        .slice(0, 16)
                    });
                    setShowTxModal(true);
                  }}
                  onDelete={deleteTx}
                />
              ))
            )}
            {loadingData && txs.length === 0 ? (
              <Loading message="Cargando tu información financiera..." />
            ) : (
              txs.length === 0 && (
                <p className="text-sm dark:text-zinc-400">
                  Aun no hay transacciones.
                </p>
              )
            )}
          </div>
        </section>
      </div>
      <Modal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        title="Nueva categoria"
      >
        <div className="grid grid-cols-1 gap-3">
          <InputField
            label="Nombre"
            value={categoriaForm.nombre}
            onChange={(v) => setCategoriaForm((f) => ({ ...f, nombre: v }))}
          />
          <SelectField
            label="Tipo"
            value={categoriaForm.tipo}
            onChange={(v) =>
              setCategoriaForm((f) => ({
                ...f,
                tipo: v as CategoriaForm["tipo"]
              }))
            }
            options={[
              { label: "Ingreso", value: "INGRESO" },
              { label: "Gasto", value: "GASTO" },
              { label: "Transferencia", value: "TRANSFERENCIA" }
            ]}
          />
          <InputField
            label="Color HEX (opcional)"
            value={categoriaForm.color ?? ""}
            onChange={(v) =>
              setCategoriaForm((f) => ({ ...f, color: v || undefined }))
            }
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCatModal(false)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              onClick={createCategoria}
              disabled={busy}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 dark:text-white"
            >
              {busy ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showTxModal}
        onClose={() => {
          setShowTxModal(false);
          setEditingTxId(null);
        }}
        title={editingTxId ? "Editar transaccion" : "Nueva transaccion"}
      >
        <TransactionForm
          form={txForm}
          cuentas={cuentas}
          categorias={categorias}
          nowLocal={nowLocal}
          busy={busy}
          isEditing={Boolean(editingTxId)}
          onChange={(partial) => setTxForm((prev) => ({ ...prev, ...partial }))}
          onSubmit={saveTx}
          onDelete={editingTxId ? deleteTx : undefined}
          onCancel={() => {
            setShowTxModal(false);
            setEditingTxId(null);
            setTxForm(emptyTx);
          }}
        />
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-black/30">
      <p className="text-sm text-black dark:text-zinc-400">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{formatMoney(value)}</p>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center  px-4 dark:bg-black/80 bg-white/70">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 dark:bg-zinc-950 p-6 shadow-2xl bg-white">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full border dark:border-white/90 border-black/90  px-3 py-1 text-xs font-semibold dark:text-white hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FlowChart({
  data
}: {
  data: [string, { ingresos: number; egresos: number }][];
}) {
  if (!data.length) {
    return <p className="text-sm text-zinc-400">Sin datos recientes.</p>;
  }
  return (
    <div className="grid gap-3">
      {data.map(([label, values]) => {
        const total = values.ingresos + values.egresos || 1;
        const inPct = Math.min(
          100,
          Math.max(0, (values.ingresos / total) * 100)
        );
        return (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{label}</span>
              <span>
                <span className="text-emerald-300">
                  {formatMoney(values.ingresos)}
                </span>{" "}
                <span className="text-zinc-500">/</span>{" "}
                <span className="text-rose-300">
                  {formatMoney(values.egresos)}
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-black/40">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-sky-400"
                style={{ width: `${inPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBar({
  label,
  value,
  maxValue,
  color
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const width = Math.min(
    100,
    Math.max(8, (value / Math.max(maxValue, 1)) * 100)
  );
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-900 dark:text-white">{label}</span>
        <span className="text-slate-600 dark:text-zinc-400">
          {formatMoney(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

function DonutRow({
  label,
  value,
  total
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / total) * 100));
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 p-3">
      <div className="relative h-12 w-12">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(#38bdf8 ${pct}%, rgba(255,255,255,0.08) ${pct}% 100%)`
          }}
        />
        <div className="absolute inset-2 rounded-full bg-zinc-950" />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
          {Math.round(pct)}%
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {label}
        </p>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          {formatMoney(value)}
        </p>
      </div>
    </div>
  );
}
