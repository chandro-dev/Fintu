import { useMemo } from "react";
import { Cuenta, Transaccion } from "@/components/transactions/types";

export const useFinancialMetrics = (txs: Transaccion[], cuentas: Cuenta[]) => {
  // 1. Totales Generales
  const totals = useMemo(() => {
    const ingresos = txs
      .filter((t) => t.direccion === "ENTRADA")
      .reduce((acc, t) => acc + Number(t.monto), 0);
    const egresos = txs
      .filter((t) => t.direccion === "SALIDA")
      .reduce((acc, t) => acc + Number(t.monto), 0);
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [txs]);

  // 2. Saldo Total en Cuentas
  const totalSaldo = useMemo( 
    () => cuentas.reduce((acc, c) => acc + Number(c.saldo || 0), 0),
    [cuentas]
  );

  // 3. Datos para la Gráfica de Flujo (Ingreso vs Gasto mensual)
  const flowByMonth = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number }>();
    txs.forEach((tx) => {
      const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7); // YYYY-MM
      const current = map.get(key) ?? { ingresos: 0, egresos: 0 };
      if (tx.direccion === "ENTRADA") current.ingresos += Number(tx.monto);
      else current.egresos += Number(tx.monto);
      map.set(key, current);
    });
    // Retornamos array ordenado, últimos 4 meses
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4);
  }, [txs]);

  // 4. Gastos por Categoría (Top 4)
  const gastosPorCategoria = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number; color?: string }>();
    txs
      .filter((tx) => tx.direccion === "SALIDA" && tx.categoria)
      .forEach((tx) => {
        const id = tx.categoria!.id;
        const current = map.get(id) ?? {
          nombre: tx.categoria!.nombre,
          total: 0,
          color: tx.categoria!.color || "#0ea5e9"
        };
        current.total += Number(tx.monto);
        map.set(id, current);
      });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [txs]);

  // 5. Saldos por Tipo de Cuenta
  const saldoPorTipoCuenta = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number }>();
    cuentas.forEach((c) => {
        const nombre = c.tipoCuenta?.nombre ?? "Otros";
        const current = map.get(nombre) ?? { nombre, total: 0 };
        current.total += Number(c.saldo || 0);
        map.set(nombre, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cuentas]);

  return {
    totals,
    totalSaldo,
    flowByMonth,
    gastosPorCategoria,
    saldoPorTipoCuenta
  };
};