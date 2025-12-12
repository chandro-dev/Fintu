"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import { InputField } from "@/components/ui/Fields";

export default function LoginPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabaseClient.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession?.access_token) router.replace("/dashboard");
      }
    );
    return () => data.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!loadingSession && session?.access_token) {
      router.replace("/dashboard");
    }
  }, [loadingSession, router, session?.access_token]);

  const signInWithGoogle = async () => {
    setAuthBusy(true);
    setAuthError(null);
    const { error: err } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
    if (err) setAuthError(err.message);
    setAuthBusy(false);
  };

  const signInWithEmail = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError("Email y password son obligatorios");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error: err } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword
      });
      if (err) throw err;
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "No se pudo iniciar sesion"
      );
    } finally {
      setAuthBusy(false);
    }
  };

  if (session?.access_token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <p className="text-sm text-slate-200">Redirigiendo al dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12 text-white">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
            Fintu
          </p>
          <h1 className="text-4xl font-semibold">Accede a tu cuenta</h1>
          <p className="text-sm text-slate-300">
            Inicia sesion para ver y administrar tu dashboard financiero.
          </p>
        </header>

        <AuthPanel
          authError={authError}
          authBusy={authBusy}
          loadingSession={loadingSession}
          loginEmail={loginEmail}
          loginPassword={loginPassword}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPassword}
          onEmailSignIn={signInWithEmail}
          onGoogleSignIn={signInWithGoogle}
        />
      </div>
    </div>
  );
}

function AuthPanel({
  authError,
  authBusy,
  loadingSession,
  loginEmail,
  loginPassword,
  onEmailChange,
  onPasswordChange,
  onEmailSignIn,
  onGoogleSignIn
}: {
  authError: string | null;
  authBusy: boolean;
  loadingSession: boolean;
  loginEmail: string;
  loginPassword: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onEmailSignIn: () => void;
  onGoogleSignIn: () => void;
}) {
  return (
    <section className="grid grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-400">
          Acceso requerido
        </p>
        <h2 className="text-2xl font-semibold text-white">
          Inicia sesion para ver tu dashboard
        </h2>
        <p className="text-sm text-slate-300">
          Usa tus credenciales de Supabase o accede con Google. Una vez dentro
          cargaremos tus cuentas, categorias y transacciones automaticamente.
        </p>
        <ul className="space-y-1 text-sm text-slate-300/80">
          <li>- Sin redirecciones raras: permaneces en la app.</li>
          <li>- Actualizamos los datos apenas la sesion este lista.</li>
          <li>- Puedes cerrar sesion desde el dashboard.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/40 p-5 shadow-sm">
        {authError && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {authError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          <InputField
            label="Email"
            value={loginEmail}
            onChange={onEmailChange}
            placeholder="tu@correo.com"
            disabled={authBusy || loadingSession}
          />
          <InputField
            label="Password"
            type="password"
            value={loginPassword}
            onChange={onPasswordChange}
            placeholder="********"
            disabled={authBusy || loadingSession}
          />
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={onEmailSignIn}
              disabled={authBusy || loadingSession}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
            >
              {authBusy ? "Ingresando..." : "Entrar con email"}
            </button>
            <button
              onClick={onGoogleSignIn}
              disabled={authBusy || loadingSession}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              Continuar con Google
            </button>
          </div>
          <p className="text-xs text-slate-300">
            {loadingSession
              ? "Verificando sesion previa..."
              : "Si no tienes cuenta, crea una desde Supabase Auth o pide acceso al admin."}
          </p>
        </div>
      </div>
    </section>
  );
}
