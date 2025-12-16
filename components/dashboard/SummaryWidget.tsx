import { StatCard } from "@/components/ui/charts/StatCard";
import { X } from "lucide-react";
import type { Categoria, Cuenta } from "@/components/transactions/types";

interface SummaryProps {
  ingresos: number;
  egresos: number;
  neto: number;
  cuentas: Cuenta[];
  categorias: Categoria[];
  filters: {
    type: string;
    accountId: string;
    categoryId: string;
    dateStart: string;
    dateEnd: string;
  };
  setFilters: (filters: any) => void;
  onNewTransaction: () => void;
}

export function SummaryWidget({ 
  ingresos, 
  egresos, 
  neto, 
  cuentas, 
  categorias, 
  filters, 
  setFilters,
  onNewTransaction 
}: SummaryProps) {

  const handleChange = (key: string, value: string) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: "NORMAL", // Volvemos al defecto
      accountId: "",
      categoryId: "",
      dateStart: "",
      dateEnd: ""
    });
  };

  const hasFilters = filters.accountId || filters.categoryId || filters.dateStart || filters.dateEnd || filters.type !== "NORMAL";

  return (
    <div className="rounded-2xl border border-slate-500/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5 transition-all">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resumen</h2>
        {hasFilters && (
          <button 
            onClick={clearFilters}
            className="text-xs flex items-center gap-1 text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-md transition-colors"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* BARRA DE FILTROS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 animate-in fade-in slide-in-from-top-2">
        
        {/* FILTRO TIPO: Aquí agregamos la opción AJUSTE */}
        <select
          value={filters.type}
          onChange={(e) => handleChange("type", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-zinc-300 font-medium"
        >
          <option value="NORMAL">Normal (Ingresos/Gastos)</option>
          <option value="TRANSFERENCIA">Transferencias</option>
          <option value="AJUSTE">Ajustes de Saldo</option>
          <option value="ALL">Mostrar Todo</option>
        </select>

        <select
          value={filters.accountId}
          onChange={(e) => handleChange("accountId", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-zinc-300"
        >
          <option value="">Todas las Cuentas</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <select
          value={filters.categoryId}
          onChange={(e) => handleChange("categoryId", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-zinc-300"
        >
          <option value="">Todas las Categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <div className="flex gap-1">
             <input 
                type="date" 
                value={filters.dateStart}
                onChange={(e) => handleChange("dateStart", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1 py-1.5 text-[10px] text-slate-700 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-zinc-300"
             />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <StatCard label="Ingresos" value={ingresos} colorClass="text-emerald-500 bg-emerald-500/10" />
        <StatCard label="Egresos" value={egresos} colorClass="text-rose-500 bg-rose-500/10" />
        <StatCard label="Neto" value={neto} colorClass="text-sky-500 bg-sky-500/10" />
      </div>

      <button
        onClick={onNewTransaction}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        Nueva transacción
      </button>
    </div>
  );
}