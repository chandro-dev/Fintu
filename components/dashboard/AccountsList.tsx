import Link from "next/link";
import { Cuenta } from "@/components/transactions/types";
import { formatMoney } from "@/lib/formatMoney";
import { Loading } from "@/components/ui/Loading";
import { Check } from "lucide-react";

interface AccountsListProps {
  cuentas: Cuenta[];
  loading: boolean;
  selectedAccountIds?: string[];
  onToggleSelect?: (accountId: string) => void;
}

export function AccountsList({
  cuentas,
  loading,
  selectedAccountIds,
  onToggleSelect,
}: AccountsListProps) {
  // 1. Estado de carga inicial
  if (loading && cuentas.length === 0) {
    return (
      <div className="flex min-h-[100px] items-center justify-center">
        <Loading message="Cargando cuentas..." />
      </div>
    );
  }

  // 2. Estado vacío (sin cuentas)
  if (cuentas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-8 text-center dark:border-white/10">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No tienes cuentas registradas.
        </p>
        <p className="text-xs text-slate-400 dark:text-zinc-500">
          Crea tu primera cuenta para ver el resumen.
        </p>
      </div>
    );
  }

  const selected = new Set(selectedAccountIds ?? []);

  return (
    <div className="grid grid-cols-1 gap-3">
      {cuentas.map((c) => {
        // 1. Extraemos el valor numérico para evaluarlo
        const saldo = Number(c.saldo ?? 0);
        const isNegative = saldo < 0;
        const isSelected = selectedAccountIds ? selected.has(c.id) : false;

        return (
          <Link
            key={c.id}
            href={`/cuentas/${c.id}`}
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
          >
            <div className="flex items-center justify-between">
              {/* Izquierda: Nombre y Tipo */}
              <div className="flex min-w-0 items-center gap-3">
                {onToggleSelect && selectedAccountIds && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleSelect(c.id);
                    }}
                    aria-label={isSelected ? "Quitar cuenta" : "Incluir cuenta"}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isSelected
                        ? "border-sky-400 bg-sky-500 text-white"
                        : "border-slate-300 bg-white text-transparent hover:border-sky-400/60 dark:border-white/20 dark:bg-black/20"
                    }`}
                  >
                    <Check size={14} />
                  </button>
                )}
                <div className="min-w-0">
                <p className="font-semibold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                  {c.nombre}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {c.tipoCuenta?.nombre ?? "Cuenta"}
                </p>
                </div>
              </div>

              {/* Derecha: Saldo y APR */}
              <div className="text-right">
                {/* 2. Lógica condicional de color para el texto */}
                <p
                  className={`font-mono text-lg font-semibold ${
                    isNegative
                      ? "text-rose-600 dark:text-rose-400" // Color para negativo
                      : "text-emerald-600 dark:text-emerald-400" // Color para positivo
                  }`}
                >
                  {formatMoney(saldo, c.moneda)}
                </p>

                {c.tasaApr && Number(c.tasaApr) > 0 && (
                  <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/10 dark:text-zinc-400">
                    {c.tasaApr}% APR
                  </span>
                )}
              </div>
            </div>

            {/* 3. Decoración hover: Azul si es positivo, Rojo si es negativo */}
            <div
              className={`absolute bottom-0 left-0 h-0.5 w-0 transition-all group-hover:w-full ${
                isNegative ? "bg-rose-500" : "bg-indigo-500"
              }`}
            />
          </Link>
        );
      })}
    </div>
  );
}
