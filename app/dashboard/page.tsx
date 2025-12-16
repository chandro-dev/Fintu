"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

// Contexto y Hooks
import { useAppData } from "@/components/AppDataProvider"; 
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";
import { formatMoney } from "@/lib/formatMoney";

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

  const {
    session,
    loadingSession,
    loadingData,
    cuentas,
    categorias,
    transacciones,
    refresh
  } = useAppData();

  // --- FILTROS ---
  const [filters, setFilters] = useState({
    type: "NORMAL", // Por defecto solo mostramos normales
    accountId: "",
    categoryId: "",
    dateStart: "",
    dateEnd: ""
  });

  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/login");
    }
  }, [loadingSession, session, router]);

  // --- LÓGICA DE FILTRADO INTELIGENTE (3 TIPOS) ---
  const filteredTransactions = useMemo(() => {
    return transacciones.filter(tx => {
      
      // 1. DETERMINAR EL TIPO REAL DE LA TRANSACCIÓN
      let txType = "NORMAL";
      
      if (tx.transaccionRelacionadaId) {
        txType = "TRANSFERENCIA";
      } else if (tx.descripcion === "Ajuste manual de saldo") {
        // Identificamos Ajustes por su descripción (según tu implementación anterior)
        txType = "AJUSTE";
      }

      // 2. APLICAR FILTRO DE TIPO
      if (filters.type !== "ALL" && filters.type !== txType) {
        return false;
      }

      // 3. Filtro por Cuenta
      if (filters.accountId && tx.cuentaId !== filters.accountId) return false;

      // 4. Filtro por Categoría
      if (filters.categoryId && tx.categoria?.id !== filters.categoryId) return false;

      // 5. Filtro por Fechas
      if (filters.dateStart) {
        const txDate = new Date(tx.ocurrioEn);
        const startDate = new Date(filters.dateStart);
        // Ajuste zona horaria simple
        if (txDate < startDate) return false;
      }
      if (filters.dateEnd) {
        const txDate = new Date(tx.ocurrioEn);
        const endDate = new Date(filters.dateEnd);
        endDate.setHours(23, 59, 59, 999);
        if (txDate > endDate) return false;
      }

      return true;
    });
  }, [transacciones, filters]);

  // Pasamos los datos FILTRADOS a las métricas
  const {
    totals,
    totalSaldo,
    flowByMonth,
    gastosPorCategoria,
    saldoPorTipoCuenta
  } = useFinancialMetrics(filteredTransactions, cuentas);

  // Estados UI
  const [modals, setModals] = useState({ tx: false, cat: false });
  const [editingTx, setEditingTx] = useState<TxForm | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

const handleEditTx = (tx: any) => {
  setEditingId(tx.id);
  
  setEditingTx({
    cuentaId: tx.cuentaId,
    // Asegúrate de enviar el monto como número
    monto: Number(tx.monto), 
    
    // Esto determina si se pone VERDE (Ingreso) o ROJO (Gasto)
    direccion: tx.direccion, 
    
    descripcion: tx.descripcion ?? "",
    categoriaId: tx.categoria?.id ?? "",
    ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16),
    
    // 🔥 ESTO ES LA CLAVE:
    // Si tiene transaccionRelacionadaId, le decimos al form que active el modo TRANSFERENCIA (Azul)
    isTransferencia: Boolean(tx.transaccionRelacionadaId) 
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

        {/* SECCIÓN SUPERIOR */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Cuentas (No afectadas por filtros de transacción, muestran saldo real) */}
          <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
            <div className="flex justify-between mb-4 items-center">
              <h2 className="text-xl font-semibold">Cuentas</h2>
              <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${saldoColorClass}`}>
                {formatMoney(saldoNum)}
              </span>
            </div>
            <AccountsList cuentas={cuentas} loading={loadingData} />
          </div>

          {/* Categorías */}
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

          {/* Resumen (AFECTADO POR FILTROS) */}
          <SummaryWidget
            ingresos={totals.ingresos}
            egresos={totals.egresos}
            neto={totals.neto}
            cuentas={cuentas}
            categorias={categorias}
            filters={filters}
            setFilters={setFilters}
            onNewTransaction={handleNewTx}
          />
        </section>

        {/* GRÁFICAS */}
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
                <p className="text-sm text-zinc-400 py-4 text-center">Sin datos con estos filtros</p>
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

        {/* LISTA DE TRANSACCIONES */}
        <section className="rounded-2xl border bg-white/80 p-6 shadow dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Transacciones ({filteredTransactions.length})
            </h2>
            <button 
              onClick={() => router.push('/transacciones')} 
              className="text-xs text-sky-500 hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {filteredTransactions.slice(0, 10).map((tx) => (
              <TransactionListItem
                key={tx.id}
                tx={tx}
                onEdit={() => handleEditTx(tx)}
              />
            ))}
            {filteredTransactions.length === 0 && !loadingData && (
              <p className="text-zinc-400 py-4 text-center border border-dashed rounded-lg">
                No hay transacciones de tipo {filters.type} con los filtros actuales.
              </p>
            )}
            {loadingData && filteredTransactions.length === 0 && (
               <p className="text-zinc-400 py-4 text-center">Cargando movimientos...</p>
            )}
          </div>
        </section>
      </div>

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