import { NextResponse } from "next/server";
import { delegationService, getRevisionIndex } from "@/lib/delegation-sheets";
import { NEED_REVISION } from "@/lib/delegation-revisions";

export const dynamic = "force-dynamic";

/**
 * { [taskId]: { count, pending } } for every task that has date history.
 * `pending` is only kept while the task itself is still "Need Revision".
 */
export async function GET() {
  try {
    const [index, tasks] = await Promise.all([getRevisionIndex(), delegationService.getAll()]);
    const status = new Map(tasks.map((t) => [String(t.id), t.status]));
    const out: Record<string, { count: number; pending: unknown }> = {};
    for (const [id, info] of index) {
      const pending = status.get(id) === NEED_REVISION ? info.pending : null;
      if (info.count > 0 || pending) out[id] = { count: info.count, pending };
    }
    return NextResponse.json(out);
  } catch (error) {
    console.error("delegations/revisions failed", error);
    return NextResponse.json({});
  }
}
