"use client";

import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ApprovalGroup {
  key: string;
  title: string;
  href: string;
  count: number;
  oldestDays: number | null;
  samples: { label: string; sub: string }[];
}

/**
 * Pending Approvals — shows only the approvals THIS user has to clear
 * (routing lives in src/lib/approval-routing.ts). Hides itself completely
 * when there is nothing waiting, so it never becomes dashboard noise.
 */
export default function PendingApprovalsCard() {
  const { data } = useSWR<{ groups: ApprovalGroup[]; total: number }>(
    "/api/approvals/pending",
    fetcher,
    { refreshInterval: 120000, revalidateOnFocus: true }
  );

  const groups = data?.groups || [];
  if (groups.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-navy-800 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">
          Pending Approvals
        </h3>
        <span className="text-[13px] font-semibold text-[#D97706] bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full">
          {data?.total} waiting
        </span>
      </div>

      <div className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
        {groups.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[#F7F8FA] dark:hover:bg-navy-800/50 transition-colors"
          >
            <div className="min-w-[56px] text-right">
              <span className="text-[22px] font-semibold text-[#1A1D21] dark:text-white tabular-nums">
                {g.count}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">
                {g.title}
              </p>
              <p className="text-[13px] text-[#5B6472] dark:text-gray-400 truncate">
                {g.samples.length > 0
                  ? g.samples.map((s) => s.label).join(", ")
                  : "Open to review"}
                {g.count > g.samples.length && g.samples.length > 0
                  ? ` +${g.count - g.samples.length} more`
                  : ""}
              </p>
            </div>
            {g.oldestDays !== null && g.oldestDays >= 2 && (
              <span className="shrink-0 text-[13px] font-semibold text-[#DC2626] bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full">
                {g.oldestDays}d old
              </span>
            )}
            <span className="shrink-0 text-[13px] font-semibold text-[#2563EB]">
              Review
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
