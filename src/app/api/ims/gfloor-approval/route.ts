import { NextRequest, NextResponse } from "next/server";
import {
  addIMSGFloorApprovals,
  getIMSGFloorApprovals,
  type ApprovalInput,
} from "@/lib/ims-gfloor-approval-sheets";
import { approvalToTxKey } from "@/lib/ims-datewise-key";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await getIMSGFloorApprovals();
    const keys = rows
      .filter((r) => (r.approval_status || "").toLowerCase() === "approved")
      .map((r) => approvalToTxKey(r));

    return NextResponse.json({ rows, keys }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error fetching G Floor approvals:", error);
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transactions: ApprovalInput[] = Array.isArray(body?.transactions)
      ? body.transactions
      : [];

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No transactions to approve" }, { status: 400 });
    }

    const result = await addIMSGFloorApprovals(transactions);

    return NextResponse.json({
      success: true,
      added: result.added,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("Error saving G Floor approvals:", error);
    return NextResponse.json({ error: "Failed to save approvals" }, { status: 500 });
  }
}
