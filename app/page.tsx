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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Fintu</p>
          <h1 className="text-4xl font-semibold text-white">Finanzas personales en un solo lugar</h1>
          <p className="text-lg text-zinc-300">
            Lleva el control de cuentas, tarjetas, prstamos, transacciones, categoras y planes.
            Autenticacin con Supabase (Google o email) y backend en Next.
          </p>
        </header>
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
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
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-slate-200"
          >
            Ir al dashboard
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Iniciar sesin
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-zinc-300">{desc}</p>
    </div>
  );
}
