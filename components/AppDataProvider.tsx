"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import type { Cuenta, Categoria, Transaccion } from "@/components/transactions/types";

// 1. Tipos de Datos (Mantener el mismo que definimos)
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
  
  // Datos principales
  cuentas: Cuenta[];
  categorias: Categoria[];
  transacciones: Transaccion[];
  tiposCuenta: TipoCuenta[]; 
  
  // Acciones
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Estados de datos
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [tiposCuenta, setTiposCuenta] = useState<TipoCuenta[]>([]);

  // Estados de control
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false); 

  // --- GESTIÓN DE SESIÓN ---
  useEffect(() => {
    // Escuchar cambios de autenticación
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
  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!accessToken) {
        // Si no hay token, limpiamos y salimos
        setCuentas([]);
        setCategorias([]);
        setTransacciones([]);
        setTiposCuenta([]);
        setLoaded(false);
        return;
      }
      
      if (loadingData) return;
      if (!opts?.force && loaded && !dirty) return; // Prevención de recarga innecesaria

      setLoadingData(true);
      setError(null);

      const headers = { Authorization: `Bearer ${accessToken}` };

      try {
        // Ejecución paralela de todos los endpoints de datos
        const [cuentasRes, categoriasRes, txRes, tiposRes] = await Promise.all([
          fetch("/api/accounts", { headers }),
          fetch("/api/categorias", { headers }),
          fetch("/api/transactions", { headers }),
          fetch("/api/tipos-cuenta", { headers }),
        ]);

        // Verificación de errores en las respuestas
        if (!cuentasRes.ok || !categoriasRes.ok || !txRes.ok || !tiposRes.ok) {
          // Intentamos extraer el error del cuerpo si es posible
          const errorDetail = await Promise.race([
            cuentasRes.json().catch(() => null),
            categoriasRes.json().catch(() => null),
            txRes.json().catch(() => null),
            tiposRes.json().catch(() => null),
          ]);
          throw new Error(errorDetail?.error || "Error al cargar la información (código 500/401/404)");
        }

        // Actualización atómica del estado (una sola vez)
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
        setLoadingData(false);
      }
    },
    [accessToken, dirty, loaded, loadingData]
  );

  // --- EFECTO DISPARADOR (MEJORA CRÍTICA) ---
  useEffect(() => {
    if (accessToken) {
      // 🔴 Disparo inicial/cambio de usuario: Si el token cambia, forzamos la recarga.
      // Esto resuelve el problema de tener que cambiar de pestaña.
      refresh({ force: true });
    }
  }, [accessToken, refresh]);

  // --- ACCIÓN DE INVALIDACIÓN ---
  const invalidate = useCallback(() => {
    setDirty(true);
  }, []);

  // --- VALORES DEL CONTEXTO ---
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

  // Puedes añadir un indicador visual aquí si quieres:
  // if (loadingSession) return <div className="loading-screen">Cargando sesión...</div>

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}