"use client";

import { useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { Loading } from "@/components/ui/Loading";
import { CategoriaService } from "@/lib/services/CategoriaService";
import { InputField, SelectField } from "@/components/ui/Fields";

// 1. IMPORTAMOS TU LIBRERÍA (Ajusta los nombres según tu exportación real)
import { CategoryIcon, ICON_MAP } from "@/lib/categoryIcons"

// Iconos de UI (Solo los necesarios para la interfaz, no para categorías)
import { Plus, Edit3, Trash2, Tag, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

import type { Categoria } from "@/components/transactions/types";

export default function CategoriasPage() {
  const { session, loadingSession, categorias, refresh } = useAppData();
  const accessToken = session?.access_token;

  // Estados UI
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "GASTO",
    color: "#94a3b8",
    icono: "tag" 
  });

  // Obtener las llaves para el selector
  const availableIcons = Object.keys(ICON_MAP); 

  // Handlers
  const handleOpenCreate = () => {
    setEditingCat(null);
    setFormData({ nombre: "", tipo: "GASTO", color: "#ef4444", icono: "tag" });
    setShowModal(true);
    setError(null);
  };

  const handleOpenEdit = (cat: Categoria) => {
    setEditingCat(cat);
    setFormData({
      nombre: cat.nombre,
      tipo: cat.tipo,
      color: cat.color || "#94a3b8",
      icono: cat.icono || "tag"
    });
    setShowModal(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) return setError("El nombre es obligatorio");
    if (!accessToken) return;

    setBusy(true);
    setError(null);
    try {
      const payload = {
        nombre: formData.nombre,
        tipo: formData.tipo as "INGRESO" | "GASTO",
        color: formData.color,
        icono: formData.icono
      };

      if (editingCat) {
        await CategoriaService.actualizar(editingCat.id, payload, { accessToken });
      } else {
        await CategoriaService.crear(payload, { accessToken });
      }

      await refresh({ force: true });
      setShowModal(false);
    } catch (e) {
      setError("Error al guardar la categoría");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar categoría?") || !accessToken) return;
    setBusy(true);
    try {
      await CategoriaService.eliminar(id, { accessToken });
      await refresh({ force: true });
    } catch (e) {
      alert("No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  };

  if (loadingSession) return <Loading message="Cargando categorías..." />;

  const ingresos = categorias.filter(c => c.tipo === "INGRESO");
  const gastos = categorias.filter(c => c.tipo === "GASTO");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-300">
      <div className="mx-auto max-w-5xl px-6 py-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400 font-bold mb-1">Configuración</p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Categorías</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Personaliza tus etiquetas con colores e iconos.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 hover:bg-sky-500 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={18} />
            Nueva Categoría
          </button>
        </header>

        <div className="space-y-10">
          <SectionGrid 
            title="Gastos" 
            icon={ArrowDownCircle} 
            items={gastos} 
            onEdit={handleOpenEdit} 
            onDelete={handleDelete} 
            colorClass="text-rose-500"
          />

          <SectionGrid 
            title="Ingresos" 
            icon={ArrowUpCircle} 
            items={ingresos} 
            onEdit={handleOpenEdit} 
            onDelete={handleDelete} 
            colorClass="text-emerald-500"
          />
          
          {categorias.length === 0 && (
             <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                <Tag className="mx-auto text-slate-300 mb-2" size={48} />
                <p className="text-slate-500">No tienes categorías creadas.</p>
             </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold dark:text-white">
                {editingCat ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full">✕</button>
            </div>

            {error && <div className="mb-4 p-3 bg-rose-500/10 text-rose-500 rounded-lg text-sm">{error}</div>}

            <div className="space-y-5">
              <InputField
                label="Nombre"
                placeholder="Ej: Supermercado..."
                value={formData.nombre}
                onChange={(v) => setFormData(prev => ({ ...prev, nombre: v }))}
              />
              
              <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="Tipo"
                    value={formData.tipo}
                    onChange={(v) => {
                        const newColor = v === "INGRESO" ? "#10b981" : "#ef4444";
                        setFormData(prev => ({ ...prev, tipo: v, color: newColor }));
                    }}
                    options={[
                        { label: "Gasto", value: "GASTO" },
                        { label: "Ingreso", value: "INGRESO" },
                    ]}
                  />
                  
                  <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Color</label>
                      <div className="flex items-center gap-3 h-[42px] px-3 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/20">
                          <input 
                             type="color" 
                             value={formData.color}
                             onChange={(e) => setFormData(prev => ({...prev, color: e.target.value}))}
                             className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                          />
                          <span className="text-xs font-mono text-slate-500">{formData.color}</span>
                      </div>
                  </div>
              </div>

              {/* 3. SELECTOR DE ICONOS (Iterando sobre tu librería) */}
              <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Icono</label>
                 <div className="grid grid-cols-6 gap-2 p-3 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 max-h-[160px] overflow-y-auto custom-scrollbar">
                    {availableIcons.map((iconName) => (
                        <button
                            key={iconName}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, icono: iconName }))}
                            className={`
                                flex items-center justify-center p-2 rounded-lg transition-all aspect-square
                                ${formData.icono === iconName 
                                    ? 'bg-sky-500 text-white shadow-md scale-110' 
                                    : 'text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200'}
                            `}
                        >
                            {/* Usamos tu componente importado para renderizar la vista previa */}
                            <CategoryIcon name={iconName} size={18} />
                        </button>
                    ))}
                 </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">Cancelar</button>
              <button 
                onClick={handleSubmit} 
                disabled={busy}
                className="px-6 py-2 rounded-full bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500 disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTE DE GRID ---
function SectionGrid({ title, icon: Icon, items, onEdit, onDelete, colorClass }: any) {
    if (items.length === 0) return null;

    return (
        <section>
            <div className={`flex items-center gap-2 mb-4 ${colorClass}`}>
                <Icon size={20} />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                <span className="text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400 font-medium">
                    {items.length}
                </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((cat: Categoria) => (
                    <div key={cat.id} className="group relative flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-sky-500/30 transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                            {/* Usamos tu componente importado para renderizar el icono en la tarjeta */}
                            <div 
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105"
                                style={{ backgroundColor: cat.color || "#ccc" }}
                            >
                                <CategoryIcon name={cat.icono} size={22} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-base">{cat.nombre}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{cat.tipo}</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => onEdit(cat)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-sky-500"
                            >
                                <Edit3 size={18} />
                            </button>
                            <button 
                                onClick={() => onDelete(cat.id)}
                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}