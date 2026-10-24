"use client";

// Theme Step 1 (Oct 2026): plain light/dark switch (was an animated
// sun/moon/comet toggle). One 44px button with a clear label.
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-11 h-11" aria-hidden />;

  const isDark = (resolvedTheme || theme) === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={label}
      aria-label={label}
      className="w-11 h-11 flex items-center justify-center text-[#5B6472] hover:text-[#1A1D21] hover:bg-gray-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors"
    >
      {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
    </button>
  );
}
