/**
 * "+ New" — the forms people fill most, two taps from any screen.
 *
 * Sahil, 2026-10-26: people should not have to go to a page, look around and
 * then find the form. Management mostly raises delegations and indents (they
 * resolve tickets, they don't raise them); the team raises tickets, leave,
 * and delegations / indents when their page access allows it.
 *
 * Each href opens the form directly. `n` (a timestamp) is added at click time
 * so the form opens again even when you are already on that page.
 */

export type QuickNewKey = "delegation" | "indent" | "ticket" | "leave";

export interface QuickNewItem {
  key: QuickNewKey;
  label: string;
  sub: string;
  href: string;
  pageId: string; // page permission id in the Users sheet
}

export const QUICK_NEW_ITEMS: Record<QuickNewKey, QuickNewItem> = {
  delegation: { key: "delegation", label: "Delegation", sub: "Give a task to someone", href: "/delegations?new=1", pageId: "delegations" },
  indent: { key: "indent", label: "Indent", sub: "Ask purchase for an item", href: "/i2r?new=1", pageId: "i2r" },
  ticket: { key: "ticket", label: "Help Ticket", sub: "Report a problem, get help", href: "/tickets?action=new", pageId: "tickets" },
  leave: { key: "leave", label: "Leave", sub: "Apply for leave", href: "/leave?open=apply", pageId: "leave" },
};

/** Management sees only what they actually raise. Matched on username. */
const MANAGEMENT = new Set(["sahil sir", "nikita mam", "aman sir"]);

const MANAGEMENT_ORDER: QuickNewKey[] = ["delegation", "indent"];
const TEAM_ORDER: QuickNewKey[] = ["ticket", "leave", "delegation", "indent"];

export function quickNewFor(user: {
  username?: string;
  isAdmin?: boolean;
  permissions?: string[];
}): QuickNewItem[] {
  const name = String(user.username ?? "").trim().toLowerCase();
  if (MANAGEMENT.has(name)) return MANAGEMENT_ORDER.map((k) => QUICK_NEW_ITEMS[k]);

  const perms = new Set((user.permissions ?? []).map((p) => String(p).toLowerCase()));
  // Same rule as the sidebar: a form shows only if its page opens for this person.
  const allowed = (item: QuickNewItem) => (perms.size > 0 ? perms.has(item.pageId) : !!user.isAdmin);
  return TEAM_ORDER.map((k) => QUICK_NEW_ITEMS[k]).filter(allowed);
}

/** Href with a fresh `n` so the target page reopens the form even if already there. */
export function quickNewHref(item: QuickNewItem, now: number = Date.now()): string {
  return `${item.href}&n=${now}`;
}

/** Tomorrow 6 PM in the browser's local time, as a datetime-local value. */
export function defaultDueLocal(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
