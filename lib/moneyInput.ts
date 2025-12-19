export type NormalizeMoneyInputOptions = {
  allowNegative?: boolean;
  decimals?: number; // 0..n
};

// Normaliza inputs de dinero para que `Number()` funcione:
// - Acepta miles con `.` o `'` (ej: 1.000, 1'000.000)
// - Acepta decimales con `,` o `.` (ej: 10,5 o 10.5)
// - Devuelve string con separador decimal `.` y sin separadores de miles
export function normalizeMoneyInput(
  rawValue: string,
  { allowNegative = false, decimals = 2 }: NormalizeMoneyInputOptions = {},
): string {
  if (!rawValue) return "";

  let raw = rawValue.replace(/\s/g, "");

  // Mantener solo dígitos, separadores comunes y signo.
  raw = raw.replace(/[^\d.,'-]/g, "");

  // Signo
  let isNegative = false;
  if (allowNegative && raw.includes("-")) {
    isNegative = raw.trim().startsWith("-");
  }
  raw = raw.replace(/-/g, "");

  // Apostrofe siempre se asume como separador de miles
  raw = raw.replace(/'/g, "");

  const hasComma = raw.includes(",");
  const dotCount = (raw.match(/\./g) || []).length;

  // Determinar separador decimal:
  // - Si hay coma, asumimos coma como decimal (estilo es-CO), y puntos como miles.
  // - Si no hay coma:
  //   - Si hay múltiples puntos => puntos son miles.
  //   - Si hay un punto => decimal solo si los decimales parecen "reales" (1-2 dígitos) y no parece miles.
  let decimalSeparator: "," | "." | null = null;
  if (hasComma) {
    decimalSeparator = ",";
  } else if (dotCount === 1) {
    const [left, right = ""] = raw.split(".");
    const rightLen = right.length;
    const looksLikeDecimal = rightLen > 0 && rightLen <= Math.max(0, decimals);
    const looksLikeThousands = rightLen === 3 && left.length > 0;
    decimalSeparator = looksLikeDecimal && !looksLikeThousands ? "." : null;
  } else {
    decimalSeparator = null;
  }

  if (decimalSeparator === ",") {
    // Quitar miles con puntos y dejar coma como decimal
    raw = raw.replace(/\./g, "");
    raw = raw.replace(",", ".");
  } else if (decimalSeparator === ".") {
    // Dejar un solo punto como decimal; si hubiese algo raro lo normalizamos
    const parts = raw.split(".");
    raw = `${parts[0]}.${parts.slice(1).join("")}`;
  } else {
    // Sin decimales: todos los puntos son miles
    raw = raw.replace(/\./g, "");
  }

  // Limitar decimales
  if (decimals >= 0 && raw.includes(".")) {
    const [intPart, decimalPart = ""] = raw.split(".");
    raw = `${intPart}.${decimalPart.slice(0, decimals)}`;
  }

  // Limpiar casos como "." o ""
  raw = raw.replace(/^\./, "0.");
  raw = raw.replace(/^0+(?=\d)/, "0");
  if (raw === "0.") raw = "0";

  return allowNegative && isNegative ? `-${raw}` : raw;
}

// Formatea un string/number al estilo es-CO (miles con "." y decimales con ",")
export function formatMoneyInput(rawValue: string | number): string {
  if (rawValue === null || rawValue === undefined) return "";
  const raw = typeof rawValue === "number" ? rawValue.toString() : rawValue;
  if (!raw) return "";

  const isNegative = raw.startsWith("-");
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [intPart = "", decimalPart] = unsigned.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  let result = formattedInt;
  if (decimalPart !== undefined && decimalPart.length > 0) {
    result += `,${decimalPart}`;
  }
  return isNegative ? `-${result}` : result;
}

export function parseMoneyInputToNumber(
  rawValue: string,
  options?: NormalizeMoneyInputOptions,
): number {
  const normalized = normalizeMoneyInput(rawValue, options);
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

