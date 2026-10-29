/**
 * Automatic "Cross Check of SO" for O2D Step 2 (Sahil, 2026-10-29).
 *
 * After Step 1 (Make SO) the Busy SO PDF is uploaded. This reads that PDF,
 * and compares it with the order in Sarthi: order number, every item and its
 * quantity, and the party. If everything matches, Step 2 is done by the
 * system. If anything differs, Step 2 stays with CRM with the differences.
 *
 * Party: Busy prints the billing name (e.g. "KAVERI DISTRIBUTORS") while the
 * order uses our own name ("PS Mobile HYD"). The first time, CRM confirms the
 * pair once; it is saved in the "SO Party Names" tab and used from then on.
 */
import type { O2D } from "@/types/o2d";

export type SoItem = { sn: number; name: string; qty: number; unit: string };
export interface SoParsed {
  soNumber: string;
  orderNos: string[];
  party: string;
  gstin: string;
  items: SoItem[];
  totalQty: number | null;
}

const squash = (s: string) => s.replace(/\\/g, "").replace(/\s+/g, " ").trim();
export const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Read the text of a Busy "Sales Order" PDF. */
export function parseSoText(raw: string): SoParsed {
  const t = squash(raw);
  const soNumber = (t.match(/Order No\.?\s*:\s*(SO\s?\d+)/i)?.[1] || t.match(/\b(SO\d{3,})\b/)?.[1] || "").replace(/\s/g, "").toUpperCase();
  const orderNos = Array.from(new Set((t.match(/OR-\d{3,}/gi) || []).map((x) => x.toUpperCase())));
  // "Order No. : SO3700 KAVERI DISTRIBUTORS Dated : ..."
  const party = squash(t.match(/Order No\.?\s*:\s*SO\s?\d+\s+(.+?)\s+Dated\s*:/i)?.[1] || "");
  // Our own GSTIN is printed first; the party's comes after "GSTIN / UIN"
  const gstin = (t.match(/GSTIN\s*\/\s*UIN\s*:\s*([0-9A-Z]{15})/i)?.[1] || "").toUpperCase();

  const items: SoItem[] = [];
  const seen = new Set<number>();
  const re = /(?:^|\s)(\d{1,3})\.\s+(.+?)\s+(\d{4,8})\s+([\d,]+(?:\.\d+)?)\s+(Pcs|Pc|Nos|No|Set|Sets|Box|Pair|Pairs|Kg|Mtr|Roll|Pkt)\.?(?=\s|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const sn = parseInt(m[1], 10);
    if (seen.has(sn)) continue; // the next page repeats the header, not the items
    seen.add(sn);
    items.push({ sn, name: squash(m[2]), qty: parseFloat(m[4].replace(/,/g, "")), unit: m[5] });
  }
  const tq = t.match(/Grand Total\s+([\d,]+(?:\.\d+)?)\s+(?:Pcs|Nos|Pc)/i)?.[1];
  return { soNumber, orderNos, party, gstin, items, totalQty: tq ? parseFloat(tq.replace(/,/g, "")) : null };
}

/** The order's items, one per line (multi-item orders are packed "1. A | 2. B"). */
export function orderItems(rows: O2D[]): { name: string; qty: number }[] {
  const out: { name: string; qty: number }[] = [];
  const split = (v: string, sep: string | RegExp) => String(v || "").split(sep).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim());
  for (const r of rows) {
    const multi = /^1\.\s/.test(r.item_name || "");
    const sep = multi ? " | " : /\n/;
    const names = multi || String(r.item_name).includes("\n") ? split(r.item_name, sep) : [r.item_name];
    const qtys = multi || String(r.item_name).includes("\n") ? split(r.item_qty, sep) : [r.item_qty];
    names.forEach((n, i) => { if (n) out.push({ name: n, qty: parseFloat(String(qtys[i] || "").replace(/,/g, "")) || 0 }); });
  }
  return out;
}

export type Diff =
  | { kind: "qty"; item: string; order: number; so: number }
  | { kind: "missing"; item: string; order: number } // in the order, not on the SO
  | { kind: "extra"; item: string; so: number } // on the SO, not in the order
  | { kind: "orderNo"; so: string }
  | { kind: "soNumber"; order: string; so: string }
  | { kind: "party"; order: string; so: string };

export type CheckStatus = "ok" | "diff" | "party" | "error";
export interface SoCheck {
  v: 1;
  status: CheckStatus;
  at: string;
  file: string; // which SO file was read
  items: number; // items on the order
  matched: number;
  diffs: Diff[];
  soParty: string;
  gstin: string;
  soNumber: string;
  auto?: boolean; // Step 2 was completed by the system
  note?: string;
}

export function compare(
  orderNo: string,
  orderParty: string,
  orderSoNumber: string,
  order: { name: string; qty: number }[],
  so: SoParsed,
  partyKnown: boolean
): Omit<SoCheck, "v" | "at" | "file"> {
  const base = { soParty: so.party, gstin: so.gstin, soNumber: so.soNumber, items: order.length };
  if (!so.items.length) return { ...base, status: "error", matched: 0, diffs: [], note: "Couldn't read the items on the SO" };

  // Same item twice → add the quantities
  const sum = (list: { name: string; qty: number }[]) => {
    const m = new Map<string, { name: string; qty: number }>();
    for (const x of list) {
      const k = norm(x.name);
      const cur = m.get(k);
      m.set(k, { name: cur?.name || x.name, qty: (cur?.qty || 0) + x.qty });
    }
    return m;
  };
  const a = sum(order);
  const b = sum(so.items);
  const diffs: Diff[] = [];
  let matched = 0;
  for (const [k, x] of a) {
    const y = b.get(k);
    if (!y) diffs.push({ kind: "missing", item: x.name, order: x.qty });
    else if (Math.abs(y.qty - x.qty) > 0.001) diffs.push({ kind: "qty", item: x.name, order: x.qty, so: y.qty });
    else matched++;
  }
  for (const [k, y] of b) if (!a.has(k)) diffs.push({ kind: "extra", item: y.name, so: y.qty });
  if (so.orderNos.length && !so.orderNos.includes(orderNo.toUpperCase())) diffs.push({ kind: "orderNo", so: so.orderNos.join(", ") });
  if (orderSoNumber && so.soNumber && norm(orderSoNumber) !== norm(so.soNumber)) diffs.push({ kind: "soNumber", order: orderSoNumber, so: so.soNumber });

  if (diffs.length) return { ...base, status: "diff", matched, diffs };
  if (!partyKnown) return { ...base, status: "party", matched, diffs: [{ kind: "party", order: orderParty, so: so.party }] };
  return { ...base, status: "ok", matched, diffs: [] };
}

/** Same name either way round ("Sky Mobile" / "SKY MOBILE TIRUR") counts as the same party. */
export function partyLooksSame(orderParty: string, soParty: string): boolean {
  const a = norm(orderParty), b = norm(soParty);
  return !!a && !!b && (a === b || (a.length >= 5 && b.includes(a)) || (b.length >= 5 && a.includes(b)));
}

export function parseCheck(v: unknown): SoCheck | null {
  try {
    const o = JSON.parse(String(v || ""));
    return o && o.v === 1 ? (o as SoCheck) : null;
  } catch {
    return null;
  }
}

/** Plain-English line for a difference, for the screen. */
export function diffText(d: Diff): string {
  switch (d.kind) {
    case "qty": return `${d.item}: order ${d.order}, SO ${d.so}`;
    case "missing": return `${d.item} (${d.order}) is not on the SO`;
    case "extra": return `${d.item} (${d.so}) is on the SO but not in the order`;
    case "orderNo": return `SO shows a different order number: ${d.so}`;
    case "soNumber": return `SO number differs: entered ${d.order}, PDF ${d.so}`;
    case "party": return `New party name on SO: ${d.so}`;
  }
}

/**
 * Next planned time: TAT counted in office hours (9:30 am – 6:30 pm IST,
 * Sundays off) — same rule as the O2D page, but fixed to India time so it is
 * right on the server too.
 */
export function plannedAfter(base: Date, tat: string): string {
  const IST = 330 * 60000;
  const parts = String(tat || "24 Hrs").trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] || "hrs").toLowerCase();
  if (isNaN(val)) return base.toISOString();
  let mins = unit.includes("day") ? val * 10 * 60 : val * 60;
  // Work in "IST wall clock as UTC" so getUTC* gives Indian time
  const d = new Date(base.getTime() + IST);
  const setTime = (h: number, m: number) => d.setUTCHours(h, m, 0, 0);
  for (let guard = 0; mins > 0 && guard < 400; guard++) {
    if (d.getUTCDay() === 0) { d.setUTCDate(d.getUTCDate() + 1); setTime(9, 30); continue; }
    const cur = d.getUTCHours() + d.getUTCMinutes() / 60;
    if (cur >= 18.5) { d.setUTCDate(d.getUTCDate() + 1); setTime(9, 30); continue; }
    if (cur < 9.5) setTime(9, 30);
    const end = new Date(d); end.setUTCHours(18, 30, 0, 0);
    const avail = (end.getTime() - d.getTime()) / 60000;
    if (mins <= avail) { d.setTime(d.getTime() + mins * 60000); mins = 0; }
    else { mins -= avail; d.setUTCDate(d.getUTCDate() + 1); setTime(9, 30); }
  }
  if (d.getUTCDay() === 0) { d.setUTCDate(d.getUTCDate() + 1); setTime(9, 30); }
  return new Date(d.getTime() - IST).toISOString();
}
