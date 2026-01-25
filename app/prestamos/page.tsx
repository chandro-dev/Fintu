"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { formatMoney } from "@/lib/formatMoney";

type LoanForm = {
  nombre: string;
  monto: string;
  cuentaOrigenId: string;
  moneda: string;
  tasaApr?: string;
  plazoMeses?: string;
  ocurrioEn?: string;
  descripcion?: string;
};

type PaymentForm = {
  loanAccountId: string;
  destinoCuentaId: string;
  monto: string;
  ocurrioEn?: string;
  descripcion?: string;
};

const LOAN_CODE = "PRESTAMO";

export default function PrestamosPage() {
  const router = useRouter();
  const { session, loadingSession, cuentas, loadingData, refresh } = useAppData();

  const loanAccounts = useMemo(
    () => cuentas.filter((c) => c.tipoCuenta?.codigo === LOAN_CODE && !c.cerradaEn),
    [cuentas],
  );
  const normalAccounts = useMemo(
    () => cuentas.filter((c) => c.tipoCuenta?.codigo !== LOAN_CODE && !c.cerradaEn),
    [cuentas],
  );

  const [createForm, setCreateForm] = useState<LoanForm>({
    nombre: "",
    monto: "",
    cuentaOrigenId: normalAccounts[0]?.id ?? "",
    moneda: "COP",
    tasaApr: "",
    plazoMeses: "",
    ocurrioEn: new Date().toISOString().slice(0, 16),
    descripcion: "",
  });

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    loanAccountId: loanAccounts[0]?.id ?? "",
    destinoCuentaId: normalAccounts[0]?.id ?? "",
    monto: "",
    ocurrioEn: new Date().toISOString().slice(0, 16),
    descripcion: "",
  });

  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Cargando sesión...
      </div>
    );
  }
  if (!session) {
    router.replace("/login");
    return null;
  }

  const outstandingTotal = loanAccounts.reduce((acc, c) => acc + Number(c.saldo || 0), 0);

  const handleCreate = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          kind: "create",
          nombre: createForm.nombre,
          monto: Number(createForm.monto),
          cuentaOrigenId: createForm.cuentaOrigenId,
          moneda: createForm.moneda,
          tasaApr: createForm.tasaApr ? Number(createForm.tasaApr) : undefined,
          plazoMeses: createForm.plazoMeses ? Number(createForm.plazoMeses) : undefined,
          ocurrioEn: createForm.ocurrioEn,
          descripcion: createForm.descripcion,
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear el préstamo");
      setStatus("Préstamo creado y desembolsado.");
      setCreateForm((prev) => ({ ...prev, nombre: "", monto: "", descripcion: "" }));
      await refresh({ force: true });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error creando préstamo");
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          kind: "payment",
          loanAccountId: paymentForm.loanAccountId,
          destinoCuentaId: paymentForm.destinoCuentaId,
          monto: Number(paymentForm.monto),
          ocurrioEn: paymentForm.ocurrioEn,
          descripcion: paymentForm.descripcion,
        }),
      });
      if (!res.ok) throw new Error("No se pudo registrar el pago");
      setStatus("Pago aplicado al préstamo y registrado como transacción.");
      setPaymentForm((prev) => ({ ...prev, monto: "", descripcion: "" }));
      await refresh({ force: true });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error registrando pago");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400 font-semibold">Préstamos</p>
            <h1 className="text-3xl font-semibold">Carpeta de préstamos</h1>
            <p className="text-sm text-slate-300">
              Desembolsa, cobra y registra pagos como transacciones vinculadas a tus cuentas.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right shadow-lg ring-1 ring-white/10">
            <p className="text-xs text-slate-300">Saldo por cobrar</p>
            <p className="text-xl font-semibold">{formatMoney(outstandingTotal)}</p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white/5 p-4 shadow-lg ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Nuevo préstamo</h2>
                <p className="text-xs text-slate-300">Crea la cuenta y registra el desembolso.</p>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs rounded-full border border-white/20 px-3 py-1 font-semibold text-white hover:bg-white/10"
              >
                Ir al dashboard
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                placeholder="Nombre del prestatario"
                value={createForm.nombre}
                onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  placeholder="Monto"
                  type="number"
                  value={createForm.monto}
                  onChange={(e) => setCreateForm({ ...createForm, monto: e.target.value })}
                />
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={createForm.cuentaOrigenId}
                  onChange={(e) => setCreateForm({ ...createForm, cuentaOrigenId: e.target.value })}
                >
                  <option value="">Cuenta de origen</option>
                  {normalAccounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({formatMoney(Number(c.saldo || 0))})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  placeholder="Tasa APR (%)"
                  type="number"
                  value={createForm.tasaApr}
                  onChange={(e) => setCreateForm({ ...createForm, tasaApr: e.target.value })}
                />
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  placeholder="Plazo (meses)"
                  type="number"
                  value={createForm.plazoMeses}
                  onChange={(e) => setCreateForm({ ...createForm, plazoMeses: e.target.value })}
                />
              </div>

              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                type="datetime-local"
                value={createForm.ocurrioEn}
                onChange={(e) => setCreateForm({ ...createForm, ocurrioEn: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                rows={2}
                placeholder="Descripción"
                value={createForm.descripcion}
                onChange={(e) => setCreateForm({ ...createForm, descripcion: e.target.value })}
              />

              <button
                onClick={handleCreate}
                disabled={saving || !createForm.nombre || !createForm.monto || !createForm.cuentaOrigenId}
                className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Crear y desembolsar"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 shadow-lg ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Registrar pago</h2>
                <p className="text-xs text-slate-300">Reduce saldo del préstamo y acredita una cuenta.</p>
              </div>
              <button
                onClick={() => router.push("/transacciones")}
                className="text-xs rounded-full border border-white/20 px-3 py-1 font-semibold text-white hover:bg-white/10"
              >
                Ver movimientos
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={paymentForm.loanAccountId}
                onChange={(e) => setPaymentForm({ ...paymentForm, loanAccountId: e.target.value })}
              >
                <option value="">Selecciona préstamo</option>
                {loanAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({formatMoney(Number(c.saldo || 0))})
                  </option>
                ))}
              </select>

              <select
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={paymentForm.destinoCuentaId}
                onChange={(e) => setPaymentForm({ ...paymentForm, destinoCuentaId: e.target.value })}
              >
                <option value="">Cuenta que recibe</option>
                {normalAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({formatMoney(Number(c.saldo || 0))})
                  </option>
                ))}
              </select>

              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                placeholder="Monto del pago"
                type="number"
                value={paymentForm.monto}
                onChange={(e) => setPaymentForm({ ...paymentForm, monto: e.target.value })}
              />
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                type="datetime-local"
                value={paymentForm.ocurrioEn}
                onChange={(e) => setPaymentForm({ ...paymentForm, ocurrioEn: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                rows={2}
                placeholder="Descripción"
                value={paymentForm.descripcion}
                onChange={(e) => setPaymentForm({ ...paymentForm, descripcion: e.target.value })}
              />

              <button
                onClick={handlePayment}
                disabled={
                  saving || !paymentForm.loanAccountId || !paymentForm.destinoCuentaId || !paymentForm.monto
                }
                className="w-full rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white/5 p-4 shadow-lg ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">Préstamos activos</h3>
              <p className="text-xs text-slate-300">Ordenados por saldo pendiente.</p>
            </div>
            <button
              onClick={() => refresh({ force: true })}
              className="text-xs rounded-full border border-white/20 px-3 py-1 font-semibold text-white hover:bg-white/10"
            >
              Refrescar
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {loanAccounts
              .sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0))
              .map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="text-xs text-slate-300">
                      {c.plazoMeses ? `${c.plazoMeses} meses · ` : ""}APR {c.tasaApr ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-200">{formatMoney(Number(c.saldo || 0))}</span>
                    <button
                      onClick={() =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          loanAccountId: c.id,
                          destinoCuentaId: prev.destinoCuentaId || normalAccounts[0]?.id || "",
                        }))
                      }
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              ))}
            {loanAccounts.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-300">
                Aún no tienes préstamos. Crea el primero desde el formulario.
              </p>
            )}
          </div>
        </section>

        {status && (
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
            {status}
          </div>
        )}

        {loadingData && (
          <div className="text-center text-xs text-slate-300">Sincronizando datos...</div>
        )}
      </div>
    </div>
  );
}
