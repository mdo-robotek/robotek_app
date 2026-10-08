import { NextRequest, NextResponse } from "next/server";
import { getChecklists, addChecklistRevision } from "@/lib/checklist-sheets";
import { ChecklistRevision } from "@/types/checklist";
import { getIstDateString, toDateOnlyString } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "No items to complete" }, { status: 400 });
    }

    const checklists = await getChecklists();
    const byId = new Map(checklists.map((c) => [String(c.id), c]));
    const byGroup = new Map(
      checklists.map((c) => [String(c.group_id || `chk_${c.id}`), c])
    );
    const completedDate = getIstDateString();
    const revisions: ChecklistRevision[] = [];
    const skipped: string[] = [];

    for (const raw of items) {
      const checklistId = String(raw?.id || "").trim();
      const groupId = String(raw?.group_id || "").trim();
      const due_date = toDateOnlyString(raw?.due_date || raw?.occurrence_due_date || "");
      if (!due_date || (!checklistId && !groupId)) {
        skipped.push(checklistId || groupId || "?");
        continue;
      }
      const current =
        (groupId && byGroup.get(groupId)) ||
        (checklistId && byId.get(checklistId)) ||
        undefined;
      if (!current) {
        skipped.push(checklistId || groupId);
        continue;
      }
      const revision = await addChecklistRevision({
        group_id: current.group_id || `chk_${current.id}`,
        new_status: "Completed",
        due_date,
        timestamp: completedDate,
      });
      revisions.push(revision);
    }

    return NextResponse.json({
      message: `Completed ${revisions.length} task(s)`,
      completed: revisions.length,
      skipped: skipped.length,
      revisions,
      completed_date: completedDate,
    });
  } catch (error) {
    console.error("Bulk complete error:", error);
    return NextResponse.json({ error: "Bulk complete failed" }, { status: 500 });
  }
}
