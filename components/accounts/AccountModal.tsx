"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { InputField, SelectField, NumberField, MoneyField } from "@/components/ui/Fields";
import { CuentasService } from "@/lib/services/CuentasService";
import { formatMoney } from "@/lib/formatMoney";
import { AlertTriangle, Trash2 } from "lucide-react";

// Tipos locales
type CuentaForm = {
  nombre: string;
  moneda: string;
  saldoInicial: string; 
  institucion: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
  initialData?: any; 
  editingId?: string | null;
  tipoCuentaId?: string| null; 
}

export function AccountModal({ 
  open, 
  onClose, 
  onSuccess, 
  accessToken, 
  initialData, 
  editingId, 
  tipoCuentaId 
}: Props) {
  
  const [form, setForm] = useState<CuentaForm>({
    nombre: "", moneda: "COP", saldoInicial: "", institucion: ""
  });
  const [busy, setBusy] = useState(false);

  // Cargar datos al abrir
  useEffect(() => {
    if (open) {
      if (initialData && editingId) {
        setForm({
          nombre: initialData.nombre,
          moneda: initialData.moneda,
          saldoInicial: String(initialData.saldo ?? 0),
          institucion: initialData.institucion ?? ""
        });
      } else {
        setForm({ nombre: "", moneda: "COP", saldoInicial: "", institucion: "" });
      }
    }
  }, [open, initialData, editingId]);

  // Calcular diferencia
  const originalBalance = Number(initialData?.saldo || 0);
  const newBalance = Number(form.saldoInicial || 0);
  const diff = newBalance - originalBalance;
  // Solo mostramos alerta si hay diferencia real (evita problemas con decimales flotantes)
  const showDiff = editingId && Math.abs(diff) > 0.01; 

  const handleSubmit = async () => {
    if (!form.nombre) return alert("Nombre requerido");
    
    setBusy(true);
    try {
      // 1. Datos básicos siempre se envían
      const payload: any = {
        nombre: form.nombre,
        tipoCuentaId,
        moneda: form.moneda,
        institucion: form.institucion || null
      };

      if (editingId) {
         // 2. Solo añadimos lógica de ajuste si el saldo cambió
         if (showDiff) {
            payload.ajusteSaldo = diff;
            payload.ajusteDescripcion = "Ajuste manual al editar cuenta";
         }
         // Si NO cambió el saldo, el backend hará un update simple solo del nombre
         await CuentasService.actualizar(editingId, payload, { accessToken });
      } else {
         payload.saldo = Number(form.saldoInicial || 0);
         await CuentasService.crear(payload, { accessToken });
      }

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error al guardar cuenta");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm("¿Eliminar cuenta y todas sus transacciones?")) return;
    setBusy(true);
    try {
        await CuentasService.eliminar(editingId, { accessToken });
        onSuccess();
        onClose();
    } catch (error) { alert("Error al eliminar"); } 
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editingId ? "Editar Cuenta" : "Nueva Cuenta"}>
      <div className="space-y-5">
        
        {/* Nombre e Institución */}
        <div className="grid gap-4">
            <InputField 
                label="Nombre de la cuenta" 
                value={form.nombre} 
                onChange={v => setForm(f => ({...f, nombre: v}))} 
                placeholder="Ej: Nómina Bancolombia"
            />
            <InputField 
                label="Institución (Opcional)" 
                value={form.institucion} 
                onChange={v => setForm(f => ({...f, institucion: v}))} 
                placeholder="Ej: Bancolombia, Nequi..."
            />
        </div>
        
        {/* Moneda y Saldo */}
        <div className="grid grid-cols-2 gap-4">
           <SelectField
             label="Moneda"
             value={form.moneda}
             onChange={v => setForm(f => ({...f, moneda: v}))}
             options={[
               { label: "Peso (COP)", value: "COP" },
               { label: "Dólar (USD)", value: "USD" },
               { label: "Euro (EUR)", value: "EUR" }
             ]}
           />
           <MoneyField
             label={editingId ? "Saldo Actual" : "Saldo Inicial"}
             value={form.saldoInicial}
             onChange={v => setForm(f => ({...f, saldoInicial: v}))}
             currency={form.moneda}
           />
        </div>

        {/* Feedback visual de ajuste */}
        {showDiff && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/50 dark:text-amber-200">
                <div className="flex items-center gap-2 font-semibold mb-1">
                    <AlertTriangle size={16} />
                    <span>El saldo ha cambiado</span>
                </div>
                <p className="opacity-90 text-xs">
                    Diferencia: <strong>{formatMoney(diff, form.moneda)}</strong>. Se creará una transacción de ajuste automáticamente.
                </p>
            </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10 mt-2">
           {editingId ? (
               <button onClick={handleDelete} type="button" className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg text-xs font-semibold flex items-center gap-1">
                 <Trash2 size={14} /> Eliminar
               </button>
           ) : <div />}

           <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-full">Cancelar</button>
                <button onClick={handleSubmit} disabled={busy} className="px-6 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-full shadow-lg disabled:opacity-50">
                    {busy ? "Guardando..." : "Guardar"}
                </button>
           </div>
        </div>
      </div>
    </Modal>
  );
}
