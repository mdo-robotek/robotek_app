import { NextRequest, NextResponse } from "next/server";
import { getFloorIMSItems, addFloorIMSItem, addFloorIMSItems, updateFloorIMSItem, deleteFloorIMSItem, markFloorIMSItemsChecked } from "@/lib/ims-floor-sheets";
import { FloorIMS } from "@/types/ims-floor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");

    if (!location || !["1st", "g"].includes(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const items = await getFloorIMSItems(location);

    if (location === "g" && searchParams.get("ledgerOnly") !== "1") {
      const { getOutFormData } = await import("@/lib/o2d-sheets");
      const outForm = await getOutFormData();
      
      outForm.forEach((row, index) => {
        if (row.description && row.description.trim().startsWith("[") && row.description.trim().endsWith("]")) {
          try {
            const lineItems = JSON.parse(row.description);
            lineItems.forEach((item: any, lineIdx: number) => {
              const desc = (item.Description || item.description || "").trim();
              const qty = parseFloat(item.Qty || item.qty) || 0;
              if (desc && qty > 0) {
                items.push({
                  id: `outform-${index}-${lineIdx}`,
                  item_name: desc,
                  category: "Auto-Out (O2D)",
                  in_qty: "0",
                  out_qty: qty.toString(),
                  date: row.date,
                  updated_at: row.date || new Date().toISOString()
                });
              }
            });
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
    }

    return NextResponse.json(items, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error("Error fetching Floor IMS items:", error);
    return NextResponse.json({ error: "Failed to fetch Floor IMS items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");
    
    if (!location || !["1st", "g"].includes(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const data = await request.json();

    if (Array.isArray(data)) {
      const result = await addFloorIMSItems(location, data);
      if (!result.success) {
        return NextResponse.json({ error: "Failed to add Floor IMS items" }, { status: 500 });
      }
      return NextResponse.json({ success: true, added: result.added });
    }

    if (Array.isArray(data?.items)) {
      const result = await addFloorIMSItems(location, data.items);
      if (!result.success) {
        return NextResponse.json({ error: "Failed to add Floor IMS items" }, { status: 500 });
      }
      return NextResponse.json({ success: true, added: result.added });
    }

    const success = await addFloorIMSItem(location, data);
    
    if (!success) {
      return NextResponse.json({ error: "Failed to add Floor IMS item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error adding Floor IMS item:", error);
    return NextResponse.json({ error: "Failed to add Floor IMS item" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");
    
    if (!location || !["1st", "g"].includes(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const data: FloorIMS = await request.json();
    const success = await updateFloorIMSItem(location, data.id, data);

    if (!success) {
      return NextResponse.json({ error: "Failed to update Floor IMS item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating Floor IMS item:", error);
    return NextResponse.json({ error: "Failed to update Floor IMS item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");
    const id = searchParams.get("id");
    
    if (!location || !["1st", "g"].includes(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }
    
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const success = await deleteFloorIMSItem(location, id);
    
    if (!success) {
      return NextResponse.json({ error: "Failed to delete Floor IMS item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting Floor IMS item:", error);
    return NextResponse.json({ error: "Failed to delete Floor IMS item" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");

    if (!location || !["1st", "g"].includes(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "At least one ID is required" }, { status: 400 });
    }

    const result = await markFloorIMSItemsChecked(location, ids);

    if (!result.success) {
      return NextResponse.json({ error: "Failed to mark items as checked" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error marking Floor IMS items checked:", error);
    return NextResponse.json({ error: "Failed to mark items as checked" }, { status: 500 });
  }
}
