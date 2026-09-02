import { NextResponse } from "next/server";
import { getIMSItems } from "@/lib/ims-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { buildIMSMovementMaps, summarizeIMSMovement } from "@/lib/ims-enrich";

export const dynamic = "force-dynamic";

async function getMainIMSData() {
  const [items, grns, outForm, gFloorLedger, firstFloorLedger] = await Promise.all([
    getIMSItems(),
    require("@/lib/grn-sheets").getGRNItems(),
    require("@/lib/o2d-sheets").getOutFormData(),
    getFloorIMSItems("g"),
    getFloorIMSItems("1st"),
  ]);

  const maps = buildIMSMovementMaps(grns, outForm, gFloorLedger, firstFloorLedger);
  return summarizeIMSMovement(items, maps);
}

export async function GET() {
  try {
    const [main, first, g, outForm] = await Promise.all([
      getMainIMSData(),
      getFloorIMSItems("1st"),
      getFloorIMSItems("g"),
      require("@/lib/o2d-sheets").getOutFormData()
    ]);

    const summarizeFloor = (items: any[]) => {
      let totalIn = 0;
      let totalOut = 0;
      let liveStock = 0;
      items.forEach(item => {
        const in_qty = parseFloat(item.in_qty) || 0;
        const out_qty = parseFloat(item.out_qty) || 0;
        totalIn += in_qty;
        totalOut += out_qty;
        liveStock += (in_qty - out_qty);
      });
      return { totalIn, totalOut, liveStock };
    };

    const gSummary = summarizeFloor(g);
    
    // Append Out Form totals to G Floor
    let gOutFromO2D = 0;
    outForm.forEach((row: any) => {
      if (row.description && row.description.trim().startsWith("[") && row.description.trim().endsWith("]")) {
        try {
          const lineItems = JSON.parse(row.description);
          lineItems.forEach((item: any) => {
            const qty = parseFloat(item.Qty || item.qty) || 0;
            gOutFromO2D += qty;
          });
        } catch (e) {}
      }
    });

    gSummary.totalOut += gOutFromO2D;
    gSummary.liveStock -= gOutFromO2D;

    return NextResponse.json({
      main,
      first: summarizeFloor(first),
      g: gSummary
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error("Error fetching IMS summary:", error);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
