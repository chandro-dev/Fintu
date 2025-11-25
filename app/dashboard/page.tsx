"use client";

import { useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/formatMoney";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TxForm, Cuenta, Transaccion, Categoria, TipoCuenta } from "@/components/transactions/types";
import { InputField, NumberField, SelectField } from "@/components/ui/Fields";
import { useTheme } from "@/components/ThemeProvider";

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

type CategoriaForm = {
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string;
};

type UserProfile = {
  authUser: {
    id: string;
    email?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  usuario: {
    id: string;
    correo: string;
    nombre?: string | null;
    avatarUrl?: string | null;
    authProvider: string;
    telefono?: string | null;
    ultimoLogin?: string | null;
    creadoEn: string;
    actualizadoEn: string;
  } | null;
};

const emptyCuenta: CuentaForm = { nombre: "", tipoCuentaId: "", moneda: "USD", saldo: 0 };
const emptyTx: TxForm = { cuentaId: "", monto: 0, direccion: "SALIDA", descripcion: "", ocurrioEn: "" };
const emptyCategoria: CategoriaForm = { nombre: "", tipo: "GASTO", color: "#0ea5e9" };

export default function Dashboard() {
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tipos, setTipos] = useState<TipoCuenta[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentaForm, setCuentaForm] = useState<CuentaForm>(emptyCuenta);
  const [txForm, setTxForm] = useState<TxForm>(emptyTx);
  const [categoriaForm, setCategoriaForm] = useState<CategoriaForm>(emptyCategoria);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
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
    void Promise.all([loadUserProfile(), loadTipos(), loadCategorias(), loadCuentas(), loadTxs()]);
  }, [session?.access_token]);

  const accessToken = session?.access_token;
  const authHeaders = useMemo(
    () =>
      accessToken
        ? {
            credentials: "include" as const,
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        : { credentials: "include" as const },
    [accessToken],
  );

  const loadTipos = async () => {
    if (!accessToken) return;
    const res = await fetch("/api/tipos-cuenta", authHeaders);
    if (res.ok) setTipos(await res.json());
  };
  const loadUserProfile = async () => {
    if (!accessToken) return;
    const res = await fetch("/api/auth/me", authHeaders);
    if (res.ok) {
      setUserInfo(await res.json());
    }
  };
  const loadCategorias = async () => {
    if (!accessToken) return;
    const res = await fetch("/api/categorias", authHeaders);
    if (res.ok) setCategorias(await res.json());
  };
  const loadCuentas = async () => {
    if (!accessToken) return;
    const res = await fetch("/api/accounts", authHeaders);
    if (res.ok) setCuentas(await res.json());
  };
  const loadTxs = async () => {
    if (!accessToken) return;
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
    setUserInfo(null);
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
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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

  const saveTx = async () => {
    const validation = validateTx();
    if (validation) return setError(validation);
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...txForm,
        ocurrioEn: txForm.ocurrioEn ? new Date(txForm.ocurrioEn).toISOString() : new Date().toISOString(),
        id: editingTxId ?? undefined,
      };
      const isEditing = Boolean(editingTxId);
      const res = await fetch("/api/transactions", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || (isEditing ? "No se pudo actualizar la transaccion" : "No se pudo crear la transaccion"));
      }
      setTxForm(emptyTx);
      setEditingTxId(null);
      setShowTxModal(false);
      await Promise.all([loadCuentas(), loadTxs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  const deleteTx = async () => {
    if (!editingTxId) return;
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: editingTxId }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "No se pudo eliminar la transaccion");
      }
      setTxForm(emptyTx);
      setEditingTxId(null);
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
    if (!accessToken) return setError("No hay sesion activa");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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
  const flowByMonth = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    txs.forEach((tx) => {
      const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7); // YYYY-MM
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
    const map = new Map<string, { nombre: string; total: number; color?: string | null }>();
    txs
      .filter((tx) => tx.direccion === "SALIDA" && tx.categoria)
      .forEach((tx) => {
        const key = tx.categoria!.id;
        const current = map.get(key) ?? { nombre: tx.categoria!.nombre, total: 0, color: tx.categoria!.color };
        current.total += Number(tx.monto);
        map.set(key, current);
      });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [txs]);
  const tokenPreview = useMemo(() => {
    if (!accessToken) return "";
    if (accessToken.length <= 26) return accessToken;
    return `${accessToken.slice(0, 14)}...${accessToken.slice(-12)}`;
  }, [accessToken]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 text-slate-900 dark:text-zinc-50">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Fintu Dashboard</p>
            <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">Finanzas personales</h1>
            <p className="text-sm text-slate-800 dark:text-zinc-300">Gestiona cuentas, transacciones, categorias y autenticacion con Supabase.</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {loadingSession && <span className="text-sm text-zinc-460">Cargando sesion...</span>}
            {!isSignedIn && !loadingSession && (
              <>
                <button onClick={loginWithEmail} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200">Entrar con email</button>
                <button onClick={signInWithGoogle} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Entrar con Google</button>
                <button onClick={() => setShowRegisterModal(true)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Crear cuenta</button>
              </>
            )}
            {isSignedIn && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-950 dark:text-zinc-300">{session?.user.email ?? "Usuario"}</span>
                <button onClick={signOut} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Salir</button>
              </div>
            )}
          </div>
        </header>

        {!isSignedIn ? (
          <section className="rounded-2xl border border-black/5 bg-white/70 p-8 text-sm text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Fintu</p>
                <h2 className="mt-2 text-2xl font-semibold dark:text-white text-slate-700">Controla tus finanzas personales</h2>
                <p className="mt-2 dark:text-zinc-300">Cuentas, tarjetas, prestamos, transacciones, categorias y planes. Autenticacion con Google o email/password. Datos servidos desde Supabase.</p>
              </div>
              <div className="rounded-xl border border-black/5 bg-white/80 p-4 shadow dark:border-white/10 dark:bg-black/30">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Iniciar sesion</h3>
                <div className="mt-3 grid gap-3">
                  <InputField label="Email" value={loginEmail} onChange={setLoginEmail} />
                  <InputField label="Password" value={loginPassword} onChange={setLoginPassword} type="password" />
                  <button onClick={loginWithEmail} disabled={busy} className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200">{busy ? "Ingresando..." : "Entrar"}</button>
                  <button onClick={signInWithGoogle} className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Entrar con Google</button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Usuario autenticado</p>
                  <h2 className="text-2xl font-semibold text-white">
                    {userInfo?.usuario?.nombre || userInfo?.authUser.email || session?.user.email || "Sesion activa"}
                  </h2>
                  <p className="text-sm text-zinc-400">{userInfo?.usuario?.correo ?? session?.user.email ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-zinc-300">
                  <InfoRow label="User ID" value={userInfo?.usuario?.id ?? session?.user.id ?? "-"} />
                  <InfoRow label="Proveedor" value={userInfo?.usuario?.authProvider ?? (session?.user.app_metadata?.provider as string) ?? "supabase"} />
                  <InfoRow
                    label="Ultimo login"
                    value={
                      userInfo?.usuario?.ultimoLogin
                        ? new Date(userInfo.usuario.ultimoLogin).toLocaleString()
                        : "Sin registro"
                    }
                  />
                  <InfoRow label="JWT" value={tokenPreview || "No token"} />
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-100 px-4 py-3 text-sm text-amber-900 shadow dark:bg-amber-500/10 dark:text-amber-100">
                {error} <button className="underline" onClick={() => setError(null)}>cerrar</button>
              </div>
            )}

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cuentas</h2>
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Total: {formatMoney(totalSaldo, cuentas[0]?.moneda ?? "USD")}</span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {cuentas.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-md dark:border-white/10 dark:bg-black/30 dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900 dark:text-white">{c.nombre}</p>
                          <p className="text-sm text-zinc-400">{c.tipoCuenta?.nombre ?? c.tipoCuentaId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-emerald-300">{formatMoney(Number(c.saldo ?? 0), c.moneda)}</p>
                          {c.tasaApr && <p className="text-xs text-zinc-400">{c.tasaApr}% APR</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {cuentas.length === 0 && <p className="text-sm text-zinc-400">Crea tu primera cuenta.</p>}
                </div>
                <button onClick={() => setShowCuentaModal(true)} className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 dark:text-white">Nueva cuenta</button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Categorias</h2>
                  <span className="text-sm text-slate-500 dark:text-zinc-400">{categorias.length} definidas</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {categorias.map((cat) => (
                    <span key={cat.id} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: cat.color ?? "rgba(255,255,255,0.08)", color: "#0a0a0a" }}>
                      {cat.nombre} · {cat.tipo}
                    </span>
                  ))}
                  {categorias.length === 0 && <p className="text-sm text-zinc-400">Crea tu primera categoria.</p>}
                </div>
                <button onClick={() => setShowCatModal(true)} className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 dark:text-white">Nueva categoria</button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resumen</h2>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <StatCard label="Ingresos" value={totals.ingresos} color="text-emerald-300" />
                  <StatCard label="Egresos" value={totals.egresos} color="text-rose-300" />
                  <StatCard label="Neto" value={totals.neto} color="text-sky-300" />
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
              <div className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Flujo ultimos meses</h2>
                  <span className="text-xs text-zinc-400">Ingresos vs egresos</span>
                </div>
                <div className="mt-4">
                  <FlowChart data={flowByMonth} />
                </div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Gasto por categoria</h2>
                  <span className="text-xs text-zinc-400">Top 4</span>
                </div>
                <div className="mt-4 space-y-3">
                  {gastosPorCategoria.length === 0 && <p className="text-sm text-zinc-400">Aun no hay gastos.</p>}
                  {gastosPorCategoria.map((cat) => (
                    <CategoryBar
                      key={cat.nombre}
                      label={cat.nombre}
                      value={cat.total}
                      maxValue={gastosPorCategoria[0]?.total ?? 1}
                      color={cat.color ?? "#0ea5e9"}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Saldo por tipo</h2>
                  <span className="text-xs text-zinc-400">{saldoPorTipoCuenta.length} tipos</span>
                </div>
                <div className="mt-4 space-y-3">
                  {saldoPorTipoCuenta.length === 0 && <p className="text-sm text-zinc-400">No hay cuentas creadas.</p>}
                  {saldoPorTipoCuenta.map((item) => (
                    <DonutRow key={item.nombre} label={item.nombre} value={item.total} total={totalSaldo || 1} />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Transacciones</h2>
                  <p className="text-sm text-zinc-400">Ultimas 50</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {txs.map((tx) => (
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
                        ocurrioEn: new Date(selected.ocurrioEn).toISOString().slice(0, 16),
                      });
                      setShowTxModal(true);
                    }}
                  />
                ))}
                {txs.length === 0 && <p className="text-sm dark:text-zinc-400">Aun no hay transacciones.</p>}
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
            <button onClick={() => setShowCuentaModal(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Cancelar</button>
            <button onClick={createCuenta} disabled={busy} className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50 dark:text-white">{busy ? "Guardando..." : "Guardar"}</button>
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
            <button onClick={() => setShowCatModal(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Cancelar</button>
            <button onClick={createCategoria} disabled={busy} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 dark:text-white">{busy ? "Guardando..." : "Guardar"}</button>
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

      <Modal open={showRegisterModal} onClose={() => setShowRegisterModal(false)} title="Crear cuenta con email">
        <div className="grid grid-cols-1 gap-3">
          <InputField label="Nombre" value={registerName} onChange={setRegisterName} />
          <InputField label="Email" value={registerEmail} onChange={setRegisterEmail} />
          <InputField label="Password" value={registerPassword} onChange={setRegisterPassword} type="password" />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowRegisterModal(false)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Cancelar</button>
            <button onClick={registerWithEmail} disabled={busy} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200">{busy ? "Creando..." : "Crear y acceder"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
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
  children,
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
          <button onClick={onClose} className="rounded-full border dark:border-white/90 border-black/90  px-3 py-1 text-xs font-semibold dark:text-white hover:bg-white/10">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FlowChart({ data }: { data: [string, { ingresos: number; egresos: number }][] }) {
  if (!data.length) {
    return <p className="text-sm text-zinc-400">Sin datos recientes.</p>;
  }
  return (
    <div className="grid gap-3">
      {data.map(([label, values]) => {
        const total = values.ingresos + values.egresos || 1;
        const inPct = Math.min(100, Math.max(0, (values.ingresos / total) * 100));
        return (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{label}</span>
              <span>
                <span className="text-emerald-300">{formatMoney(values.ingresos)}</span>{" "}
                <span className="text-zinc-500">/</span>{" "}
                <span className="text-rose-300">{formatMoney(values.egresos)}</span>
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
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const width = Math.min(100, Math.max(8, (value / Math.max(maxValue, 1)) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-900 dark:text-white">{label}</span>
        <span className="text-slate-600 dark:text-zinc-400">{formatMoney(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function DonutRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = Math.min(100, Math.max(0, (value / total) * 100));
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 p-3">
      <div className="relative h-12 w-12">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(#38bdf8 ${pct}%, rgba(255,255,255,0.08) ${pct}% 100%)`,
          }}
        />
        <div className="absolute inset-2 rounded-full bg-zinc-950" />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
          {Math.round(pct)}%
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-600 dark:text-zinc-400">{formatMoney(value)}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-28 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <span className="truncate text-xs text-slate-900 dark:text-white">{value}</span>
    </div>
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
