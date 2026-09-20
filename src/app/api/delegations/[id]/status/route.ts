import { NextRequest, NextResponse } from "next/server";
import { delegationService, addDelegationRevision } from "@/lib/delegation-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUserByUsernameOrEmail } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";

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
        
        const parties = [current.assigned_to, current.assigned_by];
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
