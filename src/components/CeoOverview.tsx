"use client";

import Link from "next/link";
import useSWR from "swr";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import PendingApprovalsCard from "./PendingApprovalsCard";
import type { ModuleSummary, Tone } from "@/lib/module-summary";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

/** ₹ in lakh / crore. */
const inr = (n: number): string => {
  const v = Math.abs(n);
  if (v >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

const toneDot: Record<Tone, string> = {
  good: "bg-[#15803D]",
  warn: "bg-[#D97706]",
  bad: "bg-[#DC2626]",
  neutral: "bg-transparent",
};

function Tile({ m }: { m: ModuleSummary }) {
  return (
    <Link
      href={m.href}
      className="group flex flex-col rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-4 min-h-[136px] hover:border-[#2563EB] transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${toneDot[m.headline.tone]}`} />
        <span className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{m.title}</span>
        <ChevronRightIcon className="w-4 h-4 ml-auto text-[#5B6472] group-hover:text-[#2563EB] transition-colors" />
      </div>
      <p className="mt-3 text-[30px] leading-none font-semibold tabular-nums text-[#1A1D21] dark:text-white">
        {m.headline.value}
      </p>
      <p className="mt-1.5 text-[14px] text-[#5B6472] dark:text-gray-400">{m.headline.label}</p>
      <p className="mt-auto pt-2 text-[13px] leading-snug text-[#5B6472] dark:text-gray-400 line-clamp-2">{m.note}</p>
    </Link>
  );
}

/**
 * The CEO home — short on purpose (Sahil, 25 Oct 2026). Is anything on fire?
 * How are we doing today? Then one tile per area; tap a tile to land on that
 * module's own page, which carries its detailed figures.
 */
export default function CeoOverview() {
  const { data, error } = useSWR("/api/summary", fetcher, {
    refreshInterval: 120000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  const { data: busy } = useSWR("/api/ims/busy-freshness", fetcher, {
    refreshInterval: 600000,
    revalidateOnFocus: false,
  });
  const { data: collection } = useSWR("/api/collection/summary", fetcher, {
    refreshInterval: 600000,
    revalidateOnFocus: false,
  });

  const ov = data?.overview;
  const modules: ModuleSummary[] = data?.modules || [];

  const alerts = ov
    ? [
        { label: "Orders waiting over 7 days", count: ov.alerts.ordersOver7Days, href: "/o2d" },
        { label: "Tasks overdue", count: ov.alerts.overdueTasks, href: "/delegations" },
        { label: "Stock entries that don't match", count: ov.alerts.stockMismatches, href: "/item-ledger" },
      ].filter((a) => a.count > 0)
    : [];
  const busyStale = (busy?.daysOld ?? 0) >= 2;

  const todayPct = ov?.dailyTarget ? Math.round((ov.todaySale / ov.dailyTarget) * 100) : 0;
  const monthPct = ov?.monthTarget ? Math.round((ov.monthSale / ov.monthTarget) * 100) : 0;
  const pctTone = (p: number) => (p >= 100 ? "text-[#15803D]" : p >= 60 ? "text-[#D97706]" : "text-[#DC2626]");
  const barTone = (p: number) => (p >= 100 ? "bg-[#15803D]" : p >= 60 ? "bg-[#D97706]" : "bg-[#DC2626]");

  if (!data && error) {
    return (
      <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-6">
        <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Couldn&apos;t load the overview right now.</p>
        <p className="mt-1 text-[14px] text-[#5B6472] dark:text-gray-400">It will try again on its own in a couple of minutes. You can also refresh the page.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-[132px] rounded-2xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[136px] rounded-2xl bg-[#F1F3F6] dark:bg-navy-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Needs attention — only when something is actually wrong */}
      {(alerts.length > 0 || busyStale) && (
        <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#FECACA] dark:border-rose-500/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#FEF2F2] dark:bg-rose-500/10 border-b border-[#FECACA] dark:border-rose-500/20">
            <h3 className="text-[15px] font-semibold text-[#DC2626]">Needs attention today</h3>
          </div>
          <div className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
            {busyStale && (
              <div className="flex items-center gap-4 px-4 min-h-[52px]">
                <span className="min-w-[48px] text-right text-[22px] font-semibold text-[#DC2626] tabular-nums">{busy.daysOld}d</span>
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold text-[#1A1D21] dark:text-white">Busy sale data is {busy.daysOld} days old</span>
                  <span className="block text-[13px] text-[#5B6472] dark:text-gray-400">Accounts team: copy the sale list from Busy (Transaction → Sales → List).</span>
                </span>
              </div>
            )}
            {alerts.map((a) => (
              <Link key={a.label} href={a.href} className="flex items-center gap-4 px-4 min-h-[52px] hover:bg-[#F7F8FA] dark:hover:bg-navy-800/50 transition-colors">
                <span className="min-w-[48px] text-right text-[22px] font-semibold text-[#DC2626] tabular-nums">{a.count}</span>
                <span className="flex-1 text-[15px] font-semibold text-[#1A1D21] dark:text-white">{a.label}</span>
                <ChevronRightIcon className="w-4 h-4 text-[#5B6472]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 2. Sale — today is the big number, the month sits beside it */}
      {ov && (
        <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className="text-[14px] font-semibold text-[#5B6472] dark:text-gray-400">Today&apos;s sale</p>
            <p className="mt-1 text-[38px] leading-none font-semibold tabular-nums text-[#1A1D21] dark:text-white">{inr(ov.todaySale)}</p>
            <p className="mt-2 text-[14px] text-[#5B6472] dark:text-gray-400">
              Target {ov.dailyTarget ? inr(ov.dailyTarget) : "not set"}
              {ov.dailyTarget ? <span className={`ml-2 font-semibold ${pctTone(todayPct)}`}>{todayPct}%</span> : null}
            </p>
            {ov.dailyTarget > 0 && (
              <div className="mt-2 h-2 rounded-full bg-[#F1F3F6] dark:bg-navy-800 overflow-hidden">
                <div className={`h-full rounded-full ${barTone(todayPct)}`} style={{ width: `${Math.min(100, todayPct)}%` }} />
              </div>
            )}
          </div>
          <div className="sm:border-l sm:border-[#E5E7EB] sm:dark:border-navy-800 sm:pl-5">
            <p className="text-[14px] font-semibold text-[#5B6472] dark:text-gray-400">This month</p>
            <p className="mt-1 text-[26px] leading-none font-semibold tabular-nums text-[#1A1D21] dark:text-white">{inr(ov.monthSale)}</p>
            <p className="mt-2 text-[14px] text-[#5B6472] dark:text-gray-400">
              of {ov.monthTarget ? inr(ov.monthTarget) : "—"} target
              {ov.monthTarget ? <span className={`ml-2 font-semibold ${pctTone(monthPct)}`}>{monthPct}%</span> : null}
            </p>
            <Link href="/metrix" className="inline-flex items-center gap-1 mt-2 min-h-[32px] text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
              See trends <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* 3. One tile per area — tap to open that module */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {modules.map((m) => (
          <Tile key={m.key} m={m} />
        ))}
        <Link
          href="/party-management"
          className="group flex flex-col rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-4 min-h-[136px] hover:border-[#2563EB] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${collection?.overdueOutstanding > 0 ? "bg-[#DC2626]" : "bg-transparent"}`} />
            <span className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Collection</span>
            <ChevronRightIcon className="w-4 h-4 ml-auto text-[#5B6472] group-hover:text-[#2563EB] transition-colors" />
          </div>
          {collection?.connected ? (
            <>
              <p className="mt-3 text-[30px] leading-none font-semibold tabular-nums text-[#1A1D21] dark:text-white">{inr(collection.totalOutstanding)}</p>
              <p className="mt-1.5 text-[14px] text-[#5B6472] dark:text-gray-400">outstanding</p>
              <p className="mt-auto pt-2 text-[13px] text-[#5B6472] dark:text-gray-400 truncate">
                {collection.overdueOutstanding > 0 ? `${inr(collection.overdueOutstanding)} overdue` : `${collection.partyCount} parties`}
              </p>
            </>
          ) : collection?.sheetReady ? (
            <>
              <p className="mt-3 text-[15px] font-semibold text-[#1A1D21] dark:text-white">Waiting for data</p>
              <p className="mt-1.5 text-[13px] text-[#5B6472] dark:text-gray-400 line-clamp-2">Accounts team: paste today&apos;s outstanding from Busy</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-[15px] font-semibold text-[#1A1D21] dark:text-white">Not connected yet</p>
              <p className="mt-1.5 text-[13px] text-[#5B6472] dark:text-gray-400 line-clamp-2">Needs the outstanding sheet from Busy</p>
            </>
          )}
        </Link>
      </div>

      {/* 4. My approvals — hides itself when nothing is waiting */}
      <PendingApprovalsCard />
    </div>
  );
}
