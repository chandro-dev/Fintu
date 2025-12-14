"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { Session } from "@supabase/supabase-js";

// Hooks (La lógica de negocio)
import { useDashboardData } from "@/hooks/useDashboardData";
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";

// Componentes UI (Los bloques de construcción)
import { Loading } from "@/components/ui/Loading";
import { SummaryWidget } from "@/components/dashboard/SummaryWidget";
import { AccountsList } from "@/components/dashboard/AccountsList"; // *Nota 1
import { CategoriesWidget } from "@/components/dashboard/CategoriesWidget"; // *Nota 1
import { CreateCategoryModal } from "@/components/dashboard/CreateCategoryModal";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";

// Charts
import { FlowChart } from "@/components/ui/charts/FlowChart"; // *Nota 2
import { CategoryBar } from "@/components/ui/charts/CategoryBar";
import { DonutRow } from "@/components/ui/charts/DonutRow";

// Tipos
import { TxForm } from "@/components/transactions/types";

export default function Dashboard() {
  const router = useRouter();

  // 1. Gestión de Sesión (Mantenida simple aquí, idealmente mover a useAuth)
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_e, session) => {
      setSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loadingSession && !session) router.replace("/login");
  }, [loadingSession, session, router]);

  // 2. Data Fetching (Hook Personalizado)
  const {
    cuentas,
    categorias,
    txs,
    loading: loadingData,
    refreshAll
  } = useDashboardData(session?.user?.id, session?.access_token);

  useEffect(() => {
    if (session?.access_token) {
      refreshAll();
    }
  }, [session?.access_token]);
  // 3. Cálculos y Métricas (Hook Personalizado)
  const {
    totals,
    totalSaldo,
    flowByMonth,
    gastosPorCategoria,
    saldoPorTipoCuenta
  } = useFinancialMetrics(txs, cuentas);

  // 4. Estado de UI (Modales y Selección)
  const [modals, setModals] = useState({ tx: false, cat: false });
  const [editingTx, setEditingTx] = useState<TxForm | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Funciones auxiliares para la UI
  const handleEditTx = (tx: any) => {
    setEditingId(tx.id);
    setEditingTx({
      cuentaId: tx.cuentaId,
      monto: Number(tx.monto),
      direccion: tx.direccion,
      descripcion: tx.descripcion ?? "",
      categoriaId: tx.categoria?.id ?? "",
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16)
    });
    setModals({ ...modals, tx: true });
  };

  const handleNewTx = () => {
    setEditingId(null);
    setEditingTx(undefined);
    setModals({ ...modals, tx: true });
  };

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut();
    router.replace("/login");
  };

  // Renderizado Condicional de Carga Inicial
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading message="Cargando sesión..." />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen text-slate-900 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col gap-10">
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">
              Fintu Dashboard
            </p>
            <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">
              Finanzas personales
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {loadingData && (
              <span className="text-xs animate-pulse text-zinc-400">
                Sincronizando...
              </span>
            )}
            <span className="text-sm">{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-xs border px-3 py-1 rounded-full border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              Salir
            </button>
          </div>
        </header>

        {/* SECCIÓN SUPERIOR: WIDGETS PRINCIPALES */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 1. Cuentas */}
          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
            {/* Nota: Puedes mover todo este div interno a AccountsList.tsx para limpiar más */}
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Cuentas</h2>
              <span className="text-sm text-zinc-400">Total: {totalSaldo}</span>
            </div>
            <AccountsList cuentas={cuentas} loading={loadingData} />
          </div>

          {/* 2. Categorías */}
          <div className="flex flex-col h-full rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
            {/* Cabecera */}
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Categorías</h2>
            </div>

            {/* Contenido: flex-1 empuja el botón hacia abajo si la tarjeta se estira */}
            <div className="flex-1">
              <CategoriesWidget categorias={categorias} loading={loadingData} />
            </div>

            {/* Botón siempre al final */}
            <button
              onClick={() => setModals({ ...modals, cat: true })}
              className="mt-4 w-full rounded-full bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Nueva categoría
            </button>
          </div>

          {/* 3. Resumen Financiero */}
          <SummaryWidget
            ingresos={totals.ingresos}
            egresos={totals.egresos}
            neto={totals.neto}
            onNewTransaction={handleNewTx}
          />
        </section>

        {/* SECCIÓN MEDIA: GRÁFICAS */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Flujo */}
          <div className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold">Flujo mensual</h3>
            <FlowChart data={flowByMonth} />
          </div>

          {/* Gastos */}
          <div className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold">Top Gastos</h3>
            <div className="space-y-3">
              {gastosPorCategoria.map((cat) => (
                <CategoryBar
                  key={cat.nombre}
                  label={cat.nombre}
                  value={cat.total}
                  maxValue={gastosPorCategoria[0]?.total || 1}
                  color={cat.color || "#333"}
                />
              ))}
              {gastosPorCategoria.length === 0 && (
                <p className="text-sm text-zinc-400">Sin datos</p>
              )}
            </div>
          </div>

          {/* Saldo por Tipo */}
          <div className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold">Por tipo de cuenta</h3>
            <div className="space-y-3">
              {saldoPorTipoCuenta.map((item) => (
                <DonutRow
                  key={item.nombre}
                  label={item.nombre}
                  value={item.total}
                  total={totalSaldo || 1}
                />
              ))}
            </div>
          </div>
        </section>

        {/* SECCIÓN INFERIOR: TRANSACCIONES */}
        <section className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
          <h2 className="text-xl font-semibold mb-4">Últimas Transacciones</h2>
          <div className="flex flex-col gap-3">
            {txs.map((tx) => (
              <TransactionListItem
                key={tx.id}
                tx={tx}
                onEdit={() => handleEditTx(tx)}
                // onDelete se maneja dentro del modal ahora, o puedes pasarlo aquí si el item tiene botón borrar directo
              />
            ))}
            {txs.length === 0 && (
              <p className="text-zinc-400">No hay movimientos recientes.</p>
            )}
          </div>
        </section>
      </div>

      {/* MODALES FLOTANTES */}
      <CreateCategoryModal
        open={modals.cat}
        onClose={() => setModals({ ...modals, cat: false })}
        onSuccess={refreshAll}
        accessToken={session.access_token}
      />

      <TransactionModal
        open={modals.tx}
        onClose={() => setModals({ ...modals, tx: false })}
        onSuccess={refreshAll}
        cuentas={cuentas}
        categorias={categorias}
        accessToken={session.access_token}
        initialData={editingTx}
        editingId={editingId}
      />
    </div>
  );
}
