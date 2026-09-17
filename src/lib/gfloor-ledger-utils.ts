export const GFLOOR_ENTRY_PRODUCTION = "PRODUCTION";
export const GFLOOR_ENTRY_PHYSICAL = "PHYSICAL";

export type GFloorTxSource = "Production" | "GFloor";

export function resolveGFloorLedgerSource(row: {
  in_qty?: string | number;
  out_qty?: string | number;
  packed_status?: string;
  source?: string;
}): GFloorTxSource {
  const tag = String(row.source || row.packed_status || "").trim().toUpperCase();
  if (tag === "PRODUCTION" || tag === "PRODUCTION IN") return "Production";
  if (tag === "PHYSICAL" || tag === "AUDIT" || tag === "PHYSICAL CHECK") return "GFloor";
  const inQty = parseFloat(String(row.in_qty ?? 0)) || 0;
  const outQty = parseFloat(String(row.out_qty ?? 0)) || 0;
  if (inQty > 0 && outQty <= 0) return "Production";
  return "GFloor";
}

export function isGFloorLedgerSource(source?: string): boolean {
  return source === "GFloor" || source === "Production";
}

export const roundQty = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

export const computeAuditDiff = (physicalQty: number, liveStock: number) => {
  const diff = roundQty(physicalQty - liveStock);
  if (diff === 0) {
    return { diff_qty: 0, diff_type: "NONE" as const };
  }
  return {
    diff_qty: Math.abs(diff),
    diff_type: diff > 0 ? ("IN" as const) : ("OUT" as const),
  };
};

export type GFloorStockItem = {
  item_name: string;
  category?: string;
  live_stock?: number;
};

export function getGFloorItemStock(
  itemName: string,
  items: GFloorStockItem[]
): { live_stock: number; category: string } {
  const key = itemName.toLowerCase().trim();
  const match = items.find((i) => (i.item_name || "").toLowerCase().trim() === key);
  return {
    live_stock: match?.live_stock ?? 0,
    category: (match?.category || "").trim(),
  };
}
