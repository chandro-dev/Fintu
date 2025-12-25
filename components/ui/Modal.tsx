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
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm p-0 transition-opacity duration-300 dark:bg-black/60 sm:p-4"
      aria-modal="true"
      role="dialog"
      onClick={onClose} // Clic en el fondo cierra el modal
    >
      {/* Contenedor del Modal */}
      <div 
        ref={modalRef}
        className={`relative flex w-full transform flex-col overflow-hidden bg-white shadow-2xl transition-all dark:bg-zinc-950 dark:border dark:border-white/10
          h-[100dvh] max-h-[100dvh] rounded-none p-4
          sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6
          ${maxWidth}`}
        onClick={(e) => e.stopPropagation()} // Evita que el clic dentro del modal lo cierre
      >
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between bg-white/95 px-4 pt-4 pb-3 backdrop-blur dark:bg-zinc-950/95 sm:static sm:z-auto sm:mx-0 sm:mt-0 sm:mb-6 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
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
        <div className="min-h-0 flex-1 overflow-y-auto text-slate-600 dark:text-zinc-300 sm:mt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
