"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10 dark:border-zinc-300/30 dark:bg-white/10 dark:text-zinc-900 dark:hover:bg-white/20"
    >
      {isDark ? "☾ Modo oscuro" : "☀ Modo claro"}
    </button>
  );
}
