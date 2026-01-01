"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";

type ModuleKey = "overview" | "health" | "charts" | "transactions";

const defaultModules: ModuleKey[] = ["overview", "health", "charts", "transactions"];

const moduleInfo: Record<ModuleKey, { title: string; description: string }> = {
  overview: { title: "Resumen", description: "Cuentas, categorias y atajos rapidos" },
  health: { title: "Salud financiera", description: "Patrimonio, liquidez y tasa de ahorro" },
  charts: { title: "Graficos", description: "Flujo mensual, top gastos y saldos" },
  transactions: { title: "Transacciones", description: "Movimientos recientes y flujo de dinero" },
};

export default function DashboardConfig() {
  const router = useRouter();
  const { session, loadingSession } = useAppData();

  const storageKey = useMemo(
    () => (session?.user?.id ? `dashboard:modules:v1:${session.user.id}` : null),
    [session?.user?.id],
  );

  const [modulesOrder, setModulesOrder] = useState<ModuleKey[]>(defaultModules);
  const [hiddenModules, setHiddenModules] = useState<ModuleKey[]>([]);
  const [dragging, setDragging] = useState<ModuleKey | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.order) setModulesOrder(parsed.order);
        if (parsed?.hidden) setHiddenModules(parsed.hidden);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ order: modulesOrder, hidden: hiddenModules }));
    } catch {}
  }, [modulesOrder, hiddenModules, storageKey]);

  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/login");
    }
  }, [loadingSession, session, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("theme");
    const prefersDark =
      stored === "dark" ||
      (stored == null && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    setTheme(prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
    }
  };

  const reorder = (source: ModuleKey, target: ModuleKey) => {
    if (source === target) return;
    setModulesOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(source);
      const toIdx = next.indexOf(target);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, source);
      return next;
    });
  };

  const toggleVisibility = (key: ModuleKey) => {
    setHiddenModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Cargando configuracion...
      </div>
    );
  }

  if (!session) return null;

  const activeModules = modulesOrder.filter((m) => !hiddenModules.includes(m));
  const inactiveModules = modulesOrder.filter((m) => hiddenModules.includes(m));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400 font-bold">
              Configuracion de Dashboard
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Diseña tu panel</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Arrastra, ordena y oculta secciones. Los cambios se guardan solo para tu usuario.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              Volver al dashboard
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              Modo {theme === "dark" ? "claro" : "oscuro"}
            </button>
            <button
              onClick={() => {
                setModulesOrder(defaultModules);
                setHiddenModules([]);
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Restablecer
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Modulos activos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">Arrastra para cambiar el orden.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeModules.map((key) => {
              const info = moduleInfo[key];
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => setDragging(key)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dragging && reorder(dragging, key)}
                  className={`flex items-start justify-between rounded-xl border px-4 py-3 shadow-sm transition ${
                    dragging === key
                      ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-500/10"
                      : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{info.title}</span>
                      <span className="text-[11px] rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500 dark:bg-white/10 dark:text-zinc-300">
                        {key}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-300">{info.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-lg text-slate-400" aria-label="Mover">
                      ⋮⋮
                    </span>
                    <button
                      onClick={() => toggleVisibility(key)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                      Ocultar
                    </button>
                  </div>
                </div>
              );
            })}
            {activeModules.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                No hay modulos activos. Reactiva alguno desde la lista de ocultos.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Modulos ocultos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Activa para agregarlos de nuevo al dashboard. Mantienen su ultimo orden.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {inactiveModules.map((key) => {
              const info = moduleInfo[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleVisibility(key)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  <span>{info.title}</span>
                  <span className="text-[11px] rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500 dark:bg-white/10 dark:text-zinc-300">
                    {key}
                  </span>
                </button>
              );
            })}
            {inactiveModules.length === 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-300">No hay modulos ocultos.</span>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-sm dark:border-white/10">
          <h3 className="text-xl font-semibold">Como funciona</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-100">
            <li>1. Arrastra las tarjetas para cambiar el orden.</li>
            <li>2. Usa “Ocultar” para quitar un modulo sin perder su posicion.</li>
            <li>3. Todo se guarda automaticamente para tu usuario.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Ver dashboard con cambios
            </button>
            <button
              onClick={() => {
                setModulesOrder(defaultModules);
                setHiddenModules([]);
              }}
              className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Restablecer
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
