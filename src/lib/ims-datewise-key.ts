export type DatewiseTxLike = {
  item_name: string;
  category?: string;
  date: string;
  in_qty?: number;
  out_qty?: number;
};

export function normalizeTxDate(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  const ts = Date.parse(trimmed);
  if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);

  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) {
      const iso = `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      const parsed = Date.parse(iso);
      if (!isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
    }
  }

  return trimmed;
}

export function getTxSortTime(dateStr: string): number {
  const normalized = normalizeTxDate(dateStr);
  if (!normalized) return 0;
  const ts = Date.parse(normalized);
  return isNaN(ts) ? 0 : ts;
}

export function getDatewiseTxKey(tx: DatewiseTxLike): string {
  const date = normalizeTxDate(tx.date);
  const name = (tx.item_name || "").trim().toLowerCase();
  const cat = (tx.category || "").trim().toLowerCase();
  const inQ = tx.in_qty || 0;
  const outQ = tx.out_qty || 0;
  return `${date}|${name}|${cat}|${inQ}|${outQ}`;
}

export function approvalToTxKey(row: {
  item_name: string;
  category?: string;
  date: string;
  in_qty?: string | number;
  out_qty?: string | number;
}): string {
  return getDatewiseTxKey({
    item_name: row.item_name,
    category: row.category,
    date: row.date,
    in_qty: parseFloat(String(row.in_qty ?? 0)) || 0,
    out_qty: parseFloat(String(row.out_qty ?? 0)) || 0,
  });
}
