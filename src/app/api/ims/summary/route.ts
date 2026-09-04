import { NextResponse } from "next/server";
import { getIMSItems } from "@/lib/ims-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { getGRNItems } from "@/lib/grn-sheets";
import { getOutFormData } from "@/lib/o2d-sheets";
import { buildIMSMovementMaps, summarizeIMSMovement } from "@/lib/ims-enrich";

export const dynamic = "force-dynamic";

function summarizeFloor(items: { in_qty?: string; out_qty?: string }[]) {
  let totalIn = 0;
  let totalOut = 0;
  let liveStock = 0;
  items.forEach((item) => {
    const in_qty = parseFloat(item.in_qty || "") || 0;
    const out_qty = parseFloat(item.out_qty || "") || 0;
    totalIn += in_qty;
    totalOut += out_qty;
    liveStock += in_qty - out_qty;
  });
  return { totalIn, totalOut, liveStock };
}

export async function GET() {
  try {
    // Single parallel sheet fetch — avoids duplicate Out Form / floor reads
    const [items, grns, outForm, gFloorLedger, firstFloorLedger] = await Promise.all([
      getIMSItems(),
      getGRNItems(),
      getOutFormData(),
      getFloorIMSItems("g"),
      getFloorIMSItems("1st"),
    ]);

    const maps = buildIMSMovementMaps(grns, outForm, gFloorLedger, firstFloorLedger);
    const main = summarizeIMSMovement(items, maps);

    const gSummary = summarizeFloor(gFloorLedger);

    let gOutFromO2D = 0;
    outForm.forEach((row: { description?: string; qty?: string }) => {
      if (row.description && row.description.trim().startsWith("[") && row.description.trim().endsWith("]")) {
        try {
          const lineItems = JSON.parse(row.description);
          lineItems.forEach((item: { Qty?: string; qty?: string }) => {
            gOutFromO2D += parseFloat(item.Qty || item.qty || "") || 0;
          });
        } catch {
          // ignore
        }
      } else if (row.description) {
        gOutFromO2D += parseFloat(row.qty || "") || 0;
      }
    });

    // G Floor hub tile: ledger + O2D outs (1st→G IN is already in main via enrich)
    gSummary.totalOut += gOutFromO2D;
    gSummary.liveStock -= gOutFromO2D;

    // Include 1st Floor OUT transfers as G Floor IN on the hub tile
    let gInFrom1st = 0;
    firstFloorLedger.forEach((row) => {
      gInFrom1st += parseFloat(String(row.out_qty || 0)) || 0;
    });
    gSummary.totalIn += gInFrom1st;
    gSummary.liveStock += gInFrom1st;

    return NextResponse.json(
      {
        main,
        first: summarizeFloor(firstFloorLedger),
        g: gSummary,
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error: unknown) {
    console.error("Error fetching IMS summary:", error);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
