"use client";

import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { diffText, parseCheck, type SoCheck } from "@/lib/so-check";

/**
 * "SO check" card in the O2D order window (Sahil, 2026-10-29).
 * The system reads the uploaded SO PDF and compares it with the order.
 * Match → Step 2 is done by the system. Difference → CRM sees what differs.
 */
type Props = { orderNo: string; row: any; step: number };

const btn = "h-11 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[14px] font-semibold text-[#1A1D21] whitespace-nowrap hover:bg-[#F7F8FA] disabled:opacity-50";

export default function O2DSoCheck({ orderNo, row, step }: Props) {
  const { mutate } = useSWRConfig();
  // reload the O2D list and counts after the system changes the order
  const onRefresh = () => mutate((k) => typeof k === "string" && k.startsWith("/api/o2d"));
  const saved = parseCheck(row?.so_check);
  const [check, setCheck] = useState<SoCheck | null>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tried = useRef(false);
  const hasFile = !!String(row?.upload_so_1 || "").trim();

  useEffect(() => setCheck(parseCheck(row?.so_check)), [row?.so_check]);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/o2d/so-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNo, ...body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't check the SO");
      if (j.check) setCheck(j.check);
      onRefresh();
    } catch (e: any) {
      setError(e.message || "Couldn't check the SO");
    } finally {
      setBusy(false);
    }
  };

  // Waiting at Step 2 and not checked yet → check now
  useEffect(() => {
    if (step === 2 && hasFile && !saved && !tried.current) {
      tried.current = true;
      run({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hasFile, orderNo]);

  if (!hasFile || (step !== 2 && !check)) return null;

  if (busy && !check) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5 flex items-center gap-3">
        <span className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] border-t-[#2563EB] animate-spin" />
        <p className="text-[15px] font-semibold text-[#1A1D21]">Checking the SO with the order…</p>
      </div>
    );
  }

  if (!check) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5">
        <p className="text-[15px] font-semibold text-[#1A1D21]">SO not checked yet</p>
        {error && <p className="text-[13px] text-[#DC2626] mt-0.5">{error}</p>}
        <button type="button" disabled={busy} onClick={() => run({ force: true })} className={`${btn} mt-2`}><ArrowPathIcon className="w-5 h-5" /> Check SO now</button>
      </div>
    );
  }

  const again = (
    <button type="button" disabled={busy} onClick={() => run({ force: true })} className={btn}>
      <ArrowPathIcon className={`w-5 h-5 ${busy ? "animate-spin" : ""}`} /> Check again
    </button>
  );
  const facts = `${check.matched} of ${check.items} item${check.items === 1 ? "" : "s"} match${check.soNumber ? ` · ${check.soNumber}` : ""}${check.soParty ? ` · billed to ${check.soParty}` : ""}`;

  if (check.status === "ok") {
    return (
      <div className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF3] p-3.5 flex items-start gap-3">
        <CheckCircleIcon className="w-6 h-6 text-[#15803D] shrink-0" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#15803D]">SO checked — all OK{check.auto ? " · Step 2 done by system" : ""}</p>
          <p className="text-[13px] text-[#1A1D21]">{facts}</p>
        </div>
      </div>
    );
  }

  if (check.status === "party") {
    return (
      <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5">
        <div className="flex items-start gap-3">
          <QuestionMarkCircleIcon className="w-6 h-6 text-[#B45309] shrink-0" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#1A1D21]">Items match. Is this the right party?</p>
            <p className="text-[14px] text-[#1A1D21] mt-0.5">Order: <b>{row?.party_name}</b><br />SO billed to: <b>{check.soParty || "—"}</b>{check.gstin ? ` · GSTIN ${check.gstin}` : ""}</p>
            <p className="text-[13px] text-[#5B6472] mt-1">Answer once — next time the system will know this party.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => run({ party: "yes" })} className="h-11 rounded-xl bg-[#15803D] text-white text-[14px] font-semibold disabled:opacity-50">Yes, same party</button>
          <button type="button" disabled={busy} onClick={() => run({ party: "no" })} className={btn}>No, wrong party</button>
        </div>
        {error && <p className="text-[13px] text-[#DC2626] mt-2">{error}</p>}
      </div>
    );
  }

  if (check.status === "diff") {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-[#DC2626] shrink-0" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#DC2626]">SO does not match the order</p>
            <p className="text-[13px] text-[#5B6472]">{facts}</p>
            <ul className="mt-1.5 space-y-0.5">
              {check.diffs.map((d, i) => <li key={i} className="text-[14px] text-[#1A1D21]">• {diffText(d)}</li>)}
            </ul>
            <p className="text-[13px] text-[#5B6472] mt-1.5">Fix the SO in Busy or the order here, upload again, then Check again.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">{again}</div>
        {error && <p className="text-[13px] text-[#DC2626] mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-3.5">
      <p className="text-[15px] font-semibold text-[#1A1D21]">Couldn&apos;t read this SO automatically</p>
      <p className="text-[13px] text-[#5B6472]">{check.note || "Please check it by hand."}</p>
      <div className="mt-2">{again}</div>
      {error && <p className="text-[13px] text-[#DC2626] mt-2">{error}</p>}
    </div>
  );
}
