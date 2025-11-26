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

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};
