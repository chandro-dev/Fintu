"use client";

import { formatMoney } from "@/lib/formatMoney";
import { Calendar, PackageOpen, ArrowRight } from "lucide-react";

// Tipo para la compra diferida (ajusta según tu prisma schema real si es necesario)
export type CompraDiferida = {
  id: string;
  descripcion: string;
  montoTotal: number;
  saldoPendiente: number;
  cuotasTotales: number;
  ocurrioEn: string;
  // Podrías tener un campo 'cuotaActual' calculado o en DB
};

interface InstallmentsTabProps {
  compras: CompraDiferida[];
  loading: boolean;
  onPagar: (compra: CompraDiferida) => void;
  moneda: string;
}

export function InstallmentsTab({ compras, loading, onPagar, moneda }: InstallmentsTabProps) {
  
  if (loading) {
    return <div className="py-20 text-center opacity-50 animate-pulse">Cargando compras diferidas...</div>;
  }

  if (compras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full mb-3">
            <PackageOpen size={32} className="text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">No tienes compras diferidas activas.</p>
        <p className="text-xs text-slate-400 mt-1">Tus compras a 1 cuota aparecen en el historial normal.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
      {compras.map((compra) => (
        <InstallmentItem key={compra.id} compra={compra} onPagar={onPagar} moneda={moneda} />
      ))}
    </div>
  );
}

// Sub-componente interno para cada tarjeta de cuota
function InstallmentItem({ compra, onPagar, moneda }: { compra: CompraDiferida, onPagar: (c: CompraDiferida) => void, moneda: string }) {
  // Cálculos visuales
  const total = Number(compra.montoTotal);
  const pendiente = Number(compra.saldoPendiente);
  const pagado = total - pendiente;
  const progreso = total > 0 ? (pagado / total) * 100 : 0;
  
  // Estimación de cuota (puedes refinar esto si tienes el dato exacto en BD)
  const cuotasRestantes = Math.max(1, compra.cuotasTotales); // Debería ser cuotasTotales - cuotasPagadas
  // Nota: Esto es solo visual si no tienes el campo 'cuotaActual' en la BD
  
  return (
    <div className="group relative flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 dark:border-white/10 shadow-sm hover:shadow-md transition-all hover:border-sky-200 dark:hover:border-sky-900/50">
        
        <div className="flex justify-between items-start mb-4">
            <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1" title={compra.descripcion}>
                    {compra.descripcion}
                </h4>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                    <Calendar size={12} />
                    <span>{new Date(compra.ocurrioEn).toLocaleDateString()}</span>
                    <span className="mx-1">•</span>
                    <span>{compra.cuotasTotales} Cuotas</span>
                </div>
            </div>
            <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Por Pagar</span>
                <p className="font-mono font-bold text-rose-500 text-lg">{formatMoney(pendiente, moneda)}</p>
            </div>
        </div>

        {/* Barra de Progreso */}
        <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[10px] font-medium text-slate-500">
                <span>Progreso ({progreso.toFixed(0)}%)</span>
                <span>Total: {formatMoney(total, moneda)}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-700 ease-out" 
                    style={{ width: `${progreso}%` }} 
                />
            </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
             <span className="text-xs text-slate-400">
                ~ {formatMoney(pendiente / cuotasRestantes, moneda)} / cuota
             </span>
             
             <button 
                onClick={() => onPagar(compra)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-500 hover:text-white dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-600 dark:hover:text-white transition-all"
             >
                Abonar Cuota <ArrowRight size={14} />
             </button>
        </div>
    </div>
  )
}