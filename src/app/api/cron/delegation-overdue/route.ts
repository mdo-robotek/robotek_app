import { NextRequest, NextResponse } from "next/server";
import { delegationService, getRevisionIndex } from "@/lib/delegation-sheets";
import { getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { dueYesterdayNotDone, NEED_REVISION } from "@/lib/delegation-revisions";
import { getAppBaseUrl } from "@/lib/app-url";
import { shortIst } from "@/lib/ist-format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Every morning (Sahil, 2026-10-26): a task due yesterday that is still not
 * done → the person gets a WhatsApp with a link to ask for a new date. Only
 * the new date is asked — no reason. Approval stays with the task giver / EA.
 *
 * Runs once a day from the server's crontab:
 *   curl -s http://127.0.0.1:3000/api/cron/delegation-overdue
 * Only "due yesterday" tasks are picked, so one run a day sends one message
 * per missed date. Add ?dry=1 to see who would get a message without sending.
 */
function isLocalRequest(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  try {
    const [tasks, index, users] = await Promise.all([delegationService.getAll(), getRevisionIndex(), getUsers()]);
    const phoneOf = new Map(users.filter((u) => u.isActive !== false).map((u) => [String(u.username).trim().toLowerCase(), u.phone]));

    const missed = dueYesterdayNotDone(tasks).filter((t) => {
      // Already asked for a new date and waiting? Don't ask again.
      const pending = t.status === NEED_REVISION ? index.get(String(t.id))?.pending : null;
      return !pending;
    });

    // One message per person, listing all their missed tasks.
    const byPerson = new Map<string, typeof missed>();
    for (const t of missed) {
      const who = String(t.assigned_to || "").trim();
      if (!who) continue;
      if (!byPerson.has(who)) byPerson.set(who, []);
      byPerson.get(who)!.push(t);
    }

    const base = getAppBaseUrl();
    const report: { person: string; tasks: number; sent: boolean; reason?: string }[] = [];
    for (const [person, list] of byPerson) {
      const phone = phoneOf.get(person.toLowerCase());
      if (!phone) { report.push({ person, tasks: list.length, sent: false, reason: "no phone / inactive" }); continue; }
      const lines = list.slice(0, 10).map((t) =>
        `• ${t.title} (due ${shortIst(t.due_date)})\n  New date: ${base}/delegations?ask=${encodeURIComponent(String(t.id))}`
      );
      const more = list.length > 10 ? `\n…and ${list.length - 10} more on the Delegations page.` : "";
      const text =
        `⏰ *Task not done yet*\n` +
        `${list.length === 1 ? "This task" : `These ${list.length} tasks`} passed the due date. Tap the link and pick the new date you will finish by.\n\n` +
        `${lines.join("\n\n")}${more}`;
      if (dry) { report.push({ person, tasks: list.length, sent: false, reason: "dry run" }); continue; }
      const res = await sendWhatsAppMessage(phone, text).catch(() => null);
      report.push({ person, tasks: list.length, sent: !!res && (res as { success?: boolean }).success !== false });
    }

    return NextResponse.json({ missedTasks: missed.length, people: report.length, report });
  } catch (error) {
    console.error("delegation-overdue failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
