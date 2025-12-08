"use client";
import { Suspense } from "react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { InputField, NumberField, SelectField } from "@/components/ui/Fields";
import { useAppData } from "@/components/AppDataProvider";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import type {
  Cuenta,
  Transaccion,
  TxForm
} from "@/components/transactions/types";
import { CuentasService } from "@/lib/services/CuentasService";
import { TransaccionService } from "@/lib/services/TransaccionService";

type ExtendedCuenta = Cuenta & { institucion?: string | null };

type TipoCuenta = { id: string; codigo: string; nombre: string };

type CuentaForm = {
  nombre: string;
  tipoCuentaId: string;
  moneda: string;
  saldo: number;
  institucion?: string | null;
  limiteCredito?: number | null;
  tasaApr?: number | null;
  diaCorte?: number | null;
  diaPago?: number | null;
  plazoMeses?: number | null;
};

const emptyForm: CuentaForm = {
  nombre: "",
  tipoCuentaId: "",
  moneda: "COP",
  saldo: 0,
  institucion: ""
};

const currencyOptions = [
  { label: "Peso colombiano (COP)", value: "COP" },
  { label: "Dólar (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
  { label: "Libra esterlina (GBP)", value: "GBP" },
  { label: "Peso mexicano (MXN)", value: "MXN" }
];
function CuentasContent() {
  const searchParams = useSearchParams();
  const {
    session,
    loadingSession,
    cuentas,
    transacciones,
    categorias,
    refresh
  } = useAppData();
  const accessToken = session?.access_token;
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);
  const cuentaIdParam = searchParams?.get("cuentaId") ?? "";
  const cuentaSeleccionada = useMemo(
    () => cuentas.find((c) => c.id === cuentaIdParam),
    [cuentaIdParam, cuentas]
  );

  const [tipos, setTipos] = useState<TipoCuenta[]>([]);
  const [form, setForm] = useState<CuentaForm>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saldoObjetivo, setSaldoObjetivo] = useState<string>("");
  const [ajusteNota, setAjusteNota] = useState<string>("");
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>({
    cuentaId: cuentaIdParam || "",
    monto: 0,
    direccion: "SALIDA",
    descripcion: "",
    categoriaId: undefined,
    ocurrioEn: nowLocal
  });
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

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

  const loadTipos = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch("/api/tipos-cuenta", authHeaders);
    if (res.ok) setTipos(await res.json());
  }, [accessToken, authHeaders]);

  useEffect(() => {
    if (!accessToken) return;
    void loadTipos();
  }, [accessToken, loadTipos]);

  const tipoNormalId = useMemo(
    () =>
      tipos.find(
        (t) =>
          t.codigo?.toUpperCase?.() === "NORMAL" ||
          t.codigo?.toUpperCase?.() === "CUENTA_NORMAL"
      )?.id,
    [tipos]
  );

  useEffect(() => {
    if (tipoNormalId && !editingId) {
      setForm((f) => ({ ...f, tipoCuentaId: tipoNormalId }));
    }
  }, [tipoNormalId, editingId]);

  useEffect(() => {
    if (!cuentaIdParam) return;
    setTxForm((f) => ({ ...f, cuentaId: cuentaIdParam }));
  }, [cuentaIdParam]);

  const ajusteCalculado = useMemo(() => {
    if (!editingId) return 0;
    if (saldoObjetivo === "") return 0;
    const deseado = Number(saldoObjetivo);
    if (Number.isNaN(deseado)) return 0;
    return deseado - Number(form.saldo ?? 0);
  }, [editingId, saldoObjetivo, form.saldo]);

  const validate = () => {
    if (!form.nombre.trim()) return "Nombre obligatorio";
    if (!form.tipoCuentaId) return "Cuenta normal requerida";
    if (!form.moneda.trim() || form.moneda.length > 5) return "Moneda invalida";
    if (form.limiteCredito !== undefined && (form.limiteCredito ?? 0) < 0)
      return "Limite no puede ser negativo";
    return null;
  };

  const saveCuenta = async () => {
    const validation = validate();
    if (validation) return setError(validation);
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    setError(null);
    try {
      const { saldo, ...rest } = form;
      const payload: Record<string, unknown> = {
        ...rest,
        tipoCuentaId: tipoNormalId || form.tipoCuentaId,
        nombre: form.nombre.trim(),
        institucion: form.institucion?.trim() || null
      };
      if (editingId && saldoObjetivo !== "") {
        const deseado = Number(saldoObjetivo);
        if (!Number.isNaN(deseado)) {
          const delta = deseado - Number(saldo ?? 0);
          if (delta !== 0) {
            payload.ajusteSaldo = delta;
            if (ajusteNota.trim())
              payload.ajusteDescripcion = ajusteNota.trim();
          }
        }
      }

      if (editingId) {
        await CuentasService.actualizar(editingId, payload, { accessToken });
      } else {
        await CuentasService.crear(payload, { accessToken });
      }
      resetForm();
      setShowModal(false);
      await refresh({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (cta: ExtendedCuenta) => {
    setEditingId(cta.id);
    setForm({
      nombre: cta.nombre,
      tipoCuentaId: tipoNormalId || cta.tipoCuentaId,
      moneda: cta.moneda,
      saldo: Number(cta.saldo ?? 0),
      institucion: cta.institucion ?? "",
      limiteCredito: cta.limiteCredito ? Number(cta.limiteCredito) : null,
      tasaApr: cta.tasaApr ? Number(cta.tasaApr) : null,
      diaCorte: cta.diaCorte ?? null,
      diaPago: cta.diaPago ?? null,
      plazoMeses: cta.plazoMeses ?? null
    });
    setSaldoObjetivo(
      cta.saldo !== undefined && cta.saldo !== null
        ? String(Number(cta.saldo ?? 0))
        : ""
    );
    setAjusteNota("");
    setShowModal(true);
  };

  const deleteCuenta = async (id: string) => {
    if (!accessToken) return setError("No hay sesion activa");
    if (!confirm("¿Eliminar esta cuenta?")) return;
    setBusy(true);
    setError(null);
    try {
      await CuentasService.eliminar(id, { accessToken });
      await refresh({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setSaldoObjetivo("");
    setAjusteNota("");
  };

  const filteredTxs = useMemo(
    () => transacciones.filter((tx) => tx.cuentaId === cuentaIdParam),
    [transacciones, cuentaIdParam]
  );

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

  const startTxEdit = (tx: Transaccion) => {
    setEditingTxId(tx.id);
    setTxForm({
      cuentaId: tx.cuentaId,
      monto: Number(tx.monto ?? 0),
      direccion: tx.direccion,
      descripcion: tx.descripcion ?? "",
      categoriaId: tx.categoria?.id ?? undefined,
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16)
    });
    setTxError(null);
    setTxModalOpen(true);
  };

  const startTxCreate = () => {
    setEditingTxId(null);
    setTxForm({
      cuentaId: cuentaIdParam || "",
      monto: 0,
      direccion: "SALIDA",
      descripcion: "",
      categoriaId: undefined,
      ocurrioEn: nowLocal
    });
    setTxError(null);
    setTxModalOpen(true);
  };

  const validateTx = (data: TxForm) => {
    if (!data.cuentaId) return "Selecciona la cuenta";
    if (!data.monto || Number(data.monto) <= 0)
      return "Monto debe ser mayor a 0";
    return null;
  };

  const saveTx = async () => {
    const validation = validateTx(txForm);
    if (validation) {
      setTxError(validation);
      return;
    }
    if (!accessToken) return setTxError("No hay sesion activa");
    setTxBusy(true);
    setTxError(null);
    try {
      const isEditing = Boolean(editingTxId);
      if (isEditing) {
        await TransaccionService.actualizar(editingTxId!, txForm, {
          accessToken
        });
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
    const targetId = id ?? editingTxId;
    if (!targetId) return;
    if (!accessToken) return setTxError("No hay sesion activa");
    if (!confirm("隅Eliminar esta transaccion?")) return;
    setTxBusy(true);
    setTxError(null);
    try {
      await TransaccionService.eliminar(targetId, { accessToken });
      setTxModalOpen(false);
      setEditingTxId(null);
      await refresh({ force: true });
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setTxBusy(false);
    }
  };

  return (
    <Suspense>
      <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-500">
                Cuentas
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                Gestiona tus cuentas
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Crea, edita o elimina cuentas, tarjetas y préstamos.
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400"
            >
              + Nueva cuenta
            </button>
          </header>

          {error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              {error}{" "}
              <button className="underline" onClick={() => setError(null)}>
                cerrar
              </button>
            </div>
          )}

          {loadingSession && (
            <p className="text-sm text-slate-500">Cargando sesion...</p>
          )}

          {cuentaSeleccionada && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-black/30">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-500">
                    Detalle
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {cuentaSeleccionada.nombre}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    Saldo actual:{" "}
                    {formatMoney(
                      Number(cuentaSeleccionada.saldo ?? 0),
                      cuentaSeleccionada.moneda
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={startTxCreate}
                    className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400"
                  >
                    Registrar transacción
                  </button>
                  <button
                    onClick={() => startEdit(cuentaSeleccionada)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                  >
                    Editar cuenta
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatCard
                  label="Ingresos"
                  value={formatMoney(
                    txSummary.ingresos,
                    cuentaSeleccionada.moneda
                  )}
                  tone="emerald"
                />
                <StatCard
                  label="Egresos"
                  value={formatMoney(
                    txSummary.egresos,
                    cuentaSeleccionada.moneda
                  )}
                  tone="rose"
                />
                <StatCard
                  label="Neto"
                  value={formatMoney(txSummary.neto, cuentaSeleccionada.moneda)}
                  tone={txSummary.neto >= 0 ? "emerald" : "rose"}
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Flujo 6 meses
                  </p>
                  <div className="mt-3 space-y-2">
                    {flowByMonth.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Sin transacciones aún.
                      </p>
                    )}
                    {flowByMonth.map(([month, data]) => {
                      const total = data.ingresos + data.egresos || 1;
                      const ingresoPct = Math.min(
                        100,
                        (data.ingresos / total) * 100
                      );
                      const egresoPct = Math.min(
                        100,
                        (data.egresos / total) * 100
                      );
                      return (
                        <div
                          key={month}
                          className="space-y-1 rounded-lg bg-slate-100/60 p-2 dark:bg-white/5"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                            <span>{month}</span>
                            <span>
                              {formatMoney(
                                data.ingresos - data.egresos,
                                cuentaSeleccionada.moneda
                              )}
                            </span>
                          </div>
                          <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${ingresoPct}%` }}
                            />
                            <div
                              className="h-full bg-rose-400"
                              style={{ width: `${egresoPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>
                              +{" "}
                              {formatMoney(
                                data.ingresos,
                                cuentaSeleccionada.moneda
                              )}
                            </span>
                            <span>
                              -{" "}
                              {formatMoney(
                                data.egresos,
                                cuentaSeleccionada.moneda
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Transacciones
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {filteredTxs.length} movimientos asociados a esta cuenta.
                  </p>
                  <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredTxs.map((tx) => (
                      <TransactionListItem
                        key={tx.id}
                        tx={tx}
                        onEdit={startTxEdit}
                        onDelete={deleteTx}
                      />
                    ))}
                    {filteredTxs.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Aun no hay movimientos.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!loadingSession && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {cuentas.map((cta) => (
                <a
                  key={cta.id}
                  href={`/cuentas/${cta.id}`}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-black/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {cta.nombre}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        {cta.tipoCuenta?.nombre ?? cta.tipoCuentaId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-emerald-500">
                        {formatMoney(Number(cta.saldo ?? 0), cta.moneda)}
                      </p>
                      {cta.tasaApr && (
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {cta.tasaApr}% APR
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-zinc-400">
                    {cta.limiteCredito ? (
                      <span>
                        Límite:{" "}
                        {formatMoney(Number(cta.limiteCredito), cta.moneda)}
                      </span>
                    ) : null}
                    {cta.plazoMeses ? (
                      <span>Plazo: {cta.plazoMeses}m</span>
                    ) : null}
                    {cta.diaCorte ? <span>Corte: {cta.diaCorte}</span> : null}
                    {cta.diaPago ? <span>Pago: {cta.diaPago}</span> : null}
                  </div>
                </a>
              ))}
              {cuentas.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  No tienes cuentas aún.
                </p>
              )}
            </div>
          )}
        </div>

        {txModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
                    {editingTxId
                      ? "Editar transacción"
                      : "Registrar transacción"}
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Movimiento en {cuentaSeleccionada?.nombre ?? "cuenta"}
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
                onChange={(partial) =>
                  setTxForm((prev) => ({ ...prev, ...partial }))
                }
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

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
                    {editingId ? "Edición" : "Creación"}
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {editingId ? "Editar cuenta" : "Nueva cuenta"}
                  </h3>
                </div>
                {editingId && (
                  <div className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-500">
                    En uso
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                >
                  Cerrar
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-700 shadow-inner dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-400">
                        Resumen
                      </p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {form.nombre || "Cuenta sin nombre"}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Cuenta normal · {form.moneda}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        Saldo actual
                      </p>
                      <p className="text-xl font-semibold text-emerald-400">
                        {formatMoney(Number(form.saldo || 0), form.moneda)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <InputField
                    label="Nombre"
                    value={form.nombre}
                    onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
                  />
                  <div className="text-sm text-slate-600 dark:text-zinc-300">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Tipo de cuenta
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Cuenta normal (predeterminada)
                    </p>
                  </div>
                  <InputField
                    label="Institución (opcional)"
                    value={form.institucion ?? ""}
                    onChange={(v) => setForm((f) => ({ ...f, institucion: v }))}
                  />
                  <SelectField
                    label="Moneda"
                    value={form.moneda}
                    onChange={(v) => setForm((f) => ({ ...f, moneda: v }))}
                    options={currencyOptions}
                    placeholder="Selecciona"
                  />
                </div>

                {editingId ? (
                  <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-sm shadow-inner dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                          Ajuste de saldo
                        </p>
                        <p className="text-base font-semibold text-slate-900 dark:text-white">
                          Actual:{" "}
                          {formatMoney(Number(form.saldo || 0), form.moneda)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 dark:text-zinc-400">
                        <p>Ajuste calculado</p>
                        <p
                          className={`text-sm font-semibold ${
                            ajusteCalculado > 0
                              ? "text-emerald-500"
                              : ajusteCalculado < 0
                              ? "text-rose-500"
                              : "text-slate-500 dark:text-zinc-400"
                          }`}
                        >
                          {ajusteCalculado === 0
                            ? "Sin ajuste"
                            : `${ajusteCalculado > 0 ? "+" : "-"}${formatMoney(
                                Math.abs(ajusteCalculado),
                                form.moneda
                              )}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <NumberField
                        label="Saldo deseado"
                        value={saldoObjetivo}
                        onChange={(v) => setSaldoObjetivo(v)}
                        isCurrency
                        currency={form.moneda}
                        allowNegative
                      />
                      <InputField
                        label="Nota de ajuste (opcional)"
                        value={ajusteNota}
                        onChange={(v) => setAjusteNota(v)}
                        placeholder="Ej. Ajuste manual por conciliación"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                      Al guardar se generará una transacción interna con el
                      ajuste indicado.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-white/20 dark:text-zinc-400">
                    El saldo se actualizará cuando registres transacciones o
                    ajustes posteriores.
                  </div>
                )}

                {renderCuentaFields()}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveCuenta}
                    disabled={busy}
                    className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    {busy
                      ? "Guardando..."
                      : editingId
                      ? "Actualizar"
                      : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Suspense>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose";
}) {
  const toneClasses =
    tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-rose-500/10 text-rose-500";
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold ${toneClasses}`}>{value}</p>
    </div>
  );
}

function renderCuentaFields() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-white/20 dark:text-zinc-400">
      El tipo de cuenta es siempre &quot;Cuenta normal&quot;; sin campos
      adicionales.
    </div>
  );
}


export default function CuentasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <p className="text-slate-500">Cargando...</p>
      </div>
    }>
      <CuentasContent />
    </Suspense>
  );
}