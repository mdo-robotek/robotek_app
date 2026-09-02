export type FloorLedgerRow = {
  id?: string;
  item_name?: string;
  category?: string;
  in_qty?: string | number;
  out_qty?: string | number;
  date?: string;
  updated_at?: string;
};

export type FirstFloorToGFloorTx = {
  item_name: string;
  category: string;
  date: string;
  in_qty: number;
  out_qty: number;
  source: "1stFloor";
};

function parseDateStr(dStr: string) {
  if (!dStr) return 0;
  let ts = Date.parse(dStr);
  if (!isNaN(ts)) return ts;
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) {
      ts = Date.parse(`${y}-${m}-${d}`);
      if (!isNaN(ts)) return ts;
    }
  }
  return 0;
}

function normalizeTxDate(row: FloorLedgerRow): string {
  let txDate = row.date || row.updated_at || "";
  const ts = parseDateStr(txDate);
  if (ts > 0) return new Date(ts).toISOString();
  return txDate;
}

/** Each 1st Floor OUT row becomes a G Floor IN transfer transaction. */
export function firstFloorOutRowsToGFloorInTxs(
  firstFloorLedger: FloorLedgerRow[],
  categoryMap: Record<string, string> = {}
): FirstFloorToGFloorTx[] {
  const transactions: FirstFloorToGFloorTx[] = [];

  firstFloorLedger.forEach((row) => {
    const name = (row.item_name || "").trim();
    if (!name) return;

    const outQty = parseFloat(String(row.out_qty ?? 0)) || 0;
    if (outQty <= 0) return;

    const lowerName = name.toLowerCase();
    transactions.push({
      item_name: name,
      category: (row.category || "").trim() || categoryMap[lowerName] || "GENERAL",
      date: normalizeTxDate(row),
      in_qty: outQty,
      out_qty: 0,
      source: "1stFloor",
    });
  });

  return transactions;
}

/** Add 1st Floor OUT quantities into a G Floor IN quantity map. */
export function applyFirstFloorOutToGFloorInMap(
  firstFloorLedger: FloorLedgerRow[],
  inQtyMap: Record<string, number>,
  rememberName: (raw: string) => string
) {
  firstFloorLedger.forEach((row) => {
    if (!row.item_name) return;
    const outQ = parseFloat(String(row.out_qty ?? 0)) || 0;
    if (outQ <= 0) return;
    const key = rememberName(row.item_name);
    if (!key) return;
    inQtyMap[key] = (inQtyMap[key] || 0) + outQ;
  });
}
