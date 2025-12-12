"use client";
import Link from "next/link";
import { useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export default function Landing() {
  // Si ya hay sesin, redirige al dashboard.
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = "/dashboard";
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950 dark:text-zinc-50 transition-colors">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Fintu</p>
          <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">Finanzas personales en un solo lugar</h1>
          <p className="text-lg text-slate-600 dark:text-zinc-300">
            Lleva el control de cuentas, tarjetas, prstamos, transacciones, categoras y planes.
            Autenticacin con Supabase (Google o email) y backend en Next.
          </p>
        </header>
        <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          <Feature
            title="Cuentas y tarjetas"
            desc="Crea cuentas normales, tarjetas de crdito y prstamos. Seguimiento de saldo y tasas."
          />
          <Feature
            title="Transacciones con categoras"
            desc="Registra ingresos y gastos, asigna categoras y ve resmenes rpidos."
          />
          <Feature
            title="Planes y presupuestos"
            desc="Define montos lmite por periodo para categoras clave y monitorea tu cumplimiento."
          />
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200"
          >
            Ir al dashboard
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
          >
            Iniciar sesion
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/30 dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-800 dark:text-zinc-300">{desc}</p>
    </div>
  );
}
