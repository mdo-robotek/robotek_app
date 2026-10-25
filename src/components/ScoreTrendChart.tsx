"use client";

import { useState } from "react";

interface TrendPoint {
  label: string;
  score: number;
  onTime: number;
  total?: number;
  completed?: number;
}

type Granularity = 'day' | 'week' | 'month' | 'quarterly' | 'yearly';

interface ScoreTrendChartProps {
  data: TrendPoint[];
  granularity: Granularity;
  onGranularityChange?: (g: Granularity) => void;
  isNegative?: boolean;
  isPrint?: boolean;
}

const GRANULARITY_OPTIONS: { id: Granularity; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

export default function ScoreTrendChart({ data, granularity, onGranularityChange, isNegative = false, isPrint = false }: ScoreTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {!isPrint && <ChartHeader granularity={granularity} onGranularityChange={onGranularityChange || (() => {})} />}
        <div className="flex items-center justify-center flex-1 text-[13px] font-semibold text-[#5B6472]">
          No Trend Data
        </div>
      </div>
    );
  }

  // Chart dimensions
  const chartW = 500;
  const chartH = 180; // Increased to fit labels
  const padL = 42;
  const padR = 16;
  const padT = 30; // Increased for labels
  const padB = 44;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxLabels = 16;
  const step = data.length > maxLabels ? Math.ceil(data.length / maxLabels) : 1;

  // Helper to transform logical value (0-100) to plotted value (depends on mode)
  // In standard: 100 -> top, 0 -> bottom
  // In negative: 0 (logical 100) -> top, -100 (logical 0) -> bottom
  const getDisplayVal = (v: number) => isNegative ? Math.round(v - 100) : Math.round(v);
  const toX = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  
  // toY maps the "Display Value" (0..100 or -100..0) to SVG Y coordinate

  const toY = (displayV: number) => {
    const min = isNegative ? -100 : 0;
    const max = isNegative ? 0 : 100;
    const percent = (displayV - min) / (max - min);
    return padT + plotH - (percent * plotH);
  };

  const makePath = (key: 'score' | 'onTime') =>
    data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(getDisplayVal(d[key])).toFixed(1)}`)
      .join(' ');

  const makeAreaPath = (key: 'score' | 'onTime') => {
    const line = data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(getDisplayVal(d[key])).toFixed(1)}`)
      .join(' ');
    // Baseline is always the worst score
    const baselineY = toY(isNegative ? -100 : 0);
    return `${line} L${toX(data.length - 1).toFixed(1)},${baselineY.toFixed(1)} L${toX(0).toFixed(1)},${baselineY.toFixed(1)} Z`;
  };


  const yTicks = isNegative ? [-100, -75, -50, -25, 0] : [0, 25, 50, 75, 100];

  return (
    <div className="w-full h-full flex flex-col">
      {!isPrint && <ChartHeader granularity={granularity} onGranularityChange={onGranularityChange || (() => {})} />}

      {/* SVG Chart */}
      <div className="flex-1 px-1 pb-1">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y Gridlines & Labels */}
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={padL} y1={toY(v)} x2={chartW - padR} y2={toY(v)}
                stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4 3"
                className="dark:stroke-gray-700/40"
              />
              <text
                x={padL - 6} y={toY(v) + 3}
                textAnchor="end"
                className="text-[14px] font-bold fill-gray-400"
              >
                {v}%
              </text>
            </g>
          ))}

          {/* Area fills */}
          <path d={makeAreaPath('score')} fill="url(#scoreGrad)" />
          <path d={makeAreaPath('onTime')} fill="url(#onTimeGrad)" />

          {/* Score line - thin */}
          <path
            d={makePath('score')}
            fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="dark:stroke-[#60A5FA]"
          />

          {/* On-Time line - thin dashed */}
          <path
            d={makePath('onTime')}
            fill="none" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="5 3"
          />

          {/* Data points & permanent labels */}
          {data.map((d, i) => (
            <g key={i}>
              <rect
                x={toX(i) - (data.length === 1 ? plotW / 2 : plotW / data.length / 2)}
                y={padT}
                width={data.length === 1 ? plotW : plotW / data.length}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />

              {/* Score dot */}
              <circle
                cx={toX(i)} cy={toY(getDisplayVal(d.score))} r={hoveredIdx === i ? 3.5 : 2}
                className="fill-[#2563EB] dark:fill-[#60A5FA] transition-all duration-200"
                stroke="white" strokeWidth="1"
              />
              {/* Permanent Label for Score */}
              <text
                x={toX(i)} y={toY(getDisplayVal(d.score)) - 8}
                textAnchor="middle"
                className="text-[7.5px] font-semibold fill-[#2563EB] dark:fill-[#60A5FA]"
              >
                {d.total === 0 ? "—" : `${getDisplayVal(d.score)}%`}
              </text>

              {/* Permanent Label for On-Time */}
              <text
                x={toX(i)} y={toY(getDisplayVal(d.onTime)) - 18}
                textAnchor="middle"
                className="text-[7.5px] font-semibold fill-[#10b981]"
              >
                {d.completed === 0 ? "—" : `${getDisplayVal(d.onTime)}%`}
              </text>

              {/* On-Time dot */}
              <circle
                cx={toX(i)} cy={toY(getDisplayVal(d.onTime))} r={hoveredIdx === i ? 3.5 : 2}
                fill="#10b981"
                stroke="white" strokeWidth="1"
                className="transition-all duration-200"
              />


              {/* Vertical hover indicator */}
              {hoveredIdx === i && (
                <line
                  x1={toX(i)} y1={padT} x2={toX(i)} y2={padT + plotH}
                  stroke="#2563EB" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25"
                  className="dark:stroke-[#60A5FA]"
                />
              )}

              {/* Tooltip */}
              {hoveredIdx === i && (
                <g>
                  <rect
                    x={Math.max(2, Math.min(toX(i) - 46, chartW - 94))} y={padT - 24} width={92} height={16} rx={5}
                    fill="#1e293b" opacity="0.92"
                  />
                  <text
                    x={Math.max(48, Math.min(toX(i), chartW - 48))} y={padT - 13}
                    textAnchor="middle"
                    className="text-[14px] font-bold fill-white"
                  >
                    {d.total === 0 ? "No Tasks in Period" : `Score: ${getDisplayVal(d.score)}% | OT: ${d.completed === 0 ? "—" : getDisplayVal(d.onTime) + "%"}`}
                  </text>
                </g>
              )}
            </g>
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => {
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={`xl-${i}`}
                x={toX(i)}
                y={chartH - padB + 14}
                textAnchor="middle"
                className="text-[14px] font-bold fill-gray-400"
                transform={data.length > 10 ? `rotate(-35, ${toX(i)}, ${chartH - padB + 14})` : ''}
              >
                {d.label}
              </text>
            );
          })}

          {/* X-axis period label */}
          <text
            x={padL + plotW / 2}
            y={chartH - 2}
            textAnchor="middle"
            className="text-[14px] font-semibold fill-gray-300"
          >
            {granularity === 'quarterly' ? 'Quarter' : granularity === 'yearly' ? 'Year' : granularity.charAt(0).toUpperCase() + granularity.slice(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}

// --- Chart header with legend + granularity dropdown ---
function ChartHeader({ granularity, onGranularityChange }: { granularity: Granularity; onGranularityChange: (g: Granularity) => void }) {
  return (
    <div className="flex items-center justify-between px-3 pt-2.5 pb-1 gap-2 flex-wrap">
      <h4 className="text-[13px] font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/10" />
        Score Trend
      </h4>
      <div className="flex items-center gap-3">
        {/* Legend */}
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
          <span className="text-[14px] font-semibold text-[#5B6472]">Score</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded-full bg-emerald-500" />
          <span className="text-[14px] font-semibold text-[#5B6472]">On-Time</span>
        </div>
        {/* Granularity dropdown */}
        <select
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value as Granularity)}
          style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
          className="rounded-lg text-[14px] font-semibold tracking-tight px-2 py-1 text-gray-600 dark:text-gray-300 border outline-none cursor-pointer hover:border-[#2563EB]/30 transition-colors"
        >
          {GRANULARITY_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
