import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIMSItems } from "@/lib/ims-sheets";
import { getGRNItems } from "@/lib/grn-sheets";
import { getOutFormData } from "@/lib/o2d-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { buildIMSMovementMaps, ledgerItemKey, buildItemLedgerStatement } from "@/lib/ims-enrich";
import { getIMSMasterItems, indexMasterByName, overlayFromMaster, masterItemKey } from "@/lib/ims-master-sheets";
import { getBusySales } from "@/lib/busy-sale-sheets";
import { getItemLedgerEntries, addItemLedgerEntry } from "@/lib/item-ledger-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailItem = (searchParams.get("item") || "").trim();

    const [items, grns, outForm, gFloorLedger, firstFloorLedger, masterRows, busySales, ledgerEntries] = await Promise.all([
      getIMSItems(),
      getGRNItems(),
      getOutFormData(),
      getFloorIMSItems("g"),
      getFloorIMSItems("1st"),
      getIMSMasterItems(),
      getBusySales(),
      getItemLedgerEntries(),
    ]);

    const maps = buildIMSMovementMaps(
      grns as any, outForm as any, gFloorLedger as any, firstFloorLedger as any, busySales as any, ledgerEntries as any
    );

    // Per-item statement (Module A ledger view): entry-level IN/OUT with
    // running balance, built from the SAME rules as the aggregate maps —
    // the response includes a reconciliation check against them so a
    // mismatch in logic can never go unnoticed.
    if (detailItem) {
      const stmt = buildItemLedgerStatement(
        detailItem, grns as any, outForm as any, gFloorLedger as any, firstFloorLedger as any, busySales as any, ledgerEntries as any
      );
      const key = ledgerItemKey(detailItem);
      const mapIn = Math.round(maps.inQtyMap[key] || 0);
      const mapOut = Math.round(maps.outQtyMap[key] || 0);
      return NextResponse.json({
        item: maps.displayNameMap[key] || detailItem,
        entries: stmt.entries,
        totalIn: stmt.totalIn,
        totalOut: stmt.totalOut,
        net: stmt.net,
        reconciled: stmt.totalIn === mapIn && stmt.totalOut === mapOut,
        summaryTotals: { totalIn: mapIn, totalOut: mapOut },
      }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const masterByName = indexMasterByName(masterRows);

    const catalogKeys = new Set(items.map((i) => ledgerItemKey(i.item_name || "")).filter(Boolean));
    const allKeys = new Set([
      ...catalogKeys,
      ...Object.keys(maps.inQtyMap),
      ...Object.keys(maps.outQtyMap),
    ]);

    const rows = Array.from(allKeys).map((key) => {
      const catalogItem = items.find((i) => ledgerItemKey(i.item_name || "") === key);
      const displayName = maps.displayNameMap[key] || catalogItem?.item_name || key;
      const master = masterByName.get(masterItemKey(displayName));
      const overlaid = catalogItem
        ? overlayFromMaster(catalogItem, master)
        : overlayFromMaster({ item_name: displayName, category: "" }, master);

      const inGrn = maps.inByGrnMap[key] || 0;
      // Record-only HO entries (not part of stock — the same goods flow in
      // via GRN/floor ledgers; see ims-enrich.ts).
      const inLocalPack = maps.inByLocalPackMap[key] || 0;
      const inAssembled = maps.inByAssembledMap[key] || 0;
      const totalIn = maps.inQtyMap[key] || 0;
      // Floor IN = everything that entered FG via floor ledgers / transfers
      // (totalIn minus direct GRN IN).
      const inFloor = Math.max(0, totalIn - inGrn);
      const totalOut = maps.outQtyMap[key] || 0;
      const net = totalIn - totalOut;

      // Flag: net negative (sold/consumed more than ever came in — a punching
      // error somewhere, same pattern as the MAGLOCK correction), or an item
      // moving but with zero recorded IN from any source.
      const flagged = net < 0 || (totalOut > 0 && totalIn === 0);

      return {
        item_name: displayName,
        category: (overlaid as any).category || "",
        active_status: (overlaid as any).active_status || "",
        in_grn: Math.round(inGrn),
        in_floor: Math.round(inFloor),
        in_locally_packed: Math.round(inLocalPack),
        in_assembled: Math.round(inAssembled),
        total_in: Math.round(totalIn),
        total_out: Math.round(totalOut),
        net: Math.round(net),
        flagged,
      };
    })
    .filter((r) => r.total_in > 0 || r.total_out > 0) // only items with some movement
    .sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0) || a.net - b.net);

    return NextResponse.json({
      rows,
      flaggedCount: rows.filter((r) => r.flagged).length,
      entries: ledgerEntries.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 50),
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error: unknown) {
    console.error("Error building item ledger:", error);
    return NextResponse.json({ error: "Failed to build item ledger" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { item_name, qty, source_type, date, remarks } = body;

    if (!item_name || !qty || !source_type) {
      return NextResponse.json({ error: "item_name, qty and source_type are required" }, { status: 400 });
    }
    if (source_type !== "Locally Packed" && source_type !== "Assembled") {
      return NextResponse.json({ error: "source_type must be 'Locally Packed' or 'Assembled'" }, { status: 400 });
    }

    const success = await addItemLedgerEntry({
      item_name: String(item_name).trim(),
      qty: Number(qty),
      source_type,
      date: date || new Date().toISOString().split("T")[0],
      remarks: remarks || "",
      entered_by: (session.user as any)?.name || (session.user as any)?.username || session.user?.email || "",
    });

    if (!success) {
      return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error adding item ledger entry:", error);
    return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
  }
}
