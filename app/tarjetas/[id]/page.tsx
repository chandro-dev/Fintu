"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { TarjetaService } from "@/lib/services/TarjetaService";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import type { TarjetaMovimientoUI } from "@/components/transactions/types";
import { useAppData } from "@/components/AppDataProvider";
import CreditSimulator from "@/components/tarjetas/CreditSimulator";

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

type MovimientoTipo = "COMPRA" | "PAGO" | "INTERES" | "CUOTA" | "AJUSTE";

const MOV_TIPO_LABEL: Record<MovimientoTipo, string> = {
  COMPRA: "Compra",
  PAGO: "Pago",
  INTERES: "Interes",
  CUOTA: "Pago de cuota",
  AJUSTE: "Ajuste",
};

export default function TarjetaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tarjetaId = params?.id ?? "";
  const { session } = useAppData();
  const [tarjeta, setTarjeta] = useState<TarjetaDetalle | null>(null);
  const [movimientos, setMovimientos] = useState<TarjetaMovimientoUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [movLoading, setMovLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [movBusy, setMovBusy] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);
  const [movForm, setMovForm] = useState({
    tipo: "COMPRA" as MovimientoTipo,
    monto: 0,
    descripcion: "",
    ocurrioEn: new Date().toISOString().slice(0, 16),
    enCuotas: false,
    cuotasTotales: 1,
    cuotaId: "",
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
    pagoMinimoPct: 0,
  });
  const [deleteBusy, setDeleteBusy] = useState(false);

  const accessToken = session?.access_token;

  const loadMovimientos = async () => {
    if (!accessToken || !tarjetaId) return;
    setMovLoading(true);
    setMovError(null);
    try {
      const movRes = await fetch(`/api/tarjetas/movimientos?tarjetaId=${tarjetaId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });
      if (movRes.ok) {
        setMovimientos(await movRes.json());
      } else {
        setMovError("No se pudieron cargar los movimientos");
      }
    } catch (err) {
      setMovError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setMovLoading(false);
    }
  };

  const loadTarjeta = async () => {
    if (!accessToken || !tarjetaId) return;
    setLoading(true);
    setError(null);
    try {
      const tarjetas = await TarjetaService.listar({ accessToken });
      const found = tarjetas.find((t: TarjetaDetalle) => t.id === tarjetaId);
      setTarjeta(found ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.all([loadTarjeta(), loadMovimientos()]);
  };

  useEffect(() => {
    if (accessToken) void loadData();
  }, [accessToken, tarjetaId]);

  const utilizado = useMemo(() => Number(tarjeta?.saldoActual ?? 0), [tarjeta?.saldoActual]);
  const disponible = useMemo(
    () => Math.max(Number(tarjeta?.cupoTotal ?? 0) - utilizado, 0),
    [tarjeta?.cupoTotal, utilizado],
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
      pagoMinimoPct: Number(tarjeta.pagoMinimoPct ?? 0),
    });
  }, [tarjeta]);

  const handleRegistrarMovimiento = async () => {
    if (!accessToken) return setMovError("No hay sesion");
    if (!tarjetaId) return setMovError("Tarjeta no encontrada");
    if (!movForm.monto || movForm.monto <= 0) return setMovError("Monto > 0 requerido");

    setMovBusy(true);
    setMovError(null);
    try {
      await TarjetaService.registrarMovimiento(
        {
          tarjetaId,
          tipo: movForm.tipo,
          monto: movForm.monto,
          descripcion: movForm.descripcion,
          ocurrioEn: movForm.ocurrioEn ? new Date(movForm.ocurrioEn).toISOString() : undefined,
          enCuotas: movForm.enCuotas,
          cuotasTotales: movForm.enCuotas ? movForm.cuotasTotales : undefined,
          cuotaId: movForm.tipo === "CUOTA" ? movForm.cuotaId || undefined : undefined,
        },
        { accessToken },
      );
      setShowModal(false);
      await loadData();
    } catch (err) {
      setMovError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setMovBusy(false);
    }
  };

  const handleUpdateTarjeta = async () => {
    if (!accessToken) return setEditError("No hay sesion");
    setEditBusy(true);
    setEditError(null);
    try {
      await TarjetaService.actualizar(tarjetaId, editForm, { accessToken });
      setEditModal(false);
      await loadData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEditBusy(false);
    }
  };

  const handleEliminarTarjeta = async () => {
    if (!accessToken) return;
    if (!window.confirm("Eliminar la tarjeta tambien elimina sus movimientos. Continuar?")) return;
    setDeleteBusy(true);
    try {
      await TarjetaService.eliminar(tarjetaId, { accessToken });
      router.push("/tarjetas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!loading && !tarjeta) {
    return (
      <div className="px-6 py-10 text-slate-900 dark:text-zinc-50">Tarjeta no encontrada</div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">Tarjeta</p>
            <h1 className="text-3xl font-semibold">{tarjeta?.nombre ?? "Tarjeta"}</h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Emisor: {tarjeta?.emisor ?? "-"} | Corte: {tarjeta?.diaCorte} | Pago: {tarjeta?.diaPago}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>Saldo: {formatMoney(utilizado, tarjeta?.moneda ?? "COP")}</p>
            <p className="text-slate-500">
              Disponible: {formatMoney(disponible, tarjeta?.moneda ?? "COP")}
            </p>
            {pagoMinimoSugerido > 0 && (
              <p className="text-xs text-amber-500">
                Pago minimo sugerido: {formatMoney(pagoMinimoSugerido, tarjeta?.moneda ?? "COP")}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30">
            <p className="text-xs text-slate-500">Cupo total</p>
            <p className="text-xl font-semibold">{formatMoney(Number(tarjeta?.cupoTotal ?? 0), tarjeta?.moneda ?? "COP")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30">
            <p className="text-xs text-slate-500">TEA</p>
            <p className="text-xl font-semibold">{tarjeta?.tasaEfectivaAnual ?? 0}%</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30">
            <p className="text-xs text-slate-500">Estado</p>
            <p className="text-xl font-semibold">{tarjeta?.estado ?? "Activa"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400"
          >
            Registrar movimiento
          </button>
          <button
            onClick={() => setEditModal(true)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
          >
            Editar tarjeta
          </button>
          <button
            onClick={handleEliminarTarjeta}
            disabled={deleteBusy}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/10"
          >
            {deleteBusy ? "Eliminando..." : "Eliminar"}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Movimientos</h3>
            {movLoading && <span className="text-xs text-slate-500">Actualizando...</span>}
          </div>
          {movError && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              {movError}
            </div>
          )}
          <div className="mt-3 space-y-2">
            {movimientos.map((m: TarjetaMovimientoUI) => (
              <TransactionListItem
                key={m.id}
                tx={{
                  id: m.id,
                  cuentaId: tarjeta?.cuentaId ?? "",
                  usuarioId: session?.user?.id ?? "",
                  monto: m.monto,
                  moneda: tarjeta?.moneda ?? "COP",
                  descripcion: m.descripcion ?? MOV_TIPO_LABEL[m.tipo],
                  ocurrioEn: m.ocurrioEn,
                  direccion:
                    m.transaccion?.direccion ??
                    (m.tipo === "PAGO" || m.tipo === "CUOTA" ? "ENTRADA" : "SALIDA"),
                  categoria: null,
                  tipoTransaccionId: null,
                  tipoTransaccion: null,
                  cuenta: {
                    nombre: tarjeta?.nombre ?? "Tarjeta",
                    moneda: tarjeta?.moneda ?? "COP",
                  },
                } as any}
                onEdit={() => {}}
              />
            ))}

            {movimientos.length === 0 && !loading && (
              <p className="text-sm text-slate-500 dark:text-zinc-400">Sin movimientos todavia.</p>
            )}
          </div>
        </div>

        <CreditSimulator
          tasaEfectivaAnual={Number(tarjeta?.tasaEfectivaAnual ?? 0)}
          moneda={tarjeta?.moneda ?? "COP"}
          saldoActual={utilizado}
          cupoTotal={Number(tarjeta?.cupoTotal ?? 0)}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Nuevo movimiento</h3>
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

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Tipo</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.tipo}
                  onChange={(e) => setMovForm((f) => ({ ...f, tipo: e.target.value as MovimientoTipo }))}
                >
                  <option value="COMPRA">Compra</option>
                  <option value="PAGO">Pago</option>
                  <option value="INTERES">Interes</option>
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
                  onChange={(e) => setMovForm((f) => ({ ...f, monto: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Descripcion</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.descripcion}
                  onChange={(e) => setMovForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Fecha</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={movForm.ocurrioEn}
                  onChange={(e) => setMovForm((f) => ({ ...f, ocurrioEn: e.target.value }))}
                />
              </label>
              {movForm.tipo === "COMPRA" && (
                <div className="md:col-span-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600 dark:border-white/20 dark:text-zinc-300">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={movForm.enCuotas}
                      onChange={(e) => setMovForm((f) => ({ ...f, enCuotas: e.target.checked }))}
                    />
                    Comprar en cuotas
                  </label>
                  {movForm.enCuotas && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <input
                        type="number"
                        min={2}
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                        value={movForm.cuotasTotales}
                        onChange={(e) =>
                          setMovForm((f) => ({ ...f, cuotasTotales: Math.max(2, Number(e.target.value)) }))
                        }
                      />
                      <span className="text-slate-500">Cuotas</span>
                    </div>
                  )}
                </div>
              )}
              {movForm.tipo === "CUOTA" && (
                <label className="md:col-span-2 space-y-1">
                  <span className="text-xs text-slate-500">ID de cuota (opcional)</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                    value={movForm.cuotaId}
                    onChange={(e) => setMovForm((f) => ({ ...f, cuotaId: e.target.value }))}
                    placeholder="Cuota a la que abonas"
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
                onClick={handleRegistrarMovimiento}
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
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Editar tarjeta</h3>
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
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Nombre</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Emisor</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.emisor}
                  onChange={(e) => setEditForm((f) => ({ ...f, emisor: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Cupo total</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.cupoTotal}
                  onChange={(e) => setEditForm((f) => ({ ...f, cupoTotal: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Saldo actual</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.saldoActual}
                  onChange={(e) => setEditForm((f) => ({ ...f, saldoActual: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">TEA (%)</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.tasaEfectivaAnual}
                  onChange={(e) => setEditForm((f) => ({ ...f, tasaEfectivaAnual: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Pago minimo (%)</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.pagoMinimoPct}
                  onChange={(e) => setEditForm((f) => ({ ...f, pagoMinimoPct: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Dia de corte</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.diaCorte}
                  onChange={(e) => setEditForm((f) => ({ ...f, diaCorte: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Dia de pago</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={editForm.diaPago}
                  onChange={(e) => setEditForm((f) => ({ ...f, diaPago: Number(e.target.value) }))}
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
                onClick={handleUpdateTarjeta}
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
