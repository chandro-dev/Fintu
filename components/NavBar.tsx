"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export function NavBar() {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setIsSignedIn(Boolean(data.session));
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_evt, session) => {
      setIsSignedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSignedIn || pathname === "/") return null;

  return (
    <nav className="fixed bottom-3 left-1/2 z-50 flex w-[95%] max-w-3xl -translate-x-1/2 items-center justify-between rounded-full border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-[0_10px_50px_rgba(0,0,0,0.25)] backdrop-blur dark:border-white/10 dark:bg-gradient-to-r dark:from-slate-900/85 dark:via-black/80 dark:to-slate-900/85 dark:text-zinc-100">
      <NavLink href="/dashboard" active={pathname.startsWith("/dashboard")}>Dashboard</NavLink>
      <NavLink href="/cuentas" active={pathname.startsWith("/cuentas")}>Cuentas</NavLink>
      <NavLink href="/transacciones" active={pathname.startsWith("/transacciones")}>Transacciones</NavLink>
      <NavLink href="/categorias" active={pathname.startsWith("/categorias")}>Categorias</NavLink>
      <NavLink href="/tarjetas" active={pathname.startsWith("/tarjetas")}>Tarjetas</NavLink>
      <NavLink href="/prestamos" active={pathname.startsWith("/prestamos")}>Prestamos</NavLink>
      <NavLink href="/presupuestos" active={pathname.startsWith("/presupuestos")}>Planes</NavLink>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1 transition-colors " +
        (active
          ? "bg-white text-slate-900 shadow-inner shadow-white/40 dark:bg-sky-500 dark:text-white dark:shadow-sky-500/40"
          : "text-zinc-500 hover:bg-white/10 hover:text-white dark:text-zinc-300")
      }
    >
      {children}
    </Link>
  );
}
