"use client";

import { useState } from "react";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

/**
 * Shown on a delegation while a "new date" ask waits for approval.
 * The giver (or EA) sees Approve / Not approve; everyone else sees who decides.
 */
export default function RevisionAskPanel({
  title,
  description,
  timesMoved = 0,
  doer,
  giver,
  currentDue,
  askedDue,
  askedAt,
  mayDecide,
  busy,
  onDecide,
}: {
  title?: string;
  description?: string;
  timesMoved?: number;
  doer: string;
  giver: string;
  currentDue: string;
  askedDue: string;
  askedAt: string;
  mayDecide: boolean;
  busy: boolean;
  onDecide: (decision: "approve" | "reject", note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDaysIcon className="w-5 h-5 text-[#D97706] shrink-0" />
        <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">New date asked</p>
      </div>
      {/* What the task is — so the decision can be made right here (Sahil, 2026-10-27) */}
      {title ? (
        <div className="rounded-xl bg-white dark:bg-navy-900 border border-amber-100 dark:border-white/10 p-3">
          <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white break-words">{title}</p>
          {description ? <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-1 line-clamp-3 break-words">{description}</p> : null}
          <p className="text-[13px] text-[#5B6472] dark:text-gray-400 mt-2">Given by {giver} · Doing: {doer}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white dark:bg-navy-900 border border-amber-100 dark:border-white/10 p-3">
          <p className="text-[13px] text-[#5B6472] dark:text-gray-400">Due now</p>
          <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{currentDue}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-navy-900 border border-amber-200 dark:border-amber-500/30 p-3">
          <p className="text-[13px] text-[#D97706]">Asks for</p>
          <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{askedDue}</p>
        </div>
      </div>
      <p className="text-[13px] text-[#5B6472] dark:text-gray-400">
        Asked {askedAt}
        {timesMoved > 0 ? <span className={timesMoved >= 3 ? "text-[#DC2626] font-semibold" : "text-[#D97706] font-semibold"}> · date already moved {timesMoved} time{timesMoved === 1 ? "" : "s"}</span> : null}
      </p>
      {mayDecide ? (
        <>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for them (optional)"
            className="w-full min-h-[44px] px-3 rounded-xl border border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-navy-900 text-[15px] text-[#1A1D21] dark:text-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("approve", note)}
              className="flex-1 min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-[15px] font-semibold"
            >
              Approve new date
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("reject", note)}
              className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-navy-900 hover:bg-[#F7F8FA] disabled:opacity-50 text-[#1A1D21] dark:text-white text-[15px] font-semibold"
            >
              Not approve
            </button>
          </div>
          <p className="text-[13px] text-[#5B6472] dark:text-gray-400">Not approve keeps the old date. {doer} gets a WhatsApp either way.</p>
        </>
      ) : (
        <p className="text-[13px] text-[#5B6472] dark:text-gray-400">Waiting for the EA to approve.</p>
      )}
    </div>
  );
}
