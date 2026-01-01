"use client";

import { Categoria } from "@/components/transactions/types";
import { getCategoryIcon } from "@/lib/categoryIcons";

interface Props {
  category: Categoria;
  size?: "sm" | "md";
  onClick?: (category: Categoria) => void;
  active?: boolean;
}

export function CategoryBadge({ category, size = "md", onClick, active }: Props) {
  const Icon = getCategoryIcon(category.icono);

  const padding = size === "sm" ? "px-2 py-0.5" : "px-3 py-1.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const iconSize = size === "sm" ? 12 : 14;
  const boxSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const isClickable = typeof onClick === "function";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border transition-all ${padding} ${
        isClickable ? "cursor-pointer hover:scale-105" : "cursor-default"
      } ${active ? "ring-2 ring-offset-1 ring-sky-400 ring-offset-white dark:ring-offset-slate-900" : ""}`}
      style={{
        backgroundColor: category.color ? `${category.color}10` : "transparent",
        borderColor: category.color ? `${category.color}30` : "#e2e8f0",
      }}
      onClick={() => onClick?.(category)}
    >
      <div
        className={`flex ${boxSize} items-center justify-center rounded-md`}
        style={{
          backgroundColor: category.color ? `${category.color}20` : "#f1f5f9",
          color: category.color || "#64748b",
        }}
      >
        <Icon size={iconSize} strokeWidth={2.5} />
      </div>

      <span className={`font-bold ${textSize}`} style={{ color: category.color || "#334155" }}>
        {category.nombre}
      </span>
    </div>
  );
}
