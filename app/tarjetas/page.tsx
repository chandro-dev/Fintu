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
  saldoInteres?: number;
  saldoCapital?: number;
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
  const interes = Number((tarjeta as any).saldoInteres ?? 0);
  const capital = Number((tarjeta as any).saldoCapital ?? Math.max(0, utilizado - interes));
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
                <p className="mt-1 text-[10px] text-white/60">
                  Int: <span className="font-mono">{formatMoney(interes, tarjeta.moneda)}</span> · Cap:{" "}
                  <span className="font-mono">{formatMoney(capital, tarjeta.moneda)}</span>
                </p>
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
  const [rateBusy, setRateBusy] = useState(false);
  const [rateInfo, setRateInfo] = useState<string | null>(null);
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
    saldoInicial: "0",
    tasaEfectivaAnual: "",
    diaCorte: "",
    diaPago: "",
    pagoMinimoPct: ""
  });

  if (!open) return null;

  const cupoNum = Number(form.cupoTotal || 0);
  const deudaNum = 0;
  const disponibleNum = Math.max(cupoNum - deudaNum, 0);
  const usagePct = cupoNum > 0 ? Math.min(100, Math.max(0, (deudaNum / cupoNum) * 100)) : 0;

  const handleSubmit = async () => {
    // 1. Validaciones
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.tasaEfectivaAnual) return setError("La tasa E.A. es obligatoria");
    if (!form.diaCorte || !form.diaPago) return setError("Los días de corte y pago son obligatorios");
    const cupoVal = Number(form.cupoTotal || 0);
    if (!Number.isFinite(cupoVal) || cupoVal < 0) return setError("El cupo no puede ser negativo.");
    if ((form.moneda || "COP") === "COP" && cupoVal > 500_000) return setError("Para COP, el cupo no puede superar $500.000.");

    setBusy(true);
    setError(null);
    setRateInfo(null);

    try {
      // 2. Preparar Payload Correcto
      const payload = {
          nombre: form.nombre,
          emisor: form.emisor,
          moneda: form.moneda,
          // Convertir strings a números
          cupoTotal: Number(form.cupoTotal || 0),
          saldoInicial: 0,
          tasaEfectivaAnual: Number(form.tasaEfectivaAnual),
          diaCorte: Number(form.diaCorte),
          diaPago: Number(form.diaPago),
          pagoMinimoPct: Number(form.pagoMinimoPct || 0),
          // LÓGICA CLAVE: Si es vacío, mandar undefined para que el backend cree la cuenta
          cuentaId: form.cuentaId && form.cuentaId !== "" ? form.cuentaId : undefined 
      };

      await TarjetaService.crear(payload, { accessToken });
      
      onSuccess();
      onClose();
      // Reset form
      setForm({ nombre: "", emisor: "", cuentaId: "", moneda: "COP", cupoTotal: "", saldoInicial: "0", tasaEfectivaAnual: "", diaCorte: "", diaPago: "", pagoMinimoPct: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear tarjeta");
    } finally {
      setBusy(false);
    }
  };

  const handleAutofillBanRepRate = async () => {
    setRateBusy(true);
    setRateInfo(null);
    try {
      const res = await fetch("/api/rates/banrep", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo obtener la tasa");

      const rate = Number(data?.tasaIntervencionPct);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("Tasa inválida recibida");

      setForm((p) => ({ ...p, tasaEfectivaAnual: String(rate) }));
      setRateInfo(`${data?.fuente || "BanRep"}: ${rate}% · ${data?.nota || ""}`.trim());
    } catch (e) {
      setRateInfo(e instanceof Error ? e.message : "No se pudo obtener la tasa");
    } finally {
      setRateBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <div className="relative overflow-hidden border-b border-slate-100 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nueva tarjeta</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Configura cupo, fechas de corte/pago y deuda inicial.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white dark:border-white/10 dark:bg-black/30 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-5 text-white shadow-lg md:col-span-2">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                    {form.emisor?.trim() ? form.emisor : "Emisor"}
                  </p>
                  <p className="mt-1 truncate text-lg font-bold tracking-wide">
                    {form.nombre?.trim() ? form.nombre : "Nombre de la tarjeta"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-2">
                  <CreditCard size={18} className="text-white/80" />
                </div>
              </div>

              <div className="relative z-10 mt-4 space-y-2">
                <div className="flex justify-between text-[10px] font-semibold text-white/60">
                  <span>Deuda</span>
                  <span>Cupo</span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span className="font-mono text-xl font-bold">{formatMoney(deudaNum, form.moneda)}</span>
                  <span className="font-mono text-sm text-white/70">{formatMoney(cupoNum, form.moneda)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full transition-all ${usagePct > 90 ? "bg-rose-500" : usagePct > 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-medium text-white/60">
                  <span>Disponible: {formatMoney(disponibleNum, form.moneda)}</span>
                  <span>{usagePct.toFixed(1)}% uso</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                Parámetros
              </p>
              <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-zinc-300">
                <div className="flex justify-between">
                  <span>Día corte</span>
                  <span className="font-mono font-semibold">{form.diaCorte || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Día pago</span>
                  <span className="font-mono font-semibold">{form.diaPago || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>TEA</span>
                  <span className="font-mono font-semibold">
                    {form.tasaEfectivaAnual ? `${form.tasaEfectivaAnual}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pago mínimo</span>
                  <span className="font-mono font-semibold">
                    {form.pagoMinimoPct ? `${form.pagoMinimoPct}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm">
                <AlertCircle size={16} /> {error}
            </div>
        )}

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            
            {/* DATOS GENERALES */}
            <div className="md:col-span-2 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                    Datos básicos
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Define el nombre visible y el emisor. Esto te ayuda a identificar la tarjeta.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <InputField label="Nombre tarjeta" placeholder="Ej: Visa Signature" value={form.nombre} onChange={v => setForm(p => ({...p, nombre: v}))} />
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">Ej: “Visa Oro”, “Mastercard Platinum”.</p>
                      </div>
                      <div className="space-y-1">
                        <InputField label="Banco / emisor" placeholder="Ej: Bancolombia" value={form.emisor} onChange={v => setForm(p => ({...p, emisor: v}))} />
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">Opcional. Solo para referencia visual.</p>
                      </div>
                  </div>
                </div>

                {/* SELECTOR DE CUENTA INTELIGENTE */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
                   <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Vinculación Contable</label>
                   <select 
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      value={form.cuentaId}
                      onChange={e => setForm(p => ({...p, cuentaId: e.target.value}))}
                   >
                      <option value="">Crear cuenta interna automáticamente (Recomendado)</option>
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
                  <div className="space-y-1">
                    <MoneyField
                      label="Cupo total"
                      currency={form.moneda}
                      value={form.cupoTotal}
                      onChange={v => setForm(p => ({...p, cupoTotal: v}))}
                      minValue={0}
                      maxValue={(form.moneda || "COP") === "COP" ? 500_000 : 100_000_000}
                    />
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      Máximo {((form.moneda || "COP") === "COP") ? "$500.000 COP" : "100.000.000"}.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <MoneyField
                      label="Deuda actual (saldo inicial)"
                      currency={form.moneda}
                      value={"0"}
                      onChange={() => {}}
                      minValue={0}
                      maxValue={100_000_000}
                      disabled
                    />
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      Por ahora siempre inicia en 0. La deuda se genera cuando registras compras/avances.
                    </p>
                  </div>
                </div>
            </div>

            {/* CONDICIONES */}
            <div>
               <p className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider flex items-center gap-2"><TrendingUp size={14}/> Tasas y Fechas</p>
               <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/20">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                        Tasa (referencia)
                      </p>
                      <button
                        type="button"
                        onClick={handleAutofillBanRepRate}
                        disabled={rateBusy}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/10"
                      >
                        {rateBusy ? "Consultando..." : "Usar BanRep"}
                      </button>
                    </div>
                    <div className="mt-3 space-y-1">
                      <NumberField label="Tasa E.A. (%)" placeholder="Ej: 28.5" value={form.tasaEfectivaAnual} onChange={v => setForm(p => ({...p, tasaEfectivaAnual: v}))} />
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        La TEA real la encuentras en tu extracto/contrato. BanRep es una referencia (tasa de intervención).
                      </p>
                      {rateInfo && <p className="text-[10px] text-slate-500 dark:text-zinc-400">{rateInfo}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <NumberField
                          label="Día de corte"
                          placeholder="1-31"
                          value={form.diaCorte}
                          onChange={v => setForm(p => ({...p, diaCorte: v}))}
                          integer
                          min={1}
                          max={31}
                        />
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">Día del mes en que cierra el ciclo.</p>
                      </div>
                      <div className="space-y-1">
                        <NumberField
                          label="Día de pago"
                          placeholder="1-31"
                          value={form.diaPago}
                          onChange={v => setForm(p => ({...p, diaPago: v}))}
                          integer
                          min={1}
                          max={31}
                        />
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">Fecha límite para pagar sin mora.</p>
                      </div>
                  </div>
                  <div className="space-y-1">
                    <NumberField label="% pago mínimo (opcional)" value={form.pagoMinimoPct} onChange={v => setForm(p => ({...p, pagoMinimoPct: v}))} />
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Ej: 5 significa 5% de la deuda actual.</p>
                  </div>
               </div>
            </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-full dark:text-zinc-300 dark:hover:bg-white/10 transition-colors">Cancelar</button>
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
  const { session, cuentas, refresh } = useAppData();
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
    <div className="min-h-screen px-4 md:px-8 py-10 bg-transparent text-slate-900 dark:text-zinc-50 transition-colors">
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
            onSuccess={async () => {
              await loadTarjetas();
              await refresh({ force: true });
            }}
            cuentas={cuentas}
            accessToken={accessToken}
        />
      </div>
    </div>
  );
}
