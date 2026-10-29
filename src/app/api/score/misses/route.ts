import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers } from "@/lib/google-sheets";
import { collectWork, makeNameResolver, toMisses, MissItem } from "@/lib/score-misses";

export const dynamic = "force-dynamic";

// GET /api/score/misses?from=YYYY-MM-DD&to=YYYY-MM-DD
// Per employee: the tasks / FMS steps that hurt their score in the period.
// Admin and EA see everyone (same rule as /api/score); others see only themselves.
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = session.user as { username?: string; role?: string } | undefined;
  const role = String(me?.role || "").toUpperCase();
  const isPrivileged = role === "ADMIN" || role === "EA";

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const istToday = new Date(now.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
  const fromStr = searchParams.get("from") || `${istToday.slice(0, 8)}01`;
  const toStr = searchParams.get("to") || istToday;
  const from = new Date(`${fromStr}T00:00:00+05:30`);
  const to = new Date(`${toStr}T23:59:59.999+05:30`);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  try {
    const [users, { work, failedSources }] = await Promise.all([getUsers(), collectWork()]);
    const active = users.filter((u) => u.isActive !== false && String(u.username || "").trim());
    const resolve = makeNameResolver(active.map((u) => String(u.username).trim()));

    // Everything due in range per person (for "missed X of Y"), and the misses.
    const totals = new Map<string, number>();
    work.forEach((w) => {
      if (!w.planned || w.planned < from || w.planned > to) return;
      resolve(w.responsible).forEach((u) => totals.set(u, (totals.get(u) || 0) + 1));
    });

    const misses = toMisses(work, from, to, now);
    const byUser = new Map<string, MissItem[]>();
    const unmatched = new Map<string, number>();
    misses.forEach(({ _raw, ...m }) => {
      void _raw;
      const owners = resolve(m.responsible);
      if (owners.length === 0) {
        const key = m.responsible || `(no doer set) ${m.module}`;
        unmatched.set(key, (unmatched.get(key) || 0) + 1);
        return;
      }
      owners.forEach((u) => byUser.set(u, [...(byUser.get(u) || []), m]));
    });

    const people = active
      .filter((u) => isPrivileged || String(u.username).trim().toLowerCase() === String(me?.username || "").trim().toLowerCase())
      .map((u) => {
        const username = String(u.username).trim();
        const items = (byUser.get(username) || []).sort((a, b) => b.delayHours - a.delayHours);
        const byModule: Record<string, number> = {};
        items.forEach((i) => { byModule[i.module] = (byModule[i.module] || 0) + 1; });
        return {
          username,
          designation: u.designation || "",
          department: u.department || "",
          due: totals.get(username) || 0,
          missed: items.length,
          notDone: items.filter((i) => i.kind === "not_done").length,
          late: items.filter((i) => i.kind === "late").length,
          byModule,
          items,
        };
      })
      .sort((a, b) => b.missed - a.missed || a.username.localeCompare(b.username));

    return NextResponse.json(
      {
        from: fromStr,
        to: toStr,
        people,
        unmatched: isPrivileged
          ? Array.from(unmatched.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
          : [],
        failedSources,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Score misses error:", error);
    return NextResponse.json({ error: "Failed to build the miss report" }, { status: 500 });
  }
}
