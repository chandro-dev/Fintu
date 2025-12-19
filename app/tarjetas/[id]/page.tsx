"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatMoney";
import { TarjetaService } from "@/lib/services/TarjetaService";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { useAppData } from "@/components/AppDataProvider";
import CreditSimulator from "@/components/tarjetas/CreditSimulator";
import type { TarjetaMovimientoUI } from "@/components/transactions/types";
import { InstallmentsTab, CompraDiferida } from "@/components/tarjetas/InstallmentsTab";

// Componentes UI Reutilizables
import { InputField, SelectField, NumberField, MoneyField } from "@/components/ui/Fields";

// Iconos
import { 
  CreditCard, Calendar, AlertCircle, Trash2, Edit3, 
  Plus, ChevronLeft, Wallet, RefreshCw
} from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================
type TarjetaDetalle = {
  id: string;
  nombre: string;
  emisor?: string | null;
  moneda: string;
  cupoTotal: number;
  saldoActual: number;
  tasaEfectivaAnual: number;
  diaCorte: number;
  diaPago: number;
  pagoMinimoPct?: number | null;
  estado?: "ACTIVA" | "CERRADA";
  cuentaId: string;
};

type MovimientoTipo = "COMPRA" | "PAGO" | "INTERES" | "CUOTA" | "AJUSTE";

const MOV_TIPO_OPTIONS = [
  { label: "Compra", value: "COMPRA" },
  { label: "Pago (Abono a deuda)", value: "PAGO" },
  { label: "Interés cobrado", value: "INTERES" },
  { label: "Pago de cuota específica", value: "CUOTA" },
  { label: "Ajuste de saldo", value: "AJUSTE" },
];

const MOV_TIPO_LABEL: Record<string, string> = {
  COMPRA: "Compra",
  PAGO: "Pago",
  INTERES: "Interés",
  CUOTA: "Pago Cuota",
  AJUSTE: "Ajuste",
};

// ============================================================================
// COMPONENTE: TARJETA VISUAL
// ============================================================================
function VisualCreditCard({ tarjeta, utilizado, disponible }: { tarjeta: TarjetaDetalle, utilizado: number, disponible: number }) {
  const usagePct = Math.min((utilizado / tarjeta.cupoTotal) * 100, 100);
  const isCancelled = tarjeta.estado === "CERRADA";
  
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-2xl transition-transform hover:scale-[1.01] ${isCancelled ? "bg-slate-800 grayscale" : "bg-gradient-to-br from-slate-800 via-slate-900 to-black"}`}>
      {/* Background Decorativo */}
      {!isCancelled && (
        <>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"></div>
        </>
      )}

      <div className="relative z-10 flex flex-col justify-between h-full min-h-[180px]">
        <div className="flex justify-between items-start">
           <div>
             <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                {isCancelled ? "CANCELADA" : (tarjeta.emisor || "CREDIT CARD")}
             </p>
             <h2 className="text-2xl font-bold mt-1 tracking-wide">{tarjeta.nombre}</h2>
           </div>
           <CreditCard size={32} className="text-white/80" />
        </div>

        <div className="mt-6">
           <div className="flex justify-between text-xs text-slate-300 mb-1 uppercase tracking-wider">
              <span>Saldo Utilizado</span>
              <span>Cupo Total</span>
           </div>
           <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-mono font-bold text-white">{formatMoney(utilizado, tarjeta.moneda)}</span>
              <span className="text-sm font-mono text-slate-400">{formatMoney(tarjeta.cupoTotal, tarjeta.moneda)}</span>
           </div>
           
           <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${usagePct > 90 ? 'bg-rose-500' : 'bg-sky-500'}`} 
                style={{ width: `${usagePct}%` }} 
              />
           </div>
           <div className="flex justify-between mt-2 text-xs">
              <span className="text-emerald-400 font-medium">Disponible: {formatMoney(disponible, tarjeta.moneda)}</span>
              <span className="text-slate-400">{usagePct.toFixed(1)}% utilizado</span>
           </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
export default function TarjetaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tarjetaId = params?.id ?? "";
  
  const { session, cuentas, refresh } = useAppData(); 
  const accessToken = session?.access_token;
  const cuentasActivas = useMemo(
    () => cuentas.filter((c) => !c.cerradaEn),
    [cuentas]
  );

  // Estados de Datos
  const [tarjeta, setTarjeta] = useState<TarjetaDetalle | null>(null);
  const [movimientos, setMovimientos] = useState<TarjetaMovimientoUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [movLoading, setMovLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de Tabs y Cuotas
  const [activeTab, setActiveTab] = useState<"MOVIMIENTOS" | "CUOTAS">("MOVIMIENTOS");
  const [comprasActivas, setComprasActivas] = useState<CompraDiferida[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);

  // Estados de Modales
  const [showMovModal, setShowMovModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Formulario Movimiento
  const [movForm, setMovForm] = useState({
    tipo: "COMPRA" as MovimientoTipo,
    monto: "",
    descripcion: "",
    ocurrioEn: new Date().toISOString().slice(0, 16),
    enCuotas: false,
    cuotasTotales: 1,
    cuotaId: "",
    cuentaOrigenId: "",
    autoCalcularInteres: true,
  });

  // Formulario Edición
  const [editForm, setEditForm] = useState<any>({});

  // 1. CARGA DE DATOS
  const loadData = async () => {
    if (!accessToken || !tarjetaId) return;
    try {
      // A. Cargar Tarjeta
      const tarjetasRes = await TarjetaService.listar({ accessToken });
      const found = tarjetasRes.find((t: any) => t.id === tarjetaId);
      setTarjeta(found ?? null);
      if (found) setEditForm(found);

      // B. Cargar Movimientos
      setMovLoading(true);
      const movRes = await fetch(`/api/tarjetas/movimientos?tarjetaId=${tarjetaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (movRes.ok) setMovimientos(await movRes.json());
      
      // C. Cargar Compras Diferidas
      setLoadingCompras(true);
      try {
          const compras = await TarjetaService.listarComprasActivas(tarjetaId, { accessToken });
          setComprasActivas(compras);
      } catch(e) { console.error("Error compras", e); }
      finally { setLoadingCompras(false); }

    } catch (err) {
      setError("Error cargando información");
    } finally {
      setLoading(false);
      setMovLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) void loadData();
  }, [accessToken, tarjetaId]);

  // Cálculos Derivados
  const utilizado = useMemo(() => Number(tarjeta?.saldoActual ?? 0), [tarjeta?.saldoActual]);
  const disponible = useMemo(() => Math.max(Number(tarjeta?.cupoTotal ?? 0) - utilizado, 0), [tarjeta?.cupoTotal, utilizado]);
  
  const pagoMinimoSugerido = useMemo(() => {
    const pct = Number(tarjeta?.pagoMinimoPct ?? 0);
    return pct > 0 ? (utilizado * pct) / 100 : 0;
  }, [tarjeta?.pagoMinimoPct, utilizado]);

  // 2. HANDLERS

  // Pre-llenar modal para pagar una cuota específica
  const handlePagarCuota = (compra: CompraDiferida) => {
      const cuotasRestantesAprox = Math.max(1, compra.cuotasTotales); // Simplificación visual
      const montoSugerido = Number(compra.saldoPendiente) / cuotasRestantesAprox;

      setMovForm({
          tipo: "CUOTA",
          monto: String(Math.ceil(montoSugerido)),
          descripcion: `Abono Cuota: ${compra.descripcion}`,
          ocurrioEn: new Date().toISOString().slice(0, 16),
          enCuotas: false,
          cuotasTotales: 1,
          cuotaId: compra.id, // ID para el backend
          cuentaOrigenId: "", // Usuario elige
          autoCalcularInteres: true,
      });
      setShowMovModal(true);
  };

  const handleRegistrarMovimiento = async () => {
    if (!accessToken) return;
    
    // Validaciones
    if ((movForm.tipo === "PAGO" || movForm.tipo === "CUOTA") && !movForm.cuentaOrigenId) {
        setActionError("Selecciona la cuenta bancaria de origen para el pago.");
        return;
    }
    if (
      movForm.tipo !== "INTERES" &&
      (!movForm.monto || Number(movForm.monto) <= 0)
    ) {
        setActionError("El monto debe ser mayor a 0.");
        return;
    }
    if (
      movForm.tipo === "INTERES" &&
      !movForm.autoCalcularInteres &&
      (!movForm.monto || Number(movForm.monto) <= 0)
    ) {
      setActionError("Define un monto de interés o activa el cálculo automático.");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      await TarjetaService.registrarMovimiento({
          tarjetaId,
          tipo: movForm.tipo,
          monto: movForm.tipo === "INTERES" && movForm.autoCalcularInteres ? 0 : Number(movForm.monto),
          descripcion: movForm.descripcion,
          ocurrioEn: movForm.ocurrioEn ? new Date(movForm.ocurrioEn).toISOString() : undefined,
          enCuotas: movForm.enCuotas,
          cuotasTotales: movForm.enCuotas ? Number(movForm.cuotasTotales) : undefined,
          cuotaId: movForm.tipo === "CUOTA" ? movForm.cuotaId || undefined : undefined,
          cuentaOrigenId: (movForm.tipo === "PAGO" || movForm.tipo === "CUOTA") ? movForm.cuentaOrigenId : undefined,
          autoCalcularInteres: movForm.tipo === "INTERES" ? Boolean(movForm.autoCalcularInteres) : undefined,
      }, { accessToken });

      setShowMovModal(false);
      setMovForm(prev => ({ ...prev, monto: "", descripcion: "", enCuotas: false, cuotaId: "" })); 
      await loadData();
      await refresh({ force: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateTarjeta = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      await TarjetaService.actualizar(tarjetaId, editForm, { accessToken });
      setShowEditModal(false);
      await loadData();
      await refresh({ force: true });
    } catch (err) {
      setActionError("Error al actualizar");
    } finally {
      setBusy(false);
    }
  };

  // NUEVO HANDLER: Toggle Estado (Archivar / Reactivar)
  const handleToggleEstado = async () => {
      if (!accessToken || !tarjeta) return;
      
      const nuevoEstado = tarjeta.estado === "ACTIVA" ? "CERRADA" : "ACTIVA";
      const confirmar = confirm(
          nuevoEstado === "CERRADA" 
          ? "¿Seguro que deseas archivar esta tarjeta? Se mantendrá el historial pero no podrás agregar nuevas compras."
          : "¿Deseas reactivar esta tarjeta?"
      );

      if (!confirmar) return;

      setBusy(true);
      try {
          await TarjetaService.actualizar(tarjetaId, {
              estado: nuevoEstado,
              cerradaEn: nuevoEstado === "CERRADA" ? new Date().toISOString() : null
          }, { accessToken });
          
          await loadData();
          await refresh({ force: true });
      } catch (err) {
          alert("Error al cambiar estado");
      } finally {
          setBusy(false);
      }
  };

  // ELIMINAR DEFINITIVO (Hard Delete)
  const handleEliminarTarjeta = async () => {
    if (!accessToken || !confirm("¡PELIGRO! ¿Eliminar definitivamente?\n\nSe borrarán TODOS los movimientos, historial de pagos y cuotas asociados. Esta acción no se puede deshacer.")) return;
    setBusy(true);
    try {
      await TarjetaService.eliminar(tarjetaId, { accessToken });
      await refresh({ force: true });
      router.push("/tarjetas");
    } catch (err) {
      alert("No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-20 text-center opacity-50">Cargando tarjeta...</div>;
  if (!tarjeta) return <div className="p-20 text-center text-slate-500">Tarjeta no encontrada</div>;

  const utilizadoUI = Number(tarjeta.saldoActual || 0);
  const cupoUI = Number(tarjeta.cupoTotal || 0);
  const disponibleUI = Math.max(cupoUI - utilizadoUI, 0);
  const usoPctUI = cupoUI > 0 ? Math.min(100, Math.max(0, (utilizadoUI / cupoUI) * 100)) : 0;

  const teaUI = Number((tarjeta as any).tasaEfectivaAnual || 0);
  const tasaDiariaUI = teaUI > 0 ? Math.pow(1 + teaUI / 100, 1 / 365) - 1 : 0;
  const baseFechaMov = movForm.ocurrioEn ? new Date(movForm.ocurrioEn) : new Date();
  const ultimoInteresDate = useMemo(() => {
    const last = movimientos
      .filter((m: any) => m.tipo === "INTERES")
      .sort((a: any, b: any) => new Date(b.ocurrioEn).getTime() - new Date(a.ocurrioEn).getTime())[0];
    return last ? new Date(last.ocurrioEn) : null;
  }, [movimientos]);
  const diasDesdeUltimoInteres = useMemo(() => {
    if (!ultimoInteresDate) return 0;
    const a = new Date(ultimoInteresDate.getFullYear(), ultimoInteresDate.getMonth(), ultimoInteresDate.getDate());
    const b = new Date(baseFechaMov.getFullYear(), baseFechaMov.getMonth(), baseFechaMov.getDate());
    const diff = b.getTime() - a.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [ultimoInteresDate, baseFechaMov]);
  const interesAutoEstimado = useMemo(() => {
    if (!tasaDiariaUI) return 0;
    return Math.max(0, utilizadoUI * tasaDiariaUI * diasDesdeUltimoInteres);
  }, [utilizadoUI, tasaDiariaUI, diasDesdeUltimoInteres]);

  const nextDateForDay = (day: number) => {
    const y = baseFechaMov.getFullYear();
    const m = baseFechaMov.getMonth();
    const d = baseFechaMov.getDate();
    const targetThisMonth = new Date(y, m, day);
    if (d <= day) return targetThisMonth;
    return new Date(y, m + 1, day);
  };
  const diasHastaCorte = useMemo(() => {
    const day = Number((tarjeta as any).diaCorte || 0);
    if (!day) return 0;
    const target = nextDateForDay(day);
    const a = new Date(baseFechaMov.getFullYear(), baseFechaMov.getMonth(), baseFechaMov.getDate());
    const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
  }, [tarjeta, baseFechaMov]);
  const diasHastaPago = useMemo(() => {
    const day = Number((tarjeta as any).diaPago || 0);
    if (!day) return 0;
    const target = nextDateForDay(day);
    const a = new Date(baseFechaMov.getFullYear(), baseFechaMov.getMonth(), baseFechaMov.getDate());
    const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
  }, [tarjeta, baseFechaMov]);

  const movimientoMontoNum = Number(movForm.monto || 0);
  const previewNuevoSaldo =
    movForm.tipo === "PAGO" || movForm.tipo === "CUOTA"
      ? Math.max(0, utilizadoUI - movimientoMontoNum)
      : movForm.tipo === "AJUSTE"
        ? Math.max(0, utilizadoUI + (Number(movForm.monto || 0) >= 0 ? movimientoMontoNum : -movimientoMontoNum))
        : utilizadoUI + movimientoMontoNum;
  const previewDisponible = Math.max(cupoUI - previewNuevoSaldo, 0);

  const interesCompraHastaPago = useMemo(() => {
    if (!tasaDiariaUI) return 0;
    if (movForm.tipo !== "COMPRA" && movForm.tipo !== "AVANCE") return 0;
    return Math.max(0, movimientoMontoNum * tasaDiariaUI * diasHastaPago);
  }, [movForm.tipo, movimientoMontoNum, tasaDiariaUI, diasHastaPago]);

  return (
    <div className="min-h-screen bg-transparent px-4 md:px-6 py-8 pb-20 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* HEADER DE NAVEGACIÓN */}
        <div className="flex items-center gap-3">
             <button onClick={() => router.push("/tarjetas")} className="p-2 rounded-full border border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5 transition-colors">
                <ChevronLeft size={20} />
             </button>
             <h1 className="text-xl font-bold">Detalle de Tarjeta</h1>
        </div>

        {error && <div className="p-4 bg-rose-100 text-rose-800 rounded-xl">{error}</div>}

        {/* ALERTA DE TARJETA CANCELADA */}
        {tarjeta.estado === "CERRADA" && (
           <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-600 flex items-center gap-3 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-400">
               <Trash2 size={20} />
               <div>
                   <p className="font-bold">Tarjeta Archivada</p>
                   <p className="text-xs">Esta tarjeta es de solo lectura. Reactívala para registrar nuevos movimientos.</p>
               </div>
           </div>
        )}

        {/* LAYOUT SUPERIOR: TARJETA + SIMULADOR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                <VisualCreditCard tarjeta={tarjeta} utilizado={utilizado} disponible={disponible} />
                <div className="grid grid-cols-3 gap-3">
                    <InfoCard label="Corte" value={`Día ${tarjeta.diaCorte}`} icon={Calendar} />
                    <InfoCard label="Pago" value={`Día ${tarjeta.diaPago}`} icon={Calendar} />
                    <InfoCard label="TEA" value={`${tarjeta.tasaEfectivaAnual}%`} icon={AlertCircle} />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <CreditSimulator 
                    tasaEfectivaAnual={tarjeta.tasaEfectivaAnual} 
                    moneda={tarjeta.moneda}
                    saldoActual={utilizado}
                    cupoTotal={tarjeta.cupoTotal}
                />
                
                {/* BOTONERA DE ACCIONES */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                    {tarjeta.estado !== "CERRADA" ? (
                        <>
                            <button 
                                onClick={() => {
                                    setMovForm(prev => ({ ...prev, tipo: "COMPRA", monto: "", descripcion: "", cuotaId: "" }));
                                    setShowMovModal(true);
                                }}
                                className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 text-white font-bold shadow-lg shadow-sky-900/20 hover:bg-sky-500 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <Plus size={20} /> Registrar Movimiento
                            </button>
                            <button onClick={() => setShowEditModal(true)} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 transition-all font-medium">
                                <Edit3 size={18} /> Editar
                            </button>
                            {/* BOTÓN ARCHIVAR */}
                            <button onClick={handleToggleEstado} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-900/30 dark:hover:bg-orange-900/20 transition-all font-medium">
                                <Trash2 size={18} /> Archivar
                            </button>
                        </>
                    ) : (
                        <>
                            {/* BOTÓN REACTIVAR */}
                            <button onClick={handleToggleEstado} className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-all">
                                <RefreshCw size={20} /> Reactivar Tarjeta
                            </button>
                            {/* BOTÓN ELIMINAR (Solo visible en archivadas) */}
                            <button onClick={handleEliminarTarjeta} className="col-span-2 py-2 text-xs text-rose-500 hover:underline">
                                Eliminar definitivamente (Borrar historial)
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* CONTENIDO PRINCIPAL: TABS (Historial vs Cuotas) */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-black/20">
            
            {/* Header de Pestañas */}
            <div className="flex gap-6 border-b border-slate-100 dark:border-white/5 mb-6">
               <button 
                  onClick={() => setActiveTab("MOVIMIENTOS")}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                      activeTab === "MOVIMIENTOS" 
                      ? "border-sky-500 text-sky-600 dark:text-sky-400" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
               >
                  Historial de Movimientos
               </button>
               <button 
                  onClick={() => setActiveTab("CUOTAS")}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === "CUOTAS" 
                      ? "border-sky-500 text-sky-600 dark:text-sky-400" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
               >
                  Compras Diferidas
                  {comprasActivas.length > 0 && (
                      <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                          {comprasActivas.length}
                      </span>
                  )}
               </button>
            </div>

            {/* Contenido de Pestañas */}
            {activeTab === "MOVIMIENTOS" ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {movLoading ? (
                        <div className="py-10 text-center opacity-50">Cargando movimientos...</div>
                    ) : (
                        <>
                           {movimientos.length === 0 && <p className="text-center py-10 text-slate-500">Sin movimientos aún.</p>}
                           {movimientos.map((m) => (
                               <TransactionListItem
                                    key={m.id}
                                    tx={{
                                        id: m.id,
                                        monto: m.monto,
                                        moneda: tarjeta.moneda,
                                        descripcion: m.descripcion ?? MOV_TIPO_LABEL[m.tipo ?? "COMPRA"],
                                        ocurrioEn: m.ocurrioEn,
                                        direccion: m.tipo === "PAGO" || m.tipo === "CUOTA" ? "ENTRADA" : "SALIDA",
                                        categoria: null,
                                        cuenta: { nombre: "Tarjeta", moneda: tarjeta.moneda },
                                        cuentaId: tarjeta.cuentaId,
                                        usuarioId: "user",
                                        tipoTransaccion: null
                                    } as any}
                                    onEdit={() => {}} 
                                />
                           ))}
                        </>
                    )}
                </div>
            ) : (
                <InstallmentsTab 
                    compras={comprasActivas}
                    loading={loadingCompras}
                    moneda={tarjeta.moneda}
                    onPagar={handlePagarCuota}
                />
            )}
        </div>
      </div>

      {/* ================= MODAL: NUEVO MOVIMIENTO ================= */}
      {showMovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 animate-in zoom-in-95">
             <div className="relative overflow-hidden border-b border-slate-100 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {movForm.tipo === "CUOTA" ? "Abonar a cuota" : "Movimiento en tarjeta"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Esto actualiza la deuda y, si aplica, descuenta el saldo de tu cuenta origen.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowMovModal(false)}
                    className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white dark:border-white/10 dark:bg-black/30 dark:text-zinc-200 dark:hover:bg-white/10"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                      Deuda actual
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatMoney(utilizadoUI, tarjeta.moneda)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                      Después
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatMoney(previewNuevoSaldo, tarjeta.moneda)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                      Disponible
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(previewDisponible, tarjeta.moneda)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div
                    className={`h-full transition-all ${usoPctUI > 90 ? "bg-rose-500" : usoPctUI > 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: `${usoPctUI}%` }}
                  />
                </div>
             </div>
             
             <div className="p-6">
               {actionError && (
                 <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-500/10 dark:text-rose-300">
                   {actionError}
                 </div>
               )}

             <div className="space-y-4">
                 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SelectField 
                        label="Tipo" 
                        value={movForm.tipo} 
                        onChange={(v) => setMovForm(p => ({...p, tipo: v as MovimientoTipo}))} 
                        options={MOV_TIPO_OPTIONS}
                        disabled={movForm.tipo === "CUOTA"} // Bloquear si viene de la pestaña cuotas
                    />
                    
                    <div className="flex flex-col">
                        <MoneyField
                            label="Monto"
                            value={movForm.monto}
                            onChange={(v) => setMovForm(p => ({...p, monto: v}))}
                            currency={tarjeta.moneda}
                            minValue={100}
                            maxValue={100_000_000}
                            disabled={movForm.tipo === "INTERES" && movForm.autoCalcularInteres}
                        />
                        {movForm.tipo === "INTERES" && (
                          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={movForm.autoCalcularInteres}
                              onChange={(e) =>
                                setMovForm((p) => ({
                                  ...p,
                                  autoCalcularInteres: e.target.checked,
                                  monto: e.target.checked ? "" : p.monto,
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-white/20"
                            />
                            Calcular interés automáticamente (según TEA y días)
                          </label>
                        )}
                        {/* HINT DE ABONO A CAPITAL */}
                        {movForm.tipo === "CUOTA" && (
                            <p className="mt-1 px-1 text-[10px] leading-tight text-sky-600 dark:text-sky-400">
                                Puedes pagar más de lo sugerido. El excedente se aplicará como <b>Abono a Capital</b>.
                            </p>
                        )}
                    </div>
                 </div>

                 {(movForm.tipo === "INTERES" || movForm.tipo === "COMPRA" || movForm.tipo === "AVANCE") && (
                   <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
                     <div className="mb-2 flex items-center justify-between">
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                         Simulación (aprox.)
                       </p>
                       <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                         TEA {teaUI ? `${teaUI.toFixed(2)}%` : "—"} · diaria {(tasaDiariaUI * 100).toFixed(3)}%
                       </p>
                     </div>

                     {movForm.tipo === "INTERES" && movForm.autoCalcularInteres && (
                       <div className="grid grid-cols-3 gap-3">
                         <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
                           <p className="text-[10px] font-bold uppercase text-slate-400">Días</p>
                           <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                             {diasDesdeUltimoInteres}
                           </p>
                         </div>
                         <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
                           <p className="text-[10px] font-bold uppercase text-slate-400">Base</p>
                           <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                             {formatMoney(utilizadoUI, tarjeta.moneda)}
                           </p>
                         </div>
                         <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
                           <p className="text-[10px] font-bold uppercase text-slate-400">Interés</p>
                           <p className="mt-1 font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                             {formatMoney(interesAutoEstimado, tarjeta.moneda)}
                           </p>
                         </div>
                       </div>
                     )}

                     {(movForm.tipo === "COMPRA" || movForm.tipo === "AVANCE") && movimientoMontoNum > 0 && (
                       <div className="grid grid-cols-3 gap-3">
                         <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
                           <p className="text-[10px] font-bold uppercase text-slate-400">Hasta corte</p>
                           <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                             {diasHastaCorte} días
                           </p>
                         </div>
                         <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
                           <p className="text-[10px] font-bold uppercase text-slate-400">Hasta pago</p>
                           <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                             {diasHastaPago} días
                           </p>
                         </div>
                         <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20">
                           <p className="text-[10px] font-bold uppercase text-slate-400">Interés (a pago)</p>
                           <p className="mt-1 font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                             {formatMoney(interesCompraHastaPago, tarjeta.moneda)}
                           </p>
                         </div>
                       </div>
                     )}

                     <p className="mt-3 text-[10px] text-slate-400 dark:text-zinc-500">
                       Estimación simple por días (no usa saldo diario promedio ni gracia por pago total).
                     </p>
                   </div>
                 )}

                 <InputField 
                    label="Descripción" 
                    value={movForm.descripcion} 
                    onChange={(v) => setMovForm(p => ({...p, descripcion: v}))} 
                    placeholder="Ej: Cena, Uber, Abono..."
                 />

                 <InputField 
                    label="Fecha" 
                    type="datetime-local"
                    value={movForm.ocurrioEn} 
                    onChange={(v) => setMovForm(p => ({...p, ocurrioEn: v}))} 
                 />

                 {/* SI ES COMPRA */}
                 {movForm.tipo === "COMPRA" && (
                     <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input type="checkbox" checked={movForm.enCuotas} onChange={(e) => setMovForm(p => ({...p, enCuotas: e.target.checked}))} className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500" />
                            <span>Diferir a cuotas</span>
                        </label>
                        {movForm.enCuotas && (
                            <NumberField 
                                label="Número de Cuotas" 
                                value={movForm.cuotasTotales} 
                                onChange={(v) => setMovForm(p => ({...p, cuotasTotales: Number(v)}))} 
                            />
                        )}
                     </div>
                 )}

                 {/* SI ES PAGO O CUOTA (Require Cuenta Origen) */}
                 {(movForm.tipo === "PAGO" || movForm.tipo === "CUOTA") && (
                     <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/30 dark:bg-emerald-900/10">
                        <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                            <Wallet size={16} /> <span>Origen de los fondos</span>
                        </div>
                        <SelectField 
                            label="Cuenta Bancaria (De donde sale el dinero)"
                            placeholder="Selecciona cuenta..."
                            value={movForm.cuentaOrigenId}
                            onChange={(v) => setMovForm(p => ({...p, cuentaOrigenId: v}))}
                            options={cuentasActivas.map(c => ({ 
                                label: `${c.nombre} (Saldo: ${formatMoney(Number(c.saldo), c.moneda)})`, 
                                value: c.id 
                            }))}
                        />
                     </div>
                 )}
             </div>

             </div>
             <div className="flex justify-end gap-3 border-t border-slate-100 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                 <button onClick={() => setShowMovModal(false)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10">Cancelar</button>
                 <button onClick={handleRegistrarMovimiento} disabled={busy} className="rounded-full bg-sky-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 disabled:opacity-50">
                    {busy ? "Guardando..." : "Confirmar movimiento"}
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDITAR TARJETA ================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
             <div className="relative overflow-hidden border-b border-slate-100 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/5">
                <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Configuración de tarjeta</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Ajusta cupo, deuda, tasa y fechas de corte/pago.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white dark:border-white/10 dark:bg-black/30 dark:text-zinc-200 dark:hover:bg-white/10"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-5 text-white shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                        {editForm.emisor || "Emisor"}
                      </p>
                      <p className="mt-1 truncate text-lg font-bold tracking-wide">
                        {editForm.nombre || "Tarjeta"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <CreditCard size={18} className="text-white/80" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-white/60">Deuda</p>
                      <p className="font-mono text-xl font-bold">{formatMoney(Number(editForm.saldoActual || 0), tarjeta.moneda)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-white/60">Cupo</p>
                      <p className="font-mono text-sm text-white/70">{formatMoney(Number(editForm.cupoTotal || 0), tarjeta.moneda)}</p>
                    </div>
                  </div>
                </div>
             </div>

<div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
    <InputField 
        label="Nombre" 
        value={editForm.nombre} 
        onChange={(v) => setEditForm((p:any) => ({...p, nombre: v}))} 
    />
    <InputField 
        label="Emisor" 
        value={editForm.emisor} 
        onChange={(v) => setEditForm((p:any) => ({...p, emisor: v}))} 
    />
    
    {/* Usamos MoneyField para mejor UX en montos */}
    <MoneyField 
        label="Cupo Total" 
        value={editForm.cupoTotal} 
        onChange={(v) => setEditForm((p:any) => ({...p, cupoTotal: Number(v)}))} 
        currency={tarjeta.moneda}
        minValue={100}
        maxValue={100_000_000}
    />
    <MoneyField 
        label="Saldo Actual (Deuda)" 
        value={editForm.saldoActual} 
        onChange={(v) => setEditForm((p:any) => ({...p, saldoActual: Number(v)}))} 
        currency={tarjeta.moneda}
        minValue={100}
        maxValue={100_000_000}
    />
    
    {/* Tasas y Porcentajes */}
    <NumberField 
        label="Tasa E.A. (%)" 
        value={editForm.tasaEfectivaAnual} 
        onChange={(v) => setEditForm((p:any) => ({...p, tasaEfectivaAnual: Number(v)}))} 
    />
    <NumberField 
        label="% Pago Mínimo" 
        value={editForm.pagoMinimoPct} 
        onChange={(v) => setEditForm((p:any) => ({...p, pagoMinimoPct: Number(v)}))} 
    />

    {/* Fechas (Enteros) */}
    <NumberField 
        label="Día Corte" 
        value={editForm.diaCorte} 
        onChange={(v) => setEditForm((p:any) => ({...p, diaCorte: Number(v)}))} 
        placeholder="1-31"
    />
    <NumberField 
        label="Día Pago" 
        value={editForm.diaPago} 
        onChange={(v) => setEditForm((p:any) => ({...p, diaPago: Number(v)}))} 
        placeholder="1-31"
    />
</div>

             <div className="flex justify-end gap-3 border-t border-slate-100 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                 <button onClick={() => setShowEditModal(false)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10">Cancelar</button>
                 <button onClick={handleUpdateTarjeta} disabled={busy} className="rounded-full bg-sky-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 disabled:opacity-50">
                    {busy ? "Guardando..." : "Guardar cambios"}
                 </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponente simple para datos
function InfoCard({ label, value, icon: Icon }: any) {
    return (
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 shadow-sm text-center">
            <Icon size={20} className="text-slate-400 mb-1" />
            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{label}</span>
            <span className="text-lg font-bold text-slate-800 dark:text-white">{value}</span>
        </div>
    )
}
