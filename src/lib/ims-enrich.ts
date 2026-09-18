import type { IMS } from "@/types/ims";
import { applyFloorOutToGFloorInMap, type FloorLedgerRow } from "./ims-1st-to-g-transfer";
import { isGrnForGFloor } from "./grn-packed";

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

export type IMSMovementMaps = {
  inQtyMap: Record<string, number>;
  outQtyMap: Record<string, number>;
  outQty60DaysMap: Record<string, number>;
  displayNameMap: Record<string, string>;
  grnKeys: Set<string>;
  o2dKeys: Set<string>;
};

function resolveMovementSource(
  nameKey: string,
  maps: IMSMovementMaps,
  isCatalog: boolean
): IMS["source"] {
  if (isCatalog) return "Details";
  const fromGrn = maps.grnKeys.has(nameKey);
  const fromO2d = maps.o2dKeys.has(nameKey);
  if (fromGrn && fromO2d) return "GRN, O2D";
  if (fromGrn) return "GRN";
  return "O2D";
}

export function buildIMSMovementMaps(
  grns: { Item_Name?: string; Qty?: string; cancelled?: string | boolean; status_1?: string; Packed_Unpacked?: string }[],
  outForm: { description?: string; qty?: string; date?: string; updated_at?: string }[],
  gFloorLedger: FloorLedgerRow[] = [],
  firstFloorLedger: FloorLedgerRow[] = []
): IMSMovementMaps {
  const inQtyMap: Record<string, number> = {};
  const outQtyMap: Record<string, number> = {};
  const outQty60DaysMap: Record<string, number> = {};
  const displayNameMap: Record<string, string> = {};
  const grnKeys = new Set<string>();
  const o2dKeys = new Set<string>();

  const rememberName = (raw: string) => {
    const key = raw.trim().toLowerCase();
    if (!key) return "";
    if (!displayNameMap[key]) displayNameMap[key] = raw.trim();
    return key;
  };

  grns.forEach((grn) => {
    if (grn.Item_Name && !grn.cancelled && grn.status_1 !== "Rejected" && isGrnForGFloor(grn)) {
      const qty = parseFloat(grn.Qty || "") || 0;
      const key = rememberName(grn.Item_Name);
      if (key) {
        grnKeys.add(key);
        inQtyMap[key] = (inQtyMap[key] || 0) + qty;
      }
    }
  });

  const now = Date.now();
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

  outForm.forEach((row) => {
    const rowDateTs = parseDateStr(row.date || row.updated_at || "");
    const isWithin60Days = rowDateTs > 0 && now - rowDateTs <= sixtyDaysMs;

    const addQty = (desc: string, qty: number) => {
      const key = rememberName(desc);
      if (!key) return;
      o2dKeys.add(key);
      outQtyMap[key] = (outQtyMap[key] || 0) + qty;
      if (isWithin60Days) {
        outQty60DaysMap[key] = (outQty60DaysMap[key] || 0) + qty;
      }
    };

    if (row.description && row.description.trim().startsWith("[") && row.description.trim().endsWith("]")) {
      try {
        const lineItems = JSON.parse(row.description);
        lineItems.forEach((item: { Description?: string; description?: string; Qty?: string; qty?: string }) => {
          const desc = (item.Description || item.description || "").trim();
          const qty = parseFloat(item.Qty || item.qty || "") || 0;
          if (desc) addQty(desc, qty);
        });
      } catch {
        // ignore parse errors
      }
    } else if (row.description) {
      const qty = parseFloat(row.qty || "") || 0;
      addQty(row.description.trim(), qty);
    }
  });

  gFloorLedger.forEach((row) => {
    if (!row.item_name) return;
    const inQ = parseFloat(String(row.in_qty || 0)) || 0;
    const outQ = parseFloat(String(row.out_qty || 0)) || 0;
    const key = rememberName(row.item_name);
    if (!key) return;

    const rowDateTs = parseDateStr(row.date || row.updated_at || "");
    const isWithin60Days = rowDateTs > 0 && now - rowDateTs <= sixtyDaysMs;

    if (inQ > 0) {
      inQtyMap[key] = (inQtyMap[key] || 0) + inQ;
    }
    if (outQ > 0) {
      outQtyMap[key] = (outQtyMap[key] || 0) + outQ;
      if (isWithin60Days) {
        outQty60DaysMap[key] = (outQty60DaysMap[key] || 0) + outQ;
      }
    }
  });

  applyFloorOutToGFloorInMap(firstFloorLedger, inQtyMap, rememberName);

  return { inQtyMap, outQtyMap, outQty60DaysMap, displayNameMap, grnKeys, o2dKeys };
}

function enrichQtyFields(
  nameKey: string,
  maps: IMSMovementMaps
): Pick<IMS, "in_qty" | "out_qty" | "live_stock" | "sale_percent" | "avg_daily_con" | "lead_time" | "safety_factor" | "max_level"> {
  const in_qty = maps.inQtyMap[nameKey] || 0;
  const out_qty = maps.outQtyMap[nameKey] || 0;
  const live_stock = in_qty - out_qty;
  const sale_percent = in_qty > 0 ? (out_qty / in_qty) * 100 : 0;
  const out60 = maps.outQty60DaysMap[nameKey] || 0;
  const avg_daily_con = out60 / 60;
  const lead_time = 30;
  const safety_factor = 1;
  const max_level = avg_daily_con * lead_time * safety_factor;

  return {
    in_qty,
    out_qty,
    live_stock,
    sale_percent: Number(sale_percent.toFixed(2)),
    avg_daily_con: Number(avg_daily_con.toFixed(2)),
    lead_time,
    safety_factor,
    max_level: Number(max_level.toFixed(2)),
  };
}

export function enrichIMSItems(
  catalogItems: IMS[],
  maps: IMSMovementMaps
): IMS[] {
  const catalogKeys = new Set(
    catalogItems
      .map((item) => (item.item_name || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const enrichedCatalog = catalogItems.map((item) => {
    const nameKey = (item.item_name || "").trim().toLowerCase();
    return {
      ...item,
      ...enrichQtyFields(nameKey, maps),
      is_pending: false,
      source: resolveMovementSource(nameKey, maps, true),
    };
  });

  const orphanKeys = new Set([
    ...Object.keys(maps.inQtyMap),
    ...Object.keys(maps.outQtyMap),
  ]);

  const orphanItems: IMS[] = [];
  orphanKeys.forEach((key) => {
    if (catalogKeys.has(key)) return;
    const in_qty = maps.inQtyMap[key] || 0;
    const out_qty = maps.outQtyMap[key] || 0;
    if (in_qty === 0 && out_qty === 0) return;

    orphanItems.push({
      id: `pending-${key}`,
      item_name: maps.displayNameMap[key] || key,
      est_amount_item: "",
      gst: "",
      final_amount: "",
      category: "",
      ...enrichQtyFields(key, maps),
      is_pending: true,
      source: resolveMovementSource(key, maps, false),
    });
  });

  orphanItems.sort((a, b) => a.item_name.localeCompare(b.item_name));

  return [...enrichedCatalog, ...orphanItems];
}

export function summarizeIMSMovement(
  catalogItems: IMS[],
  maps: IMSMovementMaps
): { totalIn: number; totalOut: number; liveStock: number } {
  const catalogKeys = new Set(
    catalogItems
      .map((item) => (item.item_name || "").trim().toLowerCase())
      .filter(Boolean)
  );

  let totalIn = 0;
  let totalOut = 0;

  const allKeys = new Set([...Object.keys(maps.inQtyMap), ...Object.keys(maps.outQtyMap)]);
  allKeys.forEach((key) => {
    totalIn += maps.inQtyMap[key] || 0;
    totalOut += maps.outQtyMap[key] || 0;
  });

  return {
    totalIn,
    totalOut,
    liveStock: totalIn - totalOut,
  };
}
