"use client";

import React from "react";

export function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
}) {
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
        className="rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/30"
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  isCurrency = false,
  currency = "USD",
  allowNegative = false,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  isCurrency?: boolean;
  currency?: string;
  allowNegative?: boolean;
}) {
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
          type="number"
          step="0.01"
          inputMode="decimal"
          min={allowNegative ? undefined : "0"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/30"
        />
      </div>
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/30"
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
