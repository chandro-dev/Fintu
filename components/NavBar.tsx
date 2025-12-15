"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Tags,
  CreditCard,
  TrendingUp,
  PieChart,
  Menu,
  ChevronLeft,
  LogOut,
  Power
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/transacciones", label: "Transacciones", icon: ArrowRightLeft },
  { href: "/categorias", label: "Categorías", icon: Tags },
  { href: "/tarjetas", label: "Tarjetas", icon: CreditCard },
  { href: "/prestamos", label: "Préstamos", icon: TrendingUp },
  { href: "/presupuestos", label: "Planes", icon: PieChart }
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // Por defecto abierto en desktop

  // Detectar sesión
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setIsSignedIn(Boolean(data.session));
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_evt, session) => {
      setIsSignedIn(Boolean(session));
      if (!session) router.replace("/login");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut();
  };

  if (!isSignedIn || pathname === "/" || pathname === "/login") return null;

  return (
    <>
      {/* ============================================================
          VERSION DESKTOP (Sidebar Lateral)
          Oculto en 'md' hacia abajo (hidden md:flex)
      ============================================================= */}
      
      {/* Spacer para empujar el contenido principal a la derecha */}
      <div
        className={`hidden md:block shrink-0 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      />

      <aside
        className={`
          hidden md:flex flex-col fixed left-0 top-0 h-screen z-50
          bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-white/10
          transition-[width] duration-300 ease-in-out shadow-sm
          ${isCollapsed ? "w-20" : "w-64"}
        `}
      >
        {/* Header del Sidebar (Logo + Toggle) */}
        <div className="flex items-center justify-between p-4 h-16 border-b border-slate-100 dark:border-white/5">
          {!isCollapsed && (
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white animate-in fade-in duration-300">
              Fintu<span className="text-sky-500">.</span>
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${isCollapsed ? "mx-auto" : ""}`}
          >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Lista de Navegación Desktop */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {NAV_ITEMS.map((item) => (
            <DesktopNavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Footer del Sidebar (Usuario / Logout) */}
        <div className="p-3 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={handleSignOut}
            className={`
              flex items-center w-full rounded-xl p-3 text-rose-500 
              hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all duration-200
              ${isCollapsed ? "justify-center" : "gap-3"}
            `}
            title="Cerrar sesión"
          >
            <LogOut size={20} />
            {!isCollapsed && (
              <span className="text-sm font-medium">Cerrar sesión</span>
            )}
          </button>
        </div>
      </aside>

      {/* ============================================================
          VERSION MOVIL (Bottom Dock)
          Visible solo en 'md' hacia abajo (md:hidden)
      ============================================================= */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 flex justify-center">
        <nav className="
          flex items-center gap-1 p-2 rounded-2xl
          bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl
          border border-slate-200/60 dark:border-white/10
          shadow-2xl shadow-sky-900/10
          max-w-full overflow-x-auto no-scrollbar
        ">
          {NAV_ITEMS.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
            />
          ))}
          
          {/* Separador vertical pequeño */}
          <div className="w-[1px] h-6 bg-slate-200 dark:bg-white/10 mx-1" />
          
          <button
            onClick={handleSignOut}
            className="p-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <Power size={20} />
          </button>
        </nav>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------
// Componente de Enlace para Desktop
// ----------------------------------------------------------------------
function DesktopNavLink({
  item,
  isActive,
  isCollapsed
}: {
  item: typeof NAV_ITEMS[0];
  isActive: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={isCollapsed ? item.label : undefined}
      className={`
        group flex items-center rounded-xl transition-all duration-200
        ${isCollapsed ? "justify-center p-3" : "px-4 py-3 gap-3"}
        ${
          isActive
            ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 font-semibold"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
        }
      `}
    >
      <item.icon
        size={20}
        className={`transition-transform duration-200 ${
          isActive ? "scale-110" : "group-hover:scale-105"
        }`}
      />
      
      {!isCollapsed && (
        <span className="text-sm whitespace-nowrap overflow-hidden">
          {item.label}
        </span>
      )}

      {/* Indicador activo (punto azul) */}
      {!isCollapsed && isActive && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500" />
      )}
    </Link>
  );
}

// ----------------------------------------------------------------------
// Componente de Enlace para Móvil
// ----------------------------------------------------------------------
function MobileNavLink({
  item,
  isActive
}: {
  item: typeof NAV_ITEMS[0];
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`
        relative flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-300
        min-w-[3.5rem]
        ${
          isActive
            ? "text-sky-500"
            : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        }
      `}
    >
      {/* Fondo activo animado */}
      {isActive && (
        <span className="absolute inset-0 bg-sky-50 dark:bg-sky-500/10 rounded-xl -z-10 animate-in zoom-in-95 duration-200" />
      )}

      <item.icon
        size={22}
        strokeWidth={isActive ? 2.5 : 2}
        className={`transition-transform duration-200 ${isActive ? "-translate-y-0.5" : ""}`}
      />
      
      {/* Indicador inferior (Punto) en lugar de texto para ahorrar espacio */}
      {isActive && (
        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-sky-500" />
      )}
    </Link>
  );
}