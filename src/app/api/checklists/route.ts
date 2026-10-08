import { NextRequest, NextResponse } from "next/server";
import { getChecklists, addChecklist, getChecklistsPaginated } from "@/lib/checklist-sheets";
import { getUserByUsernameOrEmail } from "@/lib/google-sheets";
import { Checklist } from "@/types/checklist";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { formatDateDdMmmYy, toDateOnlyString, getIstDateString } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const search = searchParams.get("search") || "";
  const statusFiltersStr = searchParams.get("statusFilters") || "[]";
  const assignmentFilter = searchParams.get("assignmentFilter") || "All";
  const currentUser = searchParams.get("currentUser") || "";
  const userRole = searchParams.get("userRole") || "USER";
  const dateFiltersStr = searchParams.get("dateFilters") || "[]";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const modalStatusStr = searchParams.get("modalStatus") || "[]";
  const modalPriorityStr = searchParams.get("modalPriority") || "[]";
  const modalAssignedToStr = searchParams.get("modalAssignedTo") || "[]";
  const modalAssignedByStr = searchParams.get("modalAssignedBy") || "[]";
  const modalDepartmentStr = searchParams.get("modalDepartment") || "[]";
  const modalFrequencyStr = searchParams.get("modalFrequency") || "[]";
  const sortKey = searchParams.get("sortKey") || "due_date";
  const sortDir = searchParams.get("sortDir") || "desc";
  const viewParam = searchParams.get("view") || "tasks";
  const view = viewParam === "master" ? "master" : "tasks";

  // Legacy bulk array response (scheduler etc.): return all expanded task occurrences.
  // Default to ADMIN scope when caller omits role — USER + empty currentUser would
  // incorrectly filter to assigned_to === "" and return almost nothing.
  if (!searchParams.has("page") && !searchParams.has("limit")) {
    const bulkRole = searchParams.has("userRole") ? userRole : "ADMIN";
    const result = await getChecklistsPaginated(
      1,
      100000,
      "",
      [],
      "All",
      currentUser,
      bulkRole,
      [],
      "",
      "",
      [],
      [],
      [],
      [],
      [],
      [],
      "due_date",
      "desc",
      view
    );
    return NextResponse.json(result.data || []);
  }

  try {
    const statusFilters = JSON.parse(statusFiltersStr);
    const dateFilters = JSON.parse(dateFiltersStr);
    const modalStatus = JSON.parse(modalStatusStr);
    const modalPriority = JSON.parse(modalPriorityStr);
    const modalAssignedTo = JSON.parse(modalAssignedToStr);
    const modalAssignedBy = JSON.parse(modalAssignedByStr);
    const modalDepartment = JSON.parse(modalDepartmentStr);
    const modalFrequency = JSON.parse(modalFrequencyStr);

    const result = await getChecklistsPaginated(
      page,
      limit,
      search,
      statusFilters,
      assignmentFilter,
      currentUser,
      userRole,
      dateFilters,
      startDate,
      endDate,
      modalStatus,
      modalPriority,
      modalAssignedTo,
      modalAssignedBy,
      modalDepartment,
      modalFrequency,
      sortKey,
      sortDir,
      view
    );

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
    });
  } catch (error) {
    console.error("Checklist pagination error:", error);
    return NextResponse.json({ error: "Pagination failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = Array.isArray(body) ? body[0] : body;
    if (!raw) {
      return NextResponse.json({ error: "No checklist data" }, { status: 400 });
    }

    const today = getIstDateString();
    const item: Partial<Checklist> = {
      task: raw.task || "",
      assigned_by: raw.assigned_by || "",
      assigned_to: raw.assigned_to || "",
      priority: raw.priority || "Medium",
      department: raw.department || "",
      frequency: raw.frequency || "Daily",
      due_date: toDateOnlyString(raw.due_date) || "",
      created_at: today,
      updated_at: today,
    };

    const created = await addChecklist(item);

    if (created) {
      void (async () => {
        try {
          const assignedUser = await getUserByUsernameOrEmail(created.assigned_to || "");
          if (assignedUser?.phone) {
            const formattedDueDate = formatDateDdMmmYy(created.due_date || "");
            const message = `🔔 *New Checklist Assigned*\n━━━━━━━━━━━━━━━━━\n📌 *Task:* ${created.task}\n🎯 *Priority:* ${created.priority}\n🏢 *Department:* ${created.department}\n⏳ *Due Date:* ${formattedDueDate}\n👨‍💼 *Assigned By:* ${created.assigned_by}`;
            await sendWhatsAppMessage(assignedUser.phone, message);
          }
        } catch (err) {
          console.error("Error sending WhatsApp notification:", err);
        }
      })();

      return NextResponse.json({ message: "Checklist added successfully", checklist: created });
    }
    return NextResponse.json({ error: "Failed to add checklist" }, { status: 500 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
