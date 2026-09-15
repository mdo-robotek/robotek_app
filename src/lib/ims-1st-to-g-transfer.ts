export type FloorLedgerRow = {
  id?: string;
  item_name?: string;
  category?: string;
  in_qty?: string | number;
  out_qty?: string | number;
  date?: string;
  updated_at?: string;
};

export type FloorToGFloorTx = {
  item_name: string;
  category: string;
  date: string;
  in_qty: number;
  out_qty: number;
  source: "1stFloor" | "SFG";
  tx_uid?: string;
};

export type FirstFloorToGFloorTx = FloorToGFloorTx;

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

/** Each floor OUT row becomes a G Floor IN transfer transaction. */
export function floorOutRowsToGFloorInTxs(
  ledger: FloorLedgerRow[],
  categoryMap: Record<string, string> = {},
  source: "1stFloor" | "SFG" = "1stFloor"
): FloorToGFloorTx[] {
  const transactions: FloorToGFloorTx[] = [];

  ledger.forEach((row, index) => {
    const name = (row.item_name || "").trim();
    if (!name) return;

    const outQty = parseFloat(String(row.out_qty ?? 0)) || 0;
    if (outQty <= 0) return;

    const lowerName = name.toLowerCase();
    const prefix = source === "SFG" ? "sfg" : "1st";
    const rowId = String(row.id || "").trim();
    transactions.push({
      item_name: name,
      category: (row.category || "").trim() || categoryMap[lowerName] || "GENERAL",
      date: normalizeTxDate(row),
      in_qty: outQty,
      out_qty: 0,
      source,
      tx_uid: rowId ? `${prefix}:${rowId}:out2g` : `${prefix}:idx:${index}:out2g`,
    });
  });

  return transactions;
}

/** Each 1st Floor OUT row becomes a G Floor IN transfer transaction. */
export function firstFloorOutRowsToGFloorInTxs(
  firstFloorLedger: FloorLedgerRow[],
  categoryMap: Record<string, string> = {}
): FirstFloorToGFloorTx[] {
  return floorOutRowsToGFloorInTxs(firstFloorLedger, categoryMap, "1stFloor");
}

/** Add floor OUT quantities into a G Floor IN quantity map. */
export function applyFloorOutToGFloorInMap(
  ledger: FloorLedgerRow[],
  inQtyMap: Record<string, number>,
  rememberName: (raw: string) => string
) {
  ledger.forEach((row) => {
    if (!row.item_name) return;
    const outQ = parseFloat(String(row.out_qty ?? 0)) || 0;
    if (outQ <= 0) return;
    const key = rememberName(row.item_name);
    if (!key) return;
    inQtyMap[key] = (inQtyMap[key] || 0) + outQ;
  });
}

/** Add 1st Floor OUT quantities into a G Floor IN quantity map. */
export function applyFirstFloorOutToGFloorInMap(
  firstFloorLedger: FloorLedgerRow[],
  inQtyMap: Record<string, number>,
  rememberName: (raw: string) => string
) {
  applyFloorOutToGFloorInMap(firstFloorLedger, inQtyMap, rememberName);
}
