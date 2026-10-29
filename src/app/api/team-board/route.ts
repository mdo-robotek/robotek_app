import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers } from "@/lib/google-sheets";
import { collectWork, makeNameResolver } from "@/lib/score-misses";
import {
  canSeeActionBoard, companyScore, istWeekStart, modulePull, periodRange, personScores, type BoardPeriod,
} from "@/lib/action-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

/** GET /api/team-board?period=week|lastweek|month|lastmonth — Performance Board data. */
export async function GET(request: Request) {
  const session = await auth();
  const me = session?.user as { username?: string; role?: string; designation?: string } | undefined;
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const users = await getUsers();
    const meRow = users.find((u) => String(u.username || "").trim().toLowerCase() === String(me.username || "").trim().toLowerCase());
    if (!canSeeActionBoard({ ...me, designation: me.designation || meRow?.designation } as any)) {
      return NextResponse.json({ error: "Only for Admin, EA and Process Coordinator" }, { status: 403 });
    }
    const p = (new URL(request.url).searchParams.get("period") || "week") as BoardPeriod;
    const now = Date.now();
    const range = periodRange(["week", "lastweek", "month", "lastmonth"].includes(p) ? p : "week", now);
    const { work, failedSources } = await collectWork();
    const active = users.filter((u) => u.isActive !== false && String(u.username || "").trim());
    const resolve = makeNameResolver(active.map((u) => String(u.username).trim()));
    const people = personScores(work, range.from, range.to, now, resolve, active.map((u) => ({
      username: String(u.username).trim(), designation: u.designation, department: u.department, image_url: u.image_url,
    })));
    // Company trend: last 6 weeks, both scores together
    const wk = istWeekStart(now);
    const trend = Array.from({ length: 6 }, (_, i) => {
      const from = wk - (5 - i) * 7 * 86400000;
      const s = companyScore(work, from, from + 7 * 86400000 - 1, now, "");
      const d = new Date(from + 330 * 60000);
      return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), notDonePct: s.notDonePct, notOnTimePct: s.notOnTimePct, totalPct: s.totalPct, due: s.due };
    });
    return NextResponse.json({
      period: range.label,
      company: companyScore(work, range.from, range.to, now, range.label),
      previous: companyScore(work, range.prev.from, range.prev.to, now, "Before"),
      people,
      pull: modulePull(work, range.from, range.to, now),
      trend,
      failedSources,
    });
  } catch (error) {
    console.error("team-board failed", error);
    return NextResponse.json({ error: "Couldn't load the board" }, { status: 500 });
  }
}
