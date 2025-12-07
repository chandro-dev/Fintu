// utils/formatMoney.ts
export const formatMoney = (
  value: number | string | null | undefined,
  currency = "COP",
  locale = "es-CO"
) => {
  // Solo para depuración:
  // console.log("formatMoney value:", value, "typeof:", typeof value);

  let n: number;

  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    // Convertir string a número (por si viene como "12345.67" o "12345")
    const parsed = Number(value.replace(/,/g, "."));
    n = Number.isFinite(parsed) ? parsed : 0;
  } else {
    n = 0;
  }

  const safeCurrency =
    typeof currency === "string" && currency.trim().length === 3
      ? currency.trim().toUpperCase()
      : "COP";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch (_err) {
    // Si el código de moneda sigue siendo inválido, caer a COP.
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }
};
