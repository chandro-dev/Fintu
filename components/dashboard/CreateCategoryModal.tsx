"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { InputField, SelectField } from "@/components/ui/Fields";
import { Categoria } from "@/components/transactions/types";

type CategoriaForm = {
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string;
};

const emptyCategoria: CategoriaForm = {
  nombre: "",
  tipo: "GASTO",
  color: "#0ea5e9"
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
}

export function CreateCategoryModal({ open, onClose, onSuccess, accessToken }: Props) {
  const [form, setForm] = useState<CategoriaForm>(emptyCategoria);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!form.nombre) return alert("Nombre requerido");
    setBusy(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Error creando categoria");
      
      setForm(emptyCategoria);
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("No se pudo crear la categoría");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva categoría" maxWidth="max-w-md">
      <div className="grid gap-4">
        <InputField
          label="Nombre"
          value={form.nombre}
          onChange={(v) => setForm(prev => ({ ...prev, nombre: v }))}
        />
        <SelectField
          label="Tipo"
          value={form.tipo}
          onChange={(v) => setForm(prev => ({ ...prev, tipo: v as any }))}
          options={[
            { label: "Gasto", value: "GASTO" },
            { label: "Ingreso", value: "INGRESO" },
            { label: "Transferencia", value: "TRANSFERENCIA" }
          ]}
        />
        <InputField
          label="Color (Hex)"
          value={form.color || ""}
          onChange={(v) => setForm(prev => ({ ...prev, color: v }))}
        />
        <div className="flex justify-end gap-2 mt-2">
           <button onClick={onClose} className="px-4 py-2 text-sm rounded-full border border-slate-300 dark:border-white/20">Cancelar</button>
           <button 
             onClick={handleSubmit} 
             disabled={busy}
             className="px-4 py-2 text-sm rounded-full bg-emerald-500 text-white disabled:opacity-50"
           >
             {busy ? "Guardando..." : "Crear"}
           </button>
        </div>
      </div>
    </Modal>
  );
}