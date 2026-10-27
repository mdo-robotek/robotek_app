import { NextResponse } from 'next/server';
import { getTicketHistory, addTicketHistory, getTickets } from "@/lib/ticket-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await getTicketHistory(id);
    return NextResponse.json(history);
  } catch (error: any) {
    console.error(`GET Ticket History Error:`, error);
    return NextResponse.json({ error: error.message || "Failed to fetch ticket history" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    let data: any = {};
    let voiceNoteFile: File | null = null;
    let docFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      data = JSON.parse(formData.get("historyData") as string);
      voiceNoteFile = formData.get("voice_note") as File;
      docFile = formData.get("reference_doc") as File;
    } else {
      data = await request.json();
    }
    
    if (voiceNoteFile && voiceNoteFile.size > 0) {
      const fileId = await uploadFileToDrive(voiceNoteFile);
      data.voice_note = fileId || "";
    }

    if (docFile && docFile.size > 0) {
      const fileId = await uploadFileToDrive(docFile);
      data.attachment_url = fileId || "";
    }

    const now = new Date().toISOString();
    const newHistory = {
      ...data,
      id: data.id || `H-${Date.now()}`,
      ticket_id: id,
      created_at: now
    };

    await addTicketHistory(newHistory);

    // WhatsApp Notification
    try {
      const allTickets = await getTickets();
      const ticket = allTickets.find(t => t.id === id);
      if (ticket) {
        const formattedNow = formatDate(now);
        const isStatusChange = newHistory.action_type === 'STATUS_CHANGE';
        const header = isStatusChange ? '🔄 *Ticket Status Updated*' : '💬 *New Ticket Comment*';
        const statusLine = isStatusChange
          ? `📉 *Status Changed:* ${newHistory.old_status} ➡️ ${newHistory.new_status}\n`
          : '';
        const commentLine = newHistory.comment_text
          ? `🗣️ *Comment:* _${newHistory.comment_text}_\n`
          : '';
        const message = `${header}\n━━━━━━━━━━━━━━━━━\n🔖 *Ticket ID:* ${ticket.id}\n📌 *Title:* ${ticket.title}\n🏷️ *Category:* ${ticket.category}\n🎯 *Priority:* ${ticket.priority}\n👤 *Raised By:* ${ticket.raised_by}\n👨‍🔧 *Assigned To:* ${ticket.solver_person || 'Unassigned'}\n📊 *Current Status:* ${isStatusChange ? newHistory.new_status : ticket.status}\n${statusLine}${commentLine}👤 *Updated By:* ${newHistory.actor_username}\n⏱️ *Updated At:* ${formattedNow}`;

        // Only the other person hears about it: when the solver resolves, the
        // raiser gets the WhatsApp; when the raiser replies, the solver does.
        // The one who made the change never gets their own update (Sahil, 2026-10-27).
        const session = await auth();
        const actor = String((session?.user as any)?.username || newHistory.actor_username || "").trim().toLowerCase();
        const parties = [ticket.raised_by, ticket.solver_person].filter((u) => u && String(u).trim().toLowerCase() !== actor);
        const uniqueParties = [...new Set(parties)];
        const allUsers = await getUsers();

        for (const username of uniqueParties) {
          const user = allUsers.find(u => u.username === username);
          if (user && user.phone) {
            await sendWhatsAppMessage(user.phone, message);
          }
        }
      }
    } catch (err) {
      console.error('Notification Error:', err);
    }

    return NextResponse.json({ success: true, history: newHistory });
  } catch (error: any) {
    console.error(`POST Ticket History Error:`, error);
    return NextResponse.json({ error: error.message || "Failed to add ticket history" }, { status: 400 });
  }
}
