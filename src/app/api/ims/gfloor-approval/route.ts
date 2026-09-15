import { NextRequest, NextResponse } from "next/server";
import {
  getIMSGFloorApprovals,
  upsertIMSGFloorStatuses,
  type ApprovalInput,
} from "@/lib/ims-gfloor-approval-sheets";
import { approvalToTxKey } from "@/lib/ims-datewise-key";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await getIMSGFloorApprovals();
    const keys: string[] = [];
    const checkedKeys: string[] = [];
    const uidKeys: string[] = [];
    const checkedUidKeys: string[] = [];

    rows.forEach((r) => {
      const uid = (r.tx_uid || "").trim();
      const key = approvalToTxKey(r);
      const approved = (r.approval_status || "").toLowerCase() === "approved";
      const checked = (r.checked_status || "").trim().toUpperCase() === "CHECKED";
      if (uid) {
        if (approved) uidKeys.push(uid);
        if (checked) checkedUidKeys.push(uid);
      } else {
        if (approved) keys.push(key);
        if (checked) checkedKeys.push(key);
      }
    });

    return NextResponse.json(
      { rows, keys, checkedKeys, uidKeys, checkedUidKeys },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
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
    const action = String(body?.action || "approve").toLowerCase();

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No transactions provided" }, { status: 400 });
    }

    if (action !== "approve" && action !== "check") {
      return NextResponse.json({ error: "action must be approve or check" }, { status: 400 });
    }

    const result = await upsertIMSGFloorStatuses(transactions, {
      approve: action === "approve",
      check: action === "check",
    });

    return NextResponse.json({
      success: true,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("Error saving G Floor approval/check:", error);
    return NextResponse.json({ error: "Failed to save status" }, { status: 500 });
  }
}
