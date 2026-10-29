import { NextRequest, NextResponse } from "next/server";
import { delegationService, addDelegationRevision } from "@/lib/delegation-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUserByUsernameOrEmail, getUsers } from "@/lib/google-sheets";
import { isEaUser, isManagement } from "@/lib/delegation-digest";
import { getRevisionIndex } from "@/lib/delegation-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";
import { NEED_REVISION } from "@/lib/delegation-revisions";
import { getAppBaseUrl } from "@/lib/app-url";
import { shortIst } from "@/lib/ist-format";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing delegation ID" }, { status: 400 });

    const formData = await req.formData();
    const newStatus = formData.get("status") as string;
    const reason = formData.get("reason") as string || "";
    const revisedDueDate = formData.get("revised_due_date") as string || "";
    const evidenceFile = formData.get("evidence") as File;

    const allDelegations = await delegationService.getAll();
    const current = allDelegations.find(d => String(d.id) === String(id));

    if (!current) {
      return NextResponse.json({ error: "Delegation not found" }, { status: 404 });
    }

    // "Need Revision" = asking for a new date (Sahil, 2026-10-26). The date
    // does NOT change here — it changes only when the task giver approves
    // (see ../revision-decision). No reason is asked.
    if (newStatus === NEED_REVISION) {
      const wanted = Date.parse(revisedDueDate);
      if (!revisedDueDate || !Number.isFinite(wanted)) {
        return NextResponse.json({ error: "Pick the new date you will finish by." }, { status: 400 });
      }
      if (wanted <= Date.now()) {
        return NextResponse.json({ error: "The new date must be later than now." }, { status: 400 });
      }
      const requestedIso = new Date(wanted).toISOString();
      const users = await getUsers().catch(() => []);
      const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
      const doerUser = users.find((u) => norm(u.username) === norm(current.assigned_to));

      // EA's own task (Sahil, 2026-10-27): the EA sets the new date himself.
      // No approval and no WhatsApp; management sees it in the morning message.
      if (isEaUser(doerUser as any)) {
        const nowIso = new Date().toISOString();
        const moved = { ...current, status: "Pending", due_date: requestedIso, updated_at: nowIso };
        await delegationService.update(id, moved);
        await addDelegationRevision({
          id: `REV-${Date.now()}`,
          delegation_id: id,
          old_status: current.status || "",
          new_status: "Pending",
          old_due_date: current.due_date || "",
          new_due_date: requestedIso,
          reason: "New date set by EA (own task)",
          created_at: nowIso,
          evidence_urls: "",
          requested_due_date: "",
        });
        return NextResponse.json({ message: "New date saved", delegation: moved });
      }

      const asked = { ...current, status: NEED_REVISION, updated_at: new Date().toISOString() };
      await delegationService.update(id, asked);
      await addDelegationRevision({
        id: `REV-${Date.now()}`,
        delegation_id: id,
        old_status: current.status || "",
        new_status: NEED_REVISION,
        old_due_date: current.due_date || "",
        new_due_date: current.due_date || "",
        reason: "",
        created_at: new Date().toISOString(),
        evidence_urls: "",
        requested_due_date: requestedIso,
      });

      // The ask goes to the EA (Rachit) — not to the task giver (Sahil, 2026-10-27).
      void (async () => {
        try {
          const eas = users.filter((u) => isEaUser(u as any) && u.isActive !== false && u.phone && norm(u.username) !== norm(current.assigned_to));
          if (!eas.length) return;
          const before = (await getRevisionIndex().catch(() => new Map())).get(String(id))?.count || 0;
          const desc = String(current.description || "").replace(/\s+/g, " ").trim();
          const text =
            `📅 *New date asked — please approve*\n\n` +
            `📌 *${current.title}*\n` +
            (desc ? `${desc.length > 140 ? desc.slice(0, 139) + "…" : desc}\n` : "") +
            `\nGiven by: ${current.assigned_by || "—"}\nDoing: ${current.assigned_to}\n` +
            `Due now: ${shortIst(current.due_date)}\nAsks for: *${shortIst(requestedIso)}*\n` +
            (before > 0 ? `Date already moved ${before} time${before === 1 ? "" : "s"} before\n` : "") +
            `\nApprove or say no: ${getAppBaseUrl()}/delegations?task=${encodeURIComponent(id)}`;
          for (const ea of eas) await sendWhatsAppMessage(String(ea.phone), text);
        } catch (err) {
          console.error("New-date WhatsApp failed:", err);
        }
      })();

      return NextResponse.json({ message: "New date asked — waiting for approval", delegation: asked });
    }

    let evidenceUrl = "";
    if (evidenceFile && evidenceFile.size > 0) {
      const fileId = await uploadFileToDrive(evidenceFile);
      evidenceUrl = fileId || "";
    }

    const updatedDelegation = {
      ...current,
      status: newStatus,
      due_date: revisedDueDate || current.due_date,
      updated_at: new Date().toISOString()
    };

    await delegationService.update(id, updatedDelegation);

    const payloadRevision = {
      id: `REV-${Date.now()}`,
      delegation_id: id,
      old_status: current.status || '',
      new_status: newStatus || '',
      old_due_date: current.due_date || '',
      new_due_date: revisedDueDate || current.due_date || '',
      reason: reason || '',
      created_at: new Date().toISOString(),
      evidence_urls: evidenceUrl || ''
    };

    await addDelegationRevision(payloadRevision);

    void (async () => {
      try {
        const formattedNow = formatDate(new Date().toISOString());
        const message = `🔄 *Delegation Status Updated*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${current.title}\n🎯 *Priority:* ${current.priority}\n👤 *Assigned To:* ${current.assigned_to}\n👨‍💼 *Assigned By:* ${current.assigned_by}\n📉 *From:* ${current.status}\n📈 *To:* ${newStatus}\n📝 *Reason:* ${reason || "N/A"}\n⏱️ *Updated At:* ${formattedNow}`;
        
        // Management gets these in the 9:15 AM message instead (Sahil, 2026-10-27).
        const parties = [current.assigned_to, current.assigned_by].filter((u) => u && !isManagement(u));
        const uniqueParties = [...new Set(parties)];

        for (const username of uniqueParties) {
          if (!username) continue;
          const user = await getUserByUsernameOrEmail(username);
          if (user && user.phone) {
            await sendWhatsAppMessage(user.phone, message);
          }
        }
      } catch (err) {
        console.error("Error sending WhatsApp notification:", err);
      }
    })();

    return NextResponse.json({ 
      message: "Status updated and revision logged",
      delegation: updatedDelegation
    });
  } catch (error: any) {
    console.error("PUT Status Error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
