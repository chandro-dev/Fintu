"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/cuentas", label: "Cuentas", icon: "💳" },
  { href: "/transacciones", label: "Transacciones", icon: "🔁" },
  { href: "/categorias", label: "Categorias", icon: "🏷️" },
  { href: "/tarjetas", label: "Tarjetas", icon: "💸" },
  { href: "/prestamos", label: "Prestamos", icon: "📈" },
  { href: "/presupuestos", label: "Planes", icon: "📊" }
];

export function NavBar() {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setIsSignedIn(Boolean(data.session));
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_evt, session) => {
      setIsSignedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const activeHref = useMemo(() => pathname.split("?")[0], [pathname]);

  if (!isSignedIn || pathname === "/") return null;

  return (
    <nav
      className={`fixed bottom-3 left-1/2 z-50 flex w-[95%] md:h-[95%] max-w-md -translate-x-1/2 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-2xl backdrop-blur transition-all duration-200 dark:border-white/10 dark:bg-black/70 dark:text-zinc-100
        md:left-3 md:top-3 md:bottom-auto md:w-auto md:max-w-none xl:-translate-x-0 md:flex-col md:items-stretch md:gap-5 md:rounded-3xl md:px-4 md:py-4 ${
          collapsed ? "md:w-20" : "md:w-72"
        }`}
    >
      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex w-full flex-row items-center gap-1 overflow-hidden md:flex md:flex-col md:space-y-1 md:gap-0flex  justify-center rounded-2xl border border-white/20 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          <span>{collapsed ? "≡" : "Menú"}</span>
        </button>
      </div>

      <div className="flex w-full flex-row items-start justify-between gap-1 overflow-visible md:flex md:flex-col md:space-y-1 md:gap-0">
        {links.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            active={activeHref.startsWith(link.href)}
            collapsed={collapsed}
            icon={link.icon}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  collapsed,
  icon,
  children
}: {
  href: string;
  active: boolean;
  collapsed: boolean;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={children?.toString()}
      className={`flex flex-col gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition
              md:flex-row md:items-center md:gap-0 md:px-1
    ${
      active
        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
        : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-white/10"
    }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl  bg-white/70 text-base font-bold text-slate-900 dark:bg-white/10 dark:text-white">
        {collapsed ? icon : children?.toString().slice(0, 2).toUpperCase()}
      </span>

      <span
        className={`
          hidden
      md:text-sm
      ${collapsed ? "md:hidden" : "md:inline"}
      leading-none
    `}
      >
        {children}
      </span>
    </Link>
  );
}
