import { NextResponse } from 'next/server';
import { updateTicket, deleteTicket, getTickets } from "@/lib/ticket-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDate } from "@/lib/dateUtils";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(
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
      data = JSON.parse(formData.get("ticketData") as string);
      voiceNoteFile = formData.get("voice_note") as File;
      docFile = formData.get("reference_doc") as File;
    } else {
      data = await request.json();
    }

    // The Follow Up panel saves the status here and then logs it through
    // ./history, which sends the WhatsApp. Without this flag everyone got
    // the same update twice (Sahil, 2026-10-27).
    const notify = data.notify !== false;
    delete data.notify;

    const allTickets = await getTickets();
    const current = allTickets.find(t => t.id === id);
    if (!current) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (voiceNoteFile && voiceNoteFile.size > 0) {
      const fileId = await uploadFileToDrive(voiceNoteFile);
      data.voice_note = fileId || "";
    }

    if (docFile && docFile.size > 0) {
      const fileId = await uploadFileToDrive(docFile);
      data.attachment_url = fileId || "";
    }

    data.updated_at = new Date().toISOString();
    await updateTicket(id, { ...current, ...data });
    
    // WhatsApp Notification — never to the person who made the change.
    if (notify) try {
      const session = await auth();
      const actor = String((session?.user as any)?.username || "").trim().toLowerCase();
      const isStatusChange = data.status && data.status !== current.status;
      const branding = isStatusChange ? "🔄 *Ticket Status Changed*" : "📝 *Ticket Details Updated*";
      const formattedUpdate = formatDate(new Date().toISOString());
      const oldStatus = current.status || 'Unknown';
      const newStatus = data.status || current.status || 'Unknown';
      const statusLine = isStatusChange ? `📉 *Status Changed:* ${oldStatus} ➡️ ${newStatus}\n` : `📊 *Status:* ${newStatus}\n`;
      const commentLine = data.comment_text ? `🗣️ *Comment:* _${data.comment_text}_\n` : '';

      const message = `${branding}\n━━━━━━━━━━━━━━━━━\n🔖 *Ticket ID:* ${current.id}\n📌 *Title:* ${data.title || current.title}\n🏷️ *Category:* ${data.category || current.category}\n🎯 *Priority:* ${data.priority || current.priority}\n👤 *Raised By:* ${data.raised_by || current.raised_by}\n👨‍🔧 *Assigned To:* ${data.solver_person || current.solver_person || 'Unassigned'}\n${statusLine}${commentLine}⏱️ *Updated At:* ${formattedUpdate}`;

      const parties = [data.raised_by || current.raised_by, data.solver_person || current.solver_person];
      const uniqueParties = [...new Set(parties)].filter((u) => u && String(u).trim().toLowerCase() !== actor);
      const allUsers = await getUsers();

      for (const username of uniqueParties) {
        const user = allUsers.find(u => u.username === username);
        if (user && user.phone) {
          await sendWhatsAppMessage(user.phone, message);
        }
      }
    } catch (err) {
      console.error("Notification Error:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT Ticket Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allTickets = await getTickets();
    const current = allTickets.find(t => t.id === id);
    if (!current) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    await deleteTicket(id);

    // Notification
    try {
      if (current.solver_person) {
        const allUsers = await getUsers();
        const solver = allUsers.find(u => u.username === current.solver_person);
        if (solver && solver.phone) {
          const message = `🗑️ *Help Ticket Deleted*\n━━━━━━━━━━━━━━━━━\n🔖 *Ticket ID:* ${current.id}\n📌 *Title:* ${current.title}\n\n_This ticket has been removed from the system._`;
          await sendWhatsAppMessage(solver.phone, message);
        }
      }
    } catch (err) {
      console.error("Notification Error:", err);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Ticket Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
