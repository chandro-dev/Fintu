"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeSurface({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const className = isDark
    ? "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50"
    : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900";

  return <div className={className}>{children}</div>;
}
