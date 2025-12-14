"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { InputField, SelectField, NumberField } from "@/components/ui/Fields";
import { CuentasService } from "@/lib/services/CuentasService";

// Tipos locales
type CuentaForm = {
  nombre: string;
  moneda: string;
  saldoInicial: string; // Manejamos como string para el input
  institucion: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
  initialData?: any; // Tipar mejor si puedes
  editingId?: string | null;
  tipoCuentaId: string; // ID del tipo "NORMAL"
}

export function AccountModal({ open, onClose, onSuccess, accessToken, initialData, editingId, tipoCuentaId }: Props) {
  const [form, setForm] = useState<CuentaForm>({
    nombre: "", moneda: "COP", saldoInicial: "", institucion: ""
  });
  const [busy, setBusy] = useState(false);

  // Cargar datos al editar
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

  const handleSubmit = async () => {
    if (!form.nombre) return alert("Nombre requerido");
    
    setBusy(true);
    try {
      const payload: any = {
        nombre: form.nombre,
        tipoCuentaId,
        moneda: form.moneda,
        institucion: form.institucion || null
      };

      // Lógica de saldo/ajuste
      if (editingId) {
         // Si es edición, calculamos el ajuste
         const saldoActual = Number(initialData?.saldo || 0);
         const saldoNuevo = Number(form.saldoInicial || 0);
         const delta = saldoNuevo - saldoActual;
         
         if (delta !== 0) {
            payload.ajusteSaldo = delta;
            payload.ajusteDescripcion = "Ajuste manual de saldo";
         }
         await CuentasService.actualizar(editingId, payload, { accessToken });
      } else {
         // Creación
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

  return (
    <Modal open={open} onClose={onClose} title={editingId ? "Editar Cuenta" : "Nueva Cuenta"}>
      <div className="grid gap-4">
        <InputField 
          label="Nombre de la cuenta" 
          value={form.nombre} 
          onChange={v => setForm(f => ({...f, nombre: v}))} 
          placeholder="Ej: Nómina Bancolombia"
        />
        
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
           <NumberField
             label={editingId ? "Nuevo Saldo (Ajuste)" : "Saldo Inicial"}
             value={form.saldoInicial}
             onChange={v => setForm(f => ({...f, saldoInicial: v}))}
             currency={form.moneda} // Para el prefijo del input
           />
        </div>

        <InputField 
          label="Institución (Opcional)" 
          value={form.institucion} 
          onChange={v => setForm(f => ({...f, institucion: v}))} 
          placeholder="Ej: Bancolombia, Davivienda..."
        />

        <div className="flex justify-end gap-3 mt-4">
           <button onClick={onClose} className="btn-secondary">Cancelar</button>
           <button onClick={handleSubmit} disabled={busy} className="btn-primary">
             {busy ? "Guardando..." : "Guardar"}
           </button>
        </div>
      </div>
    </Modal>
  );
}