import { NextResponse } from "next/server";
import { getChecklistsPaginated } from "@/lib/checklist-sheets";
import { ChecklistOccurrence } from "@/types/checklist";
import { getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { getIstDateString } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

// Daily checklist reminder (WhatsApp) — triggered by a systemd timer with
// GET /api/checklists/send-reminders?key=<CRON_SECRET>[&dry=1]
// Sends each user their overdue + today-due checklist occurrences.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key") || "";
    const secret = process.env.CRON_SECRET || "";
    if (!secret || key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const dry = searchParams.get("dry") === "1";

    const todayStr = getIstDateString();
    const [checklistPage, allUsers] = await Promise.all([
      getChecklistsPaginated(
        1, 100000, "", [], "All", "", "ADMIN",
        [], "", "", [], [], [], [], [], [],
        "due_date", "desc", "tasks"
      ),
      getUsers(),
    ]);
    const occurrences = (checklistPage.data || []) as ChecklistOccurrence[];

    const byUser: Record<string, { overdue: ChecklistOccurrence[]; today: ChecklistOccurrence[] }> = {};
    for (const c of occurrences) {
      if (!c.assigned_to || c.display_status === "Completed") continue;
      const due = (c.occurrence_due_date || c.due_date || "").slice(0, 10);
      if (!due || due > todayStr) continue;
      const bucket = (byUser[c.assigned_to] ||= { overdue: [], today: [] });
      if (due < todayStr) bucket.overdue.push(c);
      else bucket.today.push(c);
    }

    const fmt = (d: string) => {
      const [y, m, dd] = d.split("-");
      return `${dd}-${m}-${y.slice(2)}`;
    };
    const listLines = (items: ChecklistOccurrence[], withDue: boolean) => {
      const shown = items.slice(0, 5).map((c, i) => {
        const due = (c.occurrence_due_date || c.due_date || "").slice(0, 10);
        return `${i + 1}. ${c.task}${withDue && due ? ` (due ${fmt(due)})` : ""}`;
      });
      if (items.length > 5) shown.push(`...aur ${items.length - 5} tasks`);
      return shown.join("\n");
    };

    const results: { user: string; overdue: number; today: number; sent: boolean }[] = [];
    for (const [username, b] of Object.entries(byUser)) {
      if (b.overdue.length === 0 && b.today.length === 0) continue;
      const user = (allUsers as any[]).find(
        (u) => String(u.username || "").toLowerCase() === username.toLowerCase()
      );
      const entry = { user: username, overdue: b.overdue.length, today: b.today.length, sent: false };
      if (user && user.phone && !dry) {
        const parts = [`⏰ *Checklist Reminder*`, `━━━━━━━━━━━━━━━━━`, `Namaste ${username} ji,`];
        if (b.overdue.length) {
          parts.push(`\n🔴 *Overdue (${b.overdue.length}):*`);
          parts.push(listLines(b.overdue, true));
        }
        if (b.today.length) {
          parts.push(`\n🟡 *Aaj due (${b.today.length}):*`);
          parts.push(listLines(b.today, false));
        }
        parts.push(`\n👉 ERP kholkar complete karein: https://robotekindia.app/checklists`);
        parts.push(`— Sarthi`);
        try {
          const r = await sendWhatsAppMessage(user.phone, parts.join("\n"));
          entry.sent = !!(r as any)?.success;
        } catch (err) {
          console.error(`[Checklist Reminder] send failed for ${username}:`, err);
        }
      }
      results.push(entry);
    }

    return NextResponse.json({
      date: todayStr,
      dry,
      usersWithPending: results.length,
      sent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error: any) {
    console.error("Checklist Reminder Error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
