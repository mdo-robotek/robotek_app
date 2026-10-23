/**
 * Read-only audit: find item-name spelling/formatting mismatches between the
 * IMS catalog (Master sheet) and the movement sources (GRN, Busy sale
 * register, floor ledgers, Out Form). A mismatch here is the single biggest
 * cause of "wrong" live stock on the dashboard — if the catalog has
 * "ANS SPK TRUMP" but a sale row says "ANS SPK TRUMP " (trailing space) or
 * "ANS SPK TRUMP SPEAKER", the OUT for that sale lands on a DIFFERENT key
 * than the catalog's IN, so the catalog item looks like it never sold
 * (overstocked) while an orphan "pending" item appears negative (oversold)
 * for a name nobody recognizes.
 *
 * This script does NOT change any data. It only reports:
 *   1. Orphan keys — names with movement (GRN/sale/ledger) that don't match
 *      ANY catalog item name at all.
 *   2. For each orphan, the closest catalog name by edit-distance, when one
 *      is close enough to be the same item mistyped (likely culprit for a
 *      stock mismatch).
 *   3. Catalog items with GRN but a close-but-not-exact Busy-register name
 *      (sale register typo'd relative to catalog) and vice versa.
 *
 * Run: npx tsx --env-file=.env.local scripts/report-item-name-mismatches.ts
 */
import { getIMSItems } from "../src/lib/ims-sheets";
import { getGRNItems } from "../src/lib/grn-sheets";
import { getOutFormData } from "../src/lib/o2d-sheets";
import { getFloorIMSItems } from "../src/lib/ims-floor-sheets";
import { getBusySales } from "../src/lib/busy-sale-sheets";
import { getItemLedgerEntries } from "../src/lib/item-ledger-sheets";
import { getIMSMasterItems, indexMasterByName, masterItemKey } from "../src/lib/ims-master-sheets";
import { buildIMSMovementMaps } from "../src/lib/ims-enrich";

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, ""); // strip punctuation for comparison purposes
}

// Classic Levenshtein edit distance
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

async function main() {
  console.log("Fetching all sources (catalog, GRN, Busy sales, floor ledgers, Out Form, Item Ledger entries)...\n");

  const [items, grns, outForm, gFloor, firstFloor, busySales, ledgerEntries, masterRows] = await Promise.all([
    getIMSItems(),
    getGRNItems(),
    getOutFormData(),
    getFloorIMSItems("g"),
    getFloorIMSItems("1st"),
    getBusySales(),
    getItemLedgerEntries(),
    getIMSMasterItems(),
  ]);

  const masterByName = indexMasterByName(masterRows);

  const maps = buildIMSMovementMaps(grns as any, outForm as any, gFloor as any, firstFloor as any, busySales as any, ledgerEntries as any);

  // Catalog keys: from the IMS catalog sheet AND the Master sheet (a name
  // can be "Active" in Master without having its own IMS catalog row).
  const catalogKeySet = new Set<string>();
  items.forEach((i: any) => {
    if (i.item_name) catalogKeySet.add(normalize(i.item_name));
  });
  masterRows.forEach((m: any) => {
    const name = m.item_name || m.Item_Name || "";
    if (name) catalogKeySet.add(normalize(name));
  });
  const catalogKeys = Array.from(catalogKeySet);

  // Keys seen in Busy sale register specifically (most important OUT source
  // per Sahil's standing rule: Busy = single source of truth for sales OUT).
  const busyKeySet = new Set<string>();
  busySales.forEach((row: any) => {
    const name = (row.item || "").trim();
    if (name) busyKeySet.add(normalize(name));
  });

  // All movement keys (in or out) from the enrichment maps.
  const movementKeys = new Set<string>([
    ...Object.keys(maps.inQtyMap),
    ...Object.keys(maps.outQtyMap),
  ]);

  type Orphan = {
    key: string;
    display: string;
    inQty: number;
    outQty: number;
    net: number;
    inBusy: boolean;
    closestCatalogName?: string;
    closestDistance?: number;
  };

  const orphans: Orphan[] = [];
  movementKeys.forEach((key) => {
    // key is already normalize()'d by the time it reaches displayNameMap
    // (ims-enrich.ts uses raw.trim().toLowerCase(), not full normalize()),
    // so re-normalize for a fair compare against catalog/master keys.
    const normKey = normalize(maps.displayNameMap[key] || key);
    if (catalogKeySet.has(normKey)) return; // matches catalog exactly — fine

    const inQty = maps.inQtyMap[key] || 0;
    const outQty = maps.outQtyMap[key] || 0;
    if (inQty === 0 && outQty === 0) return;

    let best = "";
    let bestDist = Infinity;
    for (const ck of catalogKeys) {
      // Skip comparing against wildly different-length strings (cheap prune)
      if (Math.abs(ck.length - normKey.length) > 6) continue;
      const d = editDistance(normKey, ck);
      if (d < bestDist) {
        bestDist = d;
        best = ck;
      }
    }

    orphans.push({
      key,
      display: maps.displayNameMap[key] || key,
      inQty: Math.round(inQty),
      outQty: Math.round(outQty),
      net: Math.round(inQty - outQty),
      inBusy: busyKeySet.has(normKey),
      closestCatalogName: best || undefined,
      closestDistance: isFinite(bestDist) ? bestDist : undefined,
    });
  });

  // Likely-mismatch = orphan whose closest catalog name is a near-miss
  // (small edit distance relative to name length — typo/spacing/punctuation,
  // not a genuinely different product).
  const likelyMismatches = orphans.filter((o) => {
    if (o.closestDistance === undefined || !o.closestCatalogName) return false;
    const len = Math.max(o.display.length, o.closestCatalogName.length);
    return o.closestDistance <= Math.max(2, Math.round(len * 0.2));
  }).sort((a, b) => (a.closestDistance || 0) - (b.closestDistance || 0));

  const genuineOrphans = orphans.filter((o) => !likelyMismatches.includes(o));

  console.log(`Total movement keys checked: ${movementKeys.size}`);
  console.log(`Catalog/Master keys: ${catalogKeys.length}`);
  console.log(`Orphan keys (no exact catalog match): ${orphans.length}`);
  console.log(`  → Likely NAME MISMATCHES (near-miss spelling, probably the SAME item): ${likelyMismatches.length}`);
  console.log(`  → Genuinely new/unlisted items (no close catalog match): ${genuineOrphans.length}\n`);

  console.log("=".repeat(100));
  console.log("LIKELY NAME MISMATCHES — fix the sheet spelling to merge IN and OUT back onto one item");
  console.log("=".repeat(100));
  likelyMismatches.forEach((o) => {
    console.log(
      `\n"${o.display}"  (edit-distance ${o.closestDistance} from catalog "${o.closestCatalogName}")\n` +
      `   IN=${o.inQty}  OUT=${o.outQty}  NET=${o.net}  ${o.inBusy ? "[seen in Busy sale register]" : ""}`
    );
  });

  console.log("\n" + "=".repeat(100));
  console.log("GENUINE ORPHANS — no close catalog match found (new/unlisted item, or name too different to auto-match)");
  console.log("=".repeat(100));
  genuineOrphans
    .sort((a, b) => a.net - b.net)
    .forEach((o) => {
      console.log(
        `\n"${o.display}"  IN=${o.inQty}  OUT=${o.outQty}  NET=${o.net}  ${o.inBusy ? "[seen in Busy sale register]" : ""}` +
        (o.closestCatalogName ? `  (closest catalog name: "${o.closestCatalogName}", distance ${o.closestDistance})` : "")
      );
    });

  console.log("\n" + "=".repeat(100));
  console.log("DONE. This is a read-only report — no sheet data was changed.");
  console.log("Next step for each 'Likely Name Mismatch' row: open the source sheet (GRN / sale / floor ledger /");
  console.log("Item Ledger Entries) and correct the spelling to exactly match the catalog item name, so future");
  console.log("IN and OUT both land on the same key.");
  console.log("=".repeat(100));
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
