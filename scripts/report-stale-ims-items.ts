/**
 * READ-ONLY report. Makes no sheet writes.
 *
 * Finds candidates for the Out-of-Stock cleanup Sahil asked for:
 *   1. Items currently marked Active (or blank = active) in the Master
 *      sheet that have NOT been traded (no GRN/Busy/OutForm/floor
 *      movement) in the last N months — candidates to mark Inactive.
 *   2. Within that list, which ones are showing negative live_stock
 *      right now (candidates to zero + mark inactive).
 *   3. "Touch" category items currently showing negative stock
 *      (informational only — code already excludes Touch from
 *      Out-of-Stock/negative-stock widgets; sheet itself is untouched).
 *
 * Usage: npx tsx --env-file=.env.local scripts/report-stale-ims-items.ts [months]
 *   months defaults to 9 (the top of the 6-9 month window Sahil gave).
 */
import { getIMSItems } from "../src/lib/ims-sheets";
import { getGRNItems } from "../src/lib/grn-sheets";
import { getOutFormData } from "../src/lib/o2d-sheets";
import { getFloorIMSItems } from "../src/lib/ims-floor-sheets";
import { buildIMSMovementMaps, enrichIMSItems } from "../src/lib/ims-enrich";
import { getIMSMasterItems, indexMasterByName, overlayFromMaster, masterItemKey } from "../src/lib/ims-master-sheets";
import { getBusySales } from "../src/lib/busy-sale-sheets";

async function main() {
  const months = Number(process.argv[2]) || 9;
  const staleMs = months * 30 * 24 * 60 * 60 * 1000;

  const [items, grns, outForm, gFloorLedger, firstFloorLedger, masterRows, busySales] = await Promise.all([
    getIMSItems(),
    getGRNItems(),
    getOutFormData(),
    getFloorIMSItems("g"),
    getFloorIMSItems("1st"),
    getIMSMasterItems(),
    getBusySales(),
  ]);

  const maps = buildIMSMovementMaps(grns as any, outForm as any, gFloorLedger as any, firstFloorLedger as any, busySales as any);
  const masterByName = indexMasterByName(masterRows);
  const enrichedItems = enrichIMSItems(items, maps).map((item) => {
    const overlaid = overlayFromMaster(item, masterByName.get(masterItemKey(item.item_name)), {
      lead_time: item.lead_time || 30,
      safety_factor: item.safety_factor || 1,
    });
    return overlaid;
  });

  const now = Date.now();
  const isStale = (lastActivityDate: string | undefined) => {
    if (!lastActivityDate) return true;
    const ts = Date.parse(lastActivityDate);
    if (isNaN(ts)) return true;
    return now - ts > staleMs;
  };

  const isActive = (status: string | undefined) => String(status || "").trim().toLowerCase() !== "inactive";
  const isTouch = (category: string | undefined) => String(category || "").trim().toLowerCase() === "touch";

  console.log(`\n=== Report run with ${months}-month staleness window ===`);
  console.log(`Master sheet rows: ${masterRows.length}, enriched catalog items: ${enrichedItems.length}\n`);

  // 1. Active items with no trade activity in the window -> inactivate candidates
  const staleActive = enrichedItems
    .filter((i: any) => isActive(i.active_status) && isStale(i.last_activity_date))
    .sort((a: any, b: any) => (a.category || "").localeCompare(b.category || "") || a.item_name.localeCompare(b.item_name));

  console.log(`--- (1) Active items with NO trade in last ${months} months: ${staleActive.length} ---`);
  console.log("category | item_name | sku_code | live_stock | last_activity_date");
  staleActive.forEach((i: any) => {
    console.log(`${i.category || "-"} | ${i.item_name} | ${i.sku_code || "-"} | ${Math.round(i.live_stock ?? 0)} | ${i.last_activity_date || "(never)"}`);
  });

  // 2. Of those stale items, which show negative stock right now
  const staleNegative = staleActive.filter((i: any) => Number(i.live_stock ?? 0) < 0);
  console.log(`\n--- (2) Of the above, showing NEGATIVE stock right now: ${staleNegative.length} ---`);
  staleNegative.forEach((i: any) => {
    console.log(`${i.category || "-"} | ${i.item_name} | ${i.sku_code || "-"} | ${Math.round(i.live_stock ?? 0)}`);
  });

  // 3. Touch-category items with negative stock (informational — not acted on in the sheet)
  const touchNegative = enrichedItems.filter((i: any) => isTouch(i.category) && Number(i.live_stock ?? 0) < 0);
  console.log(`\n--- (3) Touch-category items showing negative stock (code already excludes these from dashboard; informational only): ${touchNegative.length} ---`);
  touchNegative.forEach((i: any) => {
    console.log(`${i.item_name} | ${i.sku_code || "-"} | ${Math.round(i.live_stock ?? 0)}`);
  });

  // 4. ANY active item with negative stock, regardless of staleness (candidates for the
  //    "supporting / give-away item" negative-stock cleanup Sahil mentioned, e.g. Steel Thali, Sticker)
  const anyNegative = enrichedItems
    .filter((i: any) => isActive(i.active_status) && !isTouch(i.category) && Number(i.live_stock ?? 0) < 0)
    .sort((a: any, b: any) => Number(a.live_stock ?? 0) - Number(b.live_stock ?? 0));
  console.log(`\n--- (4) ALL active, non-Touch items currently showing negative stock: ${anyNegative.length} ---`);
  console.log("category | item_name | sku_code | live_stock | last_activity_date");
  anyNegative.forEach((i: any) => {
    console.log(`${i.category || "-"} | ${i.item_name} | ${i.sku_code || "-"} | ${Math.round(i.live_stock ?? 0)} | ${i.last_activity_date || "(never)"}`);
  });

  console.log("\n=== End of report (read-only, no changes made) ===\n");
}

main().catch((err) => {
  console.error("Report failed:", err);
  process.exit(1);
});
