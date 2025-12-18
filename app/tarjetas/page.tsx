"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/formatMoney";
import { TarjetaService } from "@/lib/services/TarjetaService";
import { useAppData } from "@/components/AppDataProvider";

// Componentes UI Reutilizables (Asegúrate de tenerlos en src/components/ui/Fields.tsx)
import { InputField, MoneyField, NumberField, SelectField } from "@/components/ui/Fields";

// Iconos
import { 
  Plus, CreditCard, Wallet, TrendingUp, 
  AlertCircle, ShieldCheck, ChevronRight 
} from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================
type Tarjeta = {
  id: string;
  nombre: string;
  emisor?: string | null;
  moneda: string;
  cupoTotal: number;
  saldoActual: number;
  tasaEfectivaAnual: number;
  diaCorte: number;
  diaPago: number;
  estado?: "ACTIVA" | "CERRADA";
};

// ============================================================================
// COMPONENTE: TARJETA MINI (VISTA DE LISTA)
// ============================================================================
function CreditCardMini({ tarjeta }: { tarjeta: Tarjeta }) {
  const utilizado = Number(tarjeta.saldoActual);
  const cupo = Number(tarjeta.cupoTotal);
  const disponible = Math.max(cupo - utilizado, 0);
  const usagePct = cupo > 0 ? Math.min((utilizado / cupo) * 100, 100) : 0;
  const isCancelled = tarjeta.estado === "CERRADA";
  
  // Colores dinámicos según uso
  const barColor = usagePct > 90 ? "bg-rose-500" : usagePct > 50 ? "bg-amber-400" : "bg-emerald-400";
  const cardGradient = "from-slate-800 to-slate-900 dark:from-zinc-900 dark:to-black";

  return (
    <Link 
      href={`/tarjetas/${tarjeta.id}`}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${cardGradient} p-5 text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl ${
        isCancelled ? "opacity-60 grayscale" : ""
      }`}
    >
      {/* Decoración de Fondo */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-2xl group-hover:bg-white/10"></div>

      <div className="relative z-10 flex justify-between items-start mb-4">
        <div>
           <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{tarjeta.emisor || "Privada"}</p>
           <h3 className="text-lg font-bold tracking-wide truncate pr-2">{tarjeta.nombre}</h3>
        </div>
        <div className="rounded-md bg-white/10 p-1.5 backdrop-blur-sm">
           <CreditCard size={18} className="opacity-80" />
        </div>
      </div>

      <div className="relative z-10 space-y-3">
         {/* Saldos */}
         <div className="flex justify-between items-end">
            <div>
                <p className="text-[10px] text-slate-300 uppercase">Deuda Actual</p>
                <p className="text-xl font-mono font-bold">{formatMoney(utilizado, tarjeta.moneda)}</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-slate-300 uppercase">Cupo Total</p>
                <p className="text-sm font-mono opacity-80">{formatMoney(cupo, tarjeta.moneda)}</p>
            </div>
         </div>

      {/* Barra de Progreso */}
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
         <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${usagePct}%` }} />
      </div>

         {/* Footer Info */}
         <div className="flex justify-between text-[10px] font-medium opacity-60 pt-1">
             <span>Disp: {formatMoney(disponible, tarjeta.moneda)}</span>
             <span>Corte: Día {tarjeta.diaCorte}</span>
         </div>
      </div>
      
      {isCancelled && (
        <span className="absolute right-4 top-4 rounded-full border border-white/30 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
          Archivada
        </span>
      )}

      {/* Icono Hover */}
      <div className="absolute right-4 bottom-4 opacity-0 transform translate-x-4 transition-all group-hover:opacity-100 group-hover:translate-x-0">
         <ChevronRight className="text-white" />
      </div>
    </Link>
  );
}

// ============================================================================
// COMPONENTE: MODAL DE CREACIÓN (LÓGICA CORREGIDA)
// ============================================================================
function CreateCardModal({ 
  open, onClose, onSuccess, cuentas, accessToken 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  cuentas: any[];
  accessToken: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cuentasDisponibles = useMemo(
    () => cuentas.filter((c) => !c.cerradaEn),
    [cuentas]
  );
  
  // Usamos strings en el estado inicial para manejar inputs vacíos limpiamente
  const [form, setForm] = useState({
    nombre: "",
    emisor: "",
    cuentaId: "", // Vacío significa "Automática"
    moneda: "COP",
    cupoTotal: "",
    saldoInicial: "",
    tasaEfectivaAnual: "",
    diaCorte: "",
    diaPago: "",
    pagoMinimoPct: ""
  });

  if (!open) return null;

  const handleSubmit = async () => {
    // 1. Validaciones
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.tasaEfectivaAnual) return setError("La tasa E.A. es obligatoria");
    if (!form.diaCorte || !form.diaPago) return setError("Los días de corte y pago son obligatorios");

    setBusy(true);
    setError(null);

    try {
      // 2. Preparar Payload Correcto
      const payload = {
          nombre: form.nombre,
          emisor: form.emisor,
          moneda: form.moneda,
          // Convertir strings a números
          cupoTotal: Number(form.cupoTotal || 0),
          saldoInicial: Number(form.saldoInicial || 0),
          tasaEfectivaAnual: Number(form.tasaEfectivaAnual),
          diaCorte: Number(form.diaCorte),
          diaPago: Number(form.diaPago),
          pagoMinimoPct: Number(form.pagoMinimoPct || 0),
          // 💡 LÓGICA CLAVE: Si es vacío, mandar undefined para que el backend cree la cuenta
          cuentaId: form.cuentaId && form.cuentaId !== "" ? form.cuentaId : undefined 
      };

      await TarjetaService.crear(payload, { accessToken });
      
      onSuccess();
      onClose();
      // Reset form
      setForm({ nombre: "", emisor: "", cuentaId: "", moneda: "COP", cupoTotal: "", saldoInicial: "", tasaEfectivaAnual: "", diaCorte: "", diaPago: "", pagoMinimoPct: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear tarjeta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <h3 className="text-xl font-bold dark:text-white">Nueva Tarjeta</h3>
            <p className="text-xs text-slate-500">Configura tu tarjeta y su deuda inicial.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500">✕</button>
        </div>

        {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm">
                <AlertCircle size={16} /> {error}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* DATOS GENERALES */}
            <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Nombre Tarjeta" placeholder="Ej: Visa Signature" value={form.nombre} onChange={v => setForm(p => ({...p, nombre: v}))} />
                    <InputField label="Banco / Emisor" placeholder="Ej: Bancolombia" value={form.emisor} onChange={v => setForm(p => ({...p, emisor: v}))} />
                </div>

                {/* SELECTOR DE CUENTA INTELIGENTE */}
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
                   <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Vinculación Contable</label>
                   <select 
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      value={form.cuentaId}
                      onChange={e => setForm(p => ({...p, cuentaId: e.target.value}))}
                   >
                      <option value="">✨ Crear cuenta interna automáticamente (Recomendado)</option>
                      {cuentasDisponibles.length > 0 && (
                          <optgroup label="Vincular a existente (Avanzado)">
                            {cuentasDisponibles.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                            ))}
                          </optgroup>
                      )}
                   </select>
                   <p className="text-[10px] text-slate-400 mt-2">
                     Recomendamos la opción automática: creará una cuenta oculta para gestionar el saldo de esta tarjeta.
                   </p>
                </div>
            </div>

            {/* DATOS FINANCIEROS */}
            <div>
               <p className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider flex items-center gap-2"><Wallet size={14}/> Saldos</p>
               <div className="space-y-4">
                  <SelectField 
                        label="Moneda" 
                        value={form.moneda} 
                        onChange={v => setForm(p => ({...p, moneda: v}))}
                        options={[{label: "Pesos (COP)", value: "COP"}, {label: "Dólares (USD)", value: "USD"}]}
                  />
                  <MoneyField label="Cupo Total" currency={form.moneda} value={form.cupoTotal} onChange={v => setForm(p => ({...p, cupoTotal: v}))} />
                  <MoneyField label="Deuda Actual (Saldo Inicial)" currency={form.moneda} value={form.saldoInicial} onChange={v => setForm(p => ({...p, saldoInicial: v}))} />
               </div>
            </div>

            {/* CONDICIONES */}
            <div>
               <p className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider flex items-center gap-2"><TrendingUp size={14}/> Tasas y Fechas</p>
               <div className="space-y-4">
                  <NumberField label="Tasa E.A. (%)" placeholder="Ej: 28.5" value={form.tasaEfectivaAnual} onChange={v => setForm(p => ({...p, tasaEfectivaAnual: v}))} />
                  <div className="grid grid-cols-2 gap-4">
                      <NumberField label="Día Corte" placeholder="1-31" value={form.diaCorte} onChange={v => setForm(p => ({...p, diaCorte: v}))} />
                      <NumberField label="Día Pago" placeholder="1-31" value={form.diaPago} onChange={v => setForm(p => ({...p, diaPago: v}))} />
                  </div>
                  <NumberField label="% Pago Mínimo (Opcional)" value={form.pagoMinimoPct} onChange={v => setForm(p => ({...p, pagoMinimoPct: v}))} />
               </div>
            </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-white/5">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleSubmit} 
            disabled={busy} 
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 shadow-lg dark:bg-sky-600 dark:hover:bg-sky-500 transition-all"
          >
            {busy ? "Creando..." : "Crear Tarjeta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
export default function TarjetasPage() {
  const { session, cuentas } = useAppData();
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const accessToken = session?.access_token;

  const loadTarjetas = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await TarjetaService.listar({ accessToken });
      setTarjetas(data);
    } catch (err) {
      setError("No se pudieron cargar las tarjetas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) void loadTarjetas();
  }, [accessToken]);

  // Cálculos de Resumen
  const resumen = useMemo(() => {
    const deuda = tarjetas.reduce((acc, t) => acc + Number(t.saldoActual), 0);
    const cupo = tarjetas.reduce((acc, t) => acc + Number(t.cupoTotal), 0);
    return {
        deuda,
        cupo,
        disponible: Math.max(cupo - deuda, 0),
        pctUso: cupo > 0 ? (deuda / cupo) * 100 : 0
    };
  }, [tarjetas]);

  const monedaRef = tarjetas[0]?.moneda || "COP";

  return (
    <div className="min-h-screen px-4 md:px-8 py-10 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-50 transition-colors">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400 mb-1">Finanzas</p>
            <h1 className="text-3xl font-bold">Mis Tarjetas</h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-1">Gestiona tus cupos y controla tus fechas de pago.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="group flex items-center gap-2 rounded-full bg-slate-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-black shadow-lg hover:scale-105 transition-all"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            Nueva Tarjeta
          </button>
        </div>

        {error && <div className="p-4 bg-rose-100 text-rose-800 rounded-xl border border-rose-200">{error}</div>}

        {/* Dashboard de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-zinc-400">
                    <Wallet size={20} /> <span className="text-xs font-bold uppercase tracking-wider">Deuda Total</span>
                </div>
                <p className="text-3xl font-bold text-slate-800 dark:text-white">{formatMoney(resumen.deuda, monedaRef)}</p>
            </div>
            
            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-zinc-400">
                    <ShieldCheck size={20} /> <span className="text-xs font-bold uppercase tracking-wider">Cupo Disponible</span>
                </div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(resumen.disponible, monedaRef)}</p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm border border-slate-200 dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-zinc-400">
                        <TrendingUp size={20} /> <span className="text-xs font-bold uppercase tracking-wider">Utilización Global</span>
                    </div>
                    <p className={`text-3xl font-bold ${resumen.pctUso > 50 ? 'text-amber-500' : 'text-sky-600'}`}>
                        {resumen.pctUso.toFixed(1)}%
                    </p>
                </div>
                {/* Background Chart Effect */}
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                   <TrendingUp size={80} />
                </div>
            </div>
        </div>

        {/* Grid de Tarjetas */}
        <div>
            {loading ? (
                <div className="py-20 text-center opacity-50">Cargando tus tarjetas...</div>
            ) : tarjetas.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                    <CreditCard className="mx-auto text-slate-300 mb-2" size={48} />
                    <p className="text-slate-500">No tienes tarjetas registradas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tarjetas.map((t) => (
                        <CreditCardMini key={t.id} tarjeta={t} />
                    ))}
                </div>
            )}
        </div>

        {/* Modal de Creación */}
        <CreateCardModal 
            open={showModal} 
            onClose={() => setShowModal(false)} 
            onSuccess={loadTarjetas}
            cuentas={cuentas}
            accessToken={accessToken}
        />
      </div>
    </div>
  );
}
