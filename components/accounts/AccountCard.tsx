import { Cuenta } from "@/components/transactions/types";
import { formatMoney } from "@/lib/formatMoney";
import { Wallet, CreditCard, Building2 } from "lucide-react";

interface Props {
  cuenta: Cuenta;
  onClick: () => void;
}

export function AccountCard({ cuenta, onClick }: Props) {
  const saldo = Number(cuenta.saldo ?? 0);
  const isNegative = saldo < 0;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          {/* Icono según tipo (puedes expandir esta lógica) */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-400">
            <Wallet size={20} />
          </div>
          
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {cuenta.nombre}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <span className="uppercase tracking-wider">{cuenta.moneda}</span>
              {cuenta.institucion && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building2 size={10} />
                    {cuenta.institucion}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Saldo Disponible
        </p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${
            isNegative ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
        }`}>
          {formatMoney(saldo, cuenta.moneda)}
        </p>
      </div>

      {/* Detalles extra (Límite, fechas) */}
      {(cuenta.limiteCredito || cuenta.diaCorte) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/5 dark:text-zinc-500">
          {cuenta.limiteCredito && (
             <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 dark:bg-white/5">
               <CreditCard size={12} />
               Límite: {formatMoney(Number(cuenta.limiteCredito), cuenta.moneda)}
             </span>
          )}
          {cuenta.diaCorte && (
             <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 dark:bg-white/5">
               Corte: día {cuenta.diaCorte}
             </span>
          )}
        </div>
      )}
      
      {/* Barra decorativa inferior */}
      <div className={`absolute bottom-0 left-0 h-1 w-0 transition-all group-hover:w-full ${
          isNegative ? "bg-rose-500" : "bg-sky-500"
      }`} />
    </div>
  );
}