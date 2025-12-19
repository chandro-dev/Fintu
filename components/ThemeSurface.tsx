"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeSurface({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const baseClassName = isDark
    ? "min-h-screen text-slate-50 bg-slate-950"
    : "min-h-screen text-slate-900 bg-slate-50";

  return (
    <div className={`relative isolate overflow-hidden ${baseClassName}`}>
      {/* Background decoration */}
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-0 -z-10 " +
          (isDark
            ? "bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(168,85,247,0.10),transparent_55%),radial-gradient(1100px_circle_at_50%_85%,rgba(34,197,94,0.08),transparent_60%)]"
            : "bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(14,165,233,0.16),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(168,85,247,0.10),transparent_55%),radial-gradient(1100px_circle_at_50%_85%,rgba(34,197,94,0.10),transparent_60%)]")
        }
      />
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-0 -z-10 opacity-60 " +
          (isDark
            ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px]"
            : "bg-[linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:64px_64px]")
        }
      />

      <div className="relative">{children}</div>
    </div>
  );
}
