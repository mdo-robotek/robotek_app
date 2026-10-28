/**
 * The ERP standard for every step-based process (Sahil, 2026-10-28):
 * "Jo O2D mein hai wahi har FMS mein — ek standard, template."
 *
 * Every process page gets the same four tiles at the top —
 *   Open · Late · Due today · Done this month
 * and tapping any of them opens the same work-list window.
 *
 * A process only has to say how to read one record (its number, name, the
 * waiting step, who has it, planned time, when it finished). Everything else
 * — the counts, the lists, the window — is shared. Admin/EA see the whole
 * company; everyone else sees only the work that is theirs.
 *
 * Pure functions here; src/lib/fms-standard-load.ts reads the sheets.
 */
import type { ModuleSummary, Tone } from "@/lib/module-summary";
import type { WorkRow } from "@/lib/work-list";
import { sortRows } from "@/lib/work-list";

export type StdKey =
  | "i2r-packing" | "item-receive-packing" | "replace"
  | "recruitment" | "candidate" | "sales" | "onboard" | "offboard"
  | "new-launch" | "checklists";

export const STD_MODULES: Record<StdKey, { title: string; href: string; unit: string }> = {
  "i2r-packing": { title: "Packing Purchase", href: "/i2r-packing", unit: "packing requests" },
  "item-receive-packing": { title: "Item Receive (Packing)", href: "/item-receive-packing", unit: "receipts" },
  replace: { title: "Replacement", href: "/replace", unit: "replacements" },
  recruitment: { title: "Recruitment", href: "/hrms/recruitment", unit: "openings" },
  candidate: { title: "Candidates", href: "/hrms/candidate", unit: "candidates" },
  sales: { title: "Sales Hiring", href: "/hrms/sales", unit: "candidates" },
  onboard: { title: "Onboarding", href: "/hrms/onboard", unit: "joinings" },
  offboard: { title: "Offboarding", href: "/hrms/offboard", unit: "exits" },
  "new-launch": { title: "New Launch", href: "/new-launch", unit: "launches" },
  checklists: { title: "Checklists", href: "/checklists", unit: "checklist tasks" },
};

export const STD_FILTERS: Record<string, string> = {
  open: "Open", late: "Late", today: "Due today", done: "Done this month",
};

export function isStdKey(k: string): k is StdKey {
  return Object.prototype.hasOwnProperty.call(STD_MODULES, k);
}

/** One record, read the same way for every process. */
export type StdItem = WorkRow & { open: boolean };

const IST = 330 * 60000;
const istDay = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);
const istMonth = (ms: number) => new Date(ms + IST).toISOString().slice(0, 7);

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
/** "RAM, SHUBHAM" / "Deepak & CHARANPREET" → each name, lower-case. */
export function peopleIn(doer: string): string[] {
  return String(doer || "").split(/[,&/]+/).map(norm).filter(Boolean);
}

/** Non-admins see only the work where they are a doer of the waiting step. */
export function scopeTo(items: StdItem[], username: string | null): StdItem[] {
  if (!username) return items;
  const me = norm(username);
  return items.filter((i) => peopleIn(i.doer).includes(me));
}

export function stdFilter(items: StdItem[], filter: string, now = Date.now()): WorkRow[] {
  const today = istDay(now);
  const month = istMonth(now);
  const rows = items.filter((i) => {
    if (filter === "done") return !i.open && i.doneAt != null && istMonth(i.doneAt) === month;
    if (!i.open) return false;
    if (filter === "late") return i.planned != null && i.planned < now;
    if (filter === "today") return i.planned != null && i.planned >= now && istDay(i.planned) === today;
    return true; // open
  });
  return sortRows(rows.map(({ open: _o, ...r }) => r));
}

const toneCount = (n: number, bad = false): Tone => (n > 0 ? (bad ? "bad" : "warn") : "good");

export function stdSummary(key: StdKey, items: StdItem[], mine: boolean, now = Date.now()): ModuleSummary {
  const m = STD_MODULES[key];
  const open = stdFilter(items, "open", now).length;
  const late = stdFilter(items, "late", now).length;
  const today = stdFilter(items, "today", now).length;
  const done = stdFilter(items, "done", now).length;
  // Where most open work is waiting
  const perStep = new Map<string, { step: number; name: string; count: number }>();
  for (const i of items) {
    if (!i.open || !i.stepNo) continue;
    const k = `${i.stepNo}`;
    const e = perStep.get(k) || { step: i.stepNo, name: i.step, count: 0 };
    e.count++;
    perStep.set(k, e);
  }
  const top = [...perStep.values()].sort((a, b) => b.count - a.count)[0] || null;
  const my = mine ? "My " : "";
  return {
    key: key as any,
    title: m.title,
    href: m.href,
    headline: { value: open, label: `${m.unit} open`, tone: late > 0 ? "warn" : "good" },
    note: `${late} late · ${today} due today`,
    figures: [
      { key: "open", label: `${my}Open`, value: open, tone: "neutral" },
      { key: "late", label: `${my}Late`, value: late, tone: toneCount(late, true) },
      { key: "today", label: `${my}Due today`, value: today, tone: toneCount(today) },
      { key: "done", label: `${my}Done this month`, value: done, tone: "neutral" },
    ],
    stuckAt: top,
  };
}

// ------------------------------------------------ reading one record ----

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
const flagOn = (v: unknown) => {
  const s = norm(v);
  return s !== "" && s !== "false" && s !== "no" && s !== "0" && s !== "-";
};

type Cfg = { step_name?: string; responsible_person?: string };

/**
 * Standard step FMS record: steps planned_1..N / actual_1..N.
 * Waiting step = first step that has a planned time and no actual
 * (same rule as the morning WhatsApp).
 */
export function readStepRecord(
  rec: Record<string, any>,
  total: number,
  configs: Cfg[],
  look: { ref: string; title: string; sub?: string; link: string }
): StdItem | null {
  if (flagOn(rec.cancelled)) return null;
  let step = 0;
  for (let i = 1; i <= total; i++) {
    if (filled(rec[`planned_${i}`]) && !filled(rec[`actual_${i}`])) { step = i; break; }
  }
  let lastActual: number | null = null;
  for (let i = total; i >= 1; i--) if (filled(rec[`actual_${i}`])) { lastActual = toMs(rec[`actual_${i}`]); break; }
  const base = { id: String(rec.id ?? look.ref), ref: look.ref || String(rec.id ?? ""), title: look.title || "—", sub: look.sub, link: look.link };
  if (!step) {
    // Nothing waiting: finished if any step was done, otherwise not started yet.
    if (lastActual == null) return null;
    return { ...base, stepNo: 0, step: "All steps done", doer: "", planned: toMs(rec.planned_1), doneAt: lastActual, open: false };
  }
  return {
    ...base,
    stepNo: step,
    step: clean(configs[step - 1]?.step_name) || `Step ${step}`,
    doer: clean(configs[step - 1]?.responsible_person),
    planned: toMs(rec[`planned_${step}`]),
    open: true,
  };
}

const q = (s: string) => encodeURIComponent(s);
const join = (...xs: unknown[]) => xs.map(clean).filter(Boolean).join(" · ");

export function readPacking(r: any, configs: Cfg[]) {
  const ref = clean(r.ppf_num) || clean(r.id);
  return readStepRecord(r, 6, configs, { ref, title: clean(r.item_name), sub: join(filled(r.total_qty) ? `Qty ${clean(r.total_qty)}` : "", r.packing_design, r.last_suppliar ? `Last supplier: ${clean(r.last_suppliar)}` : ""), link: `/i2r-packing?find=${q(ref)}` });
}
export function readItemReceive(r: any, configs: Cfg[]) {
  const ref = clean(r.ppr_num) || clean(r.id);
  return readStepRecord(r, 4, configs, { ref, title: clean(r.item_name), sub: join(r.supplier_name ? `Supplier: ${clean(r.supplier_name)}` : "", filled(r.qty) ? `Qty ${clean(r.qty)}` : "", r.po_no ? `PO ${clean(r.po_no)}` : ""), link: `/item-receive-packing?find=${q(ref)}` });
}
export function readReplace(r: any, configs: Cfg[]) {
  const ref = clean(r.rn_num) || clean(r.id);
  return readStepRecord(r, 9, configs, { ref, title: clean(r.party_name), sub: join(filled(r.num_of_parcel) ? `${clean(r.num_of_parcel)} parcel(s)` : "", r.receiver_name ? `Received by ${clean(r.receiver_name)}` : ""), link: `/replace?find=${q(ref)}` });
}
export function readHr(key: StdKey, r: any, total: number, configs: Cfg[]) {
  const ref = clean(r.id);
  const name =
    key === "recruitment" ? clean(r.post_for_recruitment) :
    key === "offboard" ? clean(r.emp_name) : clean(r.candidate_name);
  return readStepRecord(r, total, configs, { ref, title: name, sub: join(r.applied_for || r.department, r.whatsapp_number ? `WhatsApp ${clean(r.whatsapp_number)}` : ""), link: `/hrms/${key}?find=${q(ref)}` });
}

/** New Launch keeps its own step number and doer rules. */
export function readLaunch(r: any, steps: { n: number; name: string; doer: string }[], doerOf: (n: number, fields: Record<string, string>) => string): StdItem | null {
  const status = clean(r.status);
  if (status === "Cancelled") return null;
  const ref = clean(r.launch_no) || clean(r.id);
  const base = { id: clean(r.id) || ref, ref, title: clean(r.product_name) || "—", link: `/new-launch?find=${q(ref)}` };
  if (status === "Completed") {
    return { ...base, stepNo: 0, step: "Launched — all steps done", doer: "", planned: null, doneAt: toMs(r.updated_at), open: false };
  }
  const n = Number(r.current_step) || 0;
  if (!n) return null;
  let fields: Record<string, string> = {};
  try { fields = JSON.parse(r.fields || "{}"); } catch { /* keep empty */ }
  const step = steps[n - 1];
  return { ...base, stepNo: n, step: step?.name || `Step ${n}`, doer: doerOf(n, fields), planned: toMs(r[`planned_${n}`]), open: true };
}

/** One checklist occurrence (a repeating task on one day). */
export function readChecklist(c: any): StdItem | null {
  const due = clean(c.occurrence_due_date || c.due_date).slice(0, 10);
  if (!due) return null;
  const done = norm(c.display_status) === "completed";
  // A checklist task is due by the end of the office day (6:30 PM India time).
  const planned = Date.parse(`${due}T18:30:00+05:30`);
  return {
    id: clean(c.occurrence_key) || `${c.id}-${due}`,
    ref: `#${clean(c.id)}`,
    title: clean(c.task) || "Checklist task",
    sub: c.assigned_by ? `Given by ${clean(c.assigned_by)}` : "",
    stepNo: 0,
    step: clean(c.frequency) || "Checklist",
    doer: clean(c.assigned_to),
    planned: Number.isFinite(planned) ? planned : null,
    doneAt: done ? toMs(c.completed_date) : null,
    link: `/checklists?find=${q(clean(c.task))}`,
    open: !done,
  };
}
