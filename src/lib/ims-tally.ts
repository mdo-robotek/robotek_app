/**
 * Stock Tally — bought vs sold (Sahil, 2026-10-28).
 *
 * Only what came INTO the company from outside (GRN) and what went OUT to
 * customers (Busy sale register). Internal moves — SFG → 1st floor →
 * ground floor — are ignored on purpose.
 *
 *   Bought (GRN) − Sold (Busy) = should be in stock
 *
 * First pass: audio items (earphones, TWS, neckbands, speakers, headphones).
 * Pure functions; the API route reads the sheets.
 */
import { ledgerItemKey } from "@/lib/ims-enrich";

export type TallyGroup = "Earphones" | "TWS" | "Neckband" | "Speaker" | "Headphone";
export const TALLY_GROUPS: TallyGroup[] = ["Earphones", "TWS", "Neckband", "Speaker", "Headphone"];

/** Master category → group; PRO / unknown items fall back to the name. */
export function groupOf(category: string, name: string): TallyGroup | null {
  const c = String(category || "").trim().toUpperCase();
  const n = String(name || "").trim().toUpperCase();
  if (c === "EAR" || c === "ANS EAR") return "Earphones";
  if (c.startsWith("TWS") || c === "ANS TWS") return "TWS";
  if (c.startsWith("N BAND") || c === "ANS NB") return "Neckband";
  if (c === "SPK" || c === "ANS SPK") return "Speaker";
  if (c === "HEADPHONE") return "Headphone";
  if (c && c !== "PRO" && c !== "OTHER" && c !== "GENERAL") return null;
  // By name (PRO range, items missing from the master)
  if (/^(PRO\s+)?(TWS|OWS)\b/.test(n) || /\bTWS\b/.test(n)) return "TWS";
  if (/^(PRO\s+)?NB\b/.test(n) || /\bNECKBAND\b/.test(n)) return "Neckband";
  if (/^(ANS\s+)?HF\b/.test(n) || /\bEARPHONE\b/.test(n)) return "Earphones";
  if (/^(ANS\s+)?SPKR?\b/.test(n) || /\bSPEAKER\b/.test(n)) return "Speaker";
  if (/^BT\s+RBH/.test(n) || /\bHEADPHONE\b/.test(n)) return "Headphone";
  return null;
}

export interface TallyRow {
  key: string;
  item: string;
  category: string;
  group: TallyGroup;
  bought: number;       // GRN qty
  grnCount: number;
  lastGrn: string;      // YYYY-MM-DD
  sold: number;         // Busy sale qty
  lastSale: string;
  shouldHave: number;   // bought − sold
  imsStock: number | null; // what IMS shows now (all its sources), for reference
  status: "ok" | "oversold" | "no_grn";
}

export interface TallyEntry { date: string; ref: string; qty: number }

type Grn = { id?: string; GRN_No?: string; Item_Name?: string; Qty?: string; cancelled?: string; status_1?: string; updated_at?: string; actual_1?: string; planned_1?: string };
type Sale = { date?: string; item?: string; qty?: number };

const day = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
};
const flagOn = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s !== "" && s !== "false" && s !== "no" && s !== "0";
};

export function grnCounts(grns: Grn[]) {
  const qty: Record<string, number> = {};
  const count: Record<string, number> = {};
  const last: Record<string, string> = {};
  const name: Record<string, string> = {};
  const entries: Record<string, TallyEntry[]> = {};
  for (const g of grns) {
    if (!g.Item_Name || flagOn(g.cancelled) || String(g.status_1 || "").trim() === "Rejected") continue;
    const key = ledgerItemKey(g.Item_Name);
    const q = parseFloat(String(g.Qty || "")) || 0;
    if (!key || !q) continue;
    qty[key] = (qty[key] || 0) + q;
    count[key] = (count[key] || 0) + 1;
    const d = day(g.actual_1 || g.updated_at || g.planned_1);
    if (d > (last[key] || "")) last[key] = d;
    if (!name[key]) name[key] = g.Item_Name.trim();
    (entries[key] ||= []).push({ date: d, ref: String(g.GRN_No || g.id || ""), qty: q });
  }
  return { qty, count, last, name, entries };
}

export function saleCounts(sales: Sale[]) {
  const qty: Record<string, number> = {};
  const last: Record<string, string> = {};
  const name: Record<string, string> = {};
  const byMonth: Record<string, Record<string, number>> = {};
  for (const s of sales) {
    const key = ledgerItemKey(String(s.item || ""));
    const q = Number(s.qty) || 0;
    if (!key || !q) continue;
    qty[key] = (qty[key] || 0) + q;
    const d = day(s.date);
    if (d > (last[key] || "")) last[key] = d;
    if (!name[key]) name[key] = String(s.item).trim();
    const m = d.slice(0, 7) || "unknown";
    (byMonth[key] ||= {})[m] = (byMonth[key][m] || 0) + q;
  }
  return { qty, last, name, byMonth };
}

export function buildTally(opts: {
  grns: Grn[];
  sales: Sale[];
  categoryOf: (name: string) => string;
  imsStockOf?: (key: string) => number | null;
}): TallyRow[] {
  const g = grnCounts(opts.grns);
  const s = saleCounts(opts.sales);
  const keys = new Set([...Object.keys(g.qty), ...Object.keys(s.qty)]);
  const rows: TallyRow[] = [];
  for (const key of keys) {
    const item = g.name[key] || s.name[key] || key;
    const category = opts.categoryOf(item) || opts.categoryOf(s.name[key] || "") || "";
    const group = groupOf(category, item);
    if (!group) continue;
    const bought = Math.round(g.qty[key] || 0);
    const sold = Math.round(s.qty[key] || 0);
    const shouldHave = bought - sold;
    rows.push({
      key, item, category, group,
      bought, grnCount: g.count[key] || 0, lastGrn: g.last[key] || "",
      sold, lastSale: s.last[key] || "",
      shouldHave,
      imsStock: opts.imsStockOf ? opts.imsStockOf(key) : null,
      status: bought === 0 && sold > 0 ? "no_grn" : shouldHave < 0 ? "oversold" : "ok",
    });
  }
  const rank = { oversold: 0, no_grn: 1, ok: 2 } as const;
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || a.group.localeCompare(b.group) || a.item.localeCompare(b.item));
}
