"use client";

import { useMemo, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface SemiCircleGaugeProps {
  value: number; // 0 to 100
  label?: string;
  isNegative?: boolean;
  total?: number;
}

export default function SemiCircleGauge({ value, label = "Overall Avg", isNegative = false, total }: SemiCircleGaugeProps) {
  const segments = 24;
  const radius = 65;
  const strokeWidth = 14;
  const cx = 100;
  const cy = 80;

  // For the animated number counting up
  const countValue = useMotionValue(0);
  const displayValue = isNegative ? value - 100 : value;
  const roundedValue = useTransform(countValue, Math.round);

  const hasNoTasks = total === 0;

  useEffect(() => {
    if (hasNoTasks) {
      countValue.set(0);
      return;
    }
    const animation = animate(countValue, displayValue, { 
      duration: 1.5, 
      ease: "easeOut",
      delay: 0.2
    });
    return animation.stop;
  }, [displayValue, countValue, hasNoTasks]);

  const lines = useMemo(() => {
    const l = [];
    // If negative mode, we show the "Failure Gap" (100 - value)
    const fillPercent = hasNoTasks ? 0 : (isNegative ? (100 - value) : value);

    for (let i = 0; i < segments; i++) {
      const angleDeg = 180 - (i / (segments - 1)) * 180;
      const angleRad = angleDeg * (Math.PI / 180);
      
      const x1 = cx + (radius - strokeWidth / 2) * Math.cos(angleRad);
      const y1 = cy - (radius - strokeWidth / 2) * Math.sin(angleRad);
      
      const x2 = cx + (radius + strokeWidth / 2) * Math.cos(angleRad);
      const y2 = cy - (radius + strokeWidth / 2) * Math.sin(angleRad);

      const percent = (i / (segments - 1)) * 100;
      const isActive = !hasNoTasks && percent <= fillPercent;
      
      const activeColor = isNegative ? (
        // For Failure view: 0-25% (Good/Green Gap), 25-50% (Amber Gap), 50-100% (Red Gap)
        percent < 20 ? "#10B981" : // Emerald
        percent < 50 ? "#F59E0B" : // Amber
        "#EF4444" // Rose/Red
      ) : (
        // For Success view: 0-40% (Red), 40-75% (Amber), 75-100% (Green)
        percent < 40 ? "#EF4444" : 
        percent < 75 ? "#F59E0B" : 
        "#10B981"
      );

      l.push({ x1, y1, x2, y2, isActive, color: activeColor });
    }
    return l;
  }, [value, segments, isNegative, hasNoTasks]);

  return (
    <div className="flex flex-col items-center justify-center relative w-full h-full p-2 pt-4">
      <div className="relative w-full aspect-[2/1] max-w-[280px] mx-auto">
        <svg viewBox="0 0 200 90" className="w-full h-full overflow-visible drop-shadow-sm">
          {lines.map((l, i) => (
            <motion.line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={l.isActive ? l.color : "currentColor"}
              strokeWidth={8}
              strokeLinecap="round"
              className={l.isActive ? "" : "text-gray-200 dark:text-navy-800/60"}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1, pathLength: 1 }}
              transition={{ duration: 1.2, delay: i * 0.07, ease: "easeOut" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
           <div className="text-3xl font-semibold text-gray-900 dark:text-white leading-none tracking-tighter flex items-center justify-center">
             {hasNoTasks ? (
               <span>—</span>
             ) : (
               <>
                 <motion.span>{roundedValue}</motion.span>
                 <span>%</span>
               </>
             )}
           </div>
           <div className="text-[13px] font-bold text-[#5B6472] mt-1">
             {label}
           </div>
        </div>
      </div>
    </div>
  );
}

