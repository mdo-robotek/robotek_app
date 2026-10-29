/**
 * One way to show every step-based process (Sahil, 2026-10-29): the same
 * list + window as the new O2D, for I2R Packing, Item Receive, Replace, the
 * HR screens, New Launch and the rest. A page only says how to read its
 * records; the list and the window are shared.
 */
import type React from "react";

export type ProcFact = { label: string; value?: string; href?: string };

export interface ProcessConfig<T> {
  /** Short name for counts: "packing requests", "candidates" … */
  unit: string;
  steps: string[]; // step names in order
  /** Who does each step (from the step setup), same order as steps */
  doers: string[];
  id: (r: T) => string;
  ref: (r: T) => string; // PPF-99, CNDID-26 …
  title: (r: T) => string; // item / candidate name
  sub?: (r: T) => string; // second line under the title
  amount?: (r: T) => string; // right-aligned figure: qty, ₹ …
  /** 1..n = waiting at that step, 0 = all done, -1 = cancelled */
  step: (r: T) => number;
  planned: (r: T, n: number) => string;
  actual: (r: T, n: number) => string;
  isCancelled: (r: T) => boolean;
  search: (r: T) => string;
  created?: (r: T) => string;
  /** Facts saved at a step (vendor, PO no., file …) shown under that step */
  stepFacts?: (r: T, n: number) => ProcFact[];
  /** Other details, shown in the window under "Details" */
  details?: (r: T) => ProcFact[];
  /** Anything special for this process, shown in the window (e.g. documents) */
  extra?: (r: T) => React.ReactNode;
}

export type ProcChip = "open" | "late" | "today" | "done" | "cancelled" | "all";
export const PROC_CHIPS: { key: ProcChip; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "late", label: "Late" },
  { key: "today", label: "Due today" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const IST = { timeZone: "Asia/Kolkata" } as const;
export const toDate = (v: unknown): Date | null => {
  const s = String(v ?? "").trim();
  if (!s || s === "-") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
export const fmtWhen = (d: Date) =>
  `${d.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" })}`;
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", IST);

export type Tone = "late" | "soon" | "ok" | "done" | "cancel" | "plain";
export function dueText(planned: Date | null, now = Date.now()): { text: string; tone: Tone } {
  if (!planned) return { text: "No date", tone: "plain" };
  const diff = now - planned.getTime();
  if (diff > 0) {
    const h = diff / 3600000;
    if (h < 1) return { text: `Late ${Math.max(1, Math.round(diff / 60000))} min`, tone: "late" };
    if (h < 24) return { text: `Late ${Math.round(h)} h`, tone: "late" };
    const d = Math.round(h / 24);
    return { text: `Late ${d} day${d > 1 ? "s" : ""}`, tone: "late" };
  }
  const t = planned.toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" });
  if (dayKey(planned) === dayKey(new Date(now))) return { text: `Today ${t}`, tone: "soon" };
  if (dayKey(planned) === dayKey(new Date(now + 86400000))) return { text: `Tomorrow ${t}`, tone: "ok" };
  return { text: planned.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" }), tone: "ok" };
}

export function prettyNames(raw: string): string {
  const names = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
  const pretty = (n: string) => n.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
  if (!names.length) return "";
  return names.length > 2 ? `${pretty(names[0])} +${names.length - 1}` : names.map(pretty).join(", ");
}

export interface RowState { step: number; label: string; planned: Date | null; due: { text: string; tone: Tone }; who: string; status: { text: string; tone: Tone } }
export function rowState<T>(cfg: ProcessConfig<T>, r: T, now = Date.now()): RowState {
  const step = cfg.isCancelled(r) ? -1 : cfg.step(r);
  const planned = step > 0 ? toDate(cfg.planned(r, step)) : null;
  const due = dueText(planned, now);
  const who = step > 0 ? prettyNames(cfg.doers[step - 1] || "") : "";
  const status = step === -1 ? { text: "Cancelled", tone: "cancel" as Tone } : step === 0 ? { text: "Done", tone: "done" as Tone } : due;
  return { step, label: step > 0 ? cfg.steps[step - 1] || `Step ${step}` : "", planned, due, who, status };
}

export function chipMatch<T>(cfg: ProcessConfig<T>, r: T, chip: ProcChip, now = Date.now()): boolean {
  const s = rowState(cfg, r, now);
  switch (chip) {
    case "open": return s.step > 0;
    case "late": return s.step > 0 && s.due.tone === "late";
    case "today": return s.step > 0 && s.due.tone === "soon";
    case "done": return s.step === 0;
    case "cancelled": return s.step === -1;
    default: return true;
  }
}

export const TONE_TEXT: Record<Tone, string> = {
  late: "text-[#DC2626]", soon: "text-[#B45309]", ok: "text-[#5B6472]", done: "text-[#15803D]", cancel: "text-[#5B6472]", plain: "text-[#5B6472]",
};
export const TONE_PILL: Record<Tone, string> = {
  late: "bg-[#FEF2F2] text-[#DC2626]", soon: "bg-[#FFFBEB] text-[#B45309]", ok: "bg-[#F1F3F6] text-[#5B6472]",
  done: "bg-[#ECFDF3] text-[#15803D]", cancel: "bg-[#F1F3F6] text-[#5B6472]", plain: "bg-[#F1F3F6] text-[#5B6472]",
};

// ── Automatic facts / details from the sheet columns ──────────────────────
const STEP_COLS = /^(planned|actual|status|acual|delay)_\d+$/i;
const NEVER = /^(id|created_at|updated_at|cancelled|timestamp|filled_by|archive.*)$/i;
const LABEL_FIX: Record<string, string> = { upoad: "upload", suppliar: "supplier", recieve: "receive", indend: "indent", num: "no.", qty: "qty", po: "PO", pi: "PI", gst: "GST", st: "" };
export function labelOf(key: string): string {
  const words = key.replace(/_\d+$/, "").replace(/[()]/g, " ").split(/[_\s]+/).filter(Boolean).map((w) => LABEL_FIX[w.toLowerCase()] ?? w.toLowerCase()).filter(Boolean);
  const t = words.join(" ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : key;
}
const isLink = (v: string) => /^https?:\/\//i.test(v);
const fact = (k: string, v: unknown): ProcFact | null => {
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s === "—") return null;
  return isLink(s) ? { label: labelOf(k), href: s } : { label: labelOf(k), value: s };
};
/** Columns that belong to step n (e.g. vendor_name_3, pi_3) */
export function autoFacts(r: unknown, n: number, skip: string[] = []): ProcFact[] {
  const out: ProcFact[] = [];
  for (const [k, v] of Object.entries((r || {}) as Record<string, unknown>)) {
    if (STEP_COLS.test(k) || skip.includes(k)) continue;
    const m = k.match(/_(\d+)$/);
    if (!m || Number(m[1]) !== n) continue;
    const f = fact(k, v);
    if (f) out.push(f);
  }
  return out;
}
/** Columns that are not tied to a step, minus the ones already shown */
export function autoDetails(r: unknown, skip: string[] = []): ProcFact[] {
  const out: ProcFact[] = [];
  for (const [k, v] of Object.entries((r || {}) as Record<string, unknown>)) {
    if (STEP_COLS.test(k) || NEVER.test(k) || skip.includes(k) || /_\d+$/.test(k)) continue;
    if (typeof v === "object") continue;
    const f = fact(k, v);
    if (f) out.push(f);
  }
  return out;
}
