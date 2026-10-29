"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon, CheckIcon, EllipsisHorizontalIcon, PaperClipIcon,
} from "@heroicons/react/24/outline";
import {
  PROC_CHIPS, TONE_PILL, TONE_TEXT, chipMatch, fmtWhen, prettyNames, rowState, toDate,
  type ProcChip, type ProcessConfig,
} from "./process-view";

/**
 * Shared list + window for every step-based process (Sahil, 2026-10-29) —
 * the same as the new O2D screen. One row per record: what, how much, which
 * step, who, how late. Tap a row → window with the next step on top, all
 * steps below, and the details. Replaces "Standard / Smart View" and the
 * step buttons on the left.
 */
export type ProcAction<T> = {
  label: string;
  onClick: (r: T) => void;
  tone?: "primary" | "danger" | "plain";
  show?: (r: T) => boolean;
  icon?: React.ComponentType<{ className?: string }>;
};

type Props<T> = {
  cfg: ProcessConfig<T>;
  items: T[];
  loading?: boolean;
  /** buttons in the "Next step" box (e.g. Update step) */
  primary: ProcAction<T>[];
  /** buttons at the bottom of the window (Edit …) */
  footer?: ProcAction<T>[];
  /** buttons inside "More" (Cancel, Delete …) */
  menu?: ProcAction<T>[];
  /** optional: start with this record open (from ?find=) */
  initialSearch?: string;
  /** extra things above the list (filters the page still needs) */
  extra?: React.ReactNode;
};

const btn = "h-11 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[14px] font-semibold text-[#1A1D21] dark:text-white whitespace-nowrap hover:bg-[#F7F8FA] dark:hover:bg-navy-700";
const primaryBtn = "h-12 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold whitespace-nowrap hover:bg-[#1D4ED8]";
const PER_PAGE = 25;

export default function ProcessScreen<T>(p: Props<T>) {
  const { cfg } = p;
  const [chip, setChip] = useState<ProcChip>("open");
  const [q, setQ] = useState(p.initialSearch || "");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => { if (p.initialSearch) { setQ(p.initialSearch); setChip("all"); } }, [p.initialSearch]);
  useEffect(() => setPage(1), [chip, q]);

  const counts = useMemo(() => {
    const c: Record<ProcChip, number> = { open: 0, late: 0, today: 0, done: 0, cancelled: 0, all: p.items.length };
    for (const r of p.items) for (const k of ["open", "late", "today", "done", "cancelled"] as ProcChip[]) if (chipMatch(cfg, r, k, now)) c[k]++;
    return c;
  }, [p.items, cfg, now]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = p.items.filter((r) => chipMatch(cfg, r, chip, now) && (!s || cfg.search(r).toLowerCase().includes(s)));
    // Open work: most late first. Others: newest first.
    if (chip === "open" || chip === "late" || chip === "today") {
      rows.sort((a, b) => (toDate(cfg.planned(a, cfg.step(a)))?.getTime() ?? Infinity) - (toDate(cfg.planned(b, cfg.step(b)))?.getTime() ?? Infinity));
    } else {
      rows.sort((a, b) => (toDate(cfg.created?.(b))?.getTime() ?? 0) - (toDate(cfg.created?.(a))?.getTime() ?? 0));
    }
    return rows;
  }, [p.items, cfg, chip, q, now]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const openItem = openId ? p.items.find((r) => cfg.id(r) === openId) || null : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full rounded-2xl border border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
      <div className="px-3 md:px-4 pt-3 pb-2 flex flex-col md:flex-row md:items-center gap-2 border-b border-[#E5E7EB] dark:border-navy-800">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 min-w-0">
          {PROC_CHIPS.map((c) => {
            const on = chip === c.key;
            return (
              <button key={c.key} type="button" onClick={() => setChip(c.key)}
                className={`h-10 px-3.5 rounded-full border text-[14px] font-semibold whitespace-nowrap ${on ? "bg-[#1A1D21] text-white border-[#1A1D21] dark:bg-white dark:text-[#1A1D21]" : "bg-white dark:bg-navy-800 text-[#1A1D21] dark:text-white border-[#E5E7EB] dark:border-navy-700"}`}>
                {c.label}{c.key !== "all" || on ? ` · ${counts[c.key]}` : ""}
              </button>
            );
          })}
        </div>
        <label className="relative md:ml-auto md:w-72">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5B6472]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[15px] outline-none focus:ring-2 focus:ring-[#2563EB]/40" />
        </label>
      </div>
      {p.extra}

      <div className="flex-1 overflow-y-auto">
        {p.loading && !p.items.length ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white">Nothing here</p>
            <p className="mt-1 text-[14px] text-[#5B6472]">{q ? "Try a different search, or tap All." : chip === "late" ? "Nothing is late right now." : `Tap All to see every ${cfg.unit.replace(/s$/, "")}.`}</p>
          </div>
        ) : (
          <>
            <table className="hidden md:table w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#FAFBFC] dark:bg-navy-950">
                <tr className="text-[13px] font-semibold text-[#5B6472] border-b border-[#E5E7EB] dark:border-navy-800">
                  <th className="px-4 py-2.5">{cfg.unit[0].toUpperCase() + cfg.unit.slice(1).replace(/s$/, "")}</th>
                  {cfg.amount && <th className="px-3 py-2.5 text-right">Qty</th>}
                  <th className="px-3 py-2.5">Now at</th>
                  <th className="px-3 py-2.5">Who</th>
                  <th className="px-4 py-2.5">Due</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const s = rowState(cfg, r, now);
                  const id = cfg.id(r);
                  return (
                    <tr key={id} onClick={() => setOpenId(id)} className={`cursor-pointer border-b border-[#F0F1F3] dark:border-navy-800 ${openId === id ? "bg-[#EFF4FF] dark:bg-navy-800" : "hover:bg-[#F7F8FA] dark:hover:bg-navy-800/60"}`}>
                      <td className="px-4 py-2.5">
                        <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{cfg.title(r) || "—"}</p>
                        <p className="text-[13px] text-[#5B6472] truncate max-w-[340px]">{[cfg.ref(r), cfg.sub?.(r)].filter(Boolean).join(" · ")}</p>
                      </td>
                      {cfg.amount && <td className="px-3 py-2.5 text-right text-[15px] font-semibold tabular-nums text-[#1A1D21] dark:text-white whitespace-nowrap">{cfg.amount(r) || "—"}</td>}
                      <td className="px-3 py-2.5">
                        {s.step > 0
                          ? <span className="px-2 py-1 rounded-md text-[13px] font-semibold bg-[#F1F3F6] dark:bg-navy-800 text-[#1A1D21] dark:text-white">{s.step} · {s.label}</span>
                          : <span className={`px-2 py-1 rounded-md text-[13px] font-semibold ${TONE_PILL[s.status.tone]}`}>{s.status.text}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[14px] text-[#1A1D21] dark:text-gray-200">{s.who || "—"}</td>
                      <td className={`px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap ${s.step > 0 ? TONE_TEXT[s.due.tone] : "text-[#5B6472]"}`}>{s.step > 0 ? s.due.text : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="md:hidden p-3 space-y-2">
              {shown.map((r) => {
                const s = rowState(cfg, r, now);
                return (
                  <li key={cfg.id(r)}>
                    <button type="button" onClick={() => setOpenId(cfg.id(r))} className="w-full text-left rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 p-3 active:bg-[#F7F8FA]">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white truncate">{cfg.title(r) || "—"}</p>
                          <p className="text-[13px] text-[#5B6472] truncate">{[cfg.ref(r), cfg.sub?.(r)].filter(Boolean).join(" · ")}</p>
                        </div>
                        {cfg.amount && <p className="text-[15px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{cfg.amount(r)}</p>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#1A1D21] dark:text-gray-200 truncate">{s.step > 0 ? `${s.step} · ${s.label}${s.who ? ` · ${s.who}` : ""}` : ""}</span>
                        <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[13px] font-semibold ${TONE_PILL[s.status.tone]}`}>{s.status.text}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {pages > 1 && (
        <div className="px-4 py-2 border-t border-[#E5E7EB] dark:border-navy-800 flex items-center gap-2">
          <span className="text-[14px] text-[#5B6472]">Page {page} of {pages} · {list.length} {cfg.unit}</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="ml-auto h-10 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 inline-flex items-center gap-1 text-[14px] font-semibold disabled:opacity-40"><ChevronLeftIcon className="w-4 h-4" /> Back</button>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="h-10 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 inline-flex items-center gap-1 text-[14px] font-semibold disabled:opacity-40">Next <ChevronRightIcon className="w-4 h-4" /></button>
        </div>
      )}

      {openItem && <ProcessWindow cfg={cfg} item={openItem} primary={p.primary} footer={p.footer || []} menu={p.menu || []} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ProcessWindow<T>({ cfg, item, primary, footer, menu, onClose }: { cfg: ProcessConfig<T>; item: T; primary: ProcAction<T>[]; footer: ProcAction<T>[]; menu: ProcAction<T>[]; onClose: () => void }) {
  const [more, setMore] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const s = rowState(cfg, item);
  const n = cfg.steps.length;
  const doneCount = Array.from({ length: n }, (_, k) => k + 1).filter((i) => !!String(cfg.actual(item, i) || "").trim()).length;
  const details = cfg.details?.(item) || [];
  const visible = (a: ProcAction<T>) => !a.show || a.show(item);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[400] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full md:w-[560px] h-full bg-white dark:bg-navy-900 shadow-2xl flex flex-col">
        <div className="px-4 md:px-5 pt-3 pb-3 border-b border-[#E5E7EB] dark:border-navy-800">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#5B6472]">{[cfg.ref(item), cfg.sub?.(item)].filter(Boolean).join(" · ")}</p>
              <h2 className="text-[21px] leading-tight font-semibold text-[#1A1D21] dark:text-white break-words">{cfg.title(item) || "—"}</h2>
            </div>
            <button type="button" onClick={onClose} className={btn}><XMarkIcon className="w-5 h-5" /> Close</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {cfg.amount && <span className="text-[17px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{cfg.amount(item)}</span>}
            {cfg.created && toDate(cfg.created(item)) && <span className="text-[14px] text-[#5B6472]">· made {fmtWhen(toDate(cfg.created(item))!)}</span>}
            <span className={`ml-auto px-2.5 py-1 rounded-full text-[13px] font-semibold ${TONE_PILL[s.status.tone]}`}>{s.status.text}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-5">
          {s.step > 0 && (
            <div className="rounded-xl border border-[#C7D7FE] bg-[#EFF4FF] dark:bg-navy-800 dark:border-navy-700 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#5B6472]">Next step{s.who ? ` · ${s.who}` : ""}</p>
                <p className="text-[17px] font-semibold text-[#1A1D21] dark:text-white">Step {s.step} · {s.label}</p>
                <p className={`text-[13px] font-semibold ${TONE_TEXT[s.due.tone]}`}>{s.planned ? (s.due.tone === "late" ? `Was due ${fmtWhen(s.planned)}` : `Due ${fmtWhen(s.planned)}`) : "No time limit set"}</p>
              </div>
              <div className="flex flex-col gap-2">
                {primary.filter(visible).map((a) => (
                  <button key={a.label} type="button" onClick={() => a.onClick(item)} className={a.tone === "plain" ? btn : primaryBtn}>
                    {a.icon ? <a.icon className="w-5 h-5" /> : <CheckIcon className="w-5 h-5" />} {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {cfg.extra && <div>{cfg.extra(item)}</div>}
          {s.step === 0 && <div className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF3] p-3.5"><p className="text-[15px] font-semibold text-[#15803D]">All steps are done.</p></div>}
          {s.step === -1 && <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5"><p className="text-[15px] font-semibold text-[#1A1D21]">This is cancelled.</p></div>}

          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold text-[#5B6472]">Progress · {doneCount} of {n} done</h3>
              <button type="button" onClick={() => setShowAll(!showAll)} className="md:hidden text-[14px] font-semibold text-[#2563EB] h-9">{showAll ? "Show less" : "Show all"}</button>
            </div>
            <ol className="mt-2">
              {cfg.steps.map((name, k) => {
                const i = k + 1;
                const actual = toDate(cfg.actual(item, i));
                const hasActual = !!String(cfg.actual(item, i) || "").trim();
                const planned = toDate(cfg.planned(item, i));
                const isCurrent = i === s.step;
                const done = hasActual && !isCurrent;
                const later = !done && !isCurrent;
                const notNeeded = !hasActual && !planned && (s.step === 0 || (s.step > 0 && i < s.step));
                const hideOnPhone = !showAll && later && (s.step <= 0 || i > s.step + 2);
                const who = prettyNames(cfg.doers[k] || "");
                const facts = cfg.stepFacts?.(item, i) || [];
                return (
                  <li key={i} className={`gap-3 py-1.5 ${hideOnPhone ? "hidden md:flex" : "flex"}`}>
                    <span className={`mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold ${done ? "bg-[#15803D] text-white" : isCurrent ? "bg-[#2563EB] text-white ring-4 ring-[#DBE6FE]" : "border-2 border-[#D1D5DB] text-[#9CA3AF]"}`}>
                      {done ? <CheckIcon className="w-4 h-4" /> : i}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-semibold ${later ? "text-[#5B6472]" : "text-[#1A1D21] dark:text-white"}`}>{name}</p>
                      <p className="text-[13px] text-[#5B6472]">
                        {done
                          ? `Done${actual ? ` ${fmtWhen(actual)}` : ""}${planned && actual && actual.getTime() > planned.getTime() ? " · late" : ""}${who ? ` · ${who}` : ""}`
                          : isCurrent ? `${who || "No one set"}${planned ? ` · due ${fmtWhen(planned)}` : ""}` : notNeeded ? "Not needed" : who}
                      </p>
                      {facts.length > 0 && (
                        <p className="mt-0.5 text-[13px] text-[#1A1D21] dark:text-gray-200 flex flex-wrap gap-x-3">
                          {facts.map((x) => x.href
                            ? <a key={x.label} href={x.href} className="text-[#2563EB] font-semibold inline-flex items-center gap-0.5"><PaperClipIcon className="w-3.5 h-3.5" />{x.label}</a>
                            : <span key={x.label}><span className="text-[#5B6472]">{x.label}:</span> {x.value}</span>)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {details.length > 0 && (
            <section>
              <h3 className="text-[14px] font-semibold text-[#5B6472]">Details</h3>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                {details.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <p className="text-[13px] text-[#5B6472]">{d.label}</p>
                    {d.href
                      ? <a href={d.href} className="text-[15px] font-semibold text-[#2563EB] inline-flex items-center gap-1"><PaperClipIcon className="w-4 h-4" />{d.value || "View"}</a>
                      : <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white break-words">{d.value || "—"}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {(footer.some(visible) || menu.some(visible)) && (
          <div className="relative px-4 md:px-5 py-3 border-t border-[#E5E7EB] dark:border-navy-800 flex items-center gap-2 bg-white dark:bg-navy-900">
            {footer.filter(visible).map((a) => (
              <button key={a.label} type="button" onClick={() => a.onClick(item)} className={btn}>{a.icon && <a.icon className="w-5 h-5" />} {a.label}</button>
            ))}
            {menu.some(visible) && (
              <>
                <button type="button" onClick={() => setMore(!more)} className={`${btn} ml-auto`}><EllipsisHorizontalIcon className="w-5 h-5" /> More</button>
                {more && (
                  <div className="absolute right-4 bottom-[64px] w-56 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl py-1 z-10">
                    {menu.filter(visible).map((a) => (
                      <button key={a.label} type="button" onClick={() => { setMore(false); a.onClick(item); }}
                        className={`w-full h-11 px-4 flex items-center gap-2 text-[14px] font-semibold text-left ${a.tone === "danger" ? "text-[#DC2626] hover:bg-[#FEF2F2]" : "text-[#1A1D21] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-navy-700"}`}>
                        {a.icon && <a.icon className="w-5 h-5" />} {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
