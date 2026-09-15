import { NextRequest, NextResponse } from "next/server";
import { getGRNItems } from "@/lib/grn-sheets";
import { getOutFormData } from "@/lib/o2d-sheets";
import { getIMSItems } from "@/lib/ims-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { firstFloorOutRowsToGFloorInTxs, floorOutRowsToGFloorInTxs } from "@/lib/ims-1st-to-g-transfer";
import { isGrnForGFloor } from "@/lib/grn-packed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET() {
  try {
    const [items, grns, outForm, gFloorLedger, firstFloorLedger, sfgFloorLedger] = await Promise.all([
      getIMSItems(),
      getGRNItems(),
      getOutFormData(),
      getFloorIMSItems("g"),
      getFloorIMSItems("1st"),
      getFloorIMSItems("sfg"),
    ]);

    const categoryMap: Record<string, string> = {};
    items.forEach(i => {
      if (i.item_name) {
        categoryMap[i.item_name.trim().toLowerCase()] = i.category || 'GENERAL';
      }
    });

    const transactions: any[] = [];

    // GRN (Inward)
    grns.forEach(grn => {
      if (grn.Item_Name && !grn.cancelled && grn.status_1 !== "Rejected" && isGrnForGFloor(grn)) {
        const qty = parseFloat(grn.Qty) || 0;
        const name = grn.Item_Name.trim();
        const lowerName = name.toLowerCase();
        
        let txDate = grn.updated_at || "";
        const ts = parseDateStr(txDate);
        if (ts > 0) txDate = new Date(ts).toISOString();

        transactions.push({
          item_name: name,
          category: categoryMap[lowerName] || 'GENERAL',
          date: txDate,
          in_qty: qty,
          out_qty: 0,
          source: 'GRN',
          tx_uid: `grn:${grn.id}`,
        });
      }
    });

    // Out Form (Outward)
    outForm.forEach((row, index) => {
      let txDate = row.date || row.updated_at || "";
      const ts = parseDateStr(txDate);
      if (ts > 0) txDate = new Date(ts).toISOString();
      const orderNo = String(row.orderNo || "").trim();

      const addQty = (desc: string, qty: number, lineIdx: number) => {
        const lowerDesc = desc.toLowerCase();
        transactions.push({
          item_name: desc,
          category: categoryMap[lowerDesc] || 'GENERAL',
          date: txDate,
          in_qty: 0,
          out_qty: qty,
          source: 'O2D',
          tx_uid: `o2d:${index}:${lineIdx}:${orderNo}`,
        });
      };

      if (row.description && row.description.trim().startsWith("[") && row.description.trim().endsWith("]")) {
        try {
          const lineItems = JSON.parse(row.description);
          lineItems.forEach((item: any, lineIdx: number) => {
            const desc = (item.Description || item.description || "").trim();
            const qty = parseFloat(item.Qty || item.qty) || 0;
            if (desc) addQty(desc, qty, lineIdx);
          });
        } catch (e) {
          // Fallback if parse fails
        }
      } else if (row.description) {
        const desc = row.description.trim();
        const qty = parseFloat(row.qty) || 0;
        if (desc) addQty(desc, qty, 0);
      }
    });

    // G Floor ledger (Production IN + physical adjustments)
    gFloorLedger.forEach((row, index) => {
      const name = (row.item_name || "").trim();
      if (!name) return;

      let txDate = row.date || row.updated_at || "";
      const ts = parseDateStr(txDate);
      if (ts > 0) txDate = new Date(ts).toISOString();

      const inQty = parseFloat(row.in_qty || "") || 0;
      const outQty = parseFloat(row.out_qty || "") || 0;
      const lowerName = name.toLowerCase();
      const floorId = row.id ? String(row.id) : `idx-${index}`;
      const floorMeta = {
        floor_id: row.id ? String(row.id) : undefined,
        checked_status: row.checked_status || "",
      };

      if (inQty > 0) {
        transactions.push({
          item_name: name,
          category: categoryMap[lowerName] || row.category || "GENERAL",
          date: txDate,
          in_qty: inQty,
          out_qty: 0,
          source: 'GFloor',
          ...floorMeta,
          tx_uid: `gfloor:${floorId}:in`,
        });
      }
      if (outQty > 0) {
        transactions.push({
          item_name: name,
          category: categoryMap[lowerName] || row.category || "GENERAL",
          date: txDate,
          in_qty: 0,
          out_qty: outQty,
          source: 'GFloor',
          ...floorMeta,
          tx_uid: `gfloor:${floorId}:out`,
        });
      }
    });

    transactions.push(...firstFloorOutRowsToGFloorInTxs(firstFloorLedger, categoryMap));
    transactions.push(...floorOutRowsToGFloorInTxs(sfgFloorLedger, categoryMap, "SFG"));

    return NextResponse.json(transactions, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error("Error fetching IMS time-series:", error);
    return NextResponse.json({ error: "Failed to fetch time-series" }, { status: 500 });
  }
}
