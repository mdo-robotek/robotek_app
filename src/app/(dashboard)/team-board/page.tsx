"use client";

import { useState } from "react";
import useSWR from "swr";
import { ArrowsPointingOutIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import type { CompanyScore, ModulePull, PersonScore, BoardPeriod } from "@/lib/action-board";
import { MIN_TO_RANK, neg, scoreBand, BAND_TEXT, BAND_BG, BAND_RING, SCORE_LEGEND } from "@/lib/action-board";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw Object.assign(new Error(String(r.status)), { status: r.status });
    return r.json();
  });

type Board = {
  period: string;
  company: CompanyScore;
  previous: CompanyScore;
  people: PersonScore[];
  pull: ModulePull[];
  trend: { label: string; notOnTimePct: number; due: number }[];
  failedSources: string[];
};

const PERIODS: { key: BoardPeriod; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "lastweek", label: "Last week" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
];

const tone = (pct: number) => BAND_TEXT[scoreBand(pct)];
const ring = (pct: number) => BAND_RING[scoreBand(pct)];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const pretty = (n: string) => n.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

function Photo({ p, size }: { p: PersonScore; size: "lg" | "md" }) {
  const cls = size === "lg" ? "w-24 h-24 text-[28px]" : "w-14 h-14 text-[18px]";
  const r = p.ranked ? ring(p.notOnTimePct) : "ring-[#E5E7EB]";
  if (p.image) return <img src={p.image} alt="" className={`${cls} rounded-full object-cover ring-4 ${r}`} />;
  return <span className={`${cls} rounded-full bg-[#EFF4FF] text-[#2563EB] font-semibold flex items-center justify-center ring-4 ${r}`}>{initials(p.username)}</span>;
}

function Hero({ p, rank, kind }: { p: PersonScore; rank: number; kind: "best" | "low" }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-4 flex flex-col items-center text-center">
      <div className="relative">
        <Photo p={p} size="lg" />
        <span className={`absolute -top-1 -left-1 w-8 h-8 rounded-full text-[14px] font-semibold flex items-center justify-center text-white ${kind === "best" ? "bg-[#15803D]" : "bg-[#DC2626]"}`}>{rank}</span>
      </div>
      <p className="mt-3 text-[17px] font-semibold text-[#1A1D21] dark:text-white">{pretty(p.username)}</p>
      <p className="text-[13px] text-[#5B6472] min-h-[20px]">{p.designation || p.department}</p>
      <p className={`mt-2 text-[30px] leading-none font-semibold tabular-nums ${tone(p.notOnTimePct)}`}>{neg(p.notOnTimePct)}</p>
      <p className="text-[13px] text-[#5B6472]">not done on time · not done {neg(p.notDonePct)} · {p.due} planned</p>
    </div>
  );
}

/**
 * Performance Board (Sahil, 2026-10-28) — the screen to share with the team.
 * Company score on top (target 0%), best and lowest performers with photo,
 * everyone's tile, and which work pulls the company score down.
 */
export default function TeamBoardPage() {
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const { data, error, isLoading } = useSWR<Board>(`/api/team-board?period=${period}`, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  if ((error as any)?.status === 403) {
    return <p className="max-w-xl mx-auto mt-10 text-[16px] font-semibold text-[#1A1D21]">This board is for Admin, the EA and the Process Coordinator.</p>;
  }

  const ranked = (data?.people || []).filter((p) => p.ranked);
  const best = ranked.slice(0, 3);
  const low = ranked.length > 3 ? [...ranked].reverse().slice(0, 3).filter((p) => !best.includes(p)) : [];
  const c = data?.company;
  const diff = c && data ? Math.round((c.notOnTimePct - data.previous.notOnTimePct) * 10) / 10 : 0;
  const card = "rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800";

  return (
    <div className="max-w-[1300px] mx-auto px-1 md:px-2 pb-10 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white">Performance Board</h1>
          <p className="text-[14px] text-[#5B6472] dark:text-gray-400">Work planned in the period — work not done and work not done on time, shown as minus. {SCORE_LEGEND}.</p>
        </div>
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="h-11 px-3 inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px] font-semibold text-[#1A1D21] dark:text-white">
          <ArrowsPointingOutIcon className="w-5 h-5" /> Full screen
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {PERIODS.map((p) => (
          <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`shrink-0 h-11 px-4 rounded-full text-[14px] font-semibold border ${period === p.key ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 text-[#1A1D21] dark:text-white"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && !data && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-[#F1F3F6] animate-pulse" />)}</div>}
      {error && !data && <p className="text-[15px] font-semibold text-[#1A1D21]">Couldn&apos;t load the board. Refresh in a minute.</p>}

      {data && c && (
        <>
          {/* Company score */}
          <div className={`${card} p-5 grid grid-cols-1 md:grid-cols-3 gap-5`}>
            <div>
              <p className="text-[14px] font-semibold text-[#5B6472]">Company · work not done on time · {data.period}</p>
              <p className={`mt-1 text-[48px] leading-none font-semibold tabular-nums ${tone(c.notOnTimePct)}`}>{neg(c.notOnTimePct)}</p>
              <p className="mt-2 text-[14px] text-[#5B6472] flex items-center gap-1">
                {diff === 0 ? "Same as before" : diff < 0 ? <><ArrowTrendingDownIcon className="w-4 h-4 text-[#15803D]" /> {Math.abs(diff)} points better than before</> : <><ArrowTrendingUpIcon className="w-4 h-4 text-[#DC2626]" /> {diff} points worse than before</>}
              </p>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#5B6472]">Company · work not done</p>
              <p className={`mt-1 text-[36px] leading-none font-semibold tabular-nums ${tone(c.notDonePct)}`}>{neg(c.notDonePct)}</p>
              <p className="mt-2 text-[14px] text-[#5B6472]">{c.notDone} not done · {c.doneLate} done late · of {c.due} planned</p>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#5B6472]">Last 6 weeks · work not done on time</p>
              <div className="mt-2 flex items-end gap-2 h-[64px]">
                {data.trend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className={`text-[12px] font-semibold tabular-nums ${tone(t.notOnTimePct)}`}>{t.due ? neg(Math.round(t.notOnTimePct)) : "—"}</span>
                    <div className={`w-full rounded-t ${BAND_BG[scoreBand(t.notOnTimePct)]}`} style={{ height: `${Math.max(4, Math.min(40, t.notOnTimePct * 0.6))}px` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-1">{data.trend.map((t, i) => <span key={i} className="flex-1 text-center text-[11px] text-[#5B6472]">{t.label}</span>)}</div>
            </div>
          </div>

          {/* Best and lowest */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section>
              <h2 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white mb-2">Best performers</h2>
              {best.length ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{best.map((p, i) => <Hero key={p.username} p={p} rank={i + 1} kind="best" />)}</div> : <p className="text-[14px] text-[#5B6472]">Not enough work planned yet this period.</p>}
            </section>
            <section>
              <h2 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white mb-2">Need to improve</h2>
              {low.length ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{low.map((p, i) => <Hero key={p.username} p={p} rank={i + 1} kind="low" />)}</div> : <p className="text-[14px] text-[#5B6472]">Not enough people with work yet this period.</p>}
            </section>
          </div>

          {/* What pulls the score down */}
          {data.pull.length > 0 && (
            <section className={`${card} p-4`}>
              <h2 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white">What pulls the company score down</h2>
              <p className="text-[13px] text-[#5B6472] mb-3">Work not done or done late, by process — fix the top one first.</p>
              <ul className="space-y-2.5">
                {data.pull.map((m) => (
                  <li key={m.module}>
                    <div className="flex items-baseline justify-between text-[14px]">
                      <span className="font-semibold text-[#1A1D21] dark:text-white">{m.module}</span>
                      <span className="tabular-nums text-[#5B6472]"><span className="font-semibold text-[#1A1D21] dark:text-white">{m.missed}</span> of {m.due} · {m.sharePct}% of all misses</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[#F1F3F6] dark:bg-navy-800 overflow-hidden">
                      <div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${m.sharePct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Everyone */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white mb-2">Everyone · {data.period}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.people.map((p) => (
                <div key={p.username} className={`${card} p-3 flex flex-col items-center text-center`}>
                  <Photo p={p} size="md" />
                  <p className="mt-2 text-[15px] font-semibold text-[#1A1D21] dark:text-white leading-tight">{pretty(p.username)}</p>
                  <p className="text-[12px] text-[#5B6472] min-h-[18px] truncate max-w-full">{p.designation || p.department}</p>
                  <p className={`mt-1 text-[22px] leading-none font-semibold tabular-nums ${p.ranked ? tone(p.notOnTimePct) : "text-[#5B6472]"}`}>{neg(p.notOnTimePct)}</p>
                  <p className="text-[12px] text-[#5B6472]">{p.ranked ? `not done on time · ${p.due} planned` : `only ${p.due} planned — not ranked`}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[#5B6472]">People with fewer than {MIN_TO_RANK} planned items in the period are shown but not ranked. Photos come from the Users page.</p>
          </section>

          {data.failedSources.length > 0 && <p className="text-[13px] text-[#B45309]">Couldn&apos;t read: {data.failedSources.join(", ")}.</p>}
        </>
      )}
    </div>
  );
}
