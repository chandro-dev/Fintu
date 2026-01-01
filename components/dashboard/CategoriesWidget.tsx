"use client";

import { useMemo } from "react";
import { Categoria } from "@/components/transactions/types";
import { Loading } from "@/components/ui/Loading";
import { TrendingDown, TrendingUp, Tag, X } from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

interface CategoriesWidgetProps {
  categorias: Categoria[];
  loading: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
}

export function CategoriesWidget({
  categorias,
  loading,
  selectedIds = [],
  onSelect,
}: CategoriesWidgetProps) {
  
  const { gastos, ingresos } = useMemo(() => {
    return {
      gastos: categorias.filter((c) => c.tipo === "GASTO"),
      ingresos: categorias.filter((c) => c.tipo === "INGRESO"),
    };
  }, [categorias]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-10">
        <Loading message="Cargando..." />
      </div>
    );
  }

  if (!loading && categorias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[150px] border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center">
        <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-full mb-3">
            <Tag className="text-slate-300 dark:text-zinc-600" size={24} />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          Sin categorías.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {onSelect && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-xs shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
            <span className="font-semibold text-slate-700 dark:text-white">Selecciona una categoría</span>
            {selectedIds.length > 0 && (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-600 dark:text-sky-300">
                {selectedIds.length} activa
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect([])}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            <X size={12} />
            Limpiar
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
        
        {/* SECCIÓN GASTOS */}
        {gastos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-rose-500/80">
              <TrendingDown size={12} />
              <span>Gastos ({gastos.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gastos.map((cat) => (
                <CategoryBadge
                  key={cat.id}
                  category={cat}
                  size="md"
                  onClick={onSelect ? () => onSelect([cat.id]) : undefined}
                  active={selectedIds.includes(cat.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN INGRESOS */}
        {ingresos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">
              <TrendingUp size={12} />
              <span>Ingresos ({ingresos.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ingresos.map((cat) => (
                <CategoryBadge
                  key={cat.id}
                  category={cat}
                  size="md"
                  onClick={onSelect ? () => onSelect([cat.id]) : undefined}
                  active={selectedIds.includes(cat.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
