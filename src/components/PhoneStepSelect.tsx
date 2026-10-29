"use client";

/**
 * Phone-only step filter (Sahil, 2026-10-27). On a laptop the step list sits
 * in a left column; on a phone that column squeezed the cards, so it becomes
 * one full-width dropdown above the list.
 */
export default function PhoneStepSelect({
  steps,
  counts,
  value,
  onChange,
  allLabel = "All",
  completedCount,
  extra = [],
}: {
  steps: string[];
  counts: number[];
  value: number | string;
  onChange: (v: any) => void;
  allLabel?: string;
  completedCount?: number;
  extra?: { value: string; label: string }[];
}) {
  return (
    <label className="md:hidden w-full">
      <span className="sr-only">Show step</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(/^\d+$/.test(v) ? Number(v) : v);
        }}
        className="w-full h-11 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 text-[15px] font-semibold text-[#1A1D21] dark:text-white outline-none focus:border-[#2563EB]"
      >
        <option value="all">{allLabel}</option>
        {steps.map((name, i) => (
          <option key={i} value={i + 1}>
            {`Step ${i + 1} — ${name}${counts[i] ? ` (${counts[i]})` : ""}`}
          </option>
        ))}
        {completedCount !== undefined && <option value="completed">{`Completed (${completedCount})`}</option>}
        {extra.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
