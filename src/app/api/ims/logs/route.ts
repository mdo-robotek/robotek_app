import { NextRequest, NextResponse } from "next/server";
import { getGRNItems } from "@/lib/grn-sheets";
import { getOutFormData } from "@/lib/o2d-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { isGrnForGFloor } from "@/lib/grn-packed";

export const dynamic = "force-dynamic";

function parseDateStr(dStr: string) {
  if (!dStr) return 0;
  let ts = Date.parse(dStr);
  if (!isNaN(ts)) return ts;
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) {
      ts = Date.parse(`${y}-${m}-${d}`);
      if (!isNaN(ts)) return ts;
    }
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get("item");

    if (!itemName) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }

    const queryName = itemName.trim().toLowerCase();

    const [grns, outForm, firstFloorLedger] = await Promise.all([
      getGRNItems(),
      getOutFormData(),
      getFloorIMSItems("1st"),
    ]);

    const logs: any[] = [];

    // Process GRN (IN)
    grns.forEach(grn => {
      if (grn.Item_Name && grn.Item_Name.trim().toLowerCase() === queryName && !grn.cancelled && grn.status_1 !== "Rejected" && isGrnForGFloor(grn)) {
        const qty = parseFloat(grn.Qty) || 0;
        if (qty > 0) {
          logs.push({
            date: grn.updated_at || "",
            timestamp: parseDateStr(grn.updated_at || ""),
            type: "IN",
            qty,
            remarks: `GRN: ${grn.GRN_No || "-"} | By: ${grn.filled_by || "-"}`
          });
        }
      }
    });

    firstFloorLedger.forEach((row) => {
      if ((row.item_name || "").trim().toLowerCase() !== queryName) return;
      const qty = parseFloat(String(row.out_qty || 0)) || 0;
      if (qty <= 0) return;
      logs.push({
        date: row.date || row.updated_at || "",
        timestamp: parseDateStr(row.date || row.updated_at || ""),
        type: "IN",
        qty,
        remarks: "1st Floor packed transfer",
      });
    });

    // Process Out Form (OUT)
    outForm.forEach(row => {
      let isMatch = false;
      let matchedQty = 0;

      if (row.description && row.description.trim().startsWith("[") && row.description.trim().endsWith("]")) {
        try {
          const lineItems = JSON.parse(row.description);
          lineItems.forEach((item: any) => {
            const desc = (item.Description || item.description || "").trim().toLowerCase();
            if (desc === queryName) {
              isMatch = true;
              matchedQty += parseFloat(item.Qty || item.qty) || 0;
            }
          });
        } catch (e) {
          // Ignore
        }
      } else if (row.description) {
        const desc = row.description.trim().toLowerCase();
        if (desc === queryName) {
          isMatch = true;
          matchedQty = parseFloat(row.qty) || 0;
        }
      }

      if (isMatch && matchedQty > 0) {
        logs.push({
          date: row.date || "",
          timestamp: parseDateStr(row.date),
          type: "OUT",
          qty: matchedQty,
          remarks: `Order No: ${row.orderNo || "-"} | Party: ${row.partyName || "-"}`
        });
      }
    });

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json(logs, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error("Error fetching IMS logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
