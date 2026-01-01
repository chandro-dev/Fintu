"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

import { useAppData } from "@/components/AppDataProvider";
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";
import { formatMoney } from "@/lib/formatMoney";

import { Loading } from "@/components/ui/Loading";
import { SummaryWidget } from "@/components/dashboard/SummaryWidget";
import { AccountsList } from "@/components/dashboard/AccountsList";
import { CategoriesWidget } from "@/components/dashboard/CategoriesWidget";
import { CreateCategoryModal } from "@/components/dashboard/CreateCategoryModal";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";

import { FlowChart } from "@/components/ui/charts/FlowChart";
import { CategoryBar } from "@/components/ui/charts/CategoryBar";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import { DonutRow } from "@/components/ui/charts/DonutRow";
import { MoneyFlowDiagram } from "@/components/ui/charts/MoneyFlowDiagram";

import { Cuenta, TxForm } from "@/components/transactions/types";

const CODIGO_TIPO_CUENTA_NORMAL = "NORMAL";

export default function Dashboard() {
  const router = useRouter();
  type ModuleKey = "overview" | "health" | "charts" | "transactions";

  const {
    session,
    loadingSession,
    loadingData,
    cuentas,
    categorias,
    transacciones,
    refresh,
  } = useAppData();

  const [filters, setFilters] = useState({
    type: "NORMAL",
    accountIds: [] as string[],
    categoryIds: [] as string[],
    dateStart: "",
    dateEnd: "",
  });

  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const cuentasNormales = useMemo<Cuenta[]>(
    () =>
      (cuentas as Cuenta[]).filter((c) => {
        return c?.tipoCuenta?.codigo === CODIGO_TIPO_CUENTA_NORMAL && !c?.cerradaEn;
      }),
    [cuentas],
  );

  const allAccountIds = useMemo(() => cuentasNormales.map((c) => c.id), [cuentasNormales]);

  const selectedAccountIds = useMemo(() => filters.accountIds ?? [], [filters.accountIds]);
  const selectedAccountIdSet = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);
  const selectedCategoryIds = useMemo(() => filters.categoryIds ?? [], [filters.categoryIds]);

  const defaultModules: ModuleKey[] = ["overview", "health", "charts", "transactions"];
  const storageKey = useMemo(
    () => (session?.user?.id ? `dashboard:modules:v1:${session.user.id}` : null),
    [session?.user?.id],
  );
  const [modulesOrder, setModulesOrder] = useState<ModuleKey[]>(defaultModules);
  const [hiddenModules, setHiddenModules] = useState<ModuleKey[]>([]);
  const [modulesHydrated, setModulesHydrated] = useState(false);

  const setAccountSelection = (ids: string[]) => {
    const next = Array.from(new Set(ids));
    const normalized = next.length === 0 ? allAccountIds : next;
    setFilters((p: any) => ({ ...p, accountIds: normalized }));
  };

  const handleCategorySelect = (ids: string[]) => {
    setFilters((p: any) => ({ ...p, categoryIds: ids }));
  };

  useEffect(() => {
    if (!cuentasNormales.length) return;

    try {
      const raw = localStorage.getItem("dashboard:filters:v1");
      if (raw) return;
    } catch {}

    setFilters((prev) => ({
      ...prev,
      accountIds: allAccountIds,
    }));
  }, [cuentasNormales, allAccountIds]);

  useEffect(() => {
    if (!filtersHydrated) return;
    if (!allAccountIds.length) return;
    if ((filters.accountIds?.length ?? 0) > 0) return;
    setFilters((p: any) => ({ ...p, accountIds: allAccountIds }));
  }, [filtersHydrated, allAccountIds, filters.accountIds]);

  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      localStorage.setItem("dashboard:filters:v1", JSON.stringify(filters));
    } catch {}
  }, [filters, filtersHydrated]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashboard:filters:v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setFilters((prev) => ({
            ...prev,
            ...parsed,
          }));
        }
      }
    } catch {}
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/login");
    }
  }, [loadingSession, session, router]);

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
    setModulesHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!modulesHydrated || !storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ order: modulesOrder, hidden: hiddenModules }),
      );
    } catch {}
  }, [modulesOrder, hiddenModules, modulesHydrated, storageKey]);

  const filteredTransactions = useMemo(() => {
    const allowedAccountIds =
      filters.accountIds?.length > 0
        ? new Set(filters.accountIds)
        : new Set(cuentasNormales.map((c: any) => c.id));

    const allowedCategoryIds =
      filters.categoryIds?.length > 0 ? new Set(filters.categoryIds) : null;

    return transacciones.filter((tx: any) => {
      let txType = "NORMAL";

      const codigoTipo = tx?.tipoTransaccion?.codigo;
      if (codigoTipo) txType = codigoTipo;
      else if (tx.transaccionRelacionadaId) txType = "TRANSFERENCIA";
      else if (tx.descripcion?.toLowerCase?.().includes("ajuste")) txType = "AJUSTE";

      if (filters.type !== "ALL" && filters.type !== txType) {
        return false;
      }

      if (!allowedAccountIds.has(tx.cuentaId)) return false;

      if (allowedCategoryIds && !allowedCategoryIds.has(tx.categoria?.id)) return false;

      if (filters.dateStart) {
        const txDate = new Date(tx.ocurrioEn);
        const startDate = new Date(filters.dateStart);
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
  }, [transacciones, filters, cuentasNormales]);

  const selectedCategoryId = selectedCategoryIds[0] ?? null;

  const transferenciasPorCategoria = useMemo(() => {
    if (!selectedCategoryId) return [];
    const selectedSet = new Set(selectedCategoryIds);
    return transacciones
      .filter((tx: any) => {
        const matchesCategory =
          selectedSet.has(tx.categoria?.id) ||
          (Array.isArray(tx.categoriasPivot) &&
            tx.categoriasPivot.some((p: any) => selectedSet.has(p.categoriaId)));
        if (!matchesCategory) return false;
        const codigoTipo = tx?.tipoTransaccion?.codigo;
        const isTransfer = Boolean(tx.transaccionRelacionadaId) || codigoTipo === "TRANSFERENCIA";
        return isTransfer;
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.ocurrioEn).getTime() - new Date(a.ocurrioEn).getTime(),
      )
      .slice(0, 5);
  }, [selectedCategoryId, selectedCategoryIds, transacciones]);

  const flowSnapshot = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    let transferIn = 0;
    let transferOut = 0;
    let ajustes = 0;

    filteredTransactions.forEach((tx: any) => {
      const amount = Math.abs(Number(tx.monto ?? 0));
      const signed = tx.direccion === "SALIDA" ? -amount : amount;
      const codigoTipo = tx?.tipoTransaccion?.codigo;
      const isTransfer = Boolean(tx.transaccionRelacionadaId) || codigoTipo === "TRANSFERENCIA";
      const isAdjustment = tx.descripcion?.toLowerCase?.().includes("ajuste");

      if (isTransfer) {
        if (tx.direccion === "SALIDA") transferOut += amount;
        else transferIn += amount;
      } else if (isAdjustment) {
        ajustes += signed;
      } else if (tx.direccion === "SALIDA") {
        gastos += amount;
      } else {
        ingresos += amount;
      }
    });

    const neto = ingresos - gastos + transferIn - transferOut + ajustes;

    return { ingresos, gastos, transferIn, transferOut, ajustes, neto };
  }, [filteredTransactions]);

  const { totals, totalSaldo, flowByMonth, gastosPorCategoria, health } =
    useFinancialMetrics(filteredTransactions, cuentasNormales);

  const saldoPorCuentaSeleccionada = useMemo(() => {
    const ids =
      filters.accountIds?.length > 0
        ? new Set(filters.accountIds)
        : new Set(cuentasNormales.map((c: any) => c.id));

    return cuentasNormales
      .filter((c: any) => ids.has(c.id))
      .map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        totalAbs: Math.abs(Number(c.saldo ?? 0)),
      }))
      .sort((a: any, b: any) => b.totalAbs - a.totalAbs)
      .slice(0, 6);
  }, [cuentasNormales, filters.accountIds]);

  const totalSaldoAbsSeleccionado = useMemo(
    () =>
      saldoPorCuentaSeleccionada.reduce(
        (acc: number, i: any) => acc + Number(i.totalAbs || 0),
        0,
      ) || 1,
    [saldoPorCuentaSeleccionada],
  );

  const assetsVsDebtSegments = useMemo(
    () => [
      { label: "Activos", value: Math.max(0, Number(health?.activos ?? 0)), color: "#22c55e" },
      { label: "Pasivos", value: Math.max(0, Number(health?.pasivos ?? 0)), color: "#ef4444" },
    ].filter((s) => s.value > 0),
    [health?.activos, health?.pasivos],
  );

  const breakdownPorTipo = useMemo(() => {
    const items = health?.porTipo ?? [];
    const max = items.reduce((acc, item) => Math.max(acc, Math.abs(item.total)), 0) || 1;
    return { items, max };
  }, [health?.porTipo]);

  const savingsRateStr = useMemo(
    () => (health?.savingsRate != null ? `${(health.savingsRate * 100).toFixed(1)}%` : "-"),
    [health?.savingsRate],
  );
  const liquidityStr = useMemo(
    () => (health?.liquidez != null ? `${health.liquidez.toFixed(2)}x` : "-"),
    [health?.liquidez],
  );
  const runwayStr = useMemo(
    () => (health?.runwayMeses != null ? `${health.runwayMeses.toFixed(1)} meses` : "-"),
    [health?.runwayMeses],
  );

  const toggleModule = (key: ModuleKey) => {
    setHiddenModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const moveModule = (key: ModuleKey, direction: "up" | "down") => {
    setModulesOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const isVisible = (key: ModuleKey) => !hiddenModules.includes(key);

  const [modals, setModals] = useState({ tx: false, cat: false });
  const [editingTx, setEditingTx] = useState<TxForm | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEditTx = (tx: any) => {
    setEditingId(tx.id);
    const categoriaIds = Array.isArray(tx.categoriasPivot)
      ? tx.categoriasPivot.map((p: any) => p.categoriaId).filter(Boolean)
      : [];

    setEditingTx({
      cuentaId: tx.cuentaId,
      monto: Number(tx.monto),
      direccion: tx.direccion,
      descripcion: tx.descripcion ?? "",
      categoriaId: tx.categoria?.id ?? "",
      categoriaIds:
        categoriaIds.length > 0 ? categoriaIds : tx.categoria?.id ? [tx.categoria.id] : [],
      ocurrioEn: new Date(tx.ocurrioEn).toISOString().slice(0, 16),
      isTransferencia: Boolean(tx.transaccionRelacionadaId),
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
        <Loading message="Cargando sesion..." />
      </div>
    );
  }

  if (!session) return null;

  const saldoNum = cuentasNormales
    .filter((c) => selectedAccountIdSet.has(c.id))
    .reduce((acc, c) => acc + Number(c.saldo ?? 0), 0);
  const saldoColorClass =
    saldoNum >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10";

  const moduleBlocks: Record<ModuleKey, JSX.Element> = {
    overview: (
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-500/80 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="text-xl font-semibold">Cuentas</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                {selectedAccountIds.length}/{cuentasNormales.length}
              </span>
              <span
                className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${saldoColorClass}`}
              >
                {formatMoney(saldoNum)}
              </span>
            </div>
          </div>
          <AccountsList
            cuentas={cuentasNormales}
            loading={loadingData}
            selectedAccountIds={selectedAccountIds}
            onToggleSelect={(accountId) => {
              const next = new Set(selectedAccountIds);
              if (next.has(accountId)) next.delete(accountId);
              else next.add(accountId);
              setAccountSelection(Array.from(next));
            }}
          />
        </div>

        <div className="flex flex-col h-full rounded-2xl border border-slate-500/80 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-semibold">Categorias</h2>
          </div>
          <div className="flex-1">
            <CategoriesWidget
              categorias={categorias}
              loading={loadingData}
              selectedIds={selectedCategoryIds}
              onSelect={handleCategorySelect}
            />
          </div>
          <button
            onClick={() => setModals({ ...modals, cat: true })}
            className="mt-4 w-full rounded-full bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
          >
            Nueva categoria
          </button>
        </div>

        <SummaryWidget
          ingresos={totals.ingresos}
          egresos={totals.egresos}
          neto={totals.neto}
          cuentas={cuentasNormales}
          categorias={categorias}
          filters={filters}
          setFilters={setFilters}
          onNewTransaction={handleNewTx}
        />
      </section>
    ),
    health: (
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white">Salud financiera</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Activos, pasivos y resiliencia</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              Patrimonio {formatMoney(health?.patrimonio ?? 0)}
            </span>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <DonutChart
                segments={assetsVsDebtSegments}
                centerLabel="Patrimonio"
                centerValue={formatMoney(health?.patrimonio ?? 0)}
              />
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-sm text-slate-500 dark:text-zinc-400">Activos</p>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
                  {formatMoney(health?.activos ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-sm text-slate-500 dark:text-zinc-400">Pasivos</p>
                <p className="text-2xl font-semibold text-rose-600 dark:text-rose-300">
                  {formatMoney(health?.pasivos ?? 0)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/70 bg-white/60 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-slate-500 dark:text-zinc-400">Liquidez</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">{liquidityStr}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Efectivo / deuda de corto plazo</p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/60 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-slate-500 dark:text-zinc-400">Tasa de ahorro</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">{savingsRateStr}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Sobre ingresos filtrados</p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/60 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-slate-500 dark:text-zinc-400">Runway</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">{runwayStr}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Meses de gasto promedio</p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/60 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-slate-500 dark:text-zinc-400">Gasto prom. mes</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">
                    {formatMoney(health?.egresoPromedioMensual ?? 0)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Promedio ultimos meses</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
          <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Desglose por tipo de cuenta
          </h3>
          <div className="space-y-3">
            {breakdownPorTipo.items.map((item) => (
              <CategoryBar
                key={item.nombre}
                label={item.nombre}
                value={Math.abs(item.total)}
                maxValue={breakdownPorTipo.max}
                color={item.tipo === "pasivo" ? "#ef4444" : "#22c55e"}
              />
            ))}
            {breakdownPorTipo.items.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-zinc-400">Sin cuentas para mostrar.</p>
            )}
          </div>
        </div>
      </section>
    ),
    charts: (
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Flujo mensual</h3>
          <FlowChart data={flowByMonth} />
        </div>

        <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
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

        <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Saldos (cuentas)</h3>
          <div className="space-y-3">
            {saldoPorCuentaSeleccionada.map((item: any) => (
              <DonutRow
                key={item.id}
                label={item.nombre}
                value={item.totalAbs}
                total={totalSaldoAbsSeleccionado}
              />
            ))}
            {saldoPorCuentaSeleccionada.length === 0 && (
              <p className="text-sm text-zinc-400 py-4 text-center">Sin saldos</p>
            )}
          </div>
        </div>
      </section>
    ),
    transactions: (
      <>
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  Ultimas transferencias
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Filtradas por la categoria seleccionada
                </p>
              </div>
              {selectedCategoryId && (
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                  {selectedCategoryIds.length} categoria activa
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {selectedCategoryId ? (
                transferenciasPorCategoria.length > 0 ? (
                  transferenciasPorCategoria.map((tx) => (
                    <TransactionListItem key={tx.id} tx={tx} onEdit={() => handleEditTx(tx)} />
                  ))
                ) : (
                  <p className="text-sm text-zinc-400 py-6 text-center border border-dashed rounded-xl">
                    No hay transferencias recientes en esta categoria.
                  </p>
                )
              ) : (
                <p className="text-sm text-zinc-400 py-6 text-center border border-dashed rounded-xl">
                  Selecciona una categoria para ver sus transferencias.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Que pasa con tu dinero</h3>
              <span className="text-[11px] rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-white/10 dark:text-zinc-200">
                Datos con filtros activos
              </span>
            </div>
            <MoneyFlowDiagram data={flowSnapshot} />
          </div>
        </section>

        <section className="rounded-2xl border bg-white/80 p-4 shadow dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Transacciones ({filteredTransactions.length})</h2>
            <button
              onClick={() => router.push("/transacciones")}
              className="text-xs text-sky-500 hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {filteredTransactions.slice(0, 10).map((tx) => (
              <TransactionListItem key={tx.id} tx={tx} onEdit={() => handleEditTx(tx)} />
            ))}
            {filteredTransactions.length === 0 && !loadingData && (
              <p className="text-zinc-400 py-4 text-center border border-dashed rounded-lg">
                No hay transacciones con los filtros actuales.
              </p>
            )}
            {loadingData && filteredTransactions.length === 0 && (
              <p className="text-zinc-400 py-4 text-center">Cargando movimientos...</p>
            )}
          </div>
        </section>
      </>
    ),
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-10 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300 font-bold">
              Fintu Dashboard
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
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
            <Link
              href="/dashboard/config"
              className="text-xs border px-3 py-1 rounded-full border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Configurar
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs border px-3 py-1 rounded-full border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {modulesOrder.map((key) => (isVisible(key) ? <div key={key}>{moduleBlocks[key]}</div> : null))}
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
        cuentas={cuentasNormales}
        categorias={categorias}
        accessToken={session.access_token}
        initialData={editingTx}
        editingId={editingId}
      />
    </div>
  );
}
