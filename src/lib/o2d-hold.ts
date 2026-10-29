/**
 * Hold and Cancel details for an O2D order (Sahil, 2026-10-29).
 *
 * The sheet has one "hold" and one "cancelled" cell per row. They used to hold
 * only the time ("2026-10-29T06:30:00.000Z"). We now keep the reason, the date
 * to check again and who did it in the same cell, separated by "|":
 *
 *   2026-10-29T06:30:00.000Z|Waiting for payment|2026-11-02|SHIVANI
 *
 * Every old check is "is the cell filled?", so nothing else changes.
 */
export interface HoldInfo {
  since: Date | null;
  reason: string;
  checkOn: string; // YYYY-MM-DD, "" if not set
  by: string;
}

export function parseHold(v: unknown): HoldInfo | null {
  const s = String(v ?? "").trim();
  if (!s || ["no", "false", "0", "-"].includes(s.toLowerCase())) return null;
  const [a = "", reason = "", checkOn = "", by = ""] = s.split("|");
  const d = new Date(a);
  return { since: isNaN(d.getTime()) ? null : d, reason: reason.trim(), checkOn: checkOn.trim(), by: by.trim() };
}

export function makeHold(reason: string, checkOn: string, by: string, now = new Date()): string {
  const clean = (x: string) => String(x || "").replace(/[|\n\r]+/g, " ").trim();
  return [now.toISOString(), clean(reason), clean(checkOn), clean(by)].join("|");
}

/** Today in India as YYYY-MM-DD. */
export function istToday(now = Date.now()): string {
  return new Date(now + 330 * 60000).toISOString().slice(0, 10);
}

/** "due" = check date is today, "overdue" = check date has passed. */
export function holdCheckState(h: HoldInfo | null, now = Date.now()): "none" | "later" | "due" | "overdue" {
  if (!h || !h.checkOn) return "none";
  const t = istToday(now);
  return h.checkOn < t ? "overdue" : h.checkOn === t ? "due" : "later";
}
