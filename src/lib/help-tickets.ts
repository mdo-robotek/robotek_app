/** Shape matches the approvals card's rows (src/components/PendingApprovalsCard.tsx). */
export interface HelpTicketsGroup {
  key: "help-tickets";
  title: string;
  href: string;
  count: number;
  oldestDays: number | null;
  late: number;
  action: string;
  samples: { label: string; sub: string }[];
}

const DONE_TICKET = new Set(["resolved", "closed"]);

/**
 * Help tickets where this user is the solver ("concern person") and the
 * ticket is not finished yet. Sahil, 2026-10-26: whoever a ticket is raised
 * to should see it on their own dashboard, not only on the Tickets page.
 */
export function helpTicketsFor(
  tickets: { title?: string; raised_by?: string; solver_person?: string; status?: string; created_at?: string; planned_resolution?: string }[],
  username: string,
  now: number = Date.now()
): HelpTicketsGroup | null {
  const me = username.trim().toLowerCase();
  if (!me) return null;
  const open = tickets
    .filter((t) => String(t.solver_person ?? "").trim().toLowerCase() === me)
    .filter((t) => !DONE_TICKET.has(String(t.status ?? "").trim().toLowerCase()))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  if (open.length === 0) return null;
  const age = (raw?: string) => {
    const t = new Date(raw || "").getTime();
    return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
  };
  const days = open.map((t) => age(t.created_at)).filter((d): d is number => d !== null);
  const late = open.filter((t) => {
    const due = new Date(t.planned_resolution || "").getTime();
    return Number.isFinite(due) && due < now;
  }).length;
  return {
    key: "help-tickets",
    title: "Help tickets",
    href: "/tickets?filter=tome",
    count: open.length,
    oldestDays: days.length ? Math.max(...days) : null,
    late,
    action: "Open",
    samples: open.slice(0, 3).map((t) => ({
      label: t.title || "Ticket",
      sub: t.raised_by ? `from ${t.raised_by}` : "",
    })),
  };
}
