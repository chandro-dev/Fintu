import { StatCard } from "@/components/ui/charts/StatCard";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Categoria, Cuenta } from "@/components/transactions/types";
import { useMemo, useState } from "react";
import { CategoryIcon } from "@/lib/categoryIcons";

interface SummaryProps {
  ingresos: number;
  egresos: number;
  neto: number;
  cuentas: Cuenta[];
  categorias: Categoria[];
  filters: {
    type: string;
    accountIds: string[];
    categoryIds: string[];
    dateStart: string;
    dateEnd: string;
  };
  setFilters: (filters: any) => void;
  onNewTransaction: () => void;
}

function Chip({
  label,
  onRemove,
  iconName,
}: {
  label: string;
  onRemove: () => void;
  iconName?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
      {iconName ? (
        <CategoryIcon name={iconName} size={14} className="text-slate-500 dark:text-zinc-300" />
      ) : null}
      <span className="max-w-[140px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label={`Quitar ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

function MultiSelect({
  label,
  items,
  selectedIds,
  onChange,
  emptyLabel = "Todas",
}: {
  label: string;
  items: { id: string; label: string; subLabel?: string; iconName?: string | null }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const haystack = `${i.label} ${i.subLabel ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const allIds = useMemo(() => items.map((i) => i.id), [items]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className="relative">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-sky-400/40 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
      >
        <span className="truncate">
          {selectedIds.length === 0
            ? emptyLabel
            : `${selectedIds.length} seleccionado(s)`}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {items
            .filter((i) => selected.has(i.id))
            .slice(0, 6)
            .map((i) => (
              <Chip
                key={i.id}
                label={i.label}
                iconName={i.iconName}
                onRemove={() => toggle(i.id)}
              />
            ))}
          {selectedIds.length > 6 && (
            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
              +{selectedIds.length - 6} más
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
          <div className="border-b border-slate-100 p-3 dark:border-white/10">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-black/30">
              <Search size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400 dark:text-zinc-200"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onChange(allIds)}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200"
              >
                Seleccionar todo
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                Listo
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto p-2">
            {filteredItems.map((i) => {
              const isSelected = selected.has(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggle(i.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                      : "hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                      isSelected
                        ? "border-sky-400 bg-sky-500 text-white"
                        : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-black/20"
                    }`}
                  >
                    <Check size={14} />
                  </span>
                  {i.iconName ? (
                    <CategoryIcon
                      name={i.iconName}
                      size={16}
                      className={isSelected ? "text-sky-600 dark:text-sky-300" : "text-slate-500 dark:text-zinc-300"}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{i.label}</p>
                    {i.subLabel && (
                      <p className="truncate text-[11px] text-slate-400 dark:text-zinc-500">
                        {i.subLabel}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                Sin resultados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
      accountIds: [],
      categoryIds: [],
      dateStart: "",
      dateEnd: ""
    });
  };

  const cuentasItems = useMemo(
    () =>
      cuentas.map((c) => ({
        id: c.id,
        label: c.nombre,
        subLabel: c.tipoCuenta?.nombre ?? "",
      })),
    [cuentas],
  );

  const categoriasItems = useMemo(
    () =>
      categorias.map((c) => ({
        id: c.id,
        label: c.nombre,
        subLabel: c.tipo,
        iconName: c.icono ?? null,
      })),
    [categorias],
  );

  const hasAccountFilter =
    (filters.accountIds?.length ?? 0) > 0 &&
    (filters.accountIds?.length ?? 0) !== cuentasItems.length;
  const hasCategoryFilter =
    (filters.categoryIds?.length ?? 0) > 0 &&
    (filters.categoryIds?.length ?? 0) !== categoriasItems.length;

  const hasFilters =
    hasAccountFilter ||
    hasCategoryFilter ||
    Boolean(filters.dateStart) ||
    Boolean(filters.dateEnd) ||
    filters.type !== "NORMAL";

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

      {/* FILTROS PRO */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { k: "NORMAL", label: "Normal" },
            { k: "TRANSFERENCIA", label: "Transfer." },
            { k: "AJUSTE", label: "Ajustes" },
            { k: "ALL", label: "Todo" },
          ].map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => handleChange("type", t.k)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                filters.type === t.k
                  ? "border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-300"
                  : "border-slate-200 bg-white/70 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300 dark:hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <MultiSelect
            label="Cuentas incluidas"
            items={cuentasItems}
            selectedIds={filters.accountIds ?? []}
            onChange={(ids) => setFilters((p: any) => ({ ...p, accountIds: ids }))}
            emptyLabel="Todas las cuentas"
          />
          <MultiSelect
            label="Categorías incluidas"
            items={categoriasItems}
            selectedIds={filters.categoryIds ?? []}
            onChange={(ids) => setFilters((p: any) => ({ ...p, categoryIds: ids }))}
            emptyLabel="Todas las categorías"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Desde
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => handleChange("dateStart", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Hasta
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => handleChange("dateEnd", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
            />
          </label>
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
