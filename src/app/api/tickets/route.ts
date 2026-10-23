import { NextRequest, NextResponse } from "next/server";
import { getTickets, addTicket, ticketService } from "@/lib/ticket-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "next-id") {
      const nextId = await ticketService.getNextNumericalId();
      return NextResponse.json({ id: nextId.toString() });
    }

    const tickets = await getTickets();
    return NextResponse.json(tickets);
  } catch (error: any) {
    console.error("GET Tickets Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const ticketData = JSON.parse(formData.get("ticketData") as string || formData.get("ticket") as string);
    const attachment = formData.get("reference_doc") as File || formData.get("attachment") as File;
    const voiceNote = formData.get("voice_note") as File || formData.get("voiceNote") as File;

    if (attachment && attachment.size > 0) {
      const fileId = await uploadFileToDrive(attachment);
      ticketData.attachment_url = fileId || "";
    }

    if (voiceNote && voiceNote.size > 0) {
      const fileId = await uploadFileToDrive(voiceNote);
      ticketData.voice_note = fileId || "";
    }

    const now = new Date().toISOString();
    ticketData.created_at = ticketData.created_at || now;
    ticketData.updated_at = now;

    await addTicket(ticketData);

    // Notification logic
    try {
      const allUsers = await getUsers();
      const solver = allUsers.find(u => u.username === ticketData.solver_person);
      if (solver && solver.phone) {
        const formattedDate = formatDate(ticketData.created_at);
        const dueDate = ticketData.planned_resolution ? formatDate(ticketData.planned_resolution) : "Not Set";
        const suggestions = [ticketData.suggestion_1, ticketData.suggestion_2, ticketData.suggestion_3].filter(Boolean);
        const suggestionBlock = suggestions.length
          ? `\n\n💡 *Suggestions by ${ticketData.raised_by}:*\n${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`
          : "";
        const message = `🎫 *New Help Ticket Raised*\n━━━━━━━━━━━━━━━━━\n🔖 *Ticket ID:* ${ticketData.id}\n📌 *Title:* ${ticketData.title}\n🏷️ *Category:* ${ticketData.category}\n🎯 *Priority:* ${ticketData.priority}\n👤 *Raised By:* ${ticketData.raised_by}\n👨‍🔧 *Assigned To:* ${ticketData.solver_person || 'Unassigned'}\n⏳ *Due Date:* ${dueDate}\n⏱️ *Created At:* ${formattedDate}\n\n📝 *Description:* _${ticketData.description}_${suggestionBlock}`;
        await sendWhatsAppMessage(solver.phone, message);
      }
    } catch (err) {
      console.error("Notification Error:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST Ticket Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
