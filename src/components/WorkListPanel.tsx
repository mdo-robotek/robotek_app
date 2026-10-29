"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import useSWR from "swr";
import { XMarkIcon, MagnifyingGlassIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import type { WorkList, WorkRow } from "@/lib/work-list";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

const IST = "Asia/Kolkata";
const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: IST });
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
const shortTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST }).toUpperCase();

function span(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d${h ? ` ${h}h` : ""}`;
  if (h > 0) return `${h}h`;
  return `${mins}m`;
}

/** Plain-words status with one meaning colour each. */
const TONE = {
  bad: "text-[#DC2626] bg-rose-50 dark:bg-rose-500/10",
  warn: "text-[#B45309] bg-amber-50 dark:bg-amber-500/10",
  good: "text-[#15803D] bg-emerald-50 dark:bg-emerald-500/10",
};

function status(row: WorkRow, now: number): { text: string; cls: string } {
  if (row.statusText) return { text: row.statusText, cls: TONE[row.tone || "warn"] };
  if (row.doneAt != null) return { text: `Done ${shortDate(row.doneAt)}`, cls: "text-[#15803D] bg-emerald-50 dark:bg-emerald-500/10" };
  if (row.planned == null) return { text: "No date", cls: "text-[#5B6472] bg-[#F1F3F6] dark:bg-navy-800" };
  if (row.planned < now) return { text: `Late ${span(now - row.planned)}`, cls: "text-[#DC2626] bg-rose-50 dark:bg-rose-500/10" };
  if (dayKey(row.planned) === dayKey(now)) return { text: `Due today ${shortTime(row.planned)}`, cls: "text-[#B45309] bg-amber-50 dark:bg-amber-500/10" };
  return { text: `Due ${shortDate(row.planned)}`, cls: "text-[#5B6472] bg-[#F1F3F6] dark:bg-navy-800" };
}

const plannedText = (ms: number | null) => (ms == null ? "—" : `${shortDate(ms)}, ${shortTime(ms)}`);

/**
 * A window with the exact items behind a number (Sahil, 2026-10-28):
 * tap "Late 20" and see those 20 — what, which step, who, since when —
 * without leaving the screen. Phone: sheet from the bottom. Laptop: centred.
 */
export default function WorkListPanel({
  module,
  filter,
  onClose,
  onShowOnPage,
  onPage = false,
}: {
  module: string;
  filter: string;
  onClose: () => void;
  /** Optional: apply the same filter to the page behind (module pages). */
  onShowOnPage?: () => void;
  /** Already on the module page — no "Open … page" button. */
  onPage?: boolean;
}) {
  const { data, error, isLoading, mutate } = useSWR<WorkList>(`/api/work-list?module=${module}&filter=${filter}`, fetcher, {
    revalidateOnFocus: false,
  });
  const [q, setQ] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const now = Date.now();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const rows = data?.rows || [];
  const people = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.doer) m.set(r.doer, (m.get(r.doer) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!person || r.doer === person) &&
        (!s || `${r.ref} ${r.title} ${r.sub || ""} ${r.step} ${r.doer}`.toLowerCase().includes(s))
    );
  }, [rows, q, person]);
  const lateCount = rows.filter((r) => r.doneAt == null && r.planned != null && r.planned < now).length;
  const pageName = data?.title.split(" · ")[0] || "module";
  const doneList = rows.length > 0 && rows.every((r) => r.doneAt != null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Rendered on <body> so no page container can clip it or sit above it.
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-5xl h-[88vh] md:h-auto md:max-h-[85vh] flex flex-col bg-white dark:bg-navy-900 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 md:px-6 pt-4 pb-3 border-b border-[#E5E7EB] dark:border-navy-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-semibold text-[#1A1D21] dark:text-white truncate">{data?.title || "Loading…"}</h2>
            {data && (
              <p className="mt-0.5 text-[14px] text-[#5B6472] dark:text-gray-400">
                {rows.length} {rows.length === 1 ? "item" : "items"}
                {lateCount > 0 && filter !== "late" && <span className="text-[#DC2626] font-semibold"> · {lateCount} late</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-3 -mr-2 flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-[#5B6472] hover:text-[#1A1D21] dark:hover:text-white"
          >
            <XMarkIcon className="w-5 h-5" /> Close
          </button>
        </div>

        {/* Filters: who has it + search */}
        {rows.length > 0 && (
          <div className="px-4 md:px-6 py-3 space-y-2.5 border-b border-[#E5E7EB] dark:border-navy-800">
            {people.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
                <button
                  type="button"
                  onClick={() => setPerson(null)}
                  className={`shrink-0 whitespace-nowrap h-9 px-3 rounded-full text-[14px] font-semibold border transition-colors ${
                    !person ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#E5E7EB] dark:border-navy-700 text-[#1A1D21] dark:text-white"
                  }`}
                >
                  Everyone {rows.length}
                </button>
                {people.map(([name, n]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setPerson(person === name ? null : name)}
                    className={`shrink-0 whitespace-nowrap h-9 px-3 rounded-full text-[14px] font-semibold border transition-colors ${
                      person === name ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#E5E7EB] dark:border-navy-700 text-[#1A1D21] dark:text-white"
                    }`}
                  >
                    {name} <span className={person === name ? "text-white/80" : "text-[#5B6472]"}>{n}</span>
                  </button>
                ))}
              </div>
            )}
            {rows.length > 6 && (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472]" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search item, party, number…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-950 text-[15px] text-[#1A1D21] dark:text-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-4 md:p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />
              ))}
            </div>
          )}
          {error && !data && (
            <div className="p-6">
              <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Couldn&apos;t load this list.</p>
              <button type="button" onClick={() => mutate()} className="mt-2 h-11 px-4 rounded-xl border border-[#E5E7EB] text-[14px] font-semibold text-[#2563EB]">
                Try again
              </button>
            </div>
          )}
          {data && rows.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white">Nothing waiting here right now.</p>
              <p className="mt-1 text-[14px] text-[#5B6472] dark:text-gray-400">New items will show up here as soon as they come in.</p>
            </div>
          )}
          {data && rows.length > 0 && shown.length === 0 && (
            <p className="p-6 text-[15px] text-[#5B6472]">No match. Clear the search or pick &quot;Everyone&quot;.</p>
          )}

          {/* Phone: one card per item */}
          {shown.length > 0 && (
            <ul className="md:hidden divide-y divide-[#E5E7EB] dark:divide-navy-800">
              {shown.map((r) => {
                const st = status(r, now);
                return (
                  <li key={`${r.id}-${r.ref}`} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#5B6472] tabular-nums">{r.ref}</p>
                        <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white leading-snug">{r.title}</p>
                        {r.sub && <p className="text-[13px] text-[#5B6472] dark:text-gray-400 leading-snug">{r.sub}</p>}
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-lg text-[13px] font-semibold ${st.cls}`}>{st.text}</span>
                    </div>
                    <p className="mt-1.5 text-[14px] text-[#1A1D21] dark:text-white">
                      {module === "tasks" && <span className="text-[#5B6472]">Given by </span>}
                      {r.stepNo ? <span className="text-[#5B6472]">Step {r.stepNo} · </span> : null}
                      {r.step}
                    </p>
                    <div className="flex items-end gap-3">
                      <p className="flex-1 text-[13px] text-[#5B6472] dark:text-gray-400">
                        {r.doer && <>With <span className="font-semibold text-[#1A1D21] dark:text-white">{r.doer}</span></>}
                        {r.doer && r.planned != null && " · "}
                        {r.planned != null && <>{module === "tasks" || module === "checklists" ? "Due" : doneList ? "Started" : "Planned"} {plannedText(r.planned)}</>}
                      </p>
                      {r.link && (
                        <Link
                          href={`${r.link}&n=${now}`}
                          onClick={onClose}
                          className="shrink-0 h-11 px-4 inline-flex items-center rounded-xl border border-[#E5E7EB] dark:border-navy-700 text-[14px] font-semibold text-[#2563EB]"
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Laptop: compact table, 6 columns */}
          {shown.length > 0 && (
            <table className="hidden md:table w-full table-fixed text-[14px]">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[25%]" />
                <col className="w-[18%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#F7F8FA] dark:bg-navy-950">
                <tr className="text-left text-[13px] font-semibold text-[#5B6472]">
                  <th className="px-4 py-2.5">No.</th>
                  <th className="px-3 py-2.5">{module === "o2d" ? "Party" : module === "tasks" ? "Task" : "Item"}</th>
                  <th className="px-3 py-2.5">{module === "tasks" ? "Given by" : module === "checklists" ? "How often" : doneList ? "Finished" : "Waiting at"}</th>
                  <th className="px-3 py-2.5">{module === "tasks" ? "Doing" : "With"}</th>
                  <th className="px-3 py-2.5">{module === "tasks" || module === "checklists" ? "Due" : doneList ? "Started" : "Planned"}</th>
                  <th className="px-3 py-2.5 text-right">Status</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
                {shown.map((r) => {
                  const st = status(r, now);
                  return (
                    <tr key={`${r.id}-${r.ref}`} className="align-top hover:bg-[#F7F8FA] dark:hover:bg-navy-800/50">
                      <td className="px-4 py-3 font-semibold text-[#1A1D21] dark:text-white tabular-nums break-words">{r.ref}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#1A1D21] dark:text-white leading-snug break-words">{r.title}</p>
                        {r.sub && <p className="text-[13px] text-[#5B6472] dark:text-gray-400 leading-snug break-words">{r.sub}</p>}
                      </td>
                      <td className="px-3 py-3 text-[#1A1D21] dark:text-white leading-snug">
                        {r.stepNo ? <span className="text-[#5B6472]">{r.stepNo}. </span> : null}
                        {r.step}
                      </td>
                      <td className="px-3 py-3 text-[#1A1D21] dark:text-white break-words">{r.doer || "—"}</td>
                      <td className="px-3 py-3 text-[#5B6472] dark:text-gray-400 tabular-nums whitespace-nowrap">{plannedText(r.planned)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`inline-block px-2 py-1 rounded-lg text-[13px] font-semibold whitespace-nowrap ${st.cls}`}>{st.text}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {r.link && (
                          <Link
                            href={`${r.link}&n=${now}`}
                            onClick={onClose}
                            className="inline-flex items-center h-9 px-3 rounded-lg text-[14px] font-semibold text-[#2563EB] hover:bg-[#EFF4FF] dark:hover:bg-navy-800"
                          >
                            Open
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: what next */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 md:px-6 py-3 border-t border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-900">
          {onPage && !onShowOnPage && (
            <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 text-[14px] font-semibold text-[#1A1D21] dark:text-white">
              Close
            </button>
          )}
          {onShowOnPage && (
            <button
              type="button"
              onClick={() => {
                onShowOnPage();
                onClose();
              }}
              className="h-11 px-4 rounded-xl border border-[#E5E7EB] dark:border-navy-700 text-[14px] font-semibold text-[#1A1D21] dark:text-white"
            >
              Show these on the page
            </button>
          )}
          {data?.href && !onPage && (
            <Link
              href={data.href}
              onClick={onClose}
              className="h-11 px-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold"
            >
              Open {pageName} page <ArrowRightIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  ,
    document.body
  );
}
