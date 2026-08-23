"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

const STARS = [
  { top: 5, left: 38, delay: 0 },
  { top: 12, left: 47, delay: 0.4 },
  { top: 22, left: 40, delay: 0.9 },
  { top: 8, left: 55, delay: 1.3 },
  { top: 18, left: 52, delay: 1.8 },
];

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [cometFly, setCometFly] = useState(false);
  const cometTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    return () => {
      if (cometTimer.current) clearTimeout(cometTimer.current);
    };
  }, []);

  const isDark = (resolvedTheme || theme) === "dark";

  const toggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
    setCometFly(true);
    if (cometTimer.current) clearTimeout(cometTimer.current);
    cometTimer.current = setTimeout(() => setCometFly(false), 650);
  }, [isDark, setTheme]);

  if (!mounted) {
    return <div className="celestial-toggle-placeholder" aria-hidden />;
  }

  return (
    <button
      type="button"
      className={`celestial-toggle${isDark ? " is-dark" : ""}`}
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="ct-stars" aria-hidden>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="ct-star"
            style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
          />
        ))}
      </div>
      <span className={`ct-comet${cometFly ? " fly" : ""}`} aria-hidden />
      <div className="ct-orb" aria-hidden />
    </button>
  );
}
