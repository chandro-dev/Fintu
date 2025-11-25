"use client";

import { useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";

type TipoCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

type Cuenta = {
  id: string;
  nombre: string;
  tipoCuentaId: string;
  moneda: string;
  saldo: number;
  limiteCredito?: number | null;
  tasaApr?: number | null;
  diaCorte?: number | null;
  diaPago?: number | null;
  plazoMeses?: number | null;
  tipoCuenta?: TipoCuenta | null;
};

type Categoria = {
  id: string;
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string | null;
};

type Transaccion = {
  id: string;
  monto: number;
  moneda: string;
  descripcion: string | null;
  ocurrioEn: string;
  direccion: "ENTRADA" | "SALIDA";
  cuentaId: string;
  cuenta?: { nombre: string; tipoCuenta?: TipoCuenta | null; moneda: string };
  categoria?: Categoria | null;
};

type CuentaForm = {
  nombre: string;
  tipoCuentaId: string;
  moneda: string;
  saldo: number;
  limiteCredito?: number | null;
  tasaApr?: number | null;
  diaCorte?: number | null;
  diaPago?: number | null;
  plazoMeses?: number | null;
};

type TxForm = {
  cuentaId: string;
  monto: number;
  direccion: "ENTRADA" | "SALIDA";
  descripcion: string;
  categoriaId?: string;
};

type CategoriaForm = {
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string;
};

const emptyCuenta: CuentaForm = { nombre: "", tipoCuentaId: "", moneda: "USD", saldo: 0 };
const emptyTx: TxForm = { cuentaId: "", monto: 0, direccion: "SALIDA", descripcion: "" };
const emptyCategoria: CategoriaForm = { nombre: "", tipo: "GASTO", color: "#0ea5e9" };

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tipos, setTipos] = useState<TipoCuenta[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentaForm, setCuentaForm] = useState<CuentaForm>(emptyCuenta);
  const [txForm, setTxForm] = useState<TxForm>(emptyTx);
  const [categoriaForm, setCategoriaForm] = useState<CategoriaForm>(emptyCategoria);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerName, setRegisterName] = useState("");

  const isSignedIn = useMemo(() => Boolean(session?.access_token), [session?.access_token]);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    void Promise.all([loadTipos(), loadCategorias(), loadCuentas(), loadTxs()]);
  }, [session?.access_token]);

  const authHeaders = { credentials: "include" as const };

  const loadTipos = async () => {
    const res = await fetch("/api/tipos-cuenta", authHeaders);
    if (res.ok) setTipos(await res.json());
  };
  const loadCategorias = async () => {
    const res = await fetch("/api/categorias", authHeaders);
    if (res.ok) setCategorias(await res.json());
  };
  const loadCuentas = async () => {
    const res = await fetch("/api/accounts", authHeaders);
    if (res.ok) setCuentas(await res.json());
  };
  const loadTxs = async () => {
    const res = await fetch("/api/transactions", authHeaders);
    if (res.ok) setTxs(await res.json());
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error: err } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (err) setError(err.message);
  };

  const loginWithEmail = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Email y password son obligatorios");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: signErr } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (signErr) throw signErr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const registerWithEmail = async () => {
    if (!registerEmail.trim() || !registerPassword.trim()) {
      setError("Email y password son obligatorios");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerEmail, password: registerPassword, name: registerName }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "No se pudo registrar");
      }
      const { error: signErr } = await supabaseClient.auth.signInWithPassword({
        email: registerEmail,
        password: registerPassword,
      });
      if (signErr) throw signErr;
      setShowRegisterModal(false);
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    setSession(null);
    setCuentas([]);
    setTxs([]);
  };

  const validateCuenta = () => {
    if (!cuentaForm.nombre.trim()) return "Nombre obligatorio";
    if (!cuentaForm.tipoCuentaId) return "Selecciona un tipo de cuenta";
    if (!cuentaForm.moneda.trim() || cuentaForm.moneda.length > 5) return "Moneda invalida";
    if (cuentaForm.limiteCredito !== undefined && (cuentaForm.limiteCredito ?? 0) < 0)
      return "Limite no puede ser negativo";
    return null;
  };

  const createCuenta = async () => {
    const validation = validateCuenta();
    if (validation) return setError(validation);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuentaForm),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "No se pudo crear la cuenta");
      }
      setCuentaForm(emptyCuenta);
      setShowCuentaModal(false);
      await loadCuentas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const validateTx = () => {
    if (!txForm.cuentaId) return "Selecciona la cuenta";
    if (!txForm.monto || Number(txForm.monto) <= 0) return "Monto debe ser mayor a 0";
    return null;
  };

  const createTx = async () => {
    const validation = validateTx();
    if (validation) return setError(validation);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...txForm, ocurrioEn: new Date().toISOString() }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "No se pudo crear la transaccion");
      }
      setTxForm(emptyTx);
      setShowTxModal(false);
      await Promise.all([loadCuentas(), loadTxs()]);
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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoriaForm),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "No se pudo crear la categoria");
      }
      setCategoriaForm(emptyCategoria);
      setShowCatModal(false);
      await loadCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const ingresos = txs.filter((tx) => tx.direccion === "ENTRADA").reduce((acc, tx) => acc + Number(tx.monto), 0);
    const egresos = txs.filter((tx) => tx.direccion === "SALIDA").reduce((acc, tx) => acc + Number(tx.monto), 0);
    const neto = ingresos - egresos;
    return { ingresos, egresos, neto };
  }, [txs]);

  const totalSaldo = useMemo(() => cuentas.reduce((acc, c) => acc + Number(c.saldo || 0), 0), [cuentas]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Fintu Dashboard</p>
            <h1 className="text-4xl font-semibold text-white">Finanzas personales</h1>
            <p className="text-sm text-zinc-300">Gestiona cuentas, transacciones, categorias y autenticacion con Supabase.</p>
          </div>
          <div className="flex items-center gap-3">
            {loadingSession && <span className="text-sm text-zinc-400">Cargando sesion...</span>}
            {!isSignedIn && !loadingSession && (
              <>
                <button onClick={loginWithEmail} className="rounded-full bg-white text-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Entrar con email</button>
                <button onClick={signInWithGoogle} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Entrar con Google</button>
                <button onClick={() => setShowRegisterModal(true)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Crear cuenta</button>
              </>
            )}
            {isSignedIn && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-300">{session?.user.email ?? "Usuario"}</span>
                <button onClick={signOut} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10">Salir</button>
              </div>
            )}
          </div>
        </header>

        {!isSignedIn ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-zinc-200">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Fintu</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Controla tus finanzas personales</h2>
                <p className="mt-2 text-zinc-300">Cuentas, tarjetas, prestamos, transacciones, categorias y planes. Autenticacion con Google o email/password. Datos servidos desde Supabase.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-lg font-semibold text-white">Iniciar sesion</h3>
                <div className="mt-3 grid gap-3">
                  <InputField label="Email" value={loginEmail} onChange={setLoginEmail} />
                  <InputField label="Password" value={loginPassword} onChange={setLoginPassword} type="password" />
                  <button onClick={loginWithEmail} disabled={busy} className="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-slate-200 disabled:opacity-50">{busy ? "Ingresando..." : "Entrar"}</button>
                  <button onClick={signInWithGoogle} className="inline-flex w-full items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Entrar con Google</button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {error && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {error} <button className="underline" onClick={() => setError(null)}>cerrar</button>
              </div>
            )}

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Cuentas</h2>
                  <span className="text-sm text-zinc-400">Total: {totalSaldo.toLocaleString()} {cuentas[0]?.moneda ?? "USD"}</span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {cuentas.map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-white">{c.nombre}</p>
                          <p className="text-sm text-zinc-400">{c.tipoCuenta?.nombre ?? c.tipoCuentaId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-emerald-300">{Number(c.saldo ?? 0).toLocaleString()} {c.moneda}</p>
                          {c.tasaApr && <p className="text-xs text-zinc-400">{c.tasaApr}% APR</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {cuentas.length === 0 && <p className="text-sm text-zinc-400">Crea tu primera cuenta.</p>}
                </div>
                <button onClick={() => setShowCuentaModal(true)} className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400">Nueva cuenta</button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Categorias</h2>
                  <span className="text-sm text-zinc-400">{categorias.length} definidas</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {categorias.map((cat) => (
                    <span key={cat.id} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: cat.color ?? "rgba(255,255,255,0.08)", color: "#0a0a0a" }}>
                      {cat.nombre} · {cat.tipo}
                    </span>
                  ))}
                  {categorias.length === 0 && <p className="text-sm text-zinc-400">Crea tu primera categoria.</p>}
                </div>
                <button onClick={() => setShowCatModal(true)} className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400">Nueva categoria</button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Resumen</h2>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <StatCard label="Ingresos" value={totals.ingresos} color="text-emerald-300" />
                  <StatCard label="Egresos" value={totals.egresos} color="text-rose-300" />
                  <StatCard label="Neto" value={totals.neto} color="text-sky-300" />
                </div>
                <button onClick={() => setShowTxModal(true)} className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Nueva transaccion</button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Transacciones</h2>
                  <p className="text-sm text-zinc-400">Ultimas 50</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {txs.map((tx) => (
                  <div key={tx.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-300">
                          {tx.cuenta?.nombre ?? tx.cuentaId} · {tx.cuenta?.tipoCuenta?.codigo ?? tx.cuenta?.tipoCuentaId}
                        </p>
                        <p className="text-lg font-semibold text-white">{tx.descripcion ?? "Sin descripcion"}</p>
                        <p className="text-xs text-zinc-500">{new Date(tx.ocurrioEn).toLocaleString()}</p>
                        {tx.categoria && (
                          <span className="mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold" style={{ background: tx.categoria.color ?? "rgba(255,255,255,0.08)", color: "#0a0a0a" }}>
                            {tx.categoria.nombre}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${tx.direccion === "ENTRADA" ? "text-emerald-300" : "text-rose-300"}`}>
                          {tx.direccion === "SALIDA" ? "-" : "+"}
                          {Number(tx.monto).toLocaleString()} {tx.moneda}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {txs.length === 0 && <p className="text-sm text-zinc-400">Aun no hay transacciones.</p>}
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={showCuentaModal} onClose={() => setShowCuentaModal(false)} title="Nueva cuenta">
        <div className="grid grid-cols-1 gap-3">
          <InputField label="Nombre" value={cuentaForm.nombre} onChange={(v) => setCuentaForm((f) => ({ ...f, nombre: v }))} />
          <SelectField
            label="Tipo de cuenta"
            value={cuentaForm.tipoCuentaId}
            onChange={(v) => setCuentaForm((f) => ({ ...f, tipoCuentaId: v }))}
            options={[{ label: "Selecciona", value: "" }, ...tipos.map((t) => ({ label: t.nombre, value: t.id }))]}
          />
          <InputField label="Moneda" value={cuentaForm.moneda} onChange={(v) => setCuentaForm((f) => ({ ...f, moneda: v }))} />
          <NumberField label="Saldo inicial" value={cuentaForm.saldo} onChange={(v) => setCuentaForm((f) => ({ ...f, saldo: Number(v || 0) }))} />
          {renderCuentaFields({ cuentaForm, setCuentaForm, tipos })}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCuentaModal(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Cancelar</button>
            <button onClick={createCuenta} disabled={busy} className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50">{busy ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title="Nueva categoria">
        <div className="grid grid-cols-1 gap-3">
          <InputField label="Nombre" value={categoriaForm.nombre} onChange={(v) => setCategoriaForm((f) => ({ ...f, nombre: v }))} />
          <SelectField
            label="Tipo"
            value={categoriaForm.tipo}
            onChange={(v) => setCategoriaForm((f) => ({ ...f, tipo: v as CategoriaForm["tipo"] }))}
            options={[
              { label: "Ingreso", value: "INGRESO" },
              { label: "Gasto", value: "GASTO" },
              { label: "Transferencia", value: "TRANSFERENCIA" },
            ]}
          />
          <InputField label="Color HEX (opcional)" value={categoriaForm.color ?? ""} onChange={(v) => setCategoriaForm((f) => ({ ...f, color: v || undefined }))} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCatModal(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Cancelar</button>
            <button onClick={createCategoria} disabled={busy} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">{busy ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showTxModal} onClose={() => setShowTxModal(false)} title="Nueva transaccion">
        <div className="grid grid-cols-1 gap-3">
          <SelectField
            label="Cuenta"
            value={txForm.cuentaId}
            onChange={(v) => setTxForm((f) => ({ ...f, cuentaId: v }))}
            options={[{ label: "Selecciona cuenta", value: "" }, ...cuentas.map((c) => ({ label: c.nombre, value: c.id }))]}
          />
          <SelectField
            label="Direccion"
            value={txForm.direccion}
            onChange={(v) => setTxForm((f) => ({ ...f, direccion: v as TxForm["direccion"] }))}
            options={[
              { label: "Entrada", value: "ENTRADA" },
              { label: "Salida", value: "SALIDA" },
            ]}
          />
          <NumberField label="Monto" value={txForm.monto} onChange={(v) => setTxForm((f) => ({ ...f, monto: Number(v || 0) }))} />
          <SelectField
            label="Categoria (opcional)"
            value={txForm.categoriaId ?? ""}
            onChange={(v) => setTxForm((f) => ({ ...f, categoriaId: v || undefined }))}
            options={[{ label: "Sin categoria", value: "" }, ...categorias.map((c) => ({ label: c.nombre, value: c.id }))]}
          />
          <InputField label="Descripcion" value={txForm.descripcion} onChange={(v) => setTxForm((f) => ({ ...f, descripcion: v }))} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowTxModal(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Cancelar</button>
            <button onClick={createTx} disabled={busy} className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{busy ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showRegisterModal} onClose={() => setShowRegisterModal(false)} title="Crear cuenta con email">
        <div className="grid grid-cols-1 gap-3">
          <InputField label="Nombre" value={registerName} onChange={setRegisterName} />
          <InputField label="Email" value={registerEmail} onChange={setRegisterEmail} />
          <InputField label="Password" value={registerPassword} onChange={setRegisterPassword} type="password" />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowRegisterModal(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Cancelar</button>
            <button onClick={registerWithEmail} disabled={busy} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-slate-200 disabled:opacity-50">{busy ? "Creando..." : "Crear y acceder"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function renderCuentaFields({
  cuentaForm,
  setCuentaForm,
  tipos,
}: {
  cuentaForm: CuentaForm;
  setCuentaForm: React.Dispatch<React.SetStateAction<CuentaForm>>;
  tipos: TipoCuenta[];
}) {
  const tipo = tipos.find((t) => t.id === cuentaForm.tipoCuentaId)?.codigo;
  if (!tipo) return null;
  return (
    <>
      {tipo === "TARJETA_CREDITO" && (
        <>
          <NumberField
            label="Limite de credito"
            value={cuentaForm.limiteCredito ?? ""}
            onChange={(v) => setCuentaForm((f) => ({ ...f, limiteCredito: v !== "" ? Number(v) : null }))}
          />
          <NumberField
            label="Tasa APR (%)"
            value={cuentaForm.tasaApr ?? ""}
            onChange={(v) => setCuentaForm((f) => ({ ...f, tasaApr: v !== "" ? Number(v) : null }))}
          />
          <NumberField
            label="Dia de corte"
            value={cuentaForm.diaCorte ?? ""}
            onChange={(v) => setCuentaForm((f) => ({ ...f, diaCorte: v !== "" ? Number(v) : null }))}
          />
          <NumberField
            label="Dia de pago"
            value={cuentaForm.diaPago ?? ""}
            onChange={(v) => setCuentaForm((f) => ({ ...f, diaPago: v !== "" ? Number(v) : null }))}
          />
        </>
      )}
      {tipo === "PRESTAMO" && (
        <>
          <NumberField
            label="Tasa APR (%)"
            value={cuentaForm.tasaApr ?? ""}
            onChange={(v) => setCuentaForm((f) => ({ ...f, tasaApr: v !== "" ? Number(v) : null }))}
          />
          <NumberField
            label="Plazo (meses)"
            value={cuentaForm.plazoMeses ?? ""}
            onChange={(v) => setCuentaForm((f) => ({ ...f, plazoMeses: v !== "" ? Number(v) : null }))}
          />
        </>
      )}
    </>
  );
}
