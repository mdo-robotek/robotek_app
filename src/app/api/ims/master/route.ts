import { NextRequest, NextResponse } from "next/server";
import { getIMSMasterItems, upsertIMSMasterItem } from "@/lib/ims-master-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await getIMSMasterItems();
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error fetching IMS Master:", error);
    return NextResponse.json({ error: "Failed to fetch Master items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await upsertIMSMasterItem({
      item_name: body?.item_name,
      sku_code: body?.sku_code,
      category: body?.category,
      active_status: body?.active_status,
      lead_time: body?.lead_time,
      safety_factor: body?.safety_factor,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to save Master item" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      added: result.added,
      item: result.item,
    });
  } catch (error) {
    console.error("Error saving IMS Master:", error);
    return NextResponse.json({ error: "Failed to save Master item" }, { status: 500 });
  }
}
