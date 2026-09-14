import { NextRequest, NextResponse } from "next/server";
import { getFloorIMSItems, addFloorIMSItem, addFloorIMSItems, updateFloorIMSItem, deleteFloorIMSItem, markFloorIMSItemsChecked, isValidFloorLocation } from "@/lib/ims-floor-sheets";
import { FloorIMS } from "@/types/ims-floor";
import { isGrnUnpacked, isSfgVirtualGrnId, sfgVirtualGrnId } from "@/lib/grn-packed";

export const dynamic = "force-dynamic";

function mergeUnpackedGrnIntoSfg(sheetItems: FloorIMS[], grns: { id: string; Item_Name?: string; Category?: string; Qty?: string; cancelled?: string | boolean; status_1?: string; Packed_Unpacked?: string; updated_at?: string }[]): FloorIMS[] {
  const overlayById = new Map(
    sheetItems.filter((i) => isSfgVirtualGrnId(i.id)).map((i) => [String(i.id), i])
  );
  const ledgerItems = sheetItems.filter((i) => !isSfgVirtualGrnId(i.id));

  const virtualIns: FloorIMS[] = [];
  grns.forEach((g) => {
    if (!g.Item_Name || g.cancelled || g.status_1 === "Rejected" || !isGrnUnpacked(g)) return;
    const id = sfgVirtualGrnId(g.id);
    const overlay = overlayById.get(id);
    const inQty = parseFloat(String(g.Qty || 0)) || 0;
    virtualIns.push({
      id,
      item_name: g.Item_Name,
      category: g.Category || overlay?.category || "",
      in_qty: String(inQty),
      out_qty: "0",
      date: g.updated_at || overlay?.date || "",
      packed_status: "UNPACKED",
      checked_status: overlay?.checked_status || "",
      updated_at: g.updated_at || overlay?.updated_at || "",
      live_stock: inQty,
    });
  });

  return [...virtualIns, ...ledgerItems];
}

function asSfgOutOnly<T extends Partial<FloorIMS>>(item: T): T {
  const outQty = parseFloat(String(item.out_qty || item.in_qty || 0)) || 0;
  return {
    ...item,
    in_qty: "0",
    out_qty: String(outQty),
    packed_status: item.packed_status || "PACKED",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");

    if (!isValidFloorLocation(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    let items = await getFloorIMSItems(location);

    if (location === "sfg") {
      const { getGRNItems } = await import("@/lib/grn-sheets");
      const grns = await getGRNItems();
      items = mergeUnpackedGrnIntoSfg(items, grns);
    }

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
    
    if (!isValidFloorLocation(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const data = await request.json();

    if (location === "sfg") {
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [data];
      const outOnly = list.map(asSfgOutOnly);
      const result = await addFloorIMSItems(location, outOnly);
      if (!result.success) {
        return NextResponse.json({ error: "Failed to add Floor IMS items" }, { status: 500 });
      }
      return NextResponse.json({ success: true, added: result.added });
    }

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
    
    if (!isValidFloorLocation(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const data: FloorIMS = await request.json();
    if (isSfgVirtualGrnId(data.id)) {
      return NextResponse.json({ error: "GRN inward entries cannot be edited here" }, { status: 400 });
    }
    const payload = location === "sfg" ? asSfgOutOnly(data) : data;
    const success = await updateFloorIMSItem(location, payload.id, payload as FloorIMS);

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
    
    if (!isValidFloorLocation(location)) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }
    
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (isSfgVirtualGrnId(id)) {
      return NextResponse.json({ error: "GRN inward entries cannot be deleted here" }, { status: 400 });
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

    if (!isValidFloorLocation(location)) {
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
