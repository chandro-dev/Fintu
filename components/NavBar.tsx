"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  LogOut
} from "lucide-react";

// Definimos la estructura de los links con sus iconos asociados
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
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar sesión
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setIsSignedIn(Boolean(data.session));
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_evt, session) => {
      setIsSignedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Detectar si es móvil para ajustar el layout inicial
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isSignedIn || pathname === "/") return null;

  return (
    <>
      {/* Spacer para desktop para evitar que el contenido quede debajo del nav fijo */}
      <div
        className={`hidden md:block transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      />

      <nav
        className={`
          fixed z-50 backdrop-blur-md transition-all duration-300 ease-in-out border border-white/10 shadow-2xl
          
          /* Estilos Móvil (Barra Inferior) */
          bottom-4 left-4 right-4 h-16 rounded-full bg-white/90 dark:bg-zinc-950/80 flex flex-row items-center justify-between px-6
          
          /* Estilos Desktop (Sidebar Lateral) */
          md:top-4 md:bottom-4 md:left-4 md:right-auto md:h-auto md:flex-col md:justify-start md:rounded-3xl md:bg-white md:dark:bg-zinc-950 md:px-3 md:py-6
          ${isCollapsed ? "md:w-20" : "md:w-64"}
        `}
      >
        {/* Botón Colapsar (Solo Desktop) */}
        <div className="hidden md:flex w-full justify-end mb-6 px-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors"
          >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Lista de Enlaces */}
        <div className="flex w-full flex-row justify-between gap-1 md:flex-col md:justify-start md:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                active={isActive}
                collapsed={isCollapsed}
                icon={item.icon}
                label={item.label}
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}

function NavLink({
  href,
  active,
  collapsed,
  icon: Icon,
  label
}: {
  href: string;
  active: boolean;
  collapsed: boolean;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`
        group flex items-center rounded-2xl transition-all duration-200
        
        /* Móvil */
        flex-col justify-center p-1
        
        /* Desktop */
        md:flex-row md:p-3 md:gap-3
        
        ${
          active
            ? "text-sky-600 dark:text-sky-400 md:bg-sky-50 md:dark:bg-sky-500/10"
            : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 md:hover:bg-slate-50 md:dark:hover:bg-white/5"
        }
      `}
    >
      {/* Icono */}
      <div
        className={`
        flex items-center justify-center transition-transform duration-200
        ${active ? "scale-110" : "group-hover:scale-105"}
      `}
      >
        <Icon
          size={22}
          strokeWidth={active ? 2.5 : 2}
          className={active ? "fill-sky-500/20" : ""} // Efecto sutil de relleno
        />
      </div>

      {/* Texto (Label) */}
      <span
        className={`
          text-[10px] font-medium mt-1
          md:mt-0 md:text-sm md:font-semibold
          overflow-hidden whitespace-nowrap transition-all duration-300
          ${
            collapsed
              ? "md:w-0 md:opacity-0 hidden md:block"
              : "md:w-auto md:opacity-100"
          }
          ${active ? "font-bold" : ""}
        `}
      >
        {label}
      </span>

      {/* Indicador de activo (Punto azul solo en desktop expandido) */}
      {!collapsed && active && (
        <div className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-sky-500" />
      )}
    </Link>
  );
}
