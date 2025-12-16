"use client";

import { useMemo } from "react";
import { Categoria } from "@/components/transactions/types";
import { Loading } from "@/components/ui/Loading";
import { TrendingDown, TrendingUp, Tag } from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge"; // <--- IMPORTAMOS EL COMPONENTE REUTILIZABLE

interface CategoriesWidgetProps {
  categorias: Categoria[];
  loading: boolean;
}

export function CategoriesWidget({
  categorias,
  loading
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
                <CategoryBadge key={cat.id} category={cat} size="md" />
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
                <CategoryBadge key={cat.id} category={cat} size="md" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}