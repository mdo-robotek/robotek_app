"use client";

import React, { useState } from "react";

/**
 * Inline editable follow-up remark for an order (shown in Pending/Delayed
 * order drill-downs). Saves to the append-only "Followup Remarks" log via
 * /api/o2d-remarks so daily follow-up reasons stay on record.
 */
export default function OrderRemarkCell({ orderNo, initial }: { orderNo: string; initial?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial || "");
  const [saved, setSaved] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const save = async () => {
    const remark = text.trim();
    if (!remark || busy) return;
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/o2d-remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_no: orderNo, remark }),
      });
      if (!res.ok) throw new Error();
      setSaved(remark);
      setEditing(false);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 max-w-[260px]">
        <span className="text-xs font-bold text-gray-600 dark:text-zinc-300 truncate">{saved || "—"}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setText(saved); setEditing(true); }}
          title="Add / update followup remark"
          className="text-[10px] font-black text-[#003875] dark:text-[#FFD500] hover:underline shrink-0"
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        placeholder="Pending reason..."
        className="px-2 py-1 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold outline-none focus:border-[#FFD500] w-[180px]"
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-[#003875] text-white disabled:opacity-50"
      >
        {busy ? "..." : "Save"}
      </button>
      {err && <span className="text-[9px] font-black text-red-500">!</span>}
    </span>
  );
}
