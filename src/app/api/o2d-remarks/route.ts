import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrderFollowupRemarks,
  latestRemarkByOrder,
  addOrderFollowupRemark,
} from "@/lib/o2d-remarks-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET: latest follow-up remark per order + recent history. */
export async function GET() {
  try {
    const remarks = await getOrderFollowupRemarks();
    const latest = latestRemarkByOrder(remarks);
    return NextResponse.json(
      {
        latestByOrder: Object.fromEntries(
          Object.entries(latest).map(([k, v]) => [k, { remark: v.remark, remark_by: v.remark_by, created_at: v.created_at }])
        ),
        recent: remarks
          .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
          .slice(0, 200),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error fetching followup remarks:", error);
    return NextResponse.json({ error: "Failed to fetch remarks" }, { status: 500 });
  }
}

/** POST: add a follow-up remark for an order (appends to the log). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const order_no = String(body.order_no || "").trim();
    const remark = String(body.remark || "").trim();
    if (!order_no || !remark) {
      return NextResponse.json({ error: "order_no and remark are required" }, { status: 400 });
    }
    const ok = await addOrderFollowupRemark({
      order_no,
      remark,
      remark_by: (session.user as any)?.name || (session.user as any)?.username || session.user?.email || "",
    });
    if (!ok) return NextResponse.json({ error: "Failed to save remark" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding followup remark:", error);
    return NextResponse.json({ error: "Failed to save remark" }, { status: 500 });
  }
}
