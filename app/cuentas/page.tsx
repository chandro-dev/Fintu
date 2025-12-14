"use client";
import { useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { Loading } from "@/components/ui/Loading";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountModal } from "@/components/accounts/AccountModal";
import { Plus } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney"; // Asegúrate de que esta función maneje COP

// Helper: Encuentra el ID de tipo 'NORMAL'
const useTipoCuentaNormalId = (tipos: any[]) => {
  return useMemo(() => 
    tipos?.find((t: any) => t.codigo === "NORMAL")?.id || "", 
  [tipos]);
};

// Helper: Formatea un número al estilo COP
const formatCOP = (value: number) => formatMoney(value, "COP");


function CuentasContent() {
  const router = useRouter();
  
  // 1. Obtención de datos del Contexto
  const { 
    cuentas, 
    tiposCuenta, 
    loadingSession, 
    loadingData, // Usamos loadingData para indicar que los datos se están cargando
    session,
    refresh 
  } = useAppData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  
  const tipoNormalId = useTipoCuentaNormalId(tiposCuenta);

  const handleCreate = () => {
    setEditingAccount(null);
    setModalOpen(true);
  };

  const handleCardClick = (id: string) => {
    router.push(`/cuentas/${id}`);
  };

  // 2. Cálculo del Saldo Total Consolidado
  const totalSaldo = useMemo(() => 
    cuentas.reduce((acc, c) => acc + Number(c.saldo), 0), 
  [cuentas]);

  // Manejo del estado de carga inicial o de sincronización
  if (loadingSession || (loadingData && !cuentas.length)) {
    return <Loading message="Sincronizando cuentas..." />;
  }

  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">
      <div className="mx-auto max-w-5xl flex flex-col gap-8">
        
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500 font-bold">
              Mis Finanzas
            </p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Cuentas
            </h1>
            <p className="text-slate-500 dark:text-zinc-400">
              Total consolidado: 
              <span className="font-semibold text-slate-900 dark:text-white ml-1">
                {formatCOP(totalSaldo)}
              </span>
              {loadingData && <span className="ml-2 animate-pulse text-xs text-sky-400">(Actualizando)</span>}
            </p>
          </div>
          
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-500 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={18} />
            Nueva cuenta
          </button>
        </header>

        {/* GRID DE CUENTAS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          
          {cuentas.length === 0 && !loadingData ? (
             <div className="col-span-full py-12 text-center text-slate-500 dark:text-zinc-400 border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
                 <p className="font-semibold">¡Comienza tu gestión financiera!</p>
                 <p className="text-sm">No tienes cuentas. Haz clic en "Nueva cuenta" para empezar.</p>
             </div>
          ) : (
            // Lista de AccountCard
            cuentas.map(cuenta => (
              <AccountCard 
                key={cuenta.id} 
                cuenta={cuenta} 
                onClick={() => handleCardClick(cuenta.id)}
              />
            ))
          )}
          
          {/* Botón "Fantasma" para crear (Si hay cuentas, lo ponemos al final del grid) */}
          {cuentas.length > 0 && (
            <button
              onClick={handleCreate}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-slate-400 transition-all hover:border-sky-400 hover:bg-sky-50/20 hover:text-sky-600 dark:border-white/10 dark:hover:bg-white/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 group-hover:bg-sky-100 dark:bg-white/5 dark:group-hover:bg-white/10">
                 <Plus size={24} />
              </div>
              <span className="font-medium">Agregar otra cuenta</span>
            </button>
          )}

        </div>

        {/* MODAL DE CREACIÓN/EDICIÓN */}
        <AccountModal 
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => refresh({ force: true })}
          accessToken={session?.access_token || ""}
          initialData={editingAccount}
          editingId={editingAccount?.id}
          tipoCuentaId={tipoNormalId}
        />

      </div>
    </div>
  );
}

export default function CuentasPage() {
  return (
    <Suspense fallback={<Loading message="Cargando vista de cuentas..." />}>
      <CuentasContent />
    </Suspense>
  );
}