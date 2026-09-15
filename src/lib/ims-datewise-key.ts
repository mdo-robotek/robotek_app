export type DatewiseTxLike = {
  item_name: string;
  category?: string;
  date: string;
  in_qty?: number;
  out_qty?: number;
  tx_uid?: string;
};

export type DatewiseRowIdentity = {
  row_uid: string;
  _contentKey: string;
  _occurrence: number;
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

/** Stable unique id per row so same-day / same-qty duplicates can be selected independently. */
export function withUniqueDatewiseIds<T extends DatewiseTxLike>(
  rows: T[]
): Array<T & DatewiseRowIdentity> {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const contentKey = getDatewiseTxKey(row);
    const occurrence = seen.get(contentKey) ?? 0;
    seen.set(contentKey, occurrence + 1);
    const explicitUid = (row.tx_uid || "").trim();
    return {
      ...row,
      row_uid: explicitUid || `${contentKey}#${occurrence}`,
      _contentKey: contentKey,
      _occurrence: occurrence,
    };
  });
}

export function uniquifyByBaseId<T>(
  rows: T[],
  getId: (row: T, index: number) => string
): Array<T & { row_uid: string }> {
  const seen = new Map<string, number>();
  return rows.map((row, index) => {
    const base = (getId(row, index) || "").trim() || `noid-${index}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...row, row_uid: n === 0 ? base : `${base}#${n}` };
  });
}

export function matchesDatewiseStatus(
  row: DatewiseRowIdentity,
  uidSet: Set<string>,
  legacyContentSet: Set<string>
): boolean {
  if (uidSet.has(row.row_uid)) return true;
  return row._occurrence === 0 && legacyContentSet.has(row._contentKey);
}
