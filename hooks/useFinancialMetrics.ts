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
    [cuentas],
  );

  // 2.b Salud financiera (activos, pasivos, patrimonio, liquidez, runway, tasa de ahorro)
  const health = useMemo(() => {
    let activos = 0;
    let pasivos = 0;
    let efectivo = 0;
    let pasivoCortoPlazo = 0;

    const porTipo: { nombre: string; total: number; tipo: "activo" | "pasivo" }[] = [];
    const map = new Map<string, { nombre: string; total: number; tipo: "activo" | "pasivo" }>();

    cuentas.forEach((c) => {
      const codigo = c.tipoCuenta?.codigo || "OTRO";
      const saldo = Number(c.saldo || 0);
      const esPasivo = codigo === "TARJETA_CREDITO" || codigo === "PRESTAMO";

      if (esPasivo) {
        const deuda = Math.abs(saldo);
        pasivos += deuda;
        if (codigo === "TARJETA_CREDITO") pasivoCortoPlazo += deuda;
        const current =
          map.get(codigo) ?? { nombre: c.tipoCuenta?.nombre || codigo, total: 0, tipo: "pasivo" };
        current.total += deuda;
        map.set(codigo, current);
      } else {
        activos += saldo;
        if (codigo === "NORMAL") efectivo += Math.max(0, saldo);
        const current =
          map.get(codigo) ?? { nombre: c.tipoCuenta?.nombre || codigo, total: 0, tipo: "activo" };
        current.total += saldo;
        map.set(codigo, current);
      }
    });

    map.forEach((v) => porTipo.push(v));
    porTipo.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    const patrimonio = activos - pasivos;
    const liquidez = pasivoCortoPlazo > 0 ? efectivo / pasivoCortoPlazo : null;

    const savingsRate =
      totals.ingresos > 0 ? (totals.ingresos - totals.egresos) / totals.ingresos : null;

    const egresosPorMes = new Map<string, number>();
    txs.forEach((tx) => {
      if (tx.direccion !== "SALIDA") return;
      const key = new Date(tx.ocurrioEn).toISOString().slice(0, 7);
      egresosPorMes.set(key, (egresosPorMes.get(key) ?? 0) + Number(tx.monto));
    });
    const ultimosEgresos = Array.from(egresosPorMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3)
      .map(([, total]) => total);
    const egresoPromedioMensual =
      ultimosEgresos.length > 0
        ? ultimosEgresos.reduce((acc, n) => acc + n, 0) / ultimosEgresos.length
        : totals.egresos;
    const runwayMeses = egresoPromedioMensual > 0 ? (efectivo || activos) / egresoPromedioMensual : null;

    return {
      activos,
      pasivos,
      patrimonio,
      liquidez,
      savingsRate,
      egresoPromedioMensual,
      runwayMeses,
      porTipo,
      efectivo,
      pasivoCortoPlazo,
    };
  }, [cuentas, totals.ingresos, totals.egresos, txs]);

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
    health,
    flowByMonth,
    gastosPorCategoria,
    saldoPorTipoCuenta
  };
};
