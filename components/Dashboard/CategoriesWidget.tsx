import { Categoria } from "@/components/transactions/types";
import { Loading } from "@/components/ui/Loading";

interface CategoriesWidgetProps {
  categorias: Categoria[];
  loading: boolean;
}

export function CategoriesWidget({
  categorias,
  loading
}: CategoriesWidgetProps) {
  return (
    <div className="flex flex-col h-full justify-between">
      {/* Contenido Principal */}
      <div>
        {/* Estado de Carga */}
        {loading && categorias.length === 0 && (
          <div className="py-4">
            <Loading message="Cargando etiquetas..." />
          </div>
        )}

        {/* Estado Vacío */}
        {!loading && categorias.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center dark:border-white/10">
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Sin categorías definidas.
            </p>
          </div>
        )}

        {/* Lista de Categorías (Badges) */}
        <div className="flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-transform hover:scale-105"
              style={{
                // Usamos el color de la BD con opacidad para el fondo, y sólido para el texto/borde
                backgroundColor: cat.color
                  ? `${cat.color}20`
                  : "rgba(255,255,255,0.1)",
                color: cat.color || "#e4e4e7", // zinc-200 default
                boxShadow: cat.color ? `0 0 8px ${cat.color}15` : "none",
                borderColor: cat.color ? `${cat.color}40` : "transparent"
              }}
            >
              {cat.nombre}
              <span className="ml-1 opacity-50 text-[10px] uppercase">
                {cat.tipo.substring(0, 1)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
