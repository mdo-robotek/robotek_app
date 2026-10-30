"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

type MissItem = {
  module: string;
  step: string;
  title: string;
  ref: string;
  responsible: string;
  planned: string;
  actual: string;
  kind: "not_done" | "late";
  delayHours: number;
};
type Person = {
  username: string;
  designation: string;
  department: string;
  due: number;
  missed: number;
  notDone: number;
  late: number;
  byModule: Record<string, number>;
  items: MissItem[];
};
type ApiData = { from: string; to: string; people: Person[]; unmatched: { name: string; count: number }[]; failedSources: string[] };

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Failed to load");
    return j;
  });

const IST = "Asia/Kolkata";
const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
function fmt(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST });
}
function delay(h: number) {
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const card = "bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700";
const btn = "inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800";
const input = "px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px] text-slate-800 dark:text-white outline-none focus:border-[#2563EB]";

export default function ScoreWhyPage() {
  const today = new Date();
  const [from, setFrom] = useState(`${istDate(today).slice(0, 8)}01`);
  const [to, setTo] = useState(istDate(today));
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data, error, isLoading, mutate } = useSWR<ApiData>(`/api/score/misses?from=${from}&to=${to}`, fetcher, { revalidateOnFocus: false });

  const setRange = (kind: "month" | "last" | "week") => {
    const now = new Date(Date.now() + 5.5 * 36e5);
    if (kind === "month") {
      setFrom(`${istDate(today).slice(0, 8)}01`);
      setTo(istDate(today));
    } else if (kind === "last") {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      setFrom(first.toISOString().slice(0, 10));
      setTo(last.toISOString().slice(0, 10));
    } else {
      const d = new Date(now);
      const dow = (d.getUTCDay() + 6) % 7; // Monday start
      d.setUTCDate(d.getUTCDate() - dow);
      setFrom(d.toISOString().slice(0, 10));
      setTo(istDate(today));
    }
  };

  const modules = useMemo(() => {
    const s = new Set<string>();
    data?.people.forEach((p) => Object.keys(p.byModule).forEach((m) => s.add(m)));
    return ["All", ...Array.from(s).sort()];
  }, [data]);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.people || [])
      .map((p) => (moduleFilter === "All" ? p : { ...p, items: p.items.filter((i) => i.module === moduleFilter) }))
      .filter((p) => (!q || `${p.username} ${p.designation} ${p.department}`.toLowerCase().includes(q)))
      .filter((p) => moduleFilter === "All" || p.items.length > 0);
  }, [data, search, moduleFilter]);

  const exportCsv = () => {
    const rows = [["Employee", "Designation", "Module", "Step", "Task", "Ref", "Planned", "Done at", "Status", "Delay"]];
    people.forEach((p) =>
      p.items.forEach((i) =>
        rows.push([p.username, p.designation, i.module, i.step, i.title, i.ref, fmt(i.planned), i.actual ? fmt(i.actual) : "", i.kind === "late" ? "Done late" : "Not done", delay(i.delayHours)]),
      ),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `score-misses_${from}_to_${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/score" className={btn} title="Back to Score"><ArrowLeftIcon className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-white">Score — why it dropped</h1>
            <p className="text-[14px] text-slate-500">Every task or FMS step not done on time, per person — Delegation, Checklist, Help Ticket and all FMS.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => mutate()} className={btn}><ArrowPathIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh</button>
          <button onClick={exportCsv} className={btn} disabled={!people.length}><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>
          <button onClick={() => { setOpen(Object.fromEntries(people.map((p) => [p.username, true]))); setTimeout(() => window.print(), 300); }} className={btn}><PrinterIcon className="w-4 h-4" /> Print</button>
        </div>
      </div>

      <div className={`${card} p-3 flex flex-wrap items-end gap-3 print:hidden`}>
        <label className="text-[13px] text-slate-500">From<br /><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={input} /></label>
        <label className="text-[13px] text-slate-500">To<br /><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={input} /></label>
        <div className="flex gap-1.5">
          <button onClick={() => setRange("week")} className={btn}>This week</button>
          <button onClick={() => setRange("month")} className={btn}>This month</button>
          <button onClick={() => setRange("last")} className={btn}>Last month</button>
        </div>
        <label className="text-[13px] text-slate-500">Module<br />
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={input}>
            {modules.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee" className={`${input} w-full pl-9`} />
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-[14px]">{String(error.message || error)}</div>}
      {data?.failedSources?.length ? (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-[14px] flex gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" /> Could not read: {data.failedSources.join(", ")}. Those modules are missing from this report.
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className={`${card} p-10 text-center text-slate-400`}><ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />Reading all modules… (can take ~20 sec)</div>
      ) : (
        <div className="space-y-2">
          {people.length === 0 && <div className={`${card} p-8 text-center text-slate-500`}>No misses in this period. 🎉</div>}
          {people.map((p) => {
            const isOpen = !!open[p.username];
            const shown = p.items.length;
            return (
              <div key={p.username} className={`${card} overflow-hidden break-inside-avoid`}>
                <button onClick={() => setOpen((o) => ({ ...o, [p.username]: !isOpen }))} className="w-full text-left p-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[15px] font-semibold text-slate-800 dark:text-white">{p.username}</p>
                    <p className="text-[13px] text-slate-500">{[p.designation, p.department].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="text-[14px]">
                    {shown === 0 ? (
                      <span className="text-emerald-600 font-semibold">No misses</span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-200"><b className="text-red-600">{shown}</b> missed{moduleFilter === "All" && p.due ? ` of ${p.due} due` : ""}</span>
                    )}
                  </div>
                  {moduleFilter === "All" && shown > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.notDone > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[13px] font-semibold">{p.notDone} not done</span>}
                      {p.late > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[13px] font-semibold">{p.late} late</span>}
                      {Object.entries(p.byModule).sort((a, b) => b[1] - a[1]).map(([m, c]) => (
                        <span key={m} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-300 text-[13px]">{m} {c}</span>
                      ))}
                    </div>
                  )}
                  {shown > 0 && (isOpen ? <ChevronUpIcon className="w-5 h-5 text-slate-400 print:hidden" /> : <ChevronDownIcon className="w-5 h-5 text-slate-400 print:hidden" />)}
                </button>
                {isOpen && shown > 0 && (
                  <div className="border-t border-slate-100 dark:border-navy-700 overflow-x-auto">
                    <table className="w-full text-[13px] min-w-[760px]">
                      <thead>
                        <tr className="text-left text-slate-500 bg-slate-50 dark:bg-navy-900">
                          <th className="px-3 py-2 font-semibold">Module</th>
                          <th className="px-3 py-2 font-semibold">Step</th>
                          <th className="px-3 py-2 font-semibold">Task</th>
                          <th className="px-3 py-2 font-semibold">Planned</th>
                          <th className="px-3 py-2 font-semibold">Done at</th>
                          <th className="px-3 py-2 font-semibold">Why</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((i, k) => (
                          <tr key={k} className="border-t border-slate-100 dark:border-navy-800">
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{i.module}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{i.step || "—"}</td>
                            <td className="px-3 py-2 text-slate-800 dark:text-white">{i.title}{i.ref ? <span className="text-slate-400"> · {i.ref}</span> : null}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmt(i.planned)}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{i.actual ? fmt(i.actual) : "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold">
                              {i.kind === "not_done"
                                ? <span className="text-red-600">Not done · {delay(i.delayHours)} overdue</span>
                                : <span className="text-amber-700">Done {delay(i.delayHours)} late</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data?.unmatched?.length ? (
        <div className={`${card} p-3`}>
          <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Misses not linked to any ERP user</p>
          <p className="text-[13px] text-slate-500 mb-2">The step setup of these FMS uses a name that doesn&apos;t match an ERP username, so nobody&apos;s score shows them. Fix the doer name in that module&apos;s step setup.</p>
          <div className="flex flex-wrap gap-1.5">
            {data.unmatched.map((u) => <span key={u.name} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-[13px] text-slate-600 dark:text-slate-300">{u.name} · {u.count}</span>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
