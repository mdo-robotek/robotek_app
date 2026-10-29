/**
 * Work list — the exact items behind a number on the CEO home or a module's
 * top tiles (Sahil, 2026-10-28: "click karun toh wahin window khul jaaye,
 * jismein dikhe kaunse kaam pending hain, kis step par, kiske paas").
 *
 * Each list uses the same rule as the number it opens, so "Late 20" always
 * opens 20 rows. Pure functions — the API route loads the sheets.
 */
import type { I2R } from "@/types/i2r";
import type { GRN } from "@/types/grn";
import { i2rActiveStep, grnActiveStep, isTbdName, I2R_STEP_SHORT, GRN_STEP_SHORT } from "@/lib/module-summary";

export interface WorkRow {
  id: string;
  /** Short reference shown first: order no, indent no, GRN no, task id. */
  ref: string;
  /** What it is: party, item, task title. */
  title: string;
  /** Second line under the title (qty, amount, description). */
  sub?: string;
  stepNo: number;
  step: string;
  /** Who has to do the waiting step (as written in the step setup). */
  doer: string;
  /** Planned time of the waiting step, epoch ms. */
  planned: number | null;
  /** For "done" lists: when it was finished, epoch ms. */
  doneAt?: number | null;
  /** Overrides the computed status pill (e.g. "Dispatched 2d late"). */
  statusText?: string;
  tone?: "bad" | "warn" | "good";
  /** Where "Open" takes you to act on this item. */
  link?: string;
}

export interface WorkList {
  module: string;
  filter: string;
  title: string;
  /** Module page, for the "Open … page" button. */
  href: string;
  rows: WorkRow[];
}

type StepCfg = { step_name?: string; responsible_person?: string };

const filled = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-";
};
const toMs = (v: unknown): number | null => {
  if (!filled(v)) return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
};
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const inMonth = (ms: number | null, now: Date) => {
  if (ms == null) return false;
  const d = new Date(ms);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/** Late first (oldest planned on top), then by planned time; done lists newest first. */
export function sortRows(rows: WorkRow[]): WorkRow[] {
  return [...rows].sort((a, b) => {
    if (a.doneAt != null || b.doneAt != null) return (b.doneAt || 0) - (a.doneAt || 0);
    return (a.planned ?? Infinity) - (b.planned ?? Infinity);
  });
}

// ---------------------------------------------------------------- I2R ------
export const I2R_FILTERS: Record<string, string> = {
  open: "Open", late: "Late", tbd: "Names to decide", done: "Done this month",
};

export function i2rWorkList(items: I2R[], configs: StepCfg[], filter: string, nowDate = new Date()): WorkRow[] {
  const now = nowDate.getTime();
  const rows: WorkRow[] = [];
  for (const it of items) {
    const any = it as any;
    const s = i2rActiveStep(it);
    if (s < 0) continue;
    const base = {
      id: String(it.id),
      link: `/i2r?find=${encodeURIComponent(clean(it.indend_num) || String(it.id))}`,
      ref: clean(it.indend_num) || String(it.id),
      title: clean(it.item_name) || "—",
      sub: [filled(it.quantity) ? `Qty ${clean(it.quantity)}` : "", clean(it.category)].filter(Boolean).join(" · "),
    };
    if (filter === "done") {
      if (s !== 0) continue;
      const doneAt = toMs(any.actual_11);
      if (!inMonth(doneAt, nowDate)) continue;
      rows.push({ ...base, stepNo: 0, step: "All steps done", doer: "", planned: toMs(any.planned_1), doneAt });
      continue;
    }
    if (filter === "tbd") {
      if (!isTbdName(it.item_name)) continue;
    } else if (s === 0) continue;
    const step = s === 0 ? 0 : s;
    const planned = step ? toMs(any[`planned_${step}`]) : null;
    if (filter === "late" && !(planned != null && planned < now)) continue;
    rows.push({
      ...base,
      stepNo: step,
      step: step ? clean(configs[step - 1]?.step_name) || I2R_STEP_SHORT[step - 1] : "All steps done",
      doer: step ? clean(configs[step - 1]?.responsible_person) : "",
      planned,
    });
  }
  return sortRows(rows);
}

// ---------------------------------------------------------------- GRN ------
export const GRN_FILTERS: Record<string, string> = {
  open: "Open", late: "Late", payment: "Payments to settle", done: "Done this month",
};

export function grnWorkList(
  items: GRN[],
  configs: StepCfg[],
  filter: string,
  supplierOf: (g: GRN) => string,
  nowDate = new Date()
): WorkRow[] {
  const now = nowDate.getTime();
  const rows: WorkRow[] = [];
  for (const it of items) {
    const any = it as any;
    const s = grnActiveStep(it);
    if (s < 0) continue;
    const supplier = supplierOf(it);
    const base = {
      id: String(it.id),
      link: `/grn?find=${encodeURIComponent(clean(it.GRN_No) || String(it.id))}`,
      ref: clean(it.GRN_No) || String(it.id),
      title: clean(it.Item_Name) || "—",
      sub: [supplier ? `Supplier: ${supplier}` : "", filled(it.Qty) ? `Qty ${clean(it.Qty)}` : ""].filter(Boolean).join(" · "),
    };
    if (filter === "done") {
      if (s !== 0) continue;
      let doneAt: number | null = null;
      for (let i = 9; i >= 1; i--) if (filled(any[`actual_${i}`])) { doneAt = toMs(any[`actual_${i}`]); break; }
      if (!inMonth(doneAt, nowDate)) continue;
      rows.push({ ...base, stepNo: 0, step: "All steps done", doer: "", planned: toMs(any.planned_1), doneAt });
      continue;
    }
    if (s === 0) continue;
    if (filter === "payment" && s !== 9) continue;
    const planned = toMs(any[`planned_${s}`]);
    if (filter === "late" && !(planned != null && planned < now)) continue;
    rows.push({
      ...base,
      stepNo: s,
      step: clean(configs[s - 1]?.step_name) || GRN_STEP_SHORT[s - 1],
      doer: clean(configs[s - 1]?.responsible_person),
      planned,
    });
  }
  return sortRows(rows);
}

// ---------------------------------------------------------------- O2D ------
export const O2D_FILTERS: Record<string, string> = {
  waiting: "To dispatch", over7: "Over 7 days", paperwork: "Paperwork pending", otd: "Dispatched late this month",
};

const inr = (n: number) => (n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "");

/** Rows from the COO report's order lists, so they match its counts exactly. */
export function o2dWorkList(coo: any, configs: StepCfg[], filter: string): WorkRow[] {
  if (filter === "otd") {
    return sortRows(
      (coo?.orders?.lateDispatchList || []).map((o: any) => {
        const made = toMs(o.created);
        const sent = toMs(o.dispatched);
        const took = made != null && sent != null ? Math.max(0, sent - made) : null;
        const days = took != null ? Math.floor(took / 86400000) : null;
        return {
          id: String(o.id),
          ref: String(o.id),
          title: clean(o.party) || "—",
          sub: [inr(Number(o.amount) || 0), made != null ? `Order ${new Date(made).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ""].filter(Boolean).join(" · "),
          stepNo: 0,
          step: sent != null ? `Dispatched ${new Date(sent).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}` : "Dispatched",
          doer: clean(configs[6]?.responsible_person),
          planned: made,
          doneAt: sent,
          statusText: days != null ? (days >= 1 ? `Took ${days}d` : "Took over 9 hrs") : "Late",
          tone: "bad" as const,
          link: `/o2d?find=${encodeURIComponent(String(o.id))}`,
        };
      })
    );
  }
  const aging = coo?.orders?.delayAging || {};
  const list: any[] =
    filter === "paperwork" ? aging.postDispatchList || [] :
    filter === "over7" ? (aging.undispatchedList || []).filter((o: any) => (o.days ?? 0) > 7) :
    aging.undispatchedList || [];
  return sortRows(
    list.map((o) => {
      const n = Number(o.stepNo) || 0;
      const subParts = [inr(Number(o.amount) || 0), o.days != null ? `${o.days} day${o.days === 1 ? "" : "s"} old` : "", clean(o.remark) ? `Note: ${clean(o.remark)}` : ""];
      return {
        id: String(o.id),
        ref: String(o.id),
        title: clean(o.party) || "—",
        sub: subParts.filter(Boolean).join(" · "),
        stepNo: n,
        step: clean(o.step).replace(/^\d+\.\s*/, "") || (n ? `Step ${n}` : "—"),
        doer: n ? clean(configs[n - 1]?.responsible_person) : "",
        planned: toMs(o.planned),
        link: `/o2d?find=${encodeURIComponent(String(o.id))}`,
      };
    })
  );
}

// -------------------------------------------------------------- Tasks ------
export const TASK_FILTERS: Record<string, string> = {
  overdue: "Overdue", pending: "Pending", revision: "New dates asked", done: "Completed in the last 7 days",
};

/**
 * Delegation tasks with the COO report's rules:
 *  overdue  = due date (IST day) before today and not Completed
 *  pending  = status Pending
 *  revision = status Need Revision with an open ask
 */
export function taskWorkList(
  tasks: any[],
  filter: string,
  todayStr: string,
  normalizeDate: (v: string) => string,
  isAsking: (t: any) => boolean
): WorkRow[] {
  const rows: WorkRow[] = [];
  for (const t of tasks) {
    const status = clean(t.status);
    let keep = false;
    if (filter === "overdue") {
      const due = normalizeDate(t.due_date);
      keep = !!due && due < todayStr && status !== "Completed";
    } else if (filter === "pending") keep = status === "Pending";
    else if (filter === "revision") keep = isAsking(t);
    else if (filter === "done") {
      const at = toMs(t.updated_at) ?? toMs(t.due_date);
      keep = status === "Completed" && at != null && Date.now() - at <= 7 * 86400000;
      if (keep) {
        rows.push({
          id: String(t.id), ref: `#${t.id}`, title: clean(t.title) || "Task",
          sub: clean(t.description).slice(0, 90),
          stepNo: 0, step: clean(t.assigned_by) || "—", doer: clean(t.assigned_to), planned: toMs(t.due_date), doneAt: at,
          link: `/delegations?task=${encodeURIComponent(String(t.id))}`,
        });
      }
      continue;
    }
    if (!keep) continue;
    rows.push({
      id: String(t.id),
      ref: `#${t.id}`,
      title: clean(t.title) || "Task",
      sub: [status && status !== "Pending" ? status : "", clean(t.description).slice(0, 90)].filter(Boolean).join(" · "),
      stepNo: 0,
      step: clean(t.assigned_by) || "—",
      doer: clean(t.assigned_to),
      planned: toMs(t.due_date),
      link: `/delegations?task=${encodeURIComponent(String(t.id))}`,
    });
  }
  return sortRows(rows);
}
