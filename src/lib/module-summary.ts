import type { I2R } from "@/types/i2r";
import type { GRN } from "@/types/grn";

/**
 * One short summary per module — the same numbers feed the CEO home tiles and
 * the strip at the top of each module page, so they can never disagree.
 * Sahil, 25 Oct 2026: "CEO dashboard short form mein; detail dekhna ho toh
 * click karke us module ke apne dashboard mein jaun."
 */

export type Tone = "good" | "warn" | "bad" | "neutral";

export interface Figure {
  key: string;
  label: string;
  value: number | string;
  tone: Tone;
  /** Optional step filter the module page can apply when this is tapped. */
  step?: number | "tbd";
}

export interface ModuleSummary {
  key: ModuleKey;
  title: string;
  href: string;
  /** The one number for the CEO tile. */
  headline: { value: number | string; label: string; tone: Tone };
  /** One short line under the headline on the CEO tile. */
  note: string;
  /** 3–4 figures for the module page strip. */
  figures: Figure[];
  /** Where most of the open work is waiting (workflow modules). */
  stuckAt?: { step: number; name: string; count: number } | null;
}

export type ModuleKey = "o2d" | "i2r" | "grn" | "ims" | "tasks" | "people";

const toneCount = (n: number, bad = false): Tone => (n > 0 ? (bad ? "bad" : "warn") : "good");

// ---------------------------------------------------------------- O2D ------
export function o2dSummary(coo: any): ModuleSummary {
  const ord = coo?.orders || {};
  const waiting = ord.delayAging?.total || 0;
  const over7 = ord.delayAging?.gt7?.count || 0;
  const paperwork = ord.delayAging?.postDispatchCount || 0;
  const otd = ord.otdRate || 0;
  const steps: any[] = ord.stepPerformance || [];
  const top = steps.filter((s) => s.pending > 0).sort((a, b) => b.pending - a.pending)[0];
  return {
    key: "o2d",
    title: "Orders",
    href: "/o2d",
    headline: { value: waiting, label: "waiting to dispatch", tone: over7 > 0 ? "bad" : toneCount(waiting) },
    note: `${over7} over 7 days · On-time ${otd}%`,
    figures: [
      { key: "waiting", label: "To dispatch", value: waiting, tone: toneCount(waiting) },
      { key: "over7", label: "Over 7 days", value: over7, tone: toneCount(over7, true) },
      { key: "paperwork", label: "Paperwork pending", value: paperwork, tone: toneCount(paperwork) },
      { key: "otd", label: "On-time this month", value: `${otd}%`, tone: otd >= 85 ? "good" : otd >= 60 ? "warn" : "bad" },
    ],
    stuckAt: top ? { step: top.step, name: top.name, count: top.pending } : null,
  };
}

// -------------------------------------------------- shared step helpers ----
function isFilled(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== "";
}
function isPast(v: unknown, now: number): boolean {
  if (!isFilled(v)) return false;
  const t = Date.parse(String(v));
  return Number.isFinite(t) && t < now;
}
function inThisMonth(v: unknown, now: Date): boolean {
  if (!isFilled(v)) return false;
  const d = new Date(String(v));
  return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ---------------------------------------------------------------- I2R ------
export const I2R_STEP_SHORT = [
  "Get Quotation", "Approval", "Finalize Vendor", "Received PI", "Check Sample", "Make PO",
  "Check Packing", "Ask For Photo/Video of Ready Stock From Vendor", "Deliver to Cargo",
  "Receive Form", "Follow Up",
];

/** Same rules as getActiveStep on the I2R page. -1 cancelled, 0 completed. */
export function i2rActiveStep(item: I2R): number {
  if (item.cancelled) return -1;
  const total = 11;
  const any = item as any;
  let maxCompleted = 0;
  for (let i = 1; i <= total; i++) if (isFilled(any[`actual_${i}`])) maxCompleted = i;
  if (maxCompleted >= total) return 0;
  for (let i = 1; i <= total; i++) {
    if (isFilled(any[`planned_${i}`]) && !isFilled(any[`actual_${i}`])) return i;
  }
  if (maxCompleted > 0) return Math.min(maxCompleted + 1, total);
  for (let i = 1; i <= total; i++) if (!isFilled(any[`actual_${i}`])) return i;
  return 0;
}

export function isTbdName(name?: string): boolean {
  return String(name || "").trim().toUpperCase().startsWith("TBD");
}

export function i2rSummary(items: I2R[], nowDate = new Date()): ModuleSummary {
  const now = nowDate.getTime();
  const perStep = new Array(12).fill(0);
  let open = 0, late = 0, tbd = 0, doneMonth = 0;
  for (const it of items) {
    const s = i2rActiveStep(it);
    if (s < 0) continue;
    // Same rule as the page's "Decide Name" filter: any live indent whose
    // name is still TBD, even if its other steps are finished.
    if (isTbdName(it.item_name)) tbd++;
    if (s === 0) {
      if (inThisMonth((it as any).actual_11, nowDate)) doneMonth++;
      continue;
    }
    open++;
    perStep[s]++;
    if (isPast((it as any)[`planned_${s}`], now)) late++;
  }
  let topStep = 0;
  for (let i = 1; i <= 11; i++) if (perStep[i] > (perStep[topStep] || 0)) topStep = i;
  return {
    key: "i2r",
    title: "Purchase",
    href: "/i2r",
    headline: { value: open, label: "requests open", tone: late > 0 ? "warn" : "good" },
    note: `${late} late · ${tbd} names to decide`,
    figures: [
      { key: "open", label: "Open", value: open, tone: "neutral" },
      { key: "late", label: "Late", value: late, tone: toneCount(late, true) },
      { key: "tbd", label: "Names to decide", value: tbd, tone: toneCount(tbd), step: "tbd" },
      { key: "done", label: "Done this month", value: doneMonth, tone: "neutral" },
    ],
    stuckAt: topStep ? { step: topStep, name: I2R_STEP_SHORT[topStep - 1], count: perStep[topStep] } : null,
  };
}

// ---------------------------------------------------------------- GRN ------
export const GRN_STEP_SHORT = [
  "Quantity check", "Inform Vendor & Confirm Qty", "Quality check", "Inform the Vendor",
  "Quality Check with vendor", "Debit Note issue to Vendor", "Update Purchase in Busy",
  "Update journal in Busy", "Settle Payment",
];

/** Same rules as getActiveStep on the GRN page. -1 cancelled, 0 completed. */
export function grnActiveStep(item: GRN): number {
  if (item.cancelled) return -1;
  const any = item as any;
  for (let i = 1; i <= 9; i++) {
    if (any[`planned_${i}`] && !any[`actual_${i}`]) return i;
  }
  let lastActual = 0;
  for (let i = 1; i <= 9; i++) if (any[`actual_${i}`]) lastActual = i;
  return lastActual === 9 || (lastActual > 0 && !any[`planned_${lastActual + 1}`]) ? 0 : 1;
}

export function grnSummary(items: GRN[], nowDate = new Date()): ModuleSummary {
  const now = nowDate.getTime();
  const perStep = new Array(10).fill(0);
  let open = 0, late = 0, doneMonth = 0;
  for (const it of items) {
    const s = grnActiveStep(it);
    if (s < 0) continue;
    if (s === 0) {
      const any = it as any;
      let last = "";
      for (let i = 9; i >= 1; i--) if (isFilled(any[`actual_${i}`])) { last = any[`actual_${i}`]; break; }
      if (inThisMonth(last, nowDate)) doneMonth++;
      continue;
    }
    open++;
    perStep[s]++;
    if (isPast((it as any)[`planned_${s}`], now)) late++;
  }
  const payment = perStep[9];
  let topStep = 0;
  for (let i = 1; i <= 9; i++) if (perStep[i] > (perStep[topStep] || 0)) topStep = i;
  return {
    key: "grn",
    title: "Goods In",
    href: "/grn",
    headline: { value: open, label: "receipts open", tone: late > 0 ? "warn" : "good" },
    note: `${late} late · ${payment} payments to settle`,
    figures: [
      { key: "open", label: "Open", value: open, tone: "neutral" },
      { key: "late", label: "Late", value: late, tone: toneCount(late, true) },
      { key: "payment", label: "Payments to settle", value: payment, tone: toneCount(payment), step: 9 },
      { key: "done", label: "Done this month", value: doneMonth, tone: "neutral" },
    ],
    stuckAt: topStep ? { step: topStep, name: GRN_STEP_SHORT[topStep - 1], count: perStep[topStep] } : null,
  };
}

// ---------------------------------------------------------------- IMS ------
export function imsSummary(coo: any): ModuleSummary {
  const inv = coo?.inventory || {};
  const atRisk = inv.criticalAtRiskCount || 0;
  const out = inv.outOfStockCount || 0;
  const neg = inv.negativeCount || 0;
  const low = inv.lowStockCount || 0;
  return {
    key: "ims",
    title: "Stock",
    href: "/ims",
    headline: { value: atRisk, label: "top sellers running low", tone: toneCount(atRisk, true) },
    note: `${out} out of stock · ${neg} negative`,
    figures: [
      { key: "atRisk", label: "Top sellers low", value: atRisk, tone: toneCount(atRisk, true) },
      { key: "out", label: "Out of stock", value: out, tone: toneCount(out) },
      { key: "negative", label: "Negative stock", value: neg, tone: toneCount(neg, true) },
      { key: "low", label: "Low stock", value: low, tone: toneCount(low) },
    ],
  };
}

// -------------------------------------------------------------- Tasks ------
export function tasksSummary(coo: any): ModuleSummary {
  const del = coo?.delegations || {};
  const overdue = del.overdue || 0;
  const pending = del.pending || 0;
  const revision = del.needRevision || 0;
  const done = del.completed || 0;
  return {
    key: "tasks",
    title: "Tasks",
    href: "/delegations",
    headline: { value: overdue, label: "tasks overdue", tone: toneCount(overdue, true) },
    note: `${pending} pending · ${revision} need revision`,
    figures: [
      { key: "overdue", label: "Overdue", value: overdue, tone: toneCount(overdue, true) },
      { key: "pending", label: "Pending", value: pending, tone: "neutral" },
      { key: "revision", label: "Need revision", value: revision, tone: toneCount(revision) },
      { key: "done", label: "Completed", value: done, tone: "neutral" },
    ],
  };
}

// ------------------------------------------------------------- People ------
export function peopleSummary(coo: any): ModuleSummary {
  const att = coo?.attendance || {};
  const present = att.present || 0;
  const total = att.total || 0;
  const absent = att.absent || 0;
  const leave = att.onLeave || 0;
  const late = att.lateArrivals || 0;
  return {
    key: "people",
    title: "Team",
    href: "/attendance",
    headline: { value: `${present}/${total}`, label: "present today", tone: absent > 0 ? "warn" : "good" },
    note: `${absent} absent · ${leave} on leave`,
    figures: [
      { key: "present", label: "Present", value: `${present}/${total}`, tone: "neutral" },
      { key: "absent", label: "Absent", value: absent, tone: toneCount(absent) },
      { key: "leave", label: "On leave", value: leave, tone: "neutral" },
      { key: "late", label: "Came late", value: late, tone: toneCount(late) },
    ],
  };
}

/** The report sections each module page shows under its strip (admins only). */
export const MODULE_DETAIL_SECTIONS: Partial<Record<ModuleKey, string[]>> = {
  o2d: ["dispatchSpeed", "stepPerformance", "delayAging"],
  ims: ["inventory"],
  tasks: ["delegations"],
  people: ["teamToday"],
};

/** The slice of the COO report those sections read. */
export function cooSliceFor(key: ModuleKey, coo: any): any {
  switch (key) {
    case "o2d": return { orders: coo?.orders };
    case "ims": return { inventory: coo?.inventory };
    case "tasks": return { delegations: coo?.delegations };
    case "people": return { attendance: coo?.attendance };
    default: return null;
  }
}
