export type CreditCardBalances = {
  saldoInteres: number;
  saldoCapital: number;
};

export type PaymentAllocation = {
  aplicadoInteres: number;
  aplicadoCapital: number;
  nuevoSaldoInteres: number;
  nuevoSaldoCapital: number;
  nuevoSaldoTotal: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function monthlyRateFromTEA(tasaEfectivaAnualPct: number) {
  const tea = Number(tasaEfectivaAnualPct) || 0;
  if (tea <= 0) return 0;
  return Math.pow(1 + tea / 100, 1 / 12) - 1;
}

export function estimateInstallmentPlan(params: {
  principal: number;
  months: number;
  tasaEfectivaAnualPct: number;
}) {
  const principal = Math.max(0, Number(params.principal) || 0);
  const months = Math.max(1, Math.trunc(Number(params.months) || 1));
  const r = monthlyRateFromTEA(params.tasaEfectivaAnualPct);

  if (principal === 0) {
    return {
      cuotaMensual: 0,
      interesTotal: 0,
      totalPagar: 0,
      tasaMensual: r,
      months,
    };
  }

  if (!r) {
    const cuota = principal / months;
    return {
      cuotaMensual: round2(cuota),
      interesTotal: 0,
      totalPagar: round2(principal),
      tasaMensual: 0,
      months,
    };
  }

  // Cuota fija (sistema francés): P * r / (1 - (1+r)^-n)
  const cuota = (principal * r) / (1 - Math.pow(1 + r, -months));
  const total = cuota * months;
  return {
    cuotaMensual: round2(cuota),
    interesTotal: round2(Math.max(0, total - principal)),
    totalPagar: round2(total),
    tasaMensual: r,
    months,
  };
}

export function allocatePaymentToInterestThenCapital(
  amount: number,
  balances: CreditCardBalances,
): PaymentAllocation {
  const pago = Math.max(0, Number(amount) || 0);
  const saldoInteres = Math.max(0, Number(balances.saldoInteres) || 0);
  const saldoCapital = Math.max(0, Number(balances.saldoCapital) || 0);

  const aplicadoInteres = Math.min(pago, saldoInteres);
  const restante = pago - aplicadoInteres;
  const aplicadoCapital = Math.min(restante, saldoCapital);

  const nuevoSaldoInteres = saldoInteres - aplicadoInteres;
  const nuevoSaldoCapital = saldoCapital - aplicadoCapital;

  return {
    aplicadoInteres: round2(aplicadoInteres),
    aplicadoCapital: round2(aplicadoCapital),
    nuevoSaldoInteres: round2(nuevoSaldoInteres),
    nuevoSaldoCapital: round2(nuevoSaldoCapital),
    nuevoSaldoTotal: round2(nuevoSaldoInteres + nuevoSaldoCapital),
  };
}
