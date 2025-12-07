"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { useAppData } from "@/components/AppDataProvider";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import type { TxForm, Transaccion } from "@/components/transactions/types";
import { TransaccionService } from "@/lib/services/TransaccionService";

const createEmptyTx = (now: string, cuentaId: string): TxForm => ({
  cuentaId,
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  categoriaId: undefined,
  ocurrioEn: now
});

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
  const cuenta = useMemo(
    () => cuentas.find((c) => c.id === cuentaId),
    [cuentas, cuentaId]
  );

  const filteredTxs = useMemo(
    () => transacciones.filter((tx) => tx.cuentaId === cuentaId),
    [transacciones, cuentaId]
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

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>(() =>
    createEmptyTx(nowLocal, cuentaId)
  );
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
      categoriaId: tx.categoria?.id ?? undefined,
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16)
    });
    setTxError(null);
    setTxModalOpen(true);
  };

  const saveTx = async () => {
    if (!accessToken) return setTxError("No hay sesión activa");
    setTxBusy(true);
    try {
      if (editingTxId) {
        await TransaccionService.actualizar(editingTxId, txForm, {
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
    const target = id ?? editingTxId;
    if (!target) return;
    if (!accessToken) return setTxError("No hay sesión activa");
    if (!confirm("¿Eliminar esta transacción?")) return;
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

  // 1) Mientras la sesión carga
  if (loadingSession) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow dark:border-white/10 dark:bg-black/40 dark:text-zinc-100">
          <p className="text-lg font-semibold">Cargando sesión...</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Validando acceso y cargando datos.
          </p>
        </div>
      </div>
    );
  }

  // 2) Ya terminó de cargar sesión y NO hay cuenta
  if (!cuenta && !loadingSession) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow dark:border-white/10 dark:bg-black/40 dark:text-zinc-100">
          <p className="text-lg font-semibold"> Cuenta no encontrada</p>
          <button
            onClick={() => router.push("/cuentas")}
            className="mt-3 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">
              Cuenta
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
              {cuenta?.nombre ?? "Cuenta"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Saldo:{" "}
              {formatMoney(Number(cuenta?.saldo ?? 0), cuenta?.moneda ?? "COP")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/cuentas")}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            >
              Volver
            </button>
            <button
              onClick={startCreate}
              disabled={!accessToken || loadingData}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400 disabled:opacity-50"
            >
              Nueva transacción
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="Ingresos"
            value={formatMoney(txSummary.ingresos, cuenta?.moneda ?? "COP")}
            tone="emerald"
          />
          <StatCard
            label="Egresos"
            value={formatMoney(txSummary.egresos, cuenta?.moneda ?? "COP")}
            tone="rose"
          />
          <StatCard
            label="Neto"
            value={formatMoney(txSummary.neto, cuenta?.moneda ?? "COP")}
            tone={txSummary.neto >= 0 ? "emerald" : "rose"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Flujo 6 meses
            </p>
            <div className="mt-3 space-y-2">
              {flowByMonth.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Sin transacciones aun.
                </p>
              )}
              {flowByMonth.map(([month, data]) => {
                const total = data.ingresos + data.egresos || 1;
                const ingresoPct = Math.min(100, (data.ingresos / total) * 100);
                const egresoPct = Math.min(100, (data.egresos / total) * 100);
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
                          cuenta?.moneda ?? "COP"
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
                        + {formatMoney(data.ingresos, cuenta?.moneda ?? "COP")}
                      </span>
                      <span>
                        - {formatMoney(data.egresos, cuenta?.moneda ?? "COP")}
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
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredTxs.map((tx) => (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  onEdit={startEdit}
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
      </div>

      {txModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
                  {editingTxId ? "Editar transaccion" : "Registrar transaccion"}
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Movimiento en {cuenta?.nombre ?? "cuenta"}
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
    </div>
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
