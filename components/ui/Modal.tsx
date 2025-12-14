"use client";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "max-w-md" | "max-w-lg" | "max-w-2xl" | "max-w-4xl"; // Para controlar el ancho
}

export function Modal({ 
  open, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-2xl" 
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // 1. Cerrar al presionar la tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      // Bloquear el scroll del body cuando el modal está abierto
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restaurar el scroll
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  // 2. Si no está abierto, no renderizamos nada (o null)
  if (!open) return null;

  return (
    // Backdrop (Fondo oscuro)
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300"
      aria-modal="true"
      role="dialog"
      onClick={onClose} // Clic en el fondo cierra el modal
    >
      {/* Contenedor del Modal */}
      <div 
        ref={modalRef}
        className={`relative w-full ${maxWidth} transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-zinc-950 dark:border dark:border-white/10`}
        onClick={(e) => e.stopPropagation()} // Evita que el clic dentro del modal lo cierre
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="group rounded-full border border-slate-200 p-1 transition-colors hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            aria-label="Cerrar modal"
          >
            {/* Icono X SVG simple */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className="h-5 w-5 text-slate-500 group-hover:text-slate-700 dark:text-zinc-400 dark:group-hover:text-white"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-2 text-slate-600 dark:text-zinc-300">
          {children}
        </div>
      </div>
    </div>
  );
}