"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const STAR_POSITIONS = Array.from({ length: 18 }, (_, i) => ({
  left: `${6 + ((i * 17) % 88)}%`,
  delay: `${(i * 0.45) % 4}s`,
  duration: `${2.2 + (i % 4) * 0.6}s`,
  twinkleSize: i % 3 === 0 ? "2.5px" : "1.5px",
  fallSize: i % 3 === 0 ? "5px" : i % 3 === 1 ? "4px" : "3px",
}));

const WING_RAYS = [
  { deg: -72, len: 140, w: 3, op: 0.95 },
  { deg: -58, len: 160, w: 4, op: 1 },
  { deg: -44, len: 150, w: 3.5, op: 0.9 },
  { deg: -30, len: 130, w: 3, op: 0.85 },
  { deg: -16, len: 110, w: 2.5, op: 0.75 },
  { deg: 16, len: 110, w: 2.5, op: 0.75 },
  { deg: 30, len: 130, w: 3, op: 0.85 },
  { deg: 44, len: 150, w: 3.5, op: 0.9 },
  { deg: 58, len: 160, w: 4, op: 1 },
  { deg: 72, len: 140, w: 3, op: 0.95 },
];

export default function HeaderThemeBackground() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  if (isDark) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1120] via-[#1e1b4b] to-[#0f172a] transition-colors duration-700" />

        <div className="absolute -top-10 right-[12%] h-28 w-28 animate-moon-glow rounded-full bg-indigo-200/25 blur-2xl" />
        <div className="absolute top-1 right-[18%] h-10 w-10 rounded-full bg-slate-100/10 blur-md" />

        {STAR_POSITIONS.slice(0, 10).map((star, i) => (
          <span
            key={`tw-${i}`}
            className="absolute rounded-full bg-white/80 animate-twinkle"
            style={{
              left: star.left,
              top: `${12 + (i % 5) * 14}%`,
              width: star.twinkleSize,
              height: star.twinkleSize,
              animationDelay: star.delay,
            }}
          />
        ))}

        {STAR_POSITIONS.map((star, i) => (
          <span
            key={`fall-${i}`}
            className="absolute top-0 animate-star-fall rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.95),0_0_10px_rgba(199,210,254,0.5)]"
            style={{
              left: star.left,
              width: star.fallSize,
              height: star.fallSize,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}

        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse 40% 80% at 85% 0%, rgba(199,210,254,0.35) 0%, transparent 70%)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Warm sun sky gradient — no blue */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#f97316] transition-colors duration-700" />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "linear-gradient(105deg, rgba(255,251,235,0.55) 0%, rgba(253,224,71,0.25) 35%, rgba(251,146,60,0.18) 70%, rgba(234,88,12,0.12) 100%)",
        }}
      />

      {/* Sun core */}
      <div
        className="absolute -left-4 top-1/2 h-20 w-20 -translate-y-1/2 animate-sunshine-spread rounded-full"
        style={{
          background: "radial-gradient(circle, #fff7d6 0%, #fde047 35%, #fbbf24 60%, rgba(251,191,36,0) 75%)",
          boxShadow: "0 0 40px rgba(253,224,71,0.9), 0 0 80px rgba(251,191,36,0.5)",
        }}
      />

      {/* Bright wings — ray burst from sun */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 animate-sun-wing-pulse">
        <svg width="320" height="120" viewBox="0 0 320 120" className="overflow-visible opacity-95">
          {WING_RAYS.map(({ deg, len, w, op }) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = 8 + len * Math.cos(rad);
            const y2 = 60 + len * Math.sin(rad);
            return (
              <line
                key={deg}
                x1="8"
                y1="60"
                x2={x2}
                y2={y2}
                stroke="url(#wingGrad)"
                strokeWidth={w}
                strokeLinecap="round"
                opacity={op}
                style={{ filter: "drop-shadow(0 0 4px rgba(255,237,150,0.9))" }}
              />
            );
          })}
          <defs>
            <linearGradient id="wingGrad" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="40%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Secondary spinning ray ring */}
      <div className="absolute left-2 top-1/2 h-24 w-24 -translate-y-1/2 animate-sun-spin opacity-70">
        {Array.from({ length: 16 }, (_, i) => i * 22.5).map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 h-14 w-1 origin-bottom -translate-x-1/2 rounded-full"
            style={{
              transform: `translateX(-50%) rotate(${deg}deg)`,
              background: "linear-gradient(to top, rgba(255,237,150,0), rgba(255,251,235,0.85) 60%, rgba(253,224,71,0.95))",
              boxShadow: "0 0 6px rgba(253,224,71,0.6)",
            }}
          />
        ))}
      </div>

      {/* Light wash across header */}
      <div className="animate-sunshine-pulse absolute inset-0 opacity-50">
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse 70% 140% at 8% 50%, rgba(255,255,255,0.45) 0%, rgba(253,224,71,0.2) 40%, transparent 75%)",
          }}
        />
      </div>

      {/* Warm shimmer particles */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="absolute animate-sun-float rounded-full bg-white/70"
          style={{
            left: `${12 + i * 13}%`,
            top: `${18 + (i % 3) * 22}%`,
            width: `${2 + (i % 2)}px`,
            height: `${2 + (i % 2)}px`,
            animationDelay: `${i * 0.5}s`,
            boxShadow: "0 0 4px rgba(255,255,255,0.8)",
          }}
        />
      ))}
    </div>
  );
}
