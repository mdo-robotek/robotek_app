"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ChartBarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import type { Figure, ModuleKey, ModuleSummary, Tone } from "@/lib/module-summary";
import WorkListPanel from "./WorkListPanel";

/** Figures that open a window listing their items (Sahil, 2026-10-28). */
export const LISTABLE: Partial<Record<ModuleKey, string[]>> = {
  o2d: ["waiting", "over7", "paperwork", "otd"],
  i2r: ["open", "late", "tbd", "done"],
  grn: ["open", "late", "payment", "done"],
  tasks: ["overdue", "pending", "revision", "done"],
};

// The detailed report (charts) loads only when someone opens Performance.
const CooReport = dynamic(() => import("./CooReport"), { ssr: false });

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

const toneDot: Record<Tone, string> = {
  good: "bg-[#15803D]",
  warn: "bg-[#D97706]",
  bad: "bg-[#DC2626]",
  neutral: "hidden",
};

/**
 * The key figures for one module, at the top of its own page — the same
 * numbers the CEO home shows for it (both come from /api/summary).
 * Compact on purpose: one row, so the page's real work stays on screen.
 * Admins get a "Performance" button that opens the detailed report sections
 * for this module in a panel, without pushing the work list down.
 */
export default function ModuleStrip({
  module,
  onFigure,
  adminOnly = false,
}: {
  module: ModuleKey;
  /** When given, figures that carry a step filter become tappable. */
  onFigure?: (f: Figure) => void;
  /** Company-wide people/task figures are for admins only. */
  adminOnly?: boolean;
}) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowed = !adminOnly || role === "ADMIN" || role === "EA";
  const { data, error } = useSWR<{ module: ModuleSummary; detail: { sections: string[]; data: any } | null }>(
    allowed ? `/api/summary?module=${module}` : null,
    fetcher,
    { refreshInterval: 120000, revalidateOnFocus: false, keepPreviousData: true }
  );
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Figure | null>(null);

  if (!allowed || error) return null;
  const m = data?.module;

  return (
    <div className="px-2 pb-3 shrink-0">
      <div className="grid grid-cols-2 gap-2 md:flex md:items-stretch md:overflow-x-auto no-scrollbar">
        {(m?.figures || Array.from({ length: 4 }).map(() => null)).map((f, i) => {
          if (!f) {
            return <div key={i} className="md:min-w-[140px] flex-1 h-[64px] rounded-xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />;
          }
          const listable = !!LISTABLE[module]?.includes(f.key);
          const tappable = listable || (!!onFigure && f.step !== undefined);
          const Tag = tappable ? "button" : "div";
          return (
            <Tag
              key={f.key}
              {...(tappable ? { type: "button", onClick: () => (listable ? setList(f) : onFigure!(f)) } : {})}
              className={`min-w-0 md:min-w-[140px] flex-1 text-left rounded-xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 px-3 py-2 ${
                tappable ? "hover:border-[#2563EB] transition-colors" : ""
              }`}
            >
              <p className="flex items-center gap-1.5 text-[13px] text-[#5B6472] dark:text-gray-400 truncate">
                <span className={`w-2 h-2 rounded-full shrink-0 ${toneDot[f.tone]}`} />
                {f.label}
              </p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums text-[#1A1D21] dark:text-white">{f.value}</p>
            </Tag>
          );
        })}
        {data?.detail && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 flex md:flex-col items-center justify-center gap-1.5 md:gap-1 min-h-[44px] md:min-w-[96px] rounded-xl border border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-900 px-3 text-[#2563EB] dark:text-[#60A5FA] hover:border-[#2563EB] transition-colors"
          >
            <ChartBarIcon className="w-5 h-5" />
            <span className="text-[13px] font-semibold">Performance</span>
          </button>
        )}
      </div>
      {m?.stuckAt && (
        <p className="text-[13px] text-[#5B6472] dark:text-gray-400 mt-1.5 px-1">
          Most work is waiting at <span className="font-semibold text-[#1A1D21] dark:text-white">Step {m.stuckAt.step} · {m.stuckAt.name}</span> ({m.stuckAt.count})
        </p>
      )}

      {list && (
        <WorkListPanel
          module={module}
          filter={list.key}
          onPage
          onClose={() => setList(null)}
          onShowOnPage={onFigure && list.step !== undefined ? () => onFigure(list) : undefined}
        />
      )}

      {open && data?.detail && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-5xl max-h-[90vh] overflow-y-auto bg-[#F7F8FA] dark:bg-navy-950 rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-white dark:bg-navy-900 border-b border-[#E5E7EB] dark:border-navy-800">
              <h2 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white">{m?.title} — Performance</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 px-3 flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-[#5B6472] hover:text-[#1A1D21] dark:hover:text-white"
              >
                <XMarkIcon className="w-5 h-5" /> Close
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <CooReport data={data.detail.data} loading={false} sections={data.detail.sections} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
