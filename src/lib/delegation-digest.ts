/**
 * Delegation date changes — who is told, and when (Sahil, 2026-10-27).
 *
 *  - Every "new date" ask goes to the EA (Rachit) on WhatsApp — not to the
 *    task giver. The EA approves or says no.
 *  - The EA's own tasks: the EA sets the new date himself (no approval).
 *  - Management (Sahil Sir, Nikita Mam, Aman Sir) get NO WhatsApp during the
 *    day for delegations. Their 9:15 AM morning message lists, for the tasks
 *    they gave: dates that moved since yesterday morning, and tasks marked done.
 *  - The EA's morning message lists every date change still waiting for him.
 */
import { movedDate, NEED_REVISION, type RevisionInfo, type RevisionRow } from "./delegation-revisions";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export const MANAGEMENT_USERNAMES = new Set(["sahil sir", "nikita mam", "aman sir"]);
export const isManagement = (username: unknown) => MANAGEMENT_USERNAMES.has(norm(username));

/** EA = role "EA" or designation "EA" / "Executive Assistant" in the Users sheet. */
export function isEaUser(u: { role_name?: string; role?: string; designation?: string } | null | undefined): boolean {
  if (!u) return false;
  const role = norm(u.role_name ?? u.role);
  const des = norm(u.designation);
  return role === "ea" || des === "ea" || des === "executive assistant";
}

export interface DigestTask {
  id?: string;
  title?: string;
  description?: string;
  assigned_by?: string;
  assigned_to?: string;
  due_date?: string;
  status?: string;
}

const t = (v: unknown) => {
  const n = Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

const shortDate = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const clip = (s: unknown, n = 60) => {
  const x = String(s ?? "").replace(/\s+/g, " ").trim();
  return x.length > n ? x.slice(0, n - 1) + "…" : x;
};

/** Open "new date" asks — for the EA's morning list. */
export function waitingAsks(tasks: DigestTask[], index: Map<string, RevisionInfo>) {
  const out: { id: string; title: string; doer: string; due: number | null; asked: number | null }[] = [];
  for (const task of tasks) {
    if (task.status !== NEED_REVISION) continue;
    const info = index.get(String(task.id));
    if (!info?.pending) continue;
    out.push({
      id: String(task.id),
      title: clip(task.title),
      doer: String(task.assigned_to || ""),
      due: t(task.due_date),
      asked: t(info.pending.requested_due_date),
    });
  }
  return out.sort((a, b) => (a.asked ?? 0) - (b.asked ?? 0));
}

/** For a task giver: dates that moved and tasks marked done since `since`. */
export function giverYesterday(giver: string, tasks: DigestTask[], rows: RevisionRow[], since: number) {
  const me = norm(giver);
  const byId = new Map(tasks.map((x) => [String(x.id), x]));
  const moved: { title: string; doer: string; from: number | null; to: number | null; how: string }[] = [];
  const done: { title: string; doer: string }[] = [];
  const doneSeen = new Set<string>();
  for (const r of rows) {
    const at = t(r.created_at);
    if (at == null || at < since) continue;
    const task = byId.get(String(r.delegation_id));
    if (!task || norm(task.assigned_by) !== me || norm(task.assigned_to) === me) continue;
    if (movedDate(r)) {
      const reason = String(r.reason || "");
      const how = /own task/i.test(reason) ? "set by EA" : (reason.match(/approved by (.+)$/i)?.[1] ? `approved by ${reason.match(/approved by (.+)$/i)![1]}` : "");
      moved.push({ title: clip(task.title, 50), doer: String(task.assigned_to || ""), from: t(r.old_due_date), to: t(r.new_due_date), how });
    }
    if (norm(r.new_status) === "completed" && !doneSeen.has(String(r.delegation_id))) {
      doneSeen.add(String(r.delegation_id));
      done.push({ title: clip(task.title, 50), doer: String(task.assigned_to || "") });
    }
  }
  return { moved, done };
}

export interface ExtraSection {
  title: string;
  body: string;
}

const MAX = 10;
const more = (n: number) => (n > MAX ? `\n…and ${n - MAX} more on the Delegations page` : "");

export function eaSection(asks: ReturnType<typeof waitingAsks>, baseUrl: string): ExtraSection | null {
  if (!asks.length) return null;
  const lines = asks.slice(0, MAX).map(
    (a) =>
      `• ${a.title} — ${a.doer}\n  ${a.due ? shortDate(a.due) : "?"} → asks ${a.asked ? shortDate(a.asked) : "?"}\n  Open: ${baseUrl}/delegations?task=${encodeURIComponent(a.id)}`
  );
  return { title: `📅 DATE CHANGES TO APPROVE — ${asks.length}`, body: lines.join("\n") + more(asks.length) };
}

export function giverSections(y: ReturnType<typeof giverYesterday>): ExtraSection[] {
  const out: ExtraSection[] = [];
  if (y.moved.length) {
    const lines = y.moved.slice(0, MAX).map(
      (m) => `• ${m.title} — ${m.doer}: ${m.from ? shortDate(m.from) : "?"} → ${m.to ? shortDate(m.to) : "?"}${m.how ? ` (${m.how})` : ""}`
    );
    out.push({ title: `🔁 DATES CHANGED SINCE YESTERDAY — ${y.moved.length}`, body: lines.join("\n") + more(y.moved.length) });
  }
  if (y.done.length) {
    const lines = y.done.slice(0, MAX).map((d) => `• ${d.title} — ${d.doer}`);
    out.push({ title: `✅ MARKED DONE SINCE YESTERDAY — ${y.done.length}`, body: lines.join("\n") + more(y.done.length) });
  }
  return out;
}
