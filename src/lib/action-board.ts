/**
 * Action Board — for the Process Coordinator and the EA (Sahil, 2026-10-28).
 *
 * The PC's job: company "work not done" = 0 and "work not done on time" = 0.
 * So she needs one list: who is late on what right now, across every
 * process, with the person's phone — call, nudge, move on.
 *
 * Help tickets are listed only as "ticket #, for whom, how long" — never what
 * the ticket says.
 *
 * Pure functions; the API route reads the sheets (collectWork in score-misses).
 */
import type { RawWork } from "@/lib/score-misses";
import { ownsLeaveFollowUp } from "@/lib/leave-access";

export interface LateItem {
  module: string;
  ref: string;
  title: string;
  step: string;
  planned: string;   // ISO
  lateHours: number;
  link: string;
}

export interface PersonLate {
  username: string;     // ERP username, or the name as written when not matched
  matched: boolean;
  designation: string;
  phone: string;
  image: string;
  late: number;
  oldestDays: number;
  byModule: Record<string, number>;
  items: LateItem[];    // oldest first, capped
}

export interface TicketFollowUp {
  id: string;
  forWhom: string;
  phone: string;
  raisedBy: string;
  daysOpen: number;
  pastDue: boolean;
}

export interface CompanyScore {
  label: string;
  due: number;          // work planned in the period up to now
  notDone: number;      // still not done, planned time passed
  doneLate: number;
  notDonePct: number;   // target 0
  notOnTimePct: number; // (not done + done late) / due, target 0
}

const IST = 330 * 60000;

/** Monday 00:00 IST of the week that contains `now`, as epoch ms. */
export function istWeekStart(now: number): number {
  const ist = new Date(now + IST);
  const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const midnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST;
  return midnight - dow * 86400000;
}

export function istMonthStart(now: number): number {
  const ist = new Date(now + IST);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST;
}

/** Same rule as the score's "why it dropped": planned in [from, to], measured up to now. */
export function companyScore(work: RawWork[], from: number, to: number, now: number, label: string): CompanyScore {
  let due = 0, notDone = 0, doneLate = 0;
  const end = Math.min(to, now);
  for (const w of work) {
    if (!w.planned) continue;
    const p = w.planned.getTime();
    if (p < from || p > end) continue;
    due++;
    if (!w.done) notDone++;
    else if (w.actual && w.actual.getTime() > p) doneLate++;
  }
  const pct = (x: number) => (due ? Math.round((x / due) * 1000) / 10 : 0);
  return { label, due, notDone, doneLate, notDonePct: pct(notDone), notOnTimePct: pct(notDone + doneLate) };
}

const q = (s: string) => encodeURIComponent(s);
const HR: Record<string, string> = {
  "Recruitment FMS": "recruitment", "Candidate FMS": "candidate", "Sales HR FMS": "sales",
  "Onboard FMS": "onboard", "Offboard FMS": "offboard",
};

/** Where "Open" should take you for one piece of work. */
export function linkFor(w: { module: string; ref: string; title: string }): string {
  const ref = String(w.ref || "").trim();
  switch (w.module) {
    case "Delegation": return `/delegations?task=${q(ref.replace(/^#/, ""))}`;
    case "Checklist": return `/checklists?find=${q(w.title)}`;
    case "O2D": return `/o2d?find=${q(ref)}`;
    case "I2R": return `/i2r?find=${q(ref)}`;
    case "I2R Packing": return `/i2r-packing?find=${q(ref)}`;
    case "GRN": return `/grn?find=${q(ref)}`;
    case "New Launch FMS": return `/new-launch?find=${q(ref)}`;
    case "Help Ticket": return `/tickets`;
    default: return HR[w.module] ? `/hrms/${HR[w.module]}?find=${q(ref)}` : "/";
  }
}

export function buildLateByPerson(
  work: RawWork[],
  now: number,
  resolve: (raw: string) => string[],
  users: Map<string, { designation?: string; phone?: string; image_url?: string }>,
  cap = 40
): PersonLate[] {
  const people = new Map<string, PersonLate>();
  for (const w of work) {
    if (w.done || !w.planned || w.module === "Help Ticket") continue;
    const p = w.planned.getTime();
    if (p >= now) continue;
    const owners = resolve(w.responsible);
    const names = owners.length ? owners : [w.responsible ? w.responsible.trim() : `(no doer set) ${w.module}`];
    for (const name of names) {
      const u = users.get(name.toLowerCase());
      let e = people.get(name);
      if (!e) {
        e = { username: name, matched: !!owners.length, designation: u?.designation || "", phone: String(u?.phone || "").trim(), image: u?.image_url || "", late: 0, oldestDays: 0, byModule: {}, items: [] };
        people.set(name, e);
      }
      e.late++;
      e.byModule[w.module] = (e.byModule[w.module] || 0) + 1;
      e.oldestDays = Math.max(e.oldestDays, Math.floor((now - p) / 86400000));
      e.items.push({
        module: w.module, ref: w.ref, title: w.title, step: w.step,
        planned: w.planned.toISOString(), lateHours: Math.round((now - p) / 3600000),
        link: linkFor(w),
      });
    }
  }
  const out = [...people.values()];
  for (const p of out) p.items = p.items.sort((a, b) => b.lateHours - a.lateHours).slice(0, cap);
  return out.sort((a, b) => b.late - a.late || b.oldestDays - a.oldestDays);
}

const DONE_TICKET = new Set(["resolved", "closed"]);

export function ticketFollowUps(
  tickets: { id?: string; solver_person?: string; raised_by?: string; status?: string; created_at?: string; planned_resolution?: string }[],
  now: number,
  phoneOf: (name: string) => string
): TicketFollowUp[] {
  const out: TicketFollowUp[] = [];
  for (const t of tickets) {
    if (DONE_TICKET.has(String(t.status || "").trim().toLowerCase())) continue;
    const created = Date.parse(String(t.created_at || ""));
    const due = Date.parse(String(t.planned_resolution || ""));
    const forWhom = String(t.solver_person || "").trim();
    out.push({
      id: String(t.id || ""),
      forWhom: forWhom || "Not assigned",
      phone: forWhom ? phoneOf(forWhom) : "",
      raisedBy: String(t.raised_by || "").trim(),
      daysOpen: Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 86400000)) : 0,
      pastDue: Number.isFinite(due) && due < now,
    });
  }
  return out.sort((a, b) => Number(b.pastDue) - Number(a.pastDue) || b.daysOpen - a.daysOpen);
}

/** WhatsApp text the PC can send in one tap (plain English, short). */
export function nudgeText(p: PersonLate, max = 5): string {
  const first = p.username.split(" ")[0];
  const name = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "";
  const lines = p.items.slice(0, max).map((i) => {
    const late = i.lateHours >= 24 ? `${Math.floor(i.lateHours / 24)} day(s) late` : `${i.lateHours} hr(s) late`;
    return `• ${i.module}: ${i.title}${i.step ? ` — ${i.step}` : ""} (${late})`;
  });
  const more = p.late > max ? `\n…and ${p.late - max} more in Sarthi.` : "";
  return `Hi ${name}, ${p.late} item(s) are pending with you in Sarthi:\n${lines.join("\n")}${more}\nPlease finish them today, or update the date in Sarthi.`;
}

export function ticketNudgeText(t: TicketFollowUp): string {
  return `Hi ${t.forWhom}, help ticket #${t.id} is waiting for you in Sarthi${t.daysOpen ? ` (${t.daysOpen} day(s) open)` : ""}. Please check it.`;
}

/** 10-digit Indian mobile → wa.me / tel: number. */
export function phoneDigits(p: string): string {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

/** Admin, EA and the Process Coordinator. */
/**
 * Process Coordinators and the EA by name (Sahil, 2026-10-28: Vandana and
 * Abhishek are both PC; Rachit is the EA). Names work even when the login
 * doesn't carry a designation (the menu only knows username + role).
 */
export const ACTION_BOARD_PEOPLE = ["vandana", "abhishek gupta", "rachit aggarwal"];

export function canSeeActionBoard(u: { username?: string; role?: string; role_name?: string; designation?: string } | undefined): boolean {
  if (!u) return false;
  const role = String(u.role || u.role_name || "").toUpperCase();
  const desig = String(u.designation || "").trim().toLowerCase();
  const name = String(u.username || "").trim().toLowerCase();
  return (
    role === "ADMIN" || role === "EA" || role === "PC" ||
    desig === "ea" || desig === "executive assistant" || desig === "pc" || desig === "process coordinator" ||
    ACTION_BOARD_PEOPLE.includes(name) || ownsLeaveFollowUp(u)
  );
}


// ───────────────────────────── Performance Board ─────────────────────────────
// Sahil, 2026-10-28: weekly / monthly score like the "EM board" — company
// score, best and lowest performers with photo, everyone's tile, and which
// work pulls the company score down. Same rules as the Action Board score:
// work planned in the period (up to now) → not done, or done after planned.

export interface PersonScore {
  username: string;
  designation: string;
  department: string;
  image: string;
  due: number;
  notDone: number;
  doneLate: number;
  notDonePct: number;
  notOnTimePct: number;
  ranked: boolean; // enough work in the period to be ranked fairly
}

export interface ModulePull { module: string; due: number; missed: number; sharePct: number }

export const MIN_TO_RANK = 5;

export function personScores(
  work: RawWork[],
  from: number,
  to: number,
  now: number,
  resolve: (raw: string) => string[],
  users: { username: string; designation?: string; department?: string; image_url?: string }[]
): PersonScore[] {
  const end = Math.min(to, now);
  const acc = new Map<string, { due: number; notDone: number; doneLate: number }>();
  for (const w of work) {
    if (!w.planned) continue;
    const p = w.planned.getTime();
    if (p < from || p > end) continue;
    for (const u of resolve(w.responsible)) {
      const a = acc.get(u) || { due: 0, notDone: 0, doneLate: 0 };
      a.due++;
      if (!w.done) a.notDone++;
      else if (w.actual && w.actual.getTime() > p) a.doneLate++;
      acc.set(u, a);
    }
  }
  const pct = (x: number, d: number) => (d ? Math.round((x / d) * 1000) / 10 : 0);
  return users
    .filter((u) => acc.has(u.username))
    .map((u) => {
      const a = acc.get(u.username)!;
      return {
        username: u.username,
        designation: u.designation || "",
        department: u.department || "",
        image: u.image_url || "",
        due: a.due,
        notDone: a.notDone,
        doneLate: a.doneLate,
        notDonePct: pct(a.notDone, a.due),
        notOnTimePct: pct(a.notDone + a.doneLate, a.due),
        ranked: a.due >= MIN_TO_RANK,
      };
    })
    .sort((x, y) => Number(y.ranked) - Number(x.ranked) || x.notOnTimePct - y.notOnTimePct || y.due - x.due);
}

export function modulePull(work: RawWork[], from: number, to: number, now: number): ModulePull[] {
  const end = Math.min(to, now);
  const m = new Map<string, { due: number; missed: number }>();
  let missedAll = 0;
  for (const w of work) {
    if (!w.planned) continue;
    const p = w.planned.getTime();
    if (p < from || p > end) continue;
    const e = m.get(w.module) || { due: 0, missed: 0 };
    e.due++;
    if (!w.done || (w.actual && w.actual.getTime() > p)) { e.missed++; missedAll++; }
    m.set(w.module, e);
  }
  return [...m.entries()]
    .map(([module, e]) => ({ module, due: e.due, missed: e.missed, sharePct: missedAll ? Math.round((e.missed / missedAll) * 100) : 0 }))
    .filter((x) => x.missed > 0)
    .sort((a, b) => b.missed - a.missed);
}

export type BoardPeriod = "week" | "lastweek" | "month" | "lastmonth";

export function periodRange(period: BoardPeriod, now: number): { from: number; to: number; label: string; prev: { from: number; to: number } } {
  const wk = istWeekStart(now);
  const mo = istMonthStart(now);
  const prevMonthStart = (start: number) => {
    const d = new Date(start + 330 * 60000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) - 330 * 60000;
  };
  switch (period) {
    case "lastweek": return { from: wk - 7 * 86400000, to: wk - 1, label: "Last week", prev: { from: wk - 14 * 86400000, to: wk - 7 * 86400000 - 1 } };
    case "month": return { from: mo, to: now, label: "This month", prev: { from: prevMonthStart(mo), to: mo - 1 } };
    case "lastmonth": { const lm = prevMonthStart(mo); return { from: lm, to: mo - 1, label: "Last month", prev: { from: prevMonthStart(lm), to: lm - 1 } }; }
    default: return { from: wk, to: now, label: "This week", prev: { from: wk - 7 * 86400000, to: wk - 1 } };
  }
}

// ───────────────────────── How the score is shown ─────────────────────────
// Sahil, 2026-10-29: our MIS writes these as minus — "work not done −20%",
// "work not done on time −10%". 0 is best, up to −5 is great, up to −10 is
// okay for the company, worse than −10 needs work.
export function neg(pct: number): string {
  const v = Math.round(pct * 10) / 10;
  return v === 0 ? "0%" : `−${v}%`;
}
export type ScoreBand = "great" | "okay" | "bad";
export function scoreBand(pct: number): ScoreBand {
  return pct <= 5 ? "great" : pct <= 10 ? "okay" : "bad";
}
export const BAND_TEXT: Record<ScoreBand, string> = { great: "text-[#15803D]", okay: "text-[#B45309]", bad: "text-[#DC2626]" };
export const BAND_BG: Record<ScoreBand, string> = { great: "bg-[#15803D]", okay: "bg-[#D97706]", bad: "bg-[#DC2626]" };
export const BAND_RING: Record<ScoreBand, string> = { great: "ring-[#15803D]", okay: "ring-[#D97706]", bad: "ring-[#DC2626]" };
export const SCORE_LEGEND = "0% best · up to −5% great · up to −10% okay · below −10% needs work";
