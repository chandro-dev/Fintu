"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

// 1. Contexto Global
import { useAppData } from "@/components/AppDataProvider"; 
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";

// Utilidades
import { formatMoney } from "@/lib/formatMoney"; // <--- IMPORTANTE: Agregado para formatear

// Componentes UI
import { Loading } from "@/components/ui/Loading";
import { SummaryWidget } from "@/components/dashboard/SummaryWidget";
import { AccountsList } from "@/components/dashboard/AccountsList";
import { CategoriesWidget } from "@/components/dashboard/CategoriesWidget";
import { CreateCategoryModal } from "@/components/dashboard/CreateCategoryModal";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";

// Charts
import { FlowChart } from "@/components/ui/charts/FlowChart";
import { CategoryBar } from "@/components/ui/charts/CategoryBar";
import { DonutRow } from "@/components/ui/charts/DonutRow";

// Tipos
import { TxForm } from "@/components/transactions/types";

export default function Dashboard() {
  const router = useRouter();

  // 2. Datos del Contexto
  const {
    session,
    loadingSession,
    loadingData,
    cuentas,
    categorias,
    transacciones,
    refresh
  } = useAppData();

  // Redirección
  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/login");
    }
  }, [loadingSession, session, router]);

  // 3. Métricas
  const {
    totals,
    totalSaldo, // Este suele ser un number
    flowByMonth,
    gastosPorCategoria,
    saldoPorTipoCuenta
  } = useFinancialMetrics(transacciones, cuentas);

  // 4. UI State
  const [modals, setModals] = useState({ tx: false, cat: false });
  const [editingTx, setEditingTx] = useState<TxForm | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading message="Cargando sesión..." />
      </div>
    );
  }

  if (!session) return null;

  // Lógica de color para el saldo total
  const saldoNum = Number(totalSaldo || 0);
  const saldoColorClass = saldoNum >= 0 
    ? "text-emerald-500 bg-emerald-500/10" 
    : "text-rose-500 bg-rose-500/10";

  return (
    <div className="min-h-screen text-slate-900 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col gap-10">
        
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300 font-bold">
              Fintu Dashboard
            </p>
            <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">
              Finanzas personales
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {loadingData && (
              <span className="flex items-center gap-2 text-xs text-sky-500 animate-pulse bg-sky-500/10 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-sky-500 rounded-full animate-ping"></span>
                Sincronizando...
              </span>
            )}
            <span className="text-sm font-medium hidden sm:block">{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-xs border px-3 py-1 rounded-full border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {/* SECCIÓN SUPERIOR: WIDGETS PRINCIPALES */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* 1. CUENTAS (CORREGIDO) */}
          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
            <div className="flex justify-between mb-4 items-center">
              <h2 className="text-xl font-semibold">Cuentas</h2>
              {/* Aquí aplicamos el formato y el color dinámico */}
              <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${saldoColorClass}`}>
                {formatMoney(saldoNum)}
              </span>
            </div>
            <AccountsList cuentas={cuentas} loading={loadingData} />
          </div>

          {/* 2. Categorías */}
          <div className="flex flex-col h-full rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Categorías</h2>
            </div>
            <div className="flex-1">
              <CategoriesWidget categorias={categorias} loading={loadingData} />
            </div>
            <button
              onClick={() => setModals({ ...modals, cat: true })}
              className="mt-4 w-full rounded-full bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
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
          <div className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Flujo mensual</h3>
            <FlowChart data={flowByMonth} />
          </div>

          <div className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Top Gastos</h3>
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
                <p className="text-sm text-zinc-400 py-4 text-center">Sin gastos registrados</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Por tipo de cuenta</h3>
            <div className="space-y-3">
              {saldoPorTipoCuenta.map((item) => (
                <DonutRow
                  key={item.nombre}
                  label={item.nombre}
                  value={item.total}
                  total={totals.ingresos - totals.egresos || totalSaldo || 1}
                />
              ))}
              {saldoPorTipoCuenta.length === 0 && (
                <p className="text-sm text-zinc-400 py-4 text-center">Sin saldos</p>
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN INFERIOR: TRANSACCIONES */}
        <section className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Últimas Transacciones</h2>
            <button 
              onClick={() => router.push('/transacciones')} 
              className="text-xs text-sky-500 hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {transacciones.slice(0, 5).map((tx) => (
              <TransactionListItem
                key={tx.id}
                tx={tx}
                onEdit={() => handleEditTx(tx)}
              />
            ))}
            {transacciones.length === 0 && !loadingData && (
              <p className="text-zinc-400 py-4 text-center border border-dashed rounded-lg">No hay movimientos recientes.</p>
            )}
            {loadingData && transacciones.length === 0 && (
               <p className="text-zinc-400 py-4 text-center">Cargando movimientos...</p>
            )}
          </div>
        </section>
      </div>

      {/* MODALES FLOTANTES */}
      <CreateCategoryModal
        open={modals.cat}
        onClose={() => setModals({ ...modals, cat: false })}
        onSuccess={() => refresh({ force: true })}
        accessToken={session.access_token}
      />

      <TransactionModal
        open={modals.tx}
        onClose={() => setModals({ ...modals, tx: false })}
        onSuccess={() => refresh({ force: true })}
        cuentas={cuentas}
        categorias={categorias}
        accessToken={session.access_token}
        initialData={editingTx}
        editingId={editingId}
      />
    </div>
  );
}