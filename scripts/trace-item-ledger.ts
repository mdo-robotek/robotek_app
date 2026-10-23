/**
 * READ-ONLY. Dumps every raw IN/OUT movement row touching one item (by
 * case-insensitive substring match on name) across GRN, Busy sales,
 * Out Form, G-Floor ledger and 1st-Floor ledger — so a stock mismatch
 * (like the MAGLOCK one) can be traced to its source instead of guessed at.
 *
 * Usage: npx tsx --env-file=.env.local scripts/trace-item-ledger.ts "ans spk trump"
 */
import { getGRNItems } from "../src/lib/grn-sheets";
import { getOutFormData } from "../src/lib/o2d-sheets";
import { getFloorIMSItems } from "../src/lib/ims-floor-sheets";
import { getBusySales } from "../src/lib/busy-sale-sheets";

function matches(name: string | undefined, needle: string) {
  return String(name || "").trim().toLowerCase().includes(needle);
}

async function main() {
  const needle = (process.argv[2] || "").trim().toLowerCase();
  if (!needle) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/trace-item-ledger.ts \"<item name or part of it>\"");
    process.exit(1);
  }

  const [grns, outForm, gFloorLedger, firstFloorLedger, busySales] = await Promise.all([
    getGRNItems(),
    getOutFormData(),
    getFloorIMSItems("g"),
    getFloorIMSItems("1st"),
    getBusySales(),
  ]);

  console.log(`\n=== Tracing all movement rows matching "${needle}" ===\n`);

  let totalIn = 0;
  let totalOut = 0;

  console.log("--- GRN (IN) ---");
  grns.forEach((g: any) => {
    if (matches(g.Item_Name, needle)) {
      const qty = parseFloat(g.Qty || "") || 0;
      const cancelled = !!g.cancelled;
      const rejected = g.status_1 === "Rejected";
      console.log(`Item="${g.Item_Name}" Qty=${qty} cancelled=${cancelled} status_1="${g.status_1}" Packed_Unpacked="${g.Packed_Unpacked}" updated_at="${g.updated_at}"`);
      if (!cancelled && !rejected) totalIn += qty;
    }
  });

  console.log("\n--- Busy Sales (OUT, authoritative source if present) ---");
  let busyTouched = false;
  busySales.forEach((row: any) => {
    if (matches(row.item, needle)) {
      busyTouched = true;
      const qty = Number(row.qty) || 0;
      console.log(`Item="${row.item}" Qty=${qty} Date="${row.date}"`);
      totalOut += qty;
    }
  });
  if (!busyTouched) console.log("(no Busy sale rows matched — this item is NOT in the Busy register)");

  console.log("\n--- Out Form (OUT, only counted if item is absent from Busy) ---");
  outForm.forEach((row: any) => {
    const desc = String(row.description || "");
    if (desc.trim().startsWith("[") && desc.trim().endsWith("]")) {
      try {
        const lineItems = JSON.parse(desc);
        lineItems.forEach((item: any) => {
          const d = item.Description || item.description || "";
          if (matches(d, needle)) {
            const qty = parseFloat(item.Qty || item.qty || "") || 0;
            console.log(`[line-item] Item="${d}" Qty=${qty} rowDate="${row.date}" updated_at="${row.updated_at}" (counted only if NOT in Busy)`);
            if (!busyTouched) totalOut += qty;
          }
        });
      } catch { /* ignore */ }
    } else if (matches(desc, needle)) {
      const qty = parseFloat(row.qty || "") || 0;
      console.log(`Item="${desc}" Qty=${qty} rowDate="${row.date}" updated_at="${row.updated_at}" (counted only if NOT in Busy)`);
      if (!busyTouched) totalOut += qty;
    }
  });

  console.log("\n--- G-Floor Ledger ---");
  gFloorLedger.forEach((row: any) => {
    if (matches(row.item_name, needle)) {
      const inQ = parseFloat(String(row.in_qty || 0)) || 0;
      const outQ = parseFloat(String(row.out_qty || 0)) || 0;
      console.log(`Item="${row.item_name}" IN=${inQ} OUT=${outQ} date="${row.date}" updated_at="${(row as any).updated_at}"`);
      totalIn += inQ;
      if (!busyTouched) totalOut += outQ;
    }
  });

  console.log("\n--- 1st-Floor Ledger (feeds into G-Floor IN via floor-transfer logic) ---");
  firstFloorLedger.forEach((row: any) => {
    if (matches(row.item_name, needle)) {
      const inQ = parseFloat(String(row.in_qty || 0)) || 0;
      const outQ = parseFloat(String(row.out_qty || 0)) || 0;
      console.log(`Item="${row.item_name}" IN=${inQ} OUT=${outQ} date="${row.date}"`);
    }
  });

  console.log(`\n=== TOTALS (approx, same rules as live dashboard) === IN=${totalIn}  OUT=${totalOut}  LIVE_STOCK=${totalIn - totalOut}\n`);
  console.log("If live_stock is negative: look above for (a) GRN rows that were cancelled/rejected but still have real stock on the floor, (b) a name-spelling mismatch splitting the item into two separate 'items' (e.g. one key in GRN, a slightly different spelling in Busy/OutForm), or (c) an OUT row logged without a matching GRN/floor-transfer IN ever being recorded.\n");
}

main().catch((err) => {
  console.error("Trace failed:", err);
  process.exit(1);
});
