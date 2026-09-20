import { NextRequest, NextResponse } from "next/server";
import { updateDelegation, deleteDelegation } from "@/lib/delegation-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUserByUsernameOrEmail } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing delegation ID" }, { status: 400 });

    const contentType = req.headers.get("content-type") || "";
    let delegationData: any = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      delegationData = JSON.parse(formData.get("delegationData") as string);
      
      const voiceNoteFile = formData.get("voice_note") as File;
      const refDocFile = formData.get("reference_doc") as File;

      if (voiceNoteFile && voiceNoteFile.size > 0) {
        const fileId = await uploadFileToDrive(voiceNoteFile);
        delegationData.voice_note_url = fileId || "";
      }

      if (refDocFile && refDocFile.size > 0) {
        const fileId = await uploadFileToDrive(refDocFile);
        delegationData.reference_docs = fileId || "";
      }
    } else {
      delegationData = await req.json();
    }

    const timestamp = new Date().toISOString();
    const updated = {
      ...delegationData,
      id,
      updated_at: timestamp
    };
    await updateDelegation(id, updated);

    void (async () => {
      try {
        const assignedUser = await getUserByUsernameOrEmail(delegationData.assigned_to || "");
        if (assignedUser && assignedUser.phone) {
          const formattedDueDate = formatDate(delegationData.due_date || "");
          const message = `📝 *Delegation Updated*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${delegationData.title}\n🎯 *Priority:* ${delegationData.priority}\n⏳ *Due Date:* ${formattedDueDate}\n👨‍💼 *Assigned By:* ${delegationData.assigned_by}\n📝 *Description:* ${delegationData.description}`;
          await sendWhatsAppMessage(assignedUser.phone, message);
        }
      } catch (err) {
        console.error("Error sending WhatsApp notification:", err);
      }
    })();

    return NextResponse.json({ message: "Delegation updated successfully", delegation: updated });
  } catch (error: any) {
    console.error("API Error updating delegation:", error);
    return NextResponse.json({ error: error.message || "Failed to update delegation" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing delegation ID" }, { status: 400 });

    await deleteDelegation(id);

    return NextResponse.json({ message: "Delegation deleted successfully" });
  } catch (error: any) {
    console.error("API Error deleting delegation:", error);
    return NextResponse.json({ error: error.message || "Invalid request" }, { status: 400 });
  }
}
