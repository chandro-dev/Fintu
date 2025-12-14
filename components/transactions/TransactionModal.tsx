"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal"; // Tu modal genérico
import { TransactionForm } from "./TransactionForm"; // El componente que me pasaste
import { TransaccionService } from "@/lib/services/TransaccionService";
import { TxForm, Cuenta, Categoria } from "./types";

// Valores por defecto para una nueva transacción
const emptyTx: TxForm = {
  cuentaId: "",
  monto: 0,
  direccion: "SALIDA",
  descripcion: "",
  ocurrioEn: "",
  categoriaId: "",
};

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void; // Para recargar el dashboard al guardar
  
  // Datos
  cuentas: Cuenta[];
  categorias: Categoria[];
  accessToken: string;

  // Edición (Opcionales)
  initialData?: TxForm;
  editingId?: string | null;
}

export function TransactionModal({
  open,
  onClose,
  onSuccess,
  cuentas,
  categorias,
  accessToken,
  initialData,
  editingId,
}: TransactionModalProps) {
  // 1. Estado local del formulario y de carga
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TxForm>(emptyTx);

  // 2. Calculamos la fecha actual para valores por defecto
  const nowLocal = useMemo(() => new Date().toISOString().slice(0, 16), []);

  // 3. Efecto: Cuando se abre el modal, reiniciamos o cargamos datos
  useEffect(() => {
    if (open) {
      if (editingId && initialData) {
        // Modo Edición: Cargar datos existentes
        setForm(initialData);
      } else {
        // Modo Creación: Resetear a valores limpios + fecha actual
        setForm({ ...emptyTx, ocurrioEn: nowLocal });
      }
    }
  }, [open, editingId, initialData, nowLocal]);

  // 4. Manejador para Guardar (Crear o Editar)
  const handleSubmit = async () => {
    // Validaciones básicas antes de enviar
    if (!form.cuentaId) return alert("Selecciona una cuenta");
    if (!form.monto) return alert("Ingresa un monto válido");

    setBusy(true);
    try {
      if (editingId) {
        // Actualizar existente
        await TransaccionService.actualizar(editingId, form, { accessToken });
      } else {
        // Crear nueva
        await TransaccionService.crear(form, { accessToken });
      }
      onSuccess(); // Refrescar Dashboard
      onClose();   // Cerrar Modal
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar la transacción.");
    } finally {
      setBusy(false);
    }
  };

  // 5. Manejador para Eliminar
  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm("¿Estás seguro de eliminar esta transacción?")) return;

    setBusy(true);
    try {
      await TransaccionService.eliminar(editingId, { accessToken });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? "Editar transacción" : "Nueva transacción"}
    >
      <TransactionForm
        // Estado
        form={form}
        busy={busy}
        isEditing={Boolean(editingId)}
        
        // Datos de contexto
        cuentas={cuentas}
        categorias={categorias}
        nowLocal={nowLocal}
        
        // Eventos de cambio de estado (Partial update)
        onChange={(partial) => setForm((prev) => ({ ...prev, ...partial }))}
        
        // Acciones
        onSubmit={handleSubmit}
        onDelete={editingId ? handleDelete : undefined} // Solo pasamos onDelete si estamos editando
        onCancel={onClose}
      />
    </Modal>
  );
}