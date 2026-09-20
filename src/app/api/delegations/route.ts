import { NextRequest, NextResponse } from "next/server";
import { getDelegations, addDelegation } from "@/lib/delegation-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUserByUsernameOrEmail } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const allDelegations = await getDelegations();
    return NextResponse.json(allDelegations);
  } catch (error: any) {
    console.error("GET Delegations Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const payload = {
       ...delegationData,
       created_at: delegationData.created_at || timestamp,
       updated_at: timestamp
    };

    await addDelegation(payload);

    void (async () => {
      try {
        const assignedUser = await getUserByUsernameOrEmail(delegationData.assigned_to || "");
        if (assignedUser && assignedUser.phone) {
          const formattedDueDate = formatDate(delegationData.due_date || "");
          const message = `🔔 *New Delegation Assigned*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${delegationData.title}\n🎯 *Priority:* ${delegationData.priority}\n⏳ *Due Date:* ${formattedDueDate}\n👨‍💼 *Assigned By:* ${delegationData.assigned_by}\n📝 *Description:* ${delegationData.description}`;
          await sendWhatsAppMessage(assignedUser.phone, message);
        }
      } catch (err) {
        console.error("Error sending WhatsApp notification:", err);
      }
    })();

    return NextResponse.json({ message: "Delegation added successfully", delegation: payload });

  } catch (error: any) {
    console.error("POST Delegation Error:", error);
    return NextResponse.json({ error: error.message || "Invalid request" }, { status: 400 });
  }
}
