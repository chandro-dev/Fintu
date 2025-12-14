import { useCachedResource } from "@/lib/useCachedResource";
import { Cuenta, Transaccion, Categoria } from "@/components/transactions/types";

export const useDashboardData = (userId: string | undefined, accessToken: string | undefined) => {
  const authHeaders = accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : {};

  // CORRECCIÓN: Usamos "" en lugar de null para complacer a TypeScript
  // Si no hay sesión, la key será una cadena vacía.
  const cacheKey = (accessToken && userId) ? userId : "";

  // Cuentas
  const cuentasRes = useCachedResource<Cuenta[]>(
    cacheKey ? `cuentas:${cacheKey}` : "", // Enviamos "" en vez de null
    async () => {
      if (!accessToken) return []; // El fetcher se protege a sí mismo
      const res = await fetch("/api/accounts", authHeaders);
      if (!res.ok) throw new Error("Error cargando cuentas");
      return res.json();
    },
    { refreshOnMount: true }
  );

  // Categorías
  const categoriasRes = useCachedResource<Categoria[]>(
    cacheKey ? `categorias:${cacheKey}` : "",
    async () => {
      if (!accessToken) return [];
      const res = await fetch("/api/categorias", authHeaders);
      if (!res.ok) throw new Error("Error cargando categorias");
      return res.json();
    },
    { refreshOnMount: true }
  );

  // Transacciones
  const txsRes = useCachedResource<Transaccion[]>(
    cacheKey ? `txs:${cacheKey}` : "",
    async () => {
      if (!accessToken) return [];
      const res = await fetch("/api/transactions", authHeaders);
      if (!res.ok) throw new Error("Error cargando transacciones");
      return res.json();
    },
    { refreshOnMount: true }
  );

  const refreshAll = async () => {
    if (!accessToken) return;
    await Promise.all([
      cuentasRes.refresh(),
      categoriasRes.refresh(),
      txsRes.refresh()
    ]);
  };

  return {
    cuentas: cuentasRes.data || [],
    categorias: categoriasRes.data || [],
    txs: txsRes.data || [],
    
    // Ajustamos la lógica de loading para que no dependa de null
    loading: (!cacheKey) || (cuentasRes.loading || categoriasRes.loading || txsRes.loading),
    
    error: cuentasRes.error || categoriasRes.error || txsRes.error,
    refreshAll,
    invalidateAll: () => {
        cuentasRes.invalidate();
        categoriasRes.invalidate();
        txsRes.invalidate();
    }
  };
};