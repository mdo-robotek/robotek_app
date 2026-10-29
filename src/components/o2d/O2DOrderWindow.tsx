"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  XMarkIcon, CheckIcon, PencilSquareIcon, PauseCircleIcon, PlayCircleIcon, MinusCircleIcon,
  EllipsisHorizontalIcon, TrashIcon, NoSymbolIcon, ArrowUturnLeftIcon, PaperClipIcon,
} from "@heroicons/react/24/outline";
import type { O2D, O2DStepConfig } from "@/types/o2d";
import { O2D_STEP_LABELS } from "@/types/o2d";
import { istToday } from "@/lib/o2d-hold";
import { parseCheck } from "@/lib/so-check";
import O2DSoCheck from "./O2DSoCheck";
import { amountOf, fmtDay, fmtWhen, orderState, rupees, toDate, whoFor, TONE_PILL, TONE_TEXT } from "./o2d-view";

/**
 * O2D order window (Sahil, 2026-10-29): tap an order in the list and it opens
 * here — on the right on a laptop, full screen on a phone. Replaces the old
 * Panel View. Next step on top with one button, then the 11 steps, then items.
 */

type Props = {
  orderNo: string;
  items: O2D[];
  configs: O2DStepConfig[];
  canRemoveFollowUp: boolean;
  step1Wait: { m: number; s: number } | null; // step 1 opens 30 min after the order is made
  onClose: () => void;
  onUpdateStep: () => void;
  onEdit: () => void;
  onHold: (reason: string, checkOn: string) => void;
  onRelease: () => void;
  onRemoveFollowUp: () => void;
  onCancel: (reason: string) => void;
  onRestore: () => void;
  onDelete: () => void;
  fileUrl: (path: string) => string;
  onRefresh: () => void; // reload the order after the system changes it
};

const btnBase = "h-11 px-3.5 items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[14px] font-semibold text-[#1A1D21] dark:text-white whitespace-nowrap hover:bg-[#F7F8FA] dark:hover:bg-navy-700";
const btn = `${btnBase} inline-flex`;
const primary = "h-11 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold whitespace-nowrap hover:bg-[#1D4ED8] disabled:opacity-50";

/** Small facts saved at some steps (SO number, parcels, voucher, files). */
function stepFacts(f: any, i: number, fileUrl: (p: string) => string): { label: string; value: string; href?: string }[] {
  const out: { label: string; value: string; href?: string }[] = [];
  const add = (label: string, v: unknown, money = false) => {
    const s = String(v ?? "").trim();
    if (s && s !== "-" && s !== "0") out.push({ label, value: money ? rupees(parseFloat(s.replace(/[^\d.-]/g, "")) || 0) : s });
  };
  const file = (label: string, v: unknown) => {
    const s = String(v ?? "").trim();
    if (s && s !== "-") out.push({ label, value: "View", href: fileUrl(s) });
  };
  if (i === 1) { add("SO no.", f.so_number_1); add("Final amount", f.final_amount_1, true); add("Merged with", f.merge_order_with_1); file("SO file", f.upload_so_1); }
  if (i === 5) { add("Parcels", f.num_of_parcel_5); const d = toDate(f.actual_date_of_order_packed_5); if (d) out.push({ label: "Packed on", value: fmtWhen(d) }); file("PI", f.upload_pi_5); }
  if (i === 7) add("Voucher no.", f.voucher_num_7);
  if (i === 8) { add("Checked", f.order_details_checked_8); add("Voucher (51)", f.voucher_num_51_8); add("Amount", f.t_amt_8, true); }
  if (i === 9) { add("Parcels", f.num_of_parcel_9); file("Bilty", f.attach_bilty_9); }
  return out;
}

function HoldDialog({ onClose, onSave }: { onClose: () => void; onSave: (reason: string, checkOn: string) => void }) {
  const [reason, setReason] = useState("");
  const [checkOn, setCheckOn] = useState("");
  const [tried, setTried] = useState(false);
  const quick = ["Waiting for payment", "Waiting for stock", "Party asked to wait", "Price to be confirmed"];
  const ok = reason.trim().length >= 3 && !!checkOn;
  return (
    <div className="fixed inset-0 z-[460] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-white dark:bg-navy-900 rounded-t-2xl md:rounded-2xl shadow-2xl p-5">
        <h3 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white">Put this order on hold</h3>
        <p className="mt-1 text-[14px] text-[#5B6472]">It stays in the &quot;On hold&quot; list and comes back to you on the date you choose. The late clock stops while it is on hold.</p>
        <label className="block mt-4 text-[14px] font-semibold text-[#1A1D21] dark:text-white">Why is it on hold?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => setReason(q)} className={`h-9 px-3 rounded-full border text-[13px] font-semibold ${reason === q ? "bg-[#1A1D21] text-white border-[#1A1D21]" : "bg-white dark:bg-navy-800 border-[#E5E7EB] dark:border-navy-700 text-[#1A1D21] dark:text-white"}`}>{q}</button>
          ))}
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Waiting for payment of ₹50,000" className="mt-2 w-full h-11 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[15px] outline-none focus:ring-2 focus:ring-[#2563EB]/40" />
        {tried && reason.trim().length < 3 && <p className="mt-1 text-[13px] text-[#DC2626]">Write the reason in a few words.</p>}
        <label className="block mt-4 text-[14px] font-semibold text-[#1A1D21] dark:text-white">Check again on</label>
        <input type="date" min={istToday()} value={checkOn} onChange={(e) => setCheckOn(e.target.value)} className="mt-2 w-full h-11 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[15px] outline-none focus:ring-2 focus:ring-[#2563EB]/40" />
        {tried && !checkOn && <p className="mt-1 text-[13px] text-[#DC2626]">Pick the date to check this order again.</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={`${btn} flex-1`}>Go back</button>
          <button type="button" onClick={() => { setTried(true); if (ok) onSave(reason.trim(), checkOn); }} className={`${primary} flex-1`}>Put on hold</button>
        </div>
      </div>
    </div>
  );
}

function CancelDialog({ onClose, onSave }: { onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <div className="fixed inset-0 z-[460] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-white dark:bg-navy-900 rounded-t-2xl md:rounded-2xl shadow-2xl p-5">
        <h3 className="text-[18px] font-semibold text-[#1A1D21] dark:text-white">Cancel this order?</h3>
        <p className="mt-1 text-[14px] text-[#5B6472]">It moves to the Cancelled list. You can restore it later.</p>
        <label className="block mt-4 text-[14px] font-semibold text-[#1A1D21] dark:text-white">Why is it cancelled?</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Party cancelled the order" className="mt-2 w-full h-11 px-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 text-[15px] outline-none focus:ring-2 focus:ring-[#2563EB]/40" />
        {tried && reason.trim().length < 3 && <p className="mt-1 text-[13px] text-[#DC2626]">Write the reason in a few words.</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={`${btn} flex-1`}>Go back</button>
          <button type="button" onClick={() => { setTried(true); if (reason.trim().length >= 3) onSave(reason.trim()); }} className="h-11 px-4 flex-1 inline-flex items-center justify-center rounded-xl bg-[#DC2626] text-white text-[14px] font-semibold">Cancel order</button>
        </div>
      </div>
    </div>
  );
}

export default function O2DOrderWindow(p: Props) {
  const [dialog, setDialog] = useState<"" | "hold" | "cancel">("");
  const [more, setMore] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const f = p.items[0] as any;
  const s = orderState(p.items, p.configs);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !dialog) p.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, p]);

  if (!f) return null;
  const total = amountOf(p.items);
  const created = toDate(f.created_at);
  const active = !s.cancel && !s.hold && s.step > 0;
  const doneCount = Array.from({ length: 11 }, (_, k) => k + 1).filter((i) => toDate(f[`actual_${i}`]) || String(f[`actual_${i}`] || "").trim()).length;

  // Steps to list: on a phone show done + current + next 2, unless "Show all".
  const steps = Array.from({ length: 11 }, (_, k) => k + 1);

  return createPortal(
    <div className="fixed inset-0 z-[400] flex justify-end" role="dialog" aria-modal="true" aria-label={`Order ${p.orderNo}`}>
      <div className="absolute inset-0 bg-black/25" onClick={p.onClose} />
      <div className="relative w-full md:w-[560px] h-full bg-white dark:bg-navy-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 md:px-5 pt-3 pb-3 border-b border-[#E5E7EB] dark:border-navy-800">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#5B6472]">{p.orderNo}</p>
              <h2 className="text-[21px] leading-tight font-semibold text-[#1A1D21] dark:text-white break-words">{f.party_name || "—"}</h2>
            </div>
            <button type="button" onClick={p.onClose} className={btn}><XMarkIcon className="w-5 h-5" /> Close</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[19px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{rupees(total)}</span>
            <span className="text-[14px] text-[#5B6472]">· {p.items.length} item{p.items.length === 1 ? "" : "s"}{f.filled_by ? ` · by ${f.filled_by}` : ""}{created ? `, ${fmtWhen(created)}` : ""}</span>
            <span className={`ml-auto px-2.5 py-1 rounded-full text-[13px] font-semibold ${TONE_PILL[s.status.tone]}`}>{s.status.text}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-5">
          {/* Hold / cancelled banner */}
          {s.cancel && (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] dark:bg-navy-800 p-3.5">
              <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">Cancelled{s.cancel.since ? ` on ${fmtWhen(s.cancel.since)}` : ""}{s.cancel.by ? ` by ${s.cancel.by}` : ""}</p>
              {s.cancel.reason && <p className="mt-0.5 text-[14px] text-[#5B6472]">Reason: {s.cancel.reason}</p>}
              <button type="button" onClick={p.onRestore} className={`${btn} mt-3`}><ArrowUturnLeftIcon className="w-5 h-5" /> Restore order</button>
            </div>
          )}
          {s.hold && !s.cancel && (
            <div className={`rounded-xl border p-3.5 ${s.holdCheck === "overdue" ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#FDE68A] bg-[#FFFBEB]"}`}>
              <p className="text-[15px] font-semibold text-[#1A1D21]">On hold{s.hold.since ? ` since ${fmtWhen(s.hold.since)}` : ""}{s.hold.by ? ` · ${s.hold.by}` : ""}</p>
              <p className="mt-0.5 text-[14px] text-[#5B6472]">{s.hold.reason ? `Reason: ${s.hold.reason}` : "No reason written"}</p>
              {s.hold.checkOn && (
                <p className={`mt-0.5 text-[14px] font-semibold ${s.holdCheck === "overdue" ? "text-[#DC2626]" : "text-[#B45309]"}`}>
                  {s.holdCheck === "overdue" ? `Check was due on ${fmtDay(s.hold.checkOn)}` : s.holdCheck === "due" ? "Check today" : `Check again on ${fmtDay(s.hold.checkOn)}`}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={p.onRelease} className={primary}><PlayCircleIcon className="w-5 h-5" /> Release hold</button>
                <button type="button" onClick={() => setDialog("hold")} className={btn}>Change date</button>
              </div>
              <p className="mt-2 text-[12px] text-[#5B6472]">On release, the order goes back to Step {s.step > 0 ? s.step : "—"} and its time limit moves ahead by the days it was on hold.</p>
            </div>
          )}

          {/* Automatic SO check (Step 2) */}
          {!s.cancel && <O2DSoCheck orderNo={p.orderNo} row={f} step={s.step} onRefresh={p.onRefresh} />}

          {/* Next step */}
          {active && (
            <div className="rounded-xl border border-[#C7D7FE] bg-[#EFF4FF] dark:bg-navy-800 dark:border-navy-700 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#5B6472]">Next step{s.who ? ` · ${s.who}` : ""}</p>
                <p className="text-[17px] font-semibold text-[#1A1D21] dark:text-white">Step {s.step} · {s.stepLabel}</p>
                <p className={`text-[13px] font-semibold ${TONE_TEXT[s.due.tone]}`}>
                  {s.planned ? (s.due.tone === "late" ? `Was due ${fmtWhen(s.planned)}` : `Due ${fmtWhen(s.planned)}`) : "No time limit set"}
                </p>
              </div>
              {p.step1Wait ? (
                <p className="text-[13px] font-semibold text-[#5B6472] sm:text-right">Opens in {p.step1Wait.m}:{String(p.step1Wait.s).padStart(2, "0")}<br /><span className="font-normal">so the order can still be edited</span></p>
              ) : (
                <button type="button" onClick={p.onUpdateStep} className={`${primary} sm:w-auto w-full h-12`}><CheckIcon className="w-5 h-5" /> Update step</button>
              )}
            </div>
          )}
          {!s.cancel && !s.hold && s.step === -1 && (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF3] p-3.5"><p className="text-[15px] font-semibold text-[#15803D]">All steps are done.</p></div>
          )}

          {/* Progress */}
          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold text-[#5B6472]">Progress · {doneCount} of 11 done</h3>
              <button type="button" onClick={() => setShowAll(!showAll)} className="md:hidden text-[14px] font-semibold text-[#2563EB] h-9">{showAll ? "Show less" : "Show all"}</button>
            </div>
            <ol className="mt-2">
              {steps.map((i) => {
                const actual = toDate(f[`actual_${i}`]);
                const hasActual = !!String(f[`actual_${i}`] || "").trim() && String(f[`actual_${i}`]).trim() !== "-";
                const planned = toDate(f[`planned_${i}`]);
                const status = String(f[`status_${i}`] || "").trim();
                const isCurrent = i === s.step;
                const done = hasActual && !isCurrent;
                const notNeeded = !hasActual && !planned && s.step > 0 && i < s.step;
                const later = !done && !isCurrent;
                const hideOnPhone = !showAll && later && (s.step === -1 || i > s.step + 2);
                const facts = done ? stepFacts(f, i, p.fileUrl) : [];
                const who = whoFor(i, p.configs);
                return (
                  <li key={i} className={`flex gap-3 py-1.5 ${hideOnPhone ? "hidden md:flex" : "flex"}`}>
                    <span className={`mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold ${done ? "bg-[#15803D] text-white" : isCurrent ? "bg-[#2563EB] text-white ring-4 ring-[#DBE6FE]" : "border-2 border-[#D1D5DB] text-[#9CA3AF]"}`}>
                      {done ? <CheckIcon className="w-4 h-4" /> : i}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-semibold ${later && !isCurrent ? "text-[#5B6472]" : "text-[#1A1D21] dark:text-white"}`}>
                        {O2D_STEP_LABELS[i - 1]}
                        {status === "No" && <span className="ml-2 text-[13px] font-semibold text-[#B45309]">Answer: No</span>}
                      </p>
                      <p className="text-[13px] text-[#5B6472]">
                        {done
                          ? `Done${actual ? ` ${fmtWhen(actual)}` : ""}${planned && actual && actual.getTime() > planned.getTime() ? " · late" : ""}${i === 2 && parseCheck(f.so_check)?.auto ? " · checked by system" : who ? ` · ${who}` : ""}`
                          : isCurrent
                            ? `${who || "No one set"}${planned ? ` · due ${fmtWhen(planned)}` : ""}`
                            : notNeeded ? "Not needed" : who}
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

          {/* Items */}
          <section>
            <h3 className="text-[14px] font-semibold text-[#5B6472]">Items</h3>
            <ul className="mt-1 divide-y divide-[#F0F1F3] dark:divide-navy-800">
              {p.items.map((it, k) => (
                <li key={`${it.id}-${k}`} className="py-2 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{it.item_name || "—"}</p>
                    {it.item_specification && it.item_specification !== "-" && <p className="text-[13px] text-[#5B6472]">{it.item_specification}</p>}
                  </div>
                  <span className="text-[14px] text-[#5B6472] tabular-nums whitespace-nowrap">{it.item_qty} pcs</span>
                  <span className="w-24 text-right text-[15px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{rupees(parseFloat(String(it.est_amount).replace(/[^\d.-]/g, "")) || 0)}</span>
                </li>
              ))}
              <li className="py-2 flex items-center">
                <span className="flex-1 text-[14px] font-semibold text-[#5B6472]">Total</span>
                <span className="text-[16px] font-semibold tabular-nums text-[#1A1D21] dark:text-white">{rupees(total)}</span>
              </li>
            </ul>
            {(f.remark && f.remark !== "-") && <p className="mt-2 text-[14px] text-[#1A1D21] dark:text-gray-200"><span className="text-[#5B6472]">Note:</span> {f.remark}</p>}
            {f.order_screenshot && f.order_screenshot !== "-" && (
              <a href={p.fileUrl(f.order_screenshot)} className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-[#2563EB]"><PaperClipIcon className="w-4 h-4" /> Order proof</a>
            )}
          </section>
        </div>

        {/* Footer actions */}
        <div className="relative px-4 md:px-5 py-3 border-t border-[#E5E7EB] dark:border-navy-800 flex items-center gap-2 bg-white dark:bg-navy-900">
          <button type="button" onClick={p.onEdit} className={btn}><PencilSquareIcon className="w-5 h-5" /> Edit</button>
          {!s.cancel && !s.hold && <button type="button" onClick={() => setDialog("hold")} className={btn}><PauseCircleIcon className="w-5 h-5" /> Hold</button>}
          {active && p.canRemoveFollowUp && <button type="button" onClick={p.onRemoveFollowUp} className={`${btnBase} hidden sm:inline-flex`}><MinusCircleIcon className="w-5 h-5" /> Remove follow-up</button>}
          <button type="button" onClick={() => setMore(!more)} className={`${btn} ml-auto`}><EllipsisHorizontalIcon className="w-5 h-5" /> More</button>
          {more && (
            <div className="absolute right-4 bottom-[64px] w-56 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl py-1 z-10">
              {active && p.canRemoveFollowUp && <button type="button" onClick={() => { setMore(false); p.onRemoveFollowUp(); }} className="sm:hidden w-full h-11 px-4 flex items-center gap-2 text-[14px] font-semibold text-left hover:bg-[#F7F8FA]"><MinusCircleIcon className="w-5 h-5" /> Remove follow-up</button>}
              {!s.cancel && <button type="button" onClick={() => { setMore(false); setDialog("cancel"); }} className="w-full h-11 px-4 flex items-center gap-2 text-[14px] font-semibold text-left text-[#DC2626] hover:bg-[#FEF2F2]"><NoSymbolIcon className="w-5 h-5" /> Cancel order</button>}
              {s.cancel && <button type="button" onClick={() => { setMore(false); p.onRestore(); }} className="w-full h-11 px-4 flex items-center gap-2 text-[14px] font-semibold text-left hover:bg-[#F7F8FA]"><ArrowUturnLeftIcon className="w-5 h-5" /> Restore order</button>}
              <button type="button" onClick={() => { setMore(false); p.onDelete(); }} className="w-full h-11 px-4 flex items-center gap-2 text-[14px] font-semibold text-left text-[#DC2626] hover:bg-[#FEF2F2]"><TrashIcon className="w-5 h-5" /> Delete order</button>
            </div>
          )}
        </div>
      </div>
      {dialog === "hold" && <HoldDialog onClose={() => setDialog("")} onSave={(r, d) => { setDialog(""); p.onHold(r, d); }} />}
      {dialog === "cancel" && <CancelDialog onClose={() => setDialog("")} onSave={(r) => { setDialog(""); p.onCancel(r); }} />}
    </div>,
    document.body
  );
}
