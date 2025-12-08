"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/formatMoney";
import { TarjetaService, TarjetaPayload } from "@/lib/services/TarjetaService";
import { useAppData } from "@/components/AppDataProvider";

type Tarjeta = {
  id: string;
  nombre: string;
  emisor?: string | null;
  moneda: string;
  cupoTotal: number;
  saldoActual: number;
  tasaEfectivaAnual: number;
  diaCorte: number;
  diaPago: number;
};

export default function TarjetasPage() {
  const { session, cuentas, loadingData } = useAppData();
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TarjetaPayload>({
    nombre: "",
    cuentaId: "",
    moneda: "COP",
    cupoTotal: 0,
    tasaEfectivaAnual: 0.0,
    diaCorte: 1,
    diaPago: 10,
  });

  const accessToken = session?.access_token;

  const loadTarjetas = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await TarjetaService.listar({ accessToken });
      setTarjetas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) void loadTarjetas();
  }, [accessToken]);

  useEffect(() => {
    if (form.cuentaId || cuentas.length === 0) return;
    setForm((prev) => ({ ...prev, cuentaId: cuentas[0].id }));
  }, [cuentas, form.cuentaId]);

  const handleSubmit = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await TarjetaService.crear(form, { accessToken });
      setShowModal(false);
      setForm((prev) => ({ ...prev, nombre: "", cuentaId: "", cupoTotal: 0 }));
      await loadTarjetas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const totalSaldo = useMemo(
    () => tarjetas.reduce((acc, t) => acc + Number(t.saldoActual ?? 0), 0),
    [tarjetas],
  );

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">Tarjetas</p>
            <h1 className="text-3xl font-semibold">Tarjetas de crédito</h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Gestiona cupo, saldo, intereses y movimientos.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400"
          >
            Nueva tarjeta
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Total saldo tarjetas: {formatMoney(totalSaldo, tarjetas[0]?.moneda ?? "COP")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tarjetas.map((t) => (
            <a
              key={t.id}
              href={`/tarjetas/${t.id}`}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-black/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{t.nombre}</p>
                  <p className="text-xs text-slate-500">{t.emisor ?? "Emisor"}</p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  Cupo: {formatMoney(Number(t.cupoTotal ?? 0), t.moneda)}
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                Saldo: {formatMoney(Number(t.saldoActual ?? 0), t.moneda)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                TEA: {t.tasaEfectivaAnual}% · Corte: {t.diaCorte} · Pago: {t.diaPago}
              </div>
            </a>
          ))}
          {tarjetas.length === 0 && !loading && (
            <p className="text-sm text-slate-500 dark:text-zinc-400">No hay tarjetas creadas.</p>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Nueva tarjeta</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Nombre</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Cuenta asociada</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.cuentaId}
                  onChange={(e) => setForm((f) => ({ ...f, cuentaId: e.target.value }))}
                  disabled={loadingData}
                >
                  <option value="">Selecciona una cuenta</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Emisor</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.emisor ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, emisor: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Cupo total</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.cupoTotal as number}
                  onChange={(e) => setForm((f) => ({ ...f, cupoTotal: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">TEA (%)</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.tasaEfectivaAnual as number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tasaEfectivaAnual: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Día de corte</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.diaCorte}
                  onChange={(e) => setForm((f) => ({ ...f, diaCorte: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Día de pago</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  value={form.diaPago}
                  onChange={(e) => setForm((f) => ({ ...f, diaPago: Number(e.target.value) }))}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
