"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import type { Cuenta, Categoria, Transaccion } from "@/components/transactions/types";

type AppDataContextValue = {
  session: Session | null;
  loadingSession: boolean;
  loadingData: boolean;
  error: string | null;
  cuentas: Cuenta[];
  categorias: Categoria[];
  transacciones: Transaccion[];
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabaseClient.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const accessToken = session?.access_token;
  const authHeaders = useMemo(
    () => ({
      credentials: "include" as const,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),
    [accessToken],
  );

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!accessToken) return;
      if (loadingData) return;
      if (!opts?.force && loaded && !dirty) return;

      setLoadingData(true);
      setError(null);
      try {
        const [cuentasRes, categoriasRes, txRes] = await Promise.all([
          fetch("/api/accounts", authHeaders),
          fetch("/api/categorias", authHeaders),
          fetch("/api/transactions", authHeaders),
        ]);

        if (!cuentasRes.ok || !categoriasRes.ok || !txRes.ok) {
          const errRes = !cuentasRes.ok
            ? await cuentasRes.json().catch(() => null)
            : !categoriasRes.ok
              ? await categoriasRes.json().catch(() => null)
              : await txRes.json().catch(() => null);
          throw new Error(errRes?.error || "No se pudo cargar la información");
        }

        setCuentas(await cuentasRes.json());
        setCategorias(await categoriasRes.json());
        setTransacciones(await txRes.json());
        setLoaded(true);
        setDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoadingData(false);
      }
    },
    [accessToken, authHeaders, dirty, loaded, loadingData],
  );

  const invalidate = useCallback(() => {
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
  }, [accessToken, refresh]);

  const value: AppDataContextValue = {
    session,
    loadingSession,
    loadingData,
    error,
    cuentas,
    categorias,
    transacciones,
    refresh,
    invalidate,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
