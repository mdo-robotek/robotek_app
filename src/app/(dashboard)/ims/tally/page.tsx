"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeftIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { TallyRow, TallyGroup } from "@/lib/ims-tally";
import { TALLY_GROUPS } from "@/lib/ims-tally";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

const n = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
const COUNT_KEY = "stock-tally-counted-v1";

const STATUS: Record<TallyRow["status"], { text: string; cls: string } | null> = {
  oversold: { text: "Sold more than bought", cls: "text-[#DC2626] bg-rose-50 dark:bg-rose-500/10" },
  no_grn: { text: "No GRN entry", cls: "text-[#B45309] bg-amber-50 dark:bg-amber-500/10" },
  ok: null,
};

/**
 * Stock Tally (Sahil, 2026-10-28): what came in from outside (GRN) against
 * what went out to customers (Busy sale register), item by item — so the
 * warehouse count can be checked against it. Internal floor moves are left out.
 */
export default function StockTallyPage() {
  const { data, error, isLoading } = useSWR<{ rows: TallyRow[] }>("/api/ims/tally", fetcher, { revalidateOnFocus: false });
  const [group, setGroup] = useState<TallyGroup | "all">("all");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<TallyRow | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});

  // Warehouse counts typed here stay in this browser only (until a count sheet exists).
  useEffect(() => {
    try { setCounted(JSON.parse(localStorage.getItem(COUNT_KEY) || "{}")); } catch { /* private window */ }
  }, []);
  const setCount = (key: string, v: string) => {
    const next = { ...counted, [key]: v.replace(/[^\d-]/g, "") };
    setCounted(next);
    try { localStorage.setItem(COUNT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const rows = data?.rows || [];
  const inGroup = useMemo(() => rows.filter((r) => group === "all" || r.group === group), [rows, group]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inGroup.filter((r) => (!problemsOnly || r.status !== "ok") && (!s || `${r.item} ${r.category}`.toLowerCase().includes(s)));
  }, [inGroup, problemsOnly, q]);
  const totals = useMemo(() => ({
    items: inGroup.length,
    bought: inGroup.reduce((a, r) => a + r.bought, 0),
    sold: inGroup.reduce((a, r) => a + r.sold, 0),
    problems: inGroup.filter((r) => r.status !== "ok").length,
  }), [inGroup]);
  const groupCount = (g: TallyGroup) => rows.filter((r) => r.group === g).length;

  const diffOf = (r: TallyRow) => {
    const c = counted[r.key];
    if (c === undefined || c === "" || c === "-") return null;
    return Number(c) - r.shouldHave;
  };

  const exportCsv = () => {
    const head = ["Item", "Category", "Group", "Bought (GRN)", "GRN entries", "Last GRN", "Sold (Busy)", "Last sale", "Should be in stock", "IMS shows", "Counted", "Counted minus should be", "Status"];
    const lines = shown.map((r) => [
      r.item, r.category, r.group, r.bought, r.grnCount, r.lastGrn, r.sold, r.lastSale, r.shouldHave, r.imsStock ?? "", counted[r.key] ?? "", diffOf(r) ?? "", STATUS[r.status]?.text || "OK",
    ]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `stock-tally-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const chip = (on: boolean) =>
    `shrink-0 whitespace-nowrap h-9 px-3 rounded-full text-[14px] font-semibold border transition-colors ${
      on ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#E5E7EB] dark:border-navy-700 text-[#1A1D21] dark:text-white bg-white dark:bg-navy-900"
    }`;

  return (
    <div className="max-w-[1400px] mx-auto px-1 md:px-2 pb-10 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/ims" className="inline-flex items-center gap-1 h-9 text-[14px] font-semibold text-[#2563EB]">
            <ArrowLeftIcon className="w-4 h-4" /> IMS
          </Link>
          <h1 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white">Stock Tally</h1>
          <p className="text-[14px] text-[#5B6472] dark:text-gray-400">Bought from outside (GRN) minus sold to customers (Busy). Moves between floors are not counted.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!shown.length} className="h-11 px-4 inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px] font-semibold text-[#1A1D21] dark:text-white disabled:opacity-50">
          <ArrowDownTrayIcon className="w-5 h-5" /> Export
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Items", value: n(totals.items) },
          { label: "Bought (GRN)", value: n(totals.bought) },
          { label: "Sold (Busy)", value: n(totals.sold) },
          { label: "Should be in stock", value: n(totals.bought - totals.sold) },
          { label: "Need checking", value: n(totals.problems), bad: totals.problems > 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[13px] text-[#5B6472] dark:text-gray-400">
              {c.bad && <span className="w-2 h-2 rounded-full bg-[#DC2626]" />}
              {c.label}
            </p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums text-[#1A1D21] dark:text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 md:flex-wrap">
          <button type="button" onClick={() => setGroup("all")} className={chip(group === "all")}>All audio {rows.length}</button>
          {TALLY_GROUPS.map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)} className={chip(group === g)}>
              {g} {groupCount(g)}
            </button>
          ))}
          <button type="button" onClick={() => setProblemsOnly(!problemsOnly)} className={chip(problemsOnly)}>
            Need checking only
          </button>
        </div>
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, e.g. NB NINJA" className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-950 text-[15px] text-[#1A1D21] dark:text-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20" />
        </div>
      </div>

      {isLoading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />)}</div>}
      {error && !data && <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Couldn&apos;t build the tally right now. Refresh the page in a minute.</p>}
      {data && shown.length === 0 && (
        <div className="rounded-xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-8 text-center">
          <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white">{problemsOnly ? "Nothing needs checking here." : "No items match."}</p>
          <p className="mt-1 text-[14px] text-[#5B6472]">Try another group or clear the search.</p>
        </div>
      )}

      {/* Phone: cards */}
      {shown.length > 0 && (
        <ul className="md:hidden space-y-2">
          {shown.map((r) => {
            const st = STATUS[r.status];
            const diff = diffOf(r);
            return (
              <li key={r.key} className="rounded-xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-3">
                <button type="button" onClick={() => setOpen(r)} className="w-full text-left">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{r.item}</p>
                      <p className="text-[13px] text-[#5B6472]">{r.group}{r.category ? ` · ${r.category}` : ""}</p>
                    </div>
                    {st && <span className={`shrink-0 px-2 py-1 rounded-lg text-[13px] font-semibold ${st.cls}`}>{st.text}</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                    <div><p className="text-[#5B6472]">Bought</p><p className="text-[16px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{n(r.bought)}</p></div>
                    <div><p className="text-[#5B6472]">Sold</p><p className="text-[16px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{n(r.sold)}</p></div>
                    <div><p className="text-[#5B6472]">Should have</p><p className={`text-[16px] font-semibold tabular-nums ${r.shouldHave < 0 ? "text-[#DC2626]" : "text-[#1A1D21] dark:text-white"}`}>{n(r.shouldHave)}</p></div>
                  </div>
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[13px] text-[#5B6472]" htmlFor={`c-${r.key}`}>Counted</label>
                  <input id={`c-${r.key}`} inputMode="numeric" value={counted[r.key] ?? ""} onChange={(e) => setCount(r.key, e.target.value)} placeholder="e.g. 120" className="w-28 h-11 px-3 rounded-lg border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-950 text-[15px] tabular-nums outline-none focus:border-[#2563EB]" />
                  {diff != null && <span className={`text-[14px] font-semibold tabular-nums ${diff === 0 ? "text-[#15803D]" : "text-[#DC2626]"}`}>{diff === 0 ? "Matches" : `${diff > 0 ? "+" : ""}${n(diff)}`}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Laptop: table */}
      {shown.length > 0 && (
        <div className="hidden md:block rounded-xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 overflow-hidden">
          <table className="w-full text-[14px]">
            <thead className="sticky top-0 bg-[#F7F8FA] dark:bg-navy-950">
              <tr className="text-left text-[13px] font-semibold text-[#5B6472]">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-3 py-2.5 text-right">Bought (GRN)</th>
                <th className="px-3 py-2.5 text-right">Sold (Busy)</th>
                <th className="px-3 py-2.5 text-right">Should be in stock</th>
                <th className="px-3 py-2.5 text-right">IMS shows</th>
                <th className="px-3 py-2.5 text-right">Counted</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
              {shown.map((r) => {
                const st = STATUS[r.status];
                const diff = diffOf(r);
                return (
                  <tr key={r.key} className="hover:bg-[#F7F8FA] dark:hover:bg-navy-800/50">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => setOpen(r)} className="text-left">
                        <span className="block font-semibold text-[#1A1D21] dark:text-white hover:text-[#2563EB]">{r.item}</span>
                        <span className="block text-[13px] text-[#5B6472]">{r.group}{r.category ? ` · ${r.category}` : ""}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1D21] dark:text-white">{n(r.bought)}<span className="block text-[12px] text-[#5B6472]">{r.grnCount} GRN</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1D21] dark:text-white">{n(r.sold)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.shouldHave < 0 ? "text-[#DC2626]" : "text-[#1A1D21] dark:text-white"}`}>{n(r.shouldHave)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#5B6472]">{n(r.imsStock)}</td>
                    <td className="px-3 py-2 text-right">
                      <input inputMode="numeric" aria-label={`Counted stock of ${r.item}`} value={counted[r.key] ?? ""} onChange={(e) => setCount(r.key, e.target.value)} placeholder="—" className="w-24 h-9 px-2 rounded-lg border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-950 text-right tabular-nums outline-none focus:border-[#2563EB]" />
                      {diff != null && <span className={`block text-[12px] font-semibold tabular-nums ${diff === 0 ? "text-[#15803D]" : "text-[#DC2626]"}`}>{diff === 0 ? "Matches" : `${diff > 0 ? "+" : ""}${n(diff)}`}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{st && <span className={`inline-block px-2 py-1 rounded-lg text-[13px] font-semibold whitespace-nowrap ${st.cls}`}>{st.text}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <ItemDetail row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ItemDetail({ row, onClose }: { row: TallyRow; onClose: () => void }) {
  const { data } = useSWR<{ grn: { date: string; ref: string; qty: number }[]; salesByMonth: { month: string; qty: number }[] }>(
    `/api/ims/tally?item=${encodeURIComponent(row.key)}`, fetcher, { revalidateOnFocus: false }
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const monthName = (m: string) => {
    const d = new Date(`${m}-01T00:00:00`);
    return isNaN(d.getTime()) ? m : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-3xl h-[85vh] md:h-auto md:max-h-[85vh] flex flex-col bg-white dark:bg-navy-900 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-4 md:px-6 pt-4 pb-3 border-b border-[#E5E7EB] dark:border-navy-800">
          <div className="flex-1">
            <h2 className="text-[20px] font-semibold text-[#1A1D21] dark:text-white">{row.item}</h2>
            <p className="text-[14px] text-[#5B6472]">Bought {n(row.bought)} · Sold {n(row.sold)} · Should be in stock <span className={row.shouldHave < 0 ? "text-[#DC2626] font-semibold" : "font-semibold text-[#1A1D21] dark:text-white"}>{n(row.shouldHave)}</span></p>
          </div>
          <button type="button" onClick={onClose} className="h-11 px-3 -mr-2 flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-[#5B6472]"><XMarkIcon className="w-5 h-5" /> Close</button>
        </div>
        <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-4 p-4 md:p-6">
          <section>
            <h3 className="text-[15px] font-semibold text-[#1A1D21] dark:text-white mb-2">Came in — GRN ({row.grnCount})</h3>
            {!data ? <div className="h-24 rounded-xl bg-[#F1F3F6] animate-pulse" /> : data.grn.length === 0 ? (
              <p className="text-[14px] text-[#5B6472]">No GRN entry for this item. If it was bought, make its GRN entry so the stock adds up.</p>
            ) : (
              <ul className="divide-y divide-[#E5E7EB] dark:divide-navy-800 rounded-xl border border-[#E5E7EB] dark:border-navy-800">
                {data.grn.map((g, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 text-[14px]">
                    <span className="text-[#1A1D21] dark:text-white">{g.ref || "GRN"} <span className="text-[#5B6472]">· {g.date || "—"}</span></span>
                    <span className="font-semibold tabular-nums text-[#1A1D21] dark:text-white">{n(g.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-[15px] font-semibold text-[#1A1D21] dark:text-white mb-2">Went out — sold, by month</h3>
            {!data ? <div className="h-24 rounded-xl bg-[#F1F3F6] animate-pulse" /> : data.salesByMonth.length === 0 ? (
              <p className="text-[14px] text-[#5B6472]">No sale of this item in the Busy sale register.</p>
            ) : (
              <ul className="divide-y divide-[#E5E7EB] dark:divide-navy-800 rounded-xl border border-[#E5E7EB] dark:border-navy-800">
                {data.salesByMonth.map((s) => (
                  <li key={s.month} className="flex items-center justify-between px-3 py-2 text-[14px]">
                    <span className="text-[#1A1D21] dark:text-white">{monthName(s.month)}</span>
                    <span className="font-semibold tabular-nums text-[#1A1D21] dark:text-white">{n(s.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
