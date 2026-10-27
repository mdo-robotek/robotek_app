/**
 * Morning WhatsApp — one message per person with all their work.
 *
 * Sahil, 2026-10-27: "roz subah ek hi WhatsApp jaaye jismein uska saara kaam
 * ho — use kya kya karna hai". One message, not one per step, so people
 * actually read it.
 *
 * What goes in it:
 *  - FMS steps (O2D, Purchase, Packing, Item Receive, GRN, Replace, HR) where
 *    the person is the responsible person of the step that is waiting now:
 *      Late       — planned time already passed
 *      Due today  — planned later today (India time)
 *  - Delegation tasks given to the person:
 *      past due date and not done → link to ask for a new date
 *      due today                  → in "Due today"
 *
 * Nobody gets an empty "nothing to do" message.
 * This file has no sheet calls — the cron route collects the data.
 */

export interface WorkItem {
  person: string;   // username as written in the step config / task
  module: string;   // short label, e.g. "GRN"
  title: string;    // e.g. "GRN-441 · Speaker box"
  step: string;     // step name
  planned: number;  // epoch ms
}

export interface TaskItem {
  id: string;
  person: string;
  title: string;
  due: number; // epoch ms
}

export interface StepConfigLike { step_name?: string; responsible_person?: string }

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function isFilled(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-";
}

/** "TRUE", "Yes", "Cancelled"... count; empty, "FALSE", "No", "0" don't. */
export function isFlagOn(v: unknown): boolean {
  const s = norm(v);
  return s !== "" && s !== "false" && s !== "no" && s !== "0" && s !== "-";
}

export function toTime(v: unknown): number | null {
  if (!isFilled(v)) return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

/** "RAM, SHUBHAM" / "Deepak Verma & CHARANPREET" → ["RAM", "SHUBHAM"] ... */
export function splitPeople(s: unknown): string[] {
  return String(s ?? "")
    .split(/[,&/]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** The step waiting now: first step that has a planned time but is not done. 0 = none. */
export function currentStep(item: Record<string, unknown>, total: number): number {
  for (let i = 1; i <= total; i++) {
    if (isFilled(item[`planned_${i}`]) && !isFilled(item[`actual_${i}`])) return i;
  }
  return 0;
}

/** Turn module records into one WorkItem per responsible person of the waiting step. */
export function fmsWork<T extends object>(opts: {
  module: string;
  items: T[];
  total: number;
  configs: StepConfigLike[];
  title: (item: T) => string;
  skip?: (item: T) => boolean;
  stepOf?: (item: T) => number; // module's own rule, if it has one
}): WorkItem[] {
  const out: WorkItem[] = [];
  for (const item of opts.items) {
    const rec = item as unknown as Record<string, unknown>;
    if (isFlagOn(rec.cancelled)) continue;
    if (opts.skip && opts.skip(item)) continue;
    const step = opts.stepOf ? opts.stepOf(item) : currentStep(rec, opts.total);
    if (step < 1) continue;
    const planned = toTime(rec[`planned_${step}`]);
    if (planned == null) continue;
    const cfg = opts.configs[step - 1] || {};
    for (const person of splitPeople(cfg.responsible_person)) {
      out.push({
        person,
        module: opts.module,
        title: opts.title(item).replace(/\s+/g, " ").trim(),
        step: String(cfg.step_name || `Step ${step}`).trim(),
        planned,
      });
    }
  }
  return out;
}

/** End of today in India time, as epoch ms. */
export function endOfIstDay(now: number): number {
  const ist = now + 330 * 60000;
  const day = Math.floor(ist / 86400000) * 86400000;
  return day + 86400000 - 1 - 330 * 60000;
}

const DONE_TASK = new Set(["completed", "approved", "hold", "cancelled"]);

/**
 * Delegation tasks for the morning message.
 *  late:  due date passed, not done, and no new-date ask already waiting
 *  today: due later today
 */
export function taskWork(
  tasks: { id?: string; title?: string; assigned_to?: string; due_date?: string; status?: string }[],
  hasPendingAsk: (id: string) => boolean,
  now: number
): { late: TaskItem[]; today: TaskItem[] } {
  const late: TaskItem[] = [];
  const today: TaskItem[] = [];
  const eod = endOfIstDay(now);
  for (const t of tasks) {
    if (DONE_TASK.has(norm(t.status))) continue;
    const due = toTime(t.due_date);
    const person = String(t.assigned_to || "").trim();
    if (due == null || !person) continue;
    const item = { id: String(t.id || ""), person, title: String(t.title || "Task").replace(/\s+/g, " ").trim(), due };
    if (due < now) {
      if (!hasPendingAsk(item.id)) late.push(item);
    } else if (due <= eod) {
      today.push(item);
    }
  }
  return { late, today };
}

// ------------------------------------------------------------ message ----

function istParts(t: number) {
  return new Date(t);
}

export function istTime(t: number): string {
  return istParts(t).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase();
}

export function istDate(t: number): string {
  return istParts(t).toLocaleString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export function istDayLabel(t: number): string {
  return istParts(t).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export function lateText(planned: number, now: number): string {
  const hrs = (now - planned) / 3600000;
  if (hrs < 24) {
    const h = Math.max(1, Math.round(hrs));
    return `${h} hr${h === 1 ? "" : "s"} late`;
  }
  const d = Math.floor(hrs / 24);
  return `${d} day${d === 1 ? "" : "s"} late`;
}

export function displayName(username: string): string {
  return String(username || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const MAX_LINES = 10;
const MAX_TASK_LINKS = 5;

/** The WhatsApp text for one person, or null when they have nothing. */
export function buildMorningMessage(opts: {
  username: string;
  fms: WorkItem[];
  tasksLate: TaskItem[];
  tasksToday: TaskItem[];
  now: number;
  baseUrl: string;
  extra?: { title: string; body: string }[];
}): string | null {
  const { fms, tasksLate, tasksToday, now, baseUrl } = opts;
  const extra = opts.extra || [];
  const late = fms.filter((w) => w.planned < now).sort((a, b) => a.planned - b.planned);
  const eod = endOfIstDay(now);
  const todayFms = fms.filter((w) => w.planned >= now && w.planned <= eod);

  type Line = { at: number; text: string };
  const todayLines: Line[] = [
    ...todayFms.map((w) => ({ at: w.planned, text: `• ${w.module}: ${w.title} — ${w.step} (by ${istTime(w.planned)})` })),
    ...tasksToday.map((t) => ({ at: t.due, text: `• Task: ${t.title} (by ${istTime(t.due)})` })),
  ].sort((a, b) => a.at - b.at);

  if (late.length + todayLines.length + tasksLate.length + extra.length === 0) return null;

  const parts: string[] = [];
  parts.push(`Good morning, ${displayName(opts.username)}\nYour work for today (${istDayLabel(now)})`);

  if (late.length) {
    const lines = late.slice(0, MAX_LINES).map((w) => `• ${w.module}: ${w.title} — ${w.step} (${lateText(w.planned, now)})`);
    if (late.length > MAX_LINES) lines.push(`…and ${late.length - MAX_LINES} more`);
    parts.push(`*🔴 LATE — ${late.length}*\n${lines.join("\n")}`);
  }

  if (todayLines.length) {
    const lines = todayLines.slice(0, MAX_LINES).map((l) => l.text);
    if (todayLines.length > MAX_LINES) lines.push(`…and ${todayLines.length - MAX_LINES} more`);
    parts.push(`*🟡 DUE TODAY — ${todayLines.length}*\n${lines.join("\n")}`);
  }

  if (tasksLate.length) {
    const sorted = [...tasksLate].sort((a, b) => a.due - b.due);
    const lines = sorted.slice(0, MAX_TASK_LINKS).map(
      (t) => `• ${t.title} (was due ${istDate(t.due)})\n  New date: ${baseUrl}/delegations?ask=${encodeURIComponent(t.id)}`
    );
    if (sorted.length > MAX_TASK_LINKS) lines.push(`…and ${sorted.length - MAX_TASK_LINKS} more on the Delegations page`);
    parts.push(`*📋 TASKS PAST DUE DATE — ${sorted.length}*\nFinish today, or tap the link and pick the new date you will finish by.\n${lines.join("\n")}`);
  }

  for (const x of extra) parts.push(`*${x.title}*\n${x.body}`);

  parts.push(`Open Sarthi: ${baseUrl}`);
  return parts.join("\n\n");
}
