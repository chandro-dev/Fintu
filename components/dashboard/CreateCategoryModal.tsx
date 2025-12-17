"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { AVAILABLE_ICONS, AVAILABLE_COLORS, getCategoryIcon } from "@/lib/categoryIcons";
import { CategoriaService } from "@/lib/services/CategoriaService";
import { InputField } from "@/components/ui/Fields";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken?: string;
}

export function CreateCategoryModal({ open, onClose, onSuccess, accessToken }: Props) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"GASTO" | "INGRESO">("GASTO");
  const [color, setColor] = useState(AVAILABLE_COLORS[0]);
  const [icono, setIcono] = useState(AVAILABLE_ICONS[0]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!accessToken || !nombre) return;
    setBusy(true);
    try {
    await CategoriaService.crear({ nombre, tipo, color, icono }, { accessToken });
      onSuccess();
      onClose();
      setNombre(""); // Reset
    } catch (e) {
      alert("Error al crear categoría");
    } finally {
      setBusy(false);
    }
  };

  const SelectedIcon = getCategoryIcon(icono);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nueva Categoría</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          
          {/* Nombre y Tipo */}
          <div className="grid grid-cols-3 gap-4">
             <div className="col-span-2">
               <InputField label="Nombre" value={nombre} onChange={setNombre} placeholder="Ej: Supermercado" />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tipo</label>
               <select 
                 value={tipo}
                 onChange={(e) => setTipo(e.target.value as any)}
                 className="w-full rounded-xl border border-slate-200 bg-white py-3 px-3 text-sm font-semibold focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-white/10 dark:bg-black/40 dark:text-white"
               >
                 <option value="GASTO">Gasto</option>
                 <option value="INGRESO">Ingreso</option>
               </select>
             </div>
          </div>

          {/* Selector de Color */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Color</label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-sky-500 dark:ring-offset-zinc-900 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Selector de Icono */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Icono</label>
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {AVAILABLE_ICONS.map((iconName) => {
                const IconComp = getCategoryIcon(iconName);
                const isSelected = icono === iconName;
                return (
                  <button
                    key={iconName}
                    onClick={() => setIcono(iconName)}
                    className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                      isSelected 
                        ? 'bg-sky-500 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10'
                    }`}
                  >
                    <IconComp size={20} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10">
             <div className="h-10 w-10 flex items-center justify-center rounded-lg" style={{ backgroundColor: color, color: '#fff' }}>
                <SelectedIcon size={20} />
             </div>
             <div>
                <p className="font-bold text-slate-900 dark:text-white">{nombre || "Nombre de categoría"}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{tipo}</p>
             </div>
          </div>

          {/* Botón */}
          <button
            onClick={handleSubmit}
            disabled={busy || !nombre}
            className="w-full rounded-full bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 disabled:opacity-50 transition-all"
          >
            {busy ? "Creando..." : "Crear Categoría"}
          </button>
        </div>
      </div>
    </div>
  );
}