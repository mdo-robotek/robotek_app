"use client";

import Link from "next/link";
import useSWR from "swr";
import PendingApprovalsCard from "./PendingApprovalsCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** ₹ in Indian lakh / crore shorthand. */
const inr = (n: number): string => {
  const v = Math.abs(n);
  if (v >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${Math.round(n)}`;
};

function Card({
  title,
  children,
  href,
  action,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-[#5B6472] dark:text-gray-400">
          {title}
        </h3>
        {href && (
          <Link href={href} className="text-[13px] font-semibold text-[#2563EB]">
            {action || "Open"}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * The top of the COO/CEO dashboard, in the order Sahil asked for:
 * red alerts -> today's sale vs target -> pending approvals -> stuck orders
 * -> collection. Everything already in the COO report stays below this,
 * untouched. The biggest number on each card is the one that matters.
 */
export default function CooCommandBar({ data }: { data: any }) {
  const { data: collection } = useSWR("/api/collection/summary", fetcher, {
    refreshInterval: 600000,
    revalidateOnFocus: false,
  });

  const alerts = data?.alerts || {};
  const orders = data?.orders || {};
  const revenue = data?.revenue || {};

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const dailyTarget = revenue.fullMonthTarget
    ? Math.round(revenue.fullMonthTarget / daysInMonth)
    : 0;
  const todaySale = orders.todayRevenue || 0;
  const todayPct = dailyTarget ? Math.round((todaySale / dailyTarget) * 100) : 0;

  const redAlerts = [
    { label: "Orders delayed over 7 days", count: alerts.criticalDelayCount || 0, href: "/o2d" },
    { label: "Overdue tasks", count: alerts.overdueTaskCount || 0, href: "/delegations" },
    { label: "Stock entries not matching", count: alerts.ledgerMismatchCount || 0, href: "/item-ledger" },
  ].filter((a) => a.count > 0);

  const stuckDispatch = orders.delayAging?.total || 0;
  const stuckPaperwork = orders.delayAging?.postDispatchCount || 0;

  return (
    <div className="space-y-4 mb-6">
      {/* 1. RED ALERTS — only shows up when something is actually wrong */}
      {redAlerts.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#FECACA] dark:border-rose-500/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 border-b border-[#FECACA] dark:border-rose-500/20">
            <h3 className="text-[15px] font-semibold text-[#DC2626]">
              Needs Attention Today
            </h3>
          </div>
          <div className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
            {redAlerts.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[#F7F8FA] dark:hover:bg-navy-800/50 transition-colors"
              >
                <span className="min-w-[56px] text-right text-[22px] font-semibold text-[#DC2626] tabular-nums">
                  {a.count}
                </span>
                <span className="flex-1 text-[15px] font-semibold text-[#1A1D21] dark:text-white">
                  {a.label}
                </span>
                <span className="text-[13px] font-semibold text-[#2563EB]">Open</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 2. TODAY'S SALE vs TARGET + 4. STUCK ORDERS + 5. COLLECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Today's Sale vs Target" href="/sales" action="Sales">
          <p className="text-[34px] leading-none font-semibold text-[#1A1D21] dark:text-white tabular-nums">
            {inr(todaySale)}
          </p>
          <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-2">
            Target {dailyTarget ? inr(dailyTarget) : "not set"}
            {dailyTarget ? (
              <span
                className={`ml-2 font-semibold ${
                  todayPct >= 100
                    ? "text-[#15803D]"
                    : todayPct >= 60
                    ? "text-[#D97706]"
                    : "text-[#DC2626]"
                }`}
              >
                {todayPct}%
              </span>
            ) : null}
          </p>
          {dailyTarget > 0 && (
            <div className="mt-3 h-2 rounded-full bg-[#F1F3F6] dark:bg-navy-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  todayPct >= 100
                    ? "bg-[#15803D]"
                    : todayPct >= 60
                    ? "bg-[#D97706]"
                    : "bg-[#DC2626]"
                }`}
                style={{ width: `${Math.min(100, todayPct)}%` }}
              />
            </div>
          )}
        </Card>

        <Card title="Stuck Orders" href="/o2d" action="Orders">
          <p className="text-[34px] leading-none font-semibold text-[#1A1D21] dark:text-white tabular-nums">
            {stuckDispatch}
          </p>
          <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-2">
            waiting to dispatch
          </p>
          <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-1">
            {stuckPaperwork} dispatched, paperwork pending
          </p>
        </Card>

        <Card title="Collection / Outstanding" href="/party-management" action="Parties">
          {collection?.connected ? (
            <>
              <p className="text-[34px] leading-none font-semibold text-[#1A1D21] dark:text-white tabular-nums">
                {inr(collection.totalOutstanding)}
              </p>
              <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-2">
                {collection.partyCount} parties
                {collection.asOnDate ? ` · as on ${collection.asOnDate}` : ""}
              </p>
              {collection.overdueOutstanding > 0 && (
                <p className="text-[14px] font-semibold text-[#DC2626] mt-1">
                  {inr(collection.overdueOutstanding)} overdue
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">
                Outstanding sheet not connected
              </p>
              <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-2 leading-relaxed">
                Export party-wise outstanding from Busy into a Google Sheet with
                a tab named <span className="font-semibold">Outstanding</span> and
                columns: Party Name, Outstanding Amount, Overdue Days, As On Date.
                Then this card fills up on its own.
              </p>
            </>
          )}
        </Card>
      </div>

      {/* 3. PENDING APPROVALS — self-hides when nothing is waiting */}
      <PendingApprovalsCard />
    </div>
  );
}
