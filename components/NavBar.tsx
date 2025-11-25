"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <nav className="fixed bottom-3 left-1/2 z-50 flex w-[95%] max-w-3xl -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 shadow-2xl backdrop-blur">
      <NavLink href="/dashboard">Dashboard</NavLink>
      <NavLink href="/cuentas">Cuentas</NavLink>
      <NavLink href="/transacciones">Transacciones</NavLink>
      <NavLink href="/categorias">Categorias</NavLink>
      <NavLink href="/tarjetas">Tarjetas</NavLink>
      <NavLink href="/prestamos">Prestamos</NavLink>
      <NavLink href="/presupuestos">Planes</NavLink>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-3 py-1 hover:bg-white/10 transition-colors">
      {children}
    </Link>
  );
}
