import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIMSMasterItems, upsertIMSMasterItem } from "@/lib/ims-master-sheets";
import { getBusySales } from "@/lib/busy-sale-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Canonical item-name list for GRN / I2R dropdowns (Sahil, 2026-10-23).
 * The Busy sale register's names are the "perfect" names — any item that
 * sold in the last 6 months, plus the Master catalog, forms the allowed
 * list. Punching a GRN/I2R with a name from this list guarantees the IN
 * lands on the same ledger key as the OUT, killing the name-mismatch
 * class of stock errors at the source.
 */
export async function GET() {
  try {
    const [masterRows, busySales] = await Promise.all([
      getIMSMasterItems(),
      getBusySales(),
    ]);

    const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
    const byKey = new Map<string, string>(); // key → display name

    // Busy names first — they are the canonical spelling.
    busySales.forEach((row) => {
      const name = (row.item || "").trim();
      if (!name) return;
      const ts = Date.parse(row.date || "");
      if (isNaN(ts) || ts < sixMonthsAgo) return; // only actively-trading names
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, name);
    });

    // Master catalog names added after — fills items not sold recently
    // (new launches, slow movers) without overriding Busy spellings.
    const categories = new Set<string>();
    masterRows.forEach((m) => {
      const name = (m.item_name || "").trim();
      if (name) {
        const key = name.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, name);
      }
      const cat = (m.category || "").trim();
      if (cat) categories.add(cat);
    });

    const names = Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      { names, categories: Array.from(categories).sort() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error building item-name list:", error);
    return NextResponse.json({ error: "Failed to load item names" }, { status: 500 });
  }
}

/** Admin-only: add a brand-new canonical name (goes into the Master sheet). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = String((session.user as any)?.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "EA") {
    return NextResponse.json({ error: "Only admin can add new item names" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const item_name = String(body.item_name || "").trim();
    const category = String(body.category || "").trim();
    if (!item_name) {
      return NextResponse.json({ error: "item_name is required" }, { status: 400 });
    }
    const result = await upsertIMSMasterItem({ item_name, category, active_status: "Active" });
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to add name" }, { status: 500 });
    }
    return NextResponse.json({ success: true, added: result.added });
  } catch (error) {
    console.error("Error adding item name:", error);
    return NextResponse.json({ error: "Failed to add item name" }, { status: 500 });
  }
}
