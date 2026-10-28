import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers } from "@/lib/google-sheets";
import { collectWork, makeNameResolver } from "@/lib/score-misses";
import { getTickets } from "@/lib/ticket-sheets";
import { getRevisionIndex } from "@/lib/delegation-sheets";
import {
  buildLateByPerson, canSeeActionBoard, companyScore, istMonthStart, istWeekStart, ticketFollowUps,
} from "@/lib/action-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

/**
 * GET /api/action-board
 * Company score (this week / this month, target 0), everyone who is late
 * right now with what and their phone, help tickets to follow up (number,
 * person, days only — never the content), and date-change asks waiting.
 */
export async function GET() {
  const session = await auth();
  const me = session?.user as { username?: string; role?: string; designation?: string } | undefined;
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const users = await getUsers();
    const meRow = users.find((u) => String(u.username || "").trim().toLowerCase() === String(me.username || "").trim().toLowerCase());
    if (!canSeeActionBoard({ ...me, designation: me.designation || meRow?.designation, role_name: meRow?.role_name } as any)) {
      return NextResponse.json({ error: "Only for Admin, EA and Process Coordinator" }, { status: 403 });
    }

    const [{ work, failedSources }, tickets, rev] = await Promise.all([
      collectWork(),
      getTickets().catch(() => []),
      getRevisionIndex().catch(() => new Map()),
    ]);
    const now = Date.now();
    const active = users.filter((u) => u.isActive !== false && String(u.username || "").trim());
    const resolve = makeNameResolver(active.map((u) => String(u.username).trim()));
    const byName = new Map(active.map((u) => [String(u.username).trim().toLowerCase(), u]));
    const phoneOf = (name: string) => {
      const hit = resolve(name)[0];
      return hit ? String(byName.get(hit.toLowerCase())?.phone || "").trim() : "";
    };

    const week = istWeekStart(now);
    const month = istMonthStart(now);
    const people = buildLateByPerson(work, now, resolve, byName as any);
    const ticketsToChase = ticketFollowUps(tickets as any, now, phoneOf);
    let datesAsked = 0;
    for (const v of (rev as Map<string, any>).values()) if (v?.pending) datesAsked++;

    return NextResponse.json({
      generatedAt: new Date(now).toISOString(),
      score: {
        week: companyScore(work, week, week + 7 * 86400000, now, "This week"),
        lastWeek: companyScore(work, week - 7 * 86400000, week - 1, now, "Last week"),
        month: companyScore(work, month, now, now, "This month"),
      },
      lateNow: people.reduce((a, p) => a + p.late, 0),
      people,
      tickets: ticketsToChase,
      datesAsked,
      failedSources,
    });
  } catch (error) {
    console.error("action-board failed", error);
    return NextResponse.json({ error: "Couldn't load the action board" }, { status: 500 });
  }
}
