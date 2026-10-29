"use client";

import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import type { O2D, O2DStepConfig } from "@/types/o2d";
import { amountOf, orderState, rupees, TONE_PILL, TONE_TEXT } from "./o2d-view";

/**
 * O2D order list (Sahil, 2026-10-29): one row per order — not one per item —
 * with where it is stuck, who has it and how late. Tap a row to open the
 * order window. Replaces Table View + Panel View.
 */

export type ListChip = "open" | "late" | "today" | "hold" | "cancelled" | "all";
export const LIST_CHIPS: { key: ListChip; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "late", label: "Late" },
  { key: "today", label: "Due today" },
  { key: "hold", label: "On hold" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

type Props = {
  orderNos: string[];
  grouped: Record<string, O2D[]>;
  configs: O2DStepConfig[];
  chip: ListChip;
  onChip: (c: ListChip) => void;
  total: number;
  holdCount?: number;
  search: string;
  onSearch: (s: string) => void;
  filtersOn: boolean;
  onFilters: () => void;
  page: number;
  pages: number;
  onPage: (p: number) => void;
  loading: boolean;
  selected: string | null;
  onOpen: (orderNo: string) => void;
  extra?: React.ReactNode; // the advanced filters, shown under the chips
};

export default function O2DOrderList(p: Props) {
  const now = Date.now();
  const rows = p.orderNos
    .map((no) => ({ no: no.trim(), items: p.grouped[no.trim()] || [] }))
    .filter((r) => r.items.length > 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
      {/* Chips + search */}
      <div className="px-3 md:px-4 pt-3 pb-2 flex flex-col md:flex-row md:items-center gap-2 border-b border-[#E5E7EB] dark:border-navy-800">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 min-w-0">
          {LIST_CHIPS.map((c) => {
            const on = p.chip === c.key;
            const n = on ? p.total : c.key === "hold" ? p.holdCount : undefined;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => p.onChip(c.key)}
                className={`h-10 px-3.5 rounded-full border text-[14px] font-semibold whitespace-nowrap ${on ? "bg-[#1A1D21] text-white border-[#1A1D21] dark:bg-white dark:text-[#1A1D21]" : "bg-white dark:bg-navy-800 text-[#1A1D21] dark:text-white border-[#E5E7EB] dark:border-navy-700"}`}
              >
                {c.label}{typeof n === "number" ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 md:ml-auto">
          <label className="relative flex-1 md:w-72">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5B6472]" />
            <input
              value={p.search}
              onChange={(e) => p.onSearch(e.target.value)}
              placeholder="Search order, party or item"
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[15px] outline-none focus:ring-2 focus:ring-[#2563EB]/40"
            />
          </label>
          <button type="button" onClick={p.onFilters} className={`h-10 px-3 rounded-xl border text-[14px] font-semibold inline-flex items-center gap-1.5 ${p.filtersOn ? "border-[#2563EB] text-[#2563EB] bg-[#EFF4FF]" : "border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[#1A1D21] dark:text-white"}`}>
            <AdjustmentsHorizontalIcon className="w-5 h-5" /> Filters
          </button>
        </div>
      </div>

      {p.extra}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {p.loading && rows.length === 0 ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white">No orders here</p>
            <p className="mt-1 text-[14px] text-[#5B6472]">{p.search ? "Try a different search, or tap All." : p.chip === "late" ? "Nothing is late right now." : "Tap All to see every order, or + New Order to add one."}</p>
          </div>
        ) : (
          <>
            {/* Laptop: table */}
            <table className="hidden md:table w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#FAFBFC] dark:bg-navy-950">
                <tr className="text-[13px] font-semibold text-[#5B6472] border-b border-[#E5E7EB] dark:border-navy-800">
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Now at</th>
                  <th className="px-3 py-2.5">Who</th>
                  <th className="px-4 py-2.5">Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ no, items }) => {
                  const s = orderState(items, p.configs, now);
                  const sel = p.selected === no;
                  return (
                    <tr key={no} onClick={() => p.onOpen(no)} className={`cursor-pointer border-b border-[#F0F1F3] dark:border-navy-800 ${sel ? "bg-[#EFF4FF] dark:bg-navy-800" : "hover:bg-[#F7F8FA] dark:hover:bg-navy-800/60"}`}>
                      <td className="px-4 py-2.5">
                        <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{no}</p>
                        <p className="text-[13px] text-[#5B6472] truncate max-w-[260px]">{items[0].party_name}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <p className="text-[15px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{rupees(amountOf(items))}</p>
                        <p className="text-[13px] text-[#5B6472]">{items.length} item{items.length === 1 ? "" : "s"}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {s.cancel || s.hold || s.step === -1
                          ? <span className={`px-2 py-1 rounded-md text-[13px] font-semibold ${TONE_PILL[s.status.tone]}`}>{s.status.text}</span>
                          : <span className="px-2 py-1 rounded-md text-[13px] font-semibold bg-[#F1F3F6] dark:bg-navy-800 text-[#1A1D21] dark:text-white">{s.step} · {s.stepLabel}</span>}
                        {s.hold?.reason && !s.cancel && <p className="mt-1 text-[13px] text-[#5B6472] truncate max-w-[240px]">{s.hold.reason}</p>}
                        {s.step === 2 && !s.hold && !s.cancel && s.soCheck && s.soCheck.status !== "ok" && <p className={`mt-1 text-[13px] font-semibold ${s.soCheck.status === "diff" ? "text-[#DC2626]" : "text-[#B45309]"}`}>{s.soCheck.status === "diff" ? "SO does not match" : s.soCheck.status === "party" ? "Confirm party once" : "Check SO by hand"}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-[14px] text-[#1A1D21] dark:text-gray-200">{s.cancel || s.step === -1 ? "—" : s.hold ? (s.hold.by || "—") : (s.who || "—")}</td>
                      <td className={`px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap ${s.cancel || s.step === -1 ? "text-[#5B6472]" : s.hold ? TONE_TEXT[s.holdCheck === "overdue" ? "late" : "hold"] : TONE_TEXT[s.due.tone]}`}>
                        {s.cancel || s.step === -1 ? "—" : s.hold ? (s.holdCheck === "overdue" ? "Check overdue" : s.holdCheck === "due" ? "Check today" : s.hold.checkOn ? `Check ${new Date(`${s.hold.checkOn}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "On hold") : s.due.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Phone: cards */}
            <ul className="md:hidden p-3 space-y-2">
              {rows.map(({ no, items }) => {
                const s = orderState(items, p.configs, now);
                const right = s.cancel || s.hold || s.step === -1 ? s.status : s.due;
                return (
                  <li key={no}>
                    <button type="button" onClick={() => p.onOpen(no)} className="w-full text-left rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 p-3 active:bg-[#F7F8FA]">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white truncate">{items[0].party_name}</p>
                          <p className="text-[13px] text-[#5B6472]">{no} · {items.length} item{items.length === 1 ? "" : "s"}</p>
                        </div>
                        <p className="text-[15px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{rupees(amountOf(items))}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#1A1D21] dark:text-gray-200 truncate">
                          {s.cancel || s.hold || s.step === -1 ? (s.hold?.reason || "") : `${s.step} · ${s.stepLabel}${s.who ? ` · ${s.who}` : ""}`}
                        </span>
                        <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[13px] font-semibold ${TONE_PILL[right.tone]}`}>{right.text}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Pages */}
      {p.pages > 1 && (
        <div className="px-4 py-2 border-t border-[#E5E7EB] dark:border-navy-800 flex items-center gap-2">
          <span className="text-[14px] text-[#5B6472]">Page {p.page} of {p.pages}</span>
          <button type="button" disabled={p.page <= 1} onClick={() => p.onPage(p.page - 1)} className="ml-auto h-10 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 inline-flex items-center gap-1 text-[14px] font-semibold disabled:opacity-40"><ChevronLeftIcon className="w-4 h-4" /> Back</button>
          <button type="button" disabled={p.page >= p.pages} onClick={() => p.onPage(p.page + 1)} className="h-10 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 inline-flex items-center gap-1 text-[14px] font-semibold disabled:opacity-40">Next <ChevronRightIcon className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
