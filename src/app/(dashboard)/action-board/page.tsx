"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  PhoneIcon, ChatBubbleLeftEllipsisIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon, ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { CompanyScore, PersonLate, TicketFollowUp } from "@/lib/action-board";
import { nudgeText, phoneDigits, ticketNudgeText, neg, scoreBand, BAND_TEXT, SCORE_LEGEND } from "@/lib/action-board";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw Object.assign(new Error(String(r.status)), { status: r.status });
    return r.json();
  });

type Board = {
  generatedAt: string;
  score: { week: CompanyScore; lastWeek: CompanyScore; month: CompanyScore };
  lateNow: number;
  people: PersonLate[];
  tickets: TicketFollowUp[];
  datesAsked: number;
  failedSources: string[];
};

const tone = (pct: number) => BAND_TEXT[scoreBand(pct)];
const lateText = (h: number) => (h >= 24 ? `${Math.floor(h / 24)}d ${h % 24 ? `${h % 24}h ` : ""}late` : `${Math.max(1, h)}h late`);
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Avatar({ name, image }: { name: string; image?: string }) {
  if (image) return <img src={image} alt="" className="w-11 h-11 rounded-full object-cover border border-[#E5E7EB]" />;
  return <span className="w-11 h-11 rounded-full bg-[#EFF4FF] text-[#2563EB] text-[14px] font-semibold flex items-center justify-center shrink-0">{initials(name)}</span>;
}

function ContactButtons({ phone, text }: { phone: string; text: string }) {
  const d = phoneDigits(phone);
  if (!d) return <span className="text-[13px] text-[#5B6472]">No phone in Users</span>;
  const btn = "h-11 px-3 inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 text-[14px] font-semibold text-[#1A1D21] dark:text-white bg-white dark:bg-navy-900 hover:border-[#2563EB]";
  return (
    <div className="flex gap-2">
      <a href={`tel:+${d}`} className={btn}><PhoneIcon className="w-4 h-4" /> Call</a>
      <a href={`https://wa.me/${d}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={btn}>
        <ChatBubbleLeftEllipsisIcon className="w-4 h-4" /> WhatsApp
      </a>
    </div>
  );
}

/**
 * Action Board (Sahil, 2026-10-28) — for the Process Coordinator and the EA.
 * Goal on top: work not done 0%, not done on time 0%. Below: everyone who is
 * late right now, most late first, with Call / WhatsApp in one tap.
 */
export default function ActionBoardPage() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<Board>("/api/action-board", fetcher, {
    refreshInterval: 300000,
    revalidateOnFocus: false,
  });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"people" | "tickets">("people");

  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.people || []).filter((p) => !s || p.username.toLowerCase().includes(s) || p.items.some((i) => `${i.title} ${i.module}`.toLowerCase().includes(s)));
  }, [data, q]);

  if ((error as any)?.status === 403) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] p-6">
        <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white">This page is for the Process Coordinator, the EA and Admin.</p>
        <p className="mt-1 text-[14px] text-[#5B6472]">Your own pending work is on Home and on each module page.</p>
      </div>
    );
  }

  const w = data?.score.week;
  const card = "rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800";

  return (
    <div className="max-w-[1200px] mx-auto px-1 md:px-2 pb-10 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white">Action Board</h1>
          <p className="text-[14px] text-[#5B6472] dark:text-gray-400">Who is late right now, and on what. Call or WhatsApp them — goal is 0% on both scores. {SCORE_LEGEND}.</p>
        </div>
        <button type="button" onClick={() => mutate()} className="h-11 px-3 inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px] font-semibold text-[#1A1D21] dark:text-white">
          <ArrowPathIcon className={`w-4 h-4 ${isValidating ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />)}</div>}
      {error && !data && (error as any)?.status !== 403 && <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Couldn&apos;t load the board. Tap Refresh in a minute.</p>}

      {data && w && (
        <>
          {/* Company score — the PC's target is 0 on both */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${card} p-4`}>
              <p className="text-[14px] font-semibold text-[#5B6472]">Work not done · this week</p>
              <p className={`mt-1 text-[34px] leading-none font-semibold tabular-nums ${tone(w.notDonePct)}`}>{neg(w.notDonePct)}</p>
              <p className="mt-1.5 text-[13px] text-[#5B6472]">{w.notDone} of {w.due} planned · target 0%</p>
            </div>
            <div className={`${card} p-4`}>
              <p className="text-[14px] font-semibold text-[#5B6472]">Work not done on time · this week</p>
              <p className={`mt-1 text-[34px] leading-none font-semibold tabular-nums ${tone(w.notOnTimePct)}`}>{neg(w.notOnTimePct)}</p>
              <p className="mt-1.5 text-[13px] text-[#5B6472]">{w.doneLate} done but late · last week {neg(data.score.lastWeek.notOnTimePct)}</p>
            </div>
            <div className={`${card} p-4`}>
              <p className="text-[14px] font-semibold text-[#5B6472]">Late right now</p>
              <p className={`mt-1 text-[34px] leading-none font-semibold tabular-nums ${data.lateNow ? "text-[#DC2626]" : "text-[#15803D]"}`}>{data.lateNow}</p>
              <p className="mt-1.5 text-[13px] text-[#5B6472]">with {data.people.length} people</p>
            </div>
            <div className={`${card} p-4 flex flex-col`}>
              <p className="text-[14px] font-semibold text-[#5B6472]">Waiting on others</p>
              <p className="mt-1 text-[15px] text-[#1A1D21] dark:text-white"><span className="font-semibold tabular-nums">{data.tickets.length}</span> help tickets open</p>
              <Link href="/delegations?revisions=1" className="text-[15px] text-[#1A1D21] dark:text-white"><span className="font-semibold tabular-nums">{data.datesAsked}</span> new dates to approve <span className="text-[#2563EB] font-semibold">→</span></Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {(["people", "tickets"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`h-11 px-4 rounded-full text-[14px] font-semibold border ${tab === t ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 text-[#1A1D21] dark:text-white"}`}>
                {t === "people" ? `Late work · ${data.people.length}` : `Help tickets · ${data.tickets.length}`}
              </button>
            ))}
          </div>

          {tab === "people" && (
            <>
              <div className="relative max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472]" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person or work" className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-950 text-[15px] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
              {people.length === 0 && (
                <div className={`${card} p-8 text-center`}>
                  <p className="text-[16px] font-semibold text-[#15803D]">Nobody is late right now.</p>
                  <p className="mt-1 text-[14px] text-[#5B6472]">Check again after lunch — the board refreshes every 5 minutes.</p>
                </div>
              )}
              <ul className="space-y-3">
                {people.map((p) => {
                  const isOpen = open === p.username;
                  return (
                    <li key={p.username} className={`${card} p-3 md:p-4`}>
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar name={p.username} image={p.image} />
                          <div className="min-w-0">
                            <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white truncate">{p.username}</p>
                            <p className="text-[13px] text-[#5B6472] truncate">
                              <span className="font-semibold text-[#DC2626]">{p.late} late</span>
                              {p.oldestDays > 0 && <> · oldest {p.oldestDays} day{p.oldestDays === 1 ? "" : "s"}</>}
                              {p.designation && <> · {p.designation}</>}
                              {!p.matched && <> · name not matched to a user</>}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {Object.entries(p.byModule).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
                                <span key={m} className="px-2 py-0.5 rounded-md bg-[#F1F3F6] dark:bg-navy-800 text-[12px] font-semibold text-[#5B6472]">{m} {n}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ContactButtons phone={p.phone} text={nudgeText(p)} />
                          <button type="button" onClick={() => setOpen(isOpen ? null : p.username)} className="h-11 px-3 inline-flex items-center gap-1 rounded-xl text-[14px] font-semibold text-[#2563EB]">
                            {isOpen ? <>Hide <ChevronUpIcon className="w-4 h-4" /></> : <>See work <ChevronDownIcon className="w-4 h-4" /></>}
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <ul className="mt-3 divide-y divide-[#E5E7EB] dark:divide-navy-800 border-t border-[#E5E7EB] dark:border-navy-800">
                          {p.items.map((i, k) => (
                            <li key={k} className="py-2.5 flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[#5B6472]">{i.module}{i.ref ? ` · ${i.ref}` : ""}</p>
                                <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white leading-snug">{i.title}</p>
                                {i.step && <p className="text-[13px] text-[#5B6472]">{i.step}</p>}
                              </div>
                              <span className="shrink-0 px-2 py-1 rounded-lg text-[13px] font-semibold text-[#DC2626] bg-rose-50 dark:bg-rose-500/10">{lateText(i.lateHours)}</span>
                              <Link href={i.link} className="shrink-0 h-9 px-3 inline-flex items-center rounded-lg text-[14px] font-semibold text-[#2563EB] hover:bg-[#EFF4FF]">Open</Link>
                            </li>
                          ))}
                          {p.late > p.items.length && <li className="py-2 text-[13px] text-[#5B6472]">…and {p.late - p.items.length} older items</li>}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === "tickets" && (
            <div className={card}>
              <p className="px-4 pt-3 pb-2 text-[13px] text-[#5B6472]">Only the ticket number and the person are shown here. Remind them to open it in Help Tickets.</p>
              {data.tickets.length === 0 ? (
                <p className="px-4 pb-6 text-[15px] font-semibold text-[#15803D]">No help ticket is open.</p>
              ) : (
                <ul className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
                  {data.tickets.map((t) => (
                    <li key={t.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Ticket #{t.id} · for {t.forWhom}</p>
                        <p className="text-[13px] text-[#5B6472]">
                          {t.raisedBy && <>Raised by {t.raisedBy} · </>}open {t.daysOpen} day{t.daysOpen === 1 ? "" : "s"}
                          {t.pastDue && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-50 text-[#DC2626] font-semibold">Past due date</span>}
                        </p>
                      </div>
                      <ContactButtons phone={t.phone} text={ticketNudgeText(t)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {data.failedSources.length > 0 && (
            <p className="text-[13px] text-[#B45309]">Couldn&apos;t read: {data.failedSources.join(", ")}. The numbers above leave these out.</p>
          )}
        </>
      )}
    </div>
  );
}
