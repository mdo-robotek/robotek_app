import { NextRequest, NextResponse } from "next/server";
import { getChecklists, addChecklistRevision } from "@/lib/checklist-sheets";
import { getUserByUsernameOrEmail } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDateDdMmmYy, getIstDateString, toDateOnlyString } from "@/lib/dateUtils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing checklist ID" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "";
    let occurrenceDueDate = "";
    let newStatus = "Completed";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      occurrenceDueDate = toDateOnlyString(body.due_date || body.occurrence_due_date || "");
      newStatus = body.status || "Completed";
    } else {
      const formData = await req.formData();
      occurrenceDueDate = toDateOnlyString(
        String(formData.get("due_date") || formData.get("occurrence_due_date") || "")
      );
      newStatus = String(formData.get("status") || "Completed");
    }

    if (String(newStatus).toLowerCase() !== "completed") {
      return NextResponse.json({ error: "Only Completed status is supported" }, { status: 400 });
    }
    if (!occurrenceDueDate) {
      return NextResponse.json({ error: "Occurrence due_date is required" }, { status: 400 });
    }

    const checklists = await getChecklists();
    const current = checklists.find((d) => String(d.id) === String(id));

    if (!current) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    const completedDate = getIstDateString();
    const revision = await addChecklistRevision({
      group_id: current.group_id || `chk_${id}`,
      new_status: "Completed",
      due_date: occurrenceDueDate,
      timestamp: completedDate,
    });

    void (async () => {
      try {
        const message = `✅ *Checklist Completed*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${current.task}\n🎯 *Priority:* ${current.priority}\n🏢 *Department:* ${current.department}\n👤 *Assigned To:* ${current.assigned_to}\n📅 *Due:* ${formatDateDdMmmYy(occurrenceDueDate)}\n✅ *Completed:* ${formatDateDdMmmYy(completedDate)}`;

        const parties = [current.assigned_to, current.assigned_by];
        for (const username of [...new Set(parties)]) {
          if (!username) continue;
          const user = await getUserByUsernameOrEmail(username);
          if (user?.phone) await sendWhatsAppMessage(user.phone, message);
        }
      } catch (err) {
        console.error("Error sending WhatsApp notification:", err);
      }
    })();

    return NextResponse.json({
      message: "Checklist completed",
      revision,
    });
  } catch (error) {
    console.error("API Error completing checklist:", error);
    return NextResponse.json({ error: "Failed to complete checklist" }, { status: 500 });
  }
}
