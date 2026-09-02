import { NextRequest, NextResponse } from "next/server";
import { getIMSItems, addIMSItem, updateIMSItem, deleteIMSItem } from "@/lib/ims-sheets";
import { getGRNItems } from "@/lib/grn-sheets";
import { getOutFormData } from "@/lib/o2d-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { buildIMSMovementMaps, enrichIMSItems } from "@/lib/ims-enrich";
import { IMS } from "@/types/ims";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [items, grns, outForm, gFloorLedger, firstFloorLedger] = await Promise.all([
      getIMSItems(),
      getGRNItems(),
      getOutFormData(),
      getFloorIMSItems("g"),
      getFloorIMSItems("1st"),
    ]);

    const maps = buildIMSMovementMaps(grns, outForm, gFloorLedger, firstFloorLedger);
    const enrichedItems = enrichIMSItems(items, maps);

    return NextResponse.json(enrichedItems, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error: unknown) {
    console.error("Error fetching IMS items:", error);
    return NextResponse.json({ error: "Failed to fetch IMS items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const success = await addIMSItem(data);

    if (!success) {
      return NextResponse.json({ error: "Failed to add IMS item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error adding IMS item:", error);
    return NextResponse.json({ error: "Failed to add IMS item" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data: IMS = await request.json();
    const success = await updateIMSItem(data.id, data);

    if (!success) {
      return NextResponse.json({ error: "Failed to update IMS item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating IMS item:", error);
    return NextResponse.json({ error: "Failed to update IMS item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const success = await deleteIMSItem(id);

    if (!success) {
      return NextResponse.json({ error: "Failed to delete IMS item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting IMS item:", error);
    return NextResponse.json({ error: "Failed to delete IMS item" }, { status: 500 });
  }
}
