"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import type { Cuenta, Categoria, Transaccion } from "@/components/transactions/types";

export type TipoCuenta = {
  id: string;
  codigo: string;
  nombre: string;
};

type AppDataContextValue = {
  session: Session | null;
  loadingSession: boolean;
  loadingData: boolean;
  error: string | null;
  
  cuentas: Cuenta[];
  categorias: Categoria[];
  transacciones: Transaccion[];
  tiposCuenta: TipoCuenta[]; 
  
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [tiposCuenta, setTiposCuenta] = useState<TipoCuenta[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false); 

  // --- GESTIÓN DE SESIÓN ---
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

  // --- FUNCIÓN DE CARGA DE DATOS (REFRESH) ---
  // 🔴 CORRECCIÓN CLAVE: Eliminamos loaded, loadingData y dirty de dependencias,
  // y en su lugar usamos las funciones de estado para leer/escribir.
  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!accessToken) {
        setCuentas([]);
        setCategorias([]);
        setTransacciones([]);
        setTiposCuenta([]);
        setLoaded(false);
        setDirty(false); // Limpiamos dirty
        return;
      }
      
      // Leemos el estado actual *antes* de entrar al bloque asíncrono
      let currentLoadingData = false;
      let currentLoaded = false;
      let currentDirty = false;
      
      // Usamos el hook de state para obtener el valor más reciente 
      // y prevenir ciclos, ya que set* es estable.
      setLoadingData(prev => { 
          currentLoadingData = prev;
          return prev; 
      });
      setLoaded(prev => {
          currentLoaded = prev;
          return prev;
      });
      setDirty(prev => {
          currentDirty = prev;
          return prev;
      });


      if (currentLoadingData) return;
      if (!opts?.force && currentLoaded && !currentDirty) return;

      setLoadingData(true);
      setError(null);

      const headers = { Authorization: `Bearer ${accessToken}` };

      try {
        const [cuentasRes, categoriasRes, txRes, tiposRes] = await Promise.all([
          fetch("/api/accounts", { headers }),
          fetch("/api/categorias", { headers }),
          fetch("/api/transactions", { headers }),
          fetch("/api/tipos-cuenta", { headers }),
        ]);

        if (!cuentasRes.ok || !categoriasRes.ok || !txRes.ok || !tiposRes.ok) {
          const errorDetail = await Promise.race([
            cuentasRes.json().catch(() => null),
            categoriasRes.json().catch(() => null),
            txRes.json().catch(() => null),
            tiposRes.json().catch(() => null),
          ]);
          throw new Error(errorDetail?.error || "Error al cargar la información (código 500/401/404)");
        }

        const [cuentasData, categoriasData, txData, tiposData] = await Promise.all([
          cuentasRes.json(),
          categoriasRes.json(),
          txRes.json(),
          tiposRes.json()
        ]);

        setCuentas(cuentasData);
        setCategorias(categoriasData);
        setTransacciones(txData);
        setTiposCuenta(tiposData);

        setLoaded(true);
        setDirty(false);
      } catch (err) {
        console.error("Error al refrescar datos:", err);
        setError(err instanceof Error ? err.message : "Error desconocido al cargar");
      } finally {
        setLoadingData(false); // Garantizamos que loadingData se apague
      }
    },
    // 🔴 Dependencia mínima y estable: solo accessToken
    [accessToken] 
  );

  // --- EFECTO DISPARADOR ---
  // Este efecto es estable y solo llama a la función estable 'refresh'.
  useEffect(() => {
    if (accessToken) {
      refresh({ force: true });
    }
  }, [accessToken, refresh]);

  // --- ACCIÓN DE INVALIDACIÓN ---
  const invalidate = useCallback(() => {
    setDirty(true);
  }, []);

  const value: AppDataContextValue = {
    session,
    loadingSession,
    loadingData,
    error,
    cuentas,
    categorias,
    transacciones,
    tiposCuenta,
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