import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGRNItems } from "@/lib/grn-sheets";
import { getBusySales } from "@/lib/busy-sale-sheets";
import { getIMSMasterItems } from "@/lib/ims-master-sheets";
import { indexMasterByName, masterItemKey } from "@/lib/ims-master-overlay";
import { getOutFormData } from "@/lib/o2d-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { getItemLedgerEntries } from "@/lib/item-ledger-sheets";
import { buildIMSMovementMaps } from "@/lib/ims-enrich";
import { buildTally, grnCounts, saleCounts } from "@/lib/ims-tally";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/ims/tally            → one row per audio item: bought (GRN) vs sold (Busy)
 * GET /api/ims/tally?item=<key> → that item's GRN entries and sales by month
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const itemKey = (new URL(request.url).searchParams.get("item") || "").trim();
    const [grns, sales, master] = await Promise.all([getGRNItems(), getBusySales(), getIMSMasterItems().catch(() => [])]);

    if (itemKey) {
      const g = grnCounts(grns as any);
      const s = saleCounts(sales as any);
      return NextResponse.json({
        key: itemKey,
        grn: (g.entries[itemKey] || []).sort((a, b) => b.date.localeCompare(a.date)),
        salesByMonth: Object.entries(s.byMonth[itemKey] || {}).sort((a, b) => b[0].localeCompare(a[0])).map(([month, qty]) => ({ month, qty: Math.round(qty) })),
      });
    }

    const byName = indexMasterByName(master as any);
    const categoryOf = (name: string) => String((byName.get(masterItemKey(name)) as any)?.category || "").trim();

    // IMS's own stock figure, only for reference next to ours.
    let imsStockOf: ((key: string) => number | null) | undefined;
    try {
      const [outForm, gFloor, firstFloor, ledger] = await Promise.all([
        getOutFormData(), getFloorIMSItems("g"), getFloorIMSItems("1st"), getItemLedgerEntries(),
      ]);
      const maps = buildIMSMovementMaps(grns as any, outForm as any, gFloor as any, firstFloor as any, sales as any, ledger as any);
      imsStockOf = (key) => (key in maps.inQtyMap || key in maps.outQtyMap ? Math.round((maps.inQtyMap[key] || 0) - (maps.outQtyMap[key] || 0)) : null);
    } catch (e) {
      console.error("tally: IMS stock skipped", e);
    }

    const rows = buildTally({ grns: grns as any, sales: sales as any, categoryOf, imsStockOf });
    return NextResponse.json({ rows, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("tally failed", error);
    return NextResponse.json({ error: "Couldn't build the stock tally" }, { status: 500 });
  }
}
