"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { TarjetaService } from "@/lib/services/TarjetaService";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import type { TarjetaMovimientoUI } from "@/components/transactions/types";
import { useAppData } from "@/components/AppDataProvider";

type TarjetaDetalle = {
  id: string;
  nombre: string;
  emisor?: string | null;
  moneda: string;
  cupoTotal: number;
  saldoActual: number;
  tasaEfectivaAnual: number;
  diaCorte: number;
  diaPago: number;
  pagoMinimoPct?: number | null;
  estado?: string;
  cuentaId: string;
};

export default function TarjetaDetallePage() {
  const params = useParams<{ id: string }>();
  const tarjetaId = params?.id ?? "";
  const { session } = useAppData();
  const [tarjeta, setTarjeta] = useState<TarjetaDetalle | null>(null);
  const [movimientos, setMovimientos] = useState<TarjetaMovimientoUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [movBusy, setMovBusy] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);
  const [movForm, setMovForm] = useState({
    tipo: "COMPRA",
    monto: 0,
    descripcion: "",
    ocurrioEn: new Date().toISOString().slice(0, 16),
    enCuotas: false,
    cuotasTotales: 1,
    cuotaId: ""
  });
  const [editModal, setEditModal] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    emisor: "",
    cupoTotal: 0,
    saldoActual: 0,
    tasaEfectivaAnual: 0,
    diaCorte: 1,
    diaPago: 10,
    pagoMinimoPct: 0
  });

  const accessToken = session?.access_token;

  const loadData = async () => {
    if (!accessToken || !tarjetaId) return;
    setLoading(true);
    setError(null);
    try {
      const tarjetas = await TarjetaService.listar({ accessToken });
      const found = tarjetas.find((t: TarjetaDetalle) => t.id === tarjetaId);
      setTarjeta(found ?? null);
      const movRes = await fetch(
        `/api/tarjetas/movimientos?tarjetaId=${tarjetaId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          credentials: "include"
        }
      );
      if (movRes.ok) {
        setMovimientos(await movRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) void loadData();
  }, [accessToken, tarjetaId]);

  const utilizado = useMemo(
    () => Number(tarjeta?.saldoActual ?? 0),
    [tarjeta?.saldoActual]
  );
  const disponible = useMemo(
    () => Number(tarjeta?.cupoTotal ?? 0) - utilizado,
    [tarjeta?.cupoTotal, utilizado]
  );
  const pagoMinimoSugerido = useMemo(() => {
    const pct = Number(tarjeta?.pagoMinimoPct ?? 0);
    if (!pct || pct <= 0) return 0;
    return (utilizado * pct) / 100;
  }, [tarjeta?.pagoMinimoPct, utilizado]);

  useEffect(() => {
    if (!tarjeta) return;
    setEditForm({
      nombre: tarjeta.nombre,
      emisor: tarjeta.emisor ?? "",
      cupoTotal: Number(tarjeta.cupoTotal ?? 0),
      saldoActual: Number(tarjeta.saldoActual ?? 0),
      tasaEfectivaAnual: Number(tarjeta.tasaEfectivaAnual ?? 0),
      diaCorte: tarjeta.diaCorte,
      diaPago: tarjeta.diaPago,
      pagoMinimoPct: Number(tarjeta.pagoMinimoPct ?? 0)
    });
  }, [tarjeta]);

  if (!loading && !tarjeta) {
    return (
      <div className="px-6 py-10 text-slate-900 dark:text-zinc-50">
        Tarjeta no encontrada
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">
              Tarjeta
            </p>
            <h1 className="text-3xl font-semibold">
              {tarjeta?.nombre ?? "Tarjeta"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Emisor: {tarjeta?.emisor ?? "-"} · Corte: {tarjeta?.diaCorte} ·
              Pago: {tarjeta?.diaPago}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>Saldo: {formatMoney(utilizado, tarjeta?.moneda ?? "COP")}</p>
            <p className="text-slate-500">
              Disponible: {formatMoney(disponible, tarjeta?.moneda ?? "COP")}
            </p>
            {pagoMinimoSugerido > 0 && (
              <p className="text-xs text-amber-500">
                Pago mínimo:{" "}
                {formatMoney(pagoMinimoSugerido, tarjeta?.moneda ?? "COP")}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30">
          <h3 className="text-lg font-semibold">Movimientos</h3>
          <div className="mt-3 space-y-2">
            {movimientos.map((m: TarjetaMovimientoUI) => (
              <TransactionListItem
                key={m.id}
                tx={
                  {
                    id: m.id,
                    cuentaId: tarjeta?.cuentaId ?? "",
                    usuarioId: session?.user?.id ?? "",
                    monto: m.monto,
                    moneda: tarjeta?.moneda ?? "COP",
                    descripcion: m.descripcion ?? null,
                    ocurrioEn: m.ocurrioEn,
                    direccion:
                      m.transaccion?.direccion ??
                      (m.tipo === "PAGO" || m.tipo === "CUOTA"
                        ? "ENTRADA"
                        : "SALIDA"),
                    categoria: null,
                    tipoTransaccionId: null,
                    tipoTransaccion: null,
                    cuenta: {
                      nombre: tarjeta?.nombre ?? "Tarjeta",
                      moneda: tarjeta?.moneda ?? "COP"
                    }
                  } as any
                }
                onEdit={() => {}}
              />
            ))}

            {movimientos.length === 0 && !loading && (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Sin movimientos todavía.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="self-start rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400"
        >
          Registrar movimiento
        </button>
        <button
          onClick={() => setEditModal(true)}
          className="self-start rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
        >
          Editar tarjeta
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Nuevo movimiento
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            {movError && (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                {movError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Tipo</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.tipo}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, tipo: e.target.value }))
                  }
                >
                  <option value="COMPRA">Compra</option>
                  <option value="PAGO">Pago</option>
                  <option value="INTERES">Interés</option>
                  <option value="CUOTA">Pago de cuota</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Monto</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.monto}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, monto: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Descripción</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.descripcion}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, descripcion: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Fecha</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.ocurrioEn}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, ocurrioEn: e.target.value }))
                  }
                />
              </label>
              {movForm.tipo === "COMPRA" && (
                <div className="md:col-span-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600 dark:border-white/20 dark:text-zinc-300">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={movForm.enCuotas}
                      onChange={(e) =>
                        setMovForm((f) => ({
                          ...f,
                          enCuotas: e.target.checked
                        }))
                      }
                    />
                    Comprar en cuotas
                  </label>
                  {movForm.enCuotas && (
                    <div className="mt-2">
                      <input
                        type="number"
                        min={2}
                        className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                        value={movForm.cuotasTotales}
                        onChange={(e) =>
                          setMovForm((f) => ({
                            ...f,
                            cuotasTotales: Math.max(2, Number(e.target.value))
                          }))
                        }
                      />
                      <span className="ml-2 text-xs text-slate-500">
                        Cuotas
                      </span>
                    </div>
                  )}
                </div>
              )}
              {movForm.tipo === "CUOTA" && (
                <label className="md:col-span-2 space-y-1">
                  <span className="text-xs text-slate-500">
                    ID de cuota (opcional)
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                    value={movForm.cuotaId}
                    onChange={(e) =>
                      setMovForm((f) => ({ ...f, cuotaId: e.target.value }))
                    }
                    placeholder="TarjetaCuota a la que abonas"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!accessToken) return setMovError("No hay sesión");
                  if (!tarjetaId) return setMovError("Tarjeta no encontrada");
                  if (!movForm.monto || movForm.monto <= 0)
                    return setMovError("Monto > 0 requerido");
                  setMovBusy(true);
                  setMovError(null);
                  try {
                    await TarjetaService.registrarMovimiento(
                      {
                        tarjetaId,
                        tipo: movForm.tipo as any,
                        monto: movForm.monto,
                        descripcion: movForm.descripcion,
                        ocurrioEn: movForm.ocurrioEn
                          ? new Date(movForm.ocurrioEn).toISOString()
                          : undefined,
                        enCuotas: movForm.enCuotas,
                        cuotasTotales: movForm.enCuotas
                          ? movForm.cuotasTotales
                          : undefined,
                        cuotaId:
                          movForm.tipo === "CUOTA"
                            ? movForm.cuotaId || undefined
                            : undefined
                      },
                      { accessToken }
                    );
                    setShowModal(false);
                    await loadData();
                  } catch (err) {
                    setMovError(
                      err instanceof Error ? err.message : "Error desconocido"
                    );
                  } finally {
                    setMovBusy(false);
                  }
                }}
                disabled={movBusy}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
              >
                {movBusy ? "Guardando..." : "Guardar movimiento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Editar tarjeta
              </h3>
              <button
                onClick={() => setEditModal(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
            {editError && (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Nombre</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.nombre}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Emisor</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.emisor}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, emisor: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Cupo total</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.cupoTotal}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      cupoTotal: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Saldo actual</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.saldoActual}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      saldoActual: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">TEA (%)</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.tasaEfectivaAnual}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      tasaEfectivaAnual: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Pago mínimo (%)</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.pagoMinimoPct}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      pagoMinimoPct: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Día de corte</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.diaCorte}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      diaCorte: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Día de pago</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.diaPago}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      diaPago: Number(e.target.value)
                    }))
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setEditModal(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!accessToken) return setEditError("No hay sesión");
                  setEditBusy(true);
                  setEditError(null);
                  try {
                    await TarjetaService.actualizar(tarjetaId, editForm, {
                      accessToken
                    });
                    setEditModal(false);
                    await loadData();
                  } catch (err) {
                    setEditError(
                      err instanceof Error ? err.message : "Error desconocido"
                    );
                  } finally {
                    setEditBusy(false);
                  }
                }}
                disabled={editBusy}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
              >
                {editBusy ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
