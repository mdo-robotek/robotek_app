/**
 * Delegation date changes — ask, approve, count.
 *
 * Sahil, 2026-10-26:
 *  - Changing a task's date needs approval. The person doing the task only
 *    asks for a new date ("I will finish by ..."). No reason is asked —
 *    "we don't need excuses".
 *  - The person who gave the task (assigned_by) approves or says no.
 *  - Every task shows how many times its date moved: R1, R2, R3...
 *  - The morning after a due date passes, the person gets a WhatsApp link
 *    to ask for a new date (see /api/cron/delegation-overdue).
 *
 * Storage: sheet "delegation_revision_history", one row per status change.
 *   A id | B delegation_id | C old_status | D new_status | E old_due_date |
 *   F new_due_date | G reason | H created_at | I evidence_urls |
 *   J requested_due_date   (new — only on "asked for a new date" rows)
 *
 * An "ask" row keeps the due date unchanged (E = F) and puts the wanted date
 * in J. Approval writes a normal row where the date really moves (E -> F).
 * So "how many times the date moved" = rows where E and F differ; this also
 * counts the old rows from before approvals existed.
 */

export const NEED_REVISION = "Need Revision";

export interface RevisionRow {
  id?: string;
  delegation_id: string;
  old_status: string;
  new_status: string;
  old_due_date: string;
  new_due_date: string;
  reason: string;
  created_at: string;
  evidence_urls?: string;
  requested_due_date?: string;
}

export interface PendingRequest {
  requested_due_date: string;
  asked_at: string;
  note: string;
}

export interface RevisionInfo {
  count: number;
  pending: PendingRequest | null;
}

const ts = (v: string) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
};

const sameMoment = (a: string, b: string) => {
  const ta = ts(a), tb = ts(b);
  if (ta && tb) return ta === tb;
  return String(a || "").trim() === String(b || "").trim();
};

export function rowFromSheet(r: unknown[]): RevisionRow {
  const s = (i: number) => String(r[i] ?? "");
  return {
    id: s(0),
    delegation_id: s(1),
    old_status: s(2),
    new_status: s(3),
    old_due_date: s(4),
    new_due_date: s(5),
    reason: s(6),
    created_at: s(7),
    evidence_urls: s(8),
    requested_due_date: s(9),
  };
}

/** True when this row really moved the due date. */
export function movedDate(r: RevisionRow): boolean {
  return !!String(r.old_due_date || "").trim() && !!String(r.new_due_date || "").trim() && !sameMoment(r.old_due_date, r.new_due_date);
}

/**
 * Per task: how many times the date moved, and the open "new date" ask (if
 * the latest row for the task is an ask). The caller should also check the
 * task's own status is still "Need Revision".
 */
export function buildRevisionIndex(rows: RevisionRow[]): Map<string, RevisionInfo> {
  const byId = new Map<string, RevisionRow[]>();
  for (const r of rows) {
    const id = String(r.delegation_id || "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(r);
  }
  const out = new Map<string, RevisionInfo>();
  for (const [id, list] of byId) {
    // Sheet order is append order; created_at breaks ties when rows were edited.
    const sorted = list
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (ts(a.r.created_at) - ts(b.r.created_at)) || (a.i - b.i))
      .map((x) => x.r);
    const count = sorted.filter(movedDate).length;
    const last = sorted[sorted.length - 1];
    const pending =
      last && last.new_status === NEED_REVISION && String(last.requested_due_date || "").trim()
        ? { requested_due_date: String(last.requested_due_date), asked_at: last.created_at, note: last.reason || "" }
        : null;
    out.set(id, { count, pending });
  }
  return out;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const MANAGEMENT = new Set(["sahil sir", "nikita mam", "aman sir"]);

/**
 * Who may approve a date change:
 *  - the person who gave the task, and
 *  - EA (designation "EA") — EA's job is to maintain delegations (Sahil, 2026-10-26).
 * If someone gave the task to themselves, EA or an admin decides.
 * Never the person doing the task.
 */
export function canDecide(
  user: { username?: string; role?: string; designation?: string },
  task: { assigned_by?: string; assigned_to?: string }
): boolean {
  const me = norm(user.username);
  if (!me) return false;
  const to = norm(task.assigned_to);
  if (me === to) return false;
  if (norm(user.designation) === "ea") return true;
  const by = norm(task.assigned_by);
  if (by && by !== to) { if (me === by) return true; }
  const role = norm(user.role);
  return role === "admin" || role === "ea";
}

/** Should this person see the ask in their "Waiting for you" card? */
export function isDecider(
  user: { username?: string; designation?: string },
  task: { assigned_by?: string; assigned_to?: string }
): boolean {
  const me = norm(user.username);
  if (!me || me === norm(task.assigned_to)) return false;
  if (norm(user.designation) === "ea") return true;
  // Management doesn't get these in their list — the EA handles them (Sahil, 2026-10-27).
  if (MANAGEMENT.has(me)) return false;
  const by = norm(task.assigned_by);
  return !!by && by !== norm(task.assigned_to) && me === by;
}

/** "R1", "R2"... and how loud the badge should be. */
export function revisionTone(count: number): "none" | "grey" | "amber" | "red" {
  if (count <= 0) return "none";
  if (count === 1) return "grey";
  if (count === 2) return "amber";
  return "red";
}

/** Tasks whose due date was yesterday (India time) and are still not done. */
const DONE = new Set(["completed", "approved"]);
export function istDay(t: number): string {
  return new Date(t + 330 * 60000).toISOString().slice(0, 10);
}
export function dueYesterdayNotDone<T extends { due_date?: string; status?: string }>(
  tasks: T[],
  now: number = Date.now()
): T[] {
  const yesterday = istDay(now - 86400000);
  return tasks.filter((t) => {
    if (DONE.has(norm(t.status)) || norm(t.status) === "hold") return false;
    const due = ts(String(t.due_date || ""));
    return !!due && istDay(due) === yesterday;
  });
}
