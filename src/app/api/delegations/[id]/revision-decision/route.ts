import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { delegationService, addDelegationRevision, getRevisionIndex } from "@/lib/delegation-sheets";
import { getUserByUsernameOrEmail, getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { canDecide, NEED_REVISION } from "@/lib/delegation-revisions";
import { getAppBaseUrl } from "@/lib/app-url";
import { shortIst } from "@/lib/ist-format";

export const dynamic = "force-dynamic";

/**
 * Approve or say no to a "new date" ask (Sahil, 2026-10-26).
 * Body: { decision: "approve" | "reject", note?: string }
 * Approve: the due date moves to the asked date (this counts as one more
 * revision, R1/R2/...). No: the old date stays. Either way the task goes
 * back to "Pending" and the person doing it gets a WhatsApp.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const me = session?.user as { username?: string; role?: string } | undefined;
    if (!me?.username) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const decision = body?.decision === "approve" ? "approve" : body?.decision === "reject" ? "reject" : "";
    const note = String(body?.note ?? "").trim().slice(0, 300);
    if (!decision) return NextResponse.json({ error: "Choose Approve or Not approve." }, { status: 400 });

    const all = await delegationService.getAll();
    const task = all.find((d) => String(d.id) === String(id));
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const meRow = (await getUsers()).find((u) => String(u.username).trim().toLowerCase() === me.username!.trim().toLowerCase());
    const decider = { username: me.username, role: me.role, designation: meRow?.designation || "" };
    if (!canDecide(decider, task)) {
      const who = task.assigned_by && task.assigned_by !== task.assigned_to ? `${task.assigned_by} or EA` : "EA or an admin";
      return NextResponse.json({ error: `Only ${who} can approve this date change.` }, { status: 403 });
    }

    const pending = task.status === NEED_REVISION ? (await getRevisionIndex()).get(String(id))?.pending : null;
    if (!pending) return NextResponse.json({ error: "There is no new-date request waiting on this task." }, { status: 409 });

    const now = new Date().toISOString();
    const approved = decision === "approve";
    const newDue = approved ? pending.requested_due_date : task.due_date;
    const updated = { ...task, status: "Pending", due_date: newDue, updated_at: now };
    await delegationService.update(String(id), updated);
    await addDelegationRevision({
      id: `REV-${Date.now()}`,
      delegation_id: String(id),
      old_status: NEED_REVISION,
      new_status: "Pending",
      old_due_date: task.due_date || "",
      new_due_date: newDue || "",
      reason: `${approved ? "New date approved" : "New date not approved"} by ${me.username}${note ? `: ${note}` : ""}`,
      created_at: now,
      evidence_urls: "",
      requested_due_date: "",
    });

    void (async () => {
      try {
        const doer = await getUserByUsernameOrEmail(task.assigned_to);
        if (!doer?.phone) return;
        const text = approved
          ? `✅ *New date approved*\nFinish by *${shortIst(newDue)}*.\n\n📌 ${task.title}${note ? `\n📝 ${note}` : ""}\n\n${getAppBaseUrl()}/delegations?task=${encodeURIComponent(String(id))}`
          : `⚠️ *New date not approved*\nThe date stays *${shortIst(task.due_date)}*.\n\n📌 ${task.title}${note ? `\n📝 ${note}` : ""}\n\n${getAppBaseUrl()}/delegations?task=${encodeURIComponent(String(id))}`;
        await sendWhatsAppMessage(doer.phone, text);
      } catch (err) {
        console.error("Decision WhatsApp failed:", err);
      }
    })();

    return NextResponse.json({ ok: true, delegation: updated });
  } catch (error) {
    console.error("revision-decision failed", error);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
}
