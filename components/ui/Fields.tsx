"use client";

import React from "react";
import { formatMoneyInput, normalizeMoneyInput } from "@/lib/moneyInput";

// ============================================================================
// INPUT FIELD (Ya lo tenías bien, lo mantengo igual)
// ============================================================================
interface InputFieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string | number;
  onChange: (value: string) => void;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
  disabled?: boolean; 
}

export function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoFocus,
  disabled,
}: InputFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/30 
        ${disabled ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-white/5" : ""}`}
      />
    </label>
  );
}

// ============================================================================
// NUMBER FIELD (Mantenemos tu diseño)
// ============================================================================
export function NumberField({
  label,
  value,
  onChange,
  isCurrency = false,
  currency = "USD",
  allowNegative = false,
  disabled = false,
  placeholder,
  decimals = 2,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  isCurrency?: boolean;
  currency?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  placeholder?: string;
  decimals?: number;
}) {
  const normalizedValue =
    value === undefined || value === null ? "" : value;
  const displayValue = isCurrency
    ? formatMoneyInput(normalizedValue)
    : normalizedValue;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isCurrency) {
      const sanitized = normalizeMoneyInput(event.target.value, {
        allowNegative,
        decimals,
      });
      onChange(sanitized);
    } else {
      onChange(event.target.value);
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-300">
      {label}
      <div className="flex items-stretch gap-2">
        {isCurrency && (
          <span className="flex items-center rounded-lg border border-black/10 bg-white/70 px-3 text-xs text-slate-500 dark:border-white/10 dark:bg-black/30 dark:text-zinc-400">
            {currency}
          </span>
        )}
        <input
          type={isCurrency ? "text" : "number"}
          step={isCurrency ? undefined : "0.01"}
          inputMode="decimal"
          min={allowNegative || isCurrency ? undefined : "0"}
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleChange}
          className={`flex-1 rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/30
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      </div>
    </label>
  );
}
// ============================================================================
// SELECT FIELD (Aquí estaba el error del Build)
// ============================================================================
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled, // <--- 1. Recibimos la prop
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  disabled?: boolean; // <--- 2. Definimos el tipo
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled} // <--- 3. Pasamos al HTML
        className={`rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/30
        ${disabled ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-white/5" : ""}`} 
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ============================================================================
// MONEY FIELD (Nuevo Componente Exclusivo)
// ============================================================================
export function MoneyField({
  label,
  value,
  onChange,
  currency = "COP",
  placeholder = "0",
  disabled = false,
  allowDecimals = true,
  minValue,
  maxValue,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  allowDecimals?: boolean;
  minValue?: number;
  maxValue?: number;
}) {
  const displayValue = formatMoneyInput(value ?? "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const decimals = allowDecimals ? 2 : 0;
    const sanitized = normalizeMoneyInput(e.target.value, { decimals });
    if (!sanitized) return onChange("");

    const numericValue = Number(sanitized);
    if (!Number.isFinite(numericValue)) return onChange("");

    const clamped =
      minValue !== undefined || maxValue !== undefined
        ? Math.min(
            maxValue ?? Number.POSITIVE_INFINITY,
            Math.max(minValue ?? Number.NEGATIVE_INFINITY, numericValue),
          )
        : numericValue;

    const normalizedClamped = decimals > 0 ? clamped.toFixed(decimals) : String(Math.trunc(clamped));
    onChange(normalizedClamped);
  };

  const finalDisplay = displayValue;

  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-300">
      {label}
      <div className={`flex items-center rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 focus-within:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus-within:border-white/30 ${
          disabled ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-white/5" : ""
        }`}>
        
        {/* Símbolo de Moneda Destacado */}
        <span className="mr-2 font-bold text-slate-400 dark:text-zinc-500 select-none">
          $
        </span>

        <input
          type="text"
          inputMode={allowDecimals ? "decimal" : "numeric"}
          value={finalDisplay}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none placeholder:text-slate-400 font-mono"
        />

        {/* Badge de Moneda (COP/USD) */}
        <span className="ml-2 text-[10px] font-bold text-slate-400 dark:text-zinc-600">
          {currency}
        </span>
      </div>
    </label>
  );
}
