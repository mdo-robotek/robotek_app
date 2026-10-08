import { NextRequest, NextResponse } from "next/server";
import { updateChecklist, deleteChecklist, getChecklists } from "@/lib/checklist-sheets";
import { getUserByUsernameOrEmail } from "@/lib/google-sheets";
import { Checklist } from "@/types/checklist";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDateDdMmmYy, toDateOnlyString, getIstDateString } from "@/lib/dateUtils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing checklist ID" }, { status: 400 });
    }

    const body = await req.json();
    const existing = (await getChecklists()).find((d) => String(d.id) === String(id));
    if (!existing) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    const checklistData: Checklist = {
      ...existing,
      ...body,
      id: String(id),
      due_date: toDateOnlyString(body.due_date ?? existing.due_date) || existing.due_date,
      group_id: existing.group_id || `chk_${id}`,
      updated_at: getIstDateString(),
      created_at: toDateOnlyString(existing.created_at) || existing.created_at,
    };

    const success = await updateChecklist(id, checklistData);

    if (success) {
      void (async () => {
        try {
          const assignedUser = await getUserByUsernameOrEmail(checklistData.assigned_to || "");
          if (assignedUser?.phone) {
            const formattedDueDate = formatDateDdMmmYy(checklistData.due_date || "");
            const message = `📝 *Checklist Updated*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${checklistData.task}\n🎯 *Priority:* ${checklistData.priority}\n🏢 *Department:* ${checklistData.department}\n⏳ *Due Date:* ${formattedDueDate}\n👨‍💼 *Assigned By:* ${checklistData.assigned_by}`;
            await sendWhatsAppMessage(assignedUser.phone, message);
          }
        } catch (err) {
          console.error("Error sending WhatsApp notification:", err);
        }
      })();

      return NextResponse.json({ message: "Checklist updated successfully" });
    }
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  } catch (error: any) {
    console.error("API Error updating checklist:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update checklist" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing checklist ID" }, { status: 400 });
    }

    const checklists = await getChecklists();
    const current = checklists.find((d) => String(d.id) === String(id));

    const success = await deleteChecklist(id);

    if (success) {
      if (current) {
        void (async () => {
          try {
            const assignedUser = await getUserByUsernameOrEmail(current.assigned_to || "");
            if (assignedUser?.phone) {
              const message = `🗑️ *Checklist Deleted*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${current.task}\n👤 *Assigned To:* ${current.assigned_to}\n\n_This checklist has been removed._`;
              await sendWhatsAppMessage(assignedUser.phone, message);
            }
          } catch (err) {
            console.error("Error sending WhatsApp notification:", err);
          }
        })();
      }
      return NextResponse.json({ message: "Checklist deleted successfully" });
    }
    return NextResponse.json({ error: "Failed to delete checklist" }, { status: 500 });
  } catch (error) {
    console.error("API Error deleting checklist:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
