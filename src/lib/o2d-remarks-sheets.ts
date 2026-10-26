import { BaseSheetsService } from "./sheets/base-service";

// Daily follow-up remarks on pending orders (Sahil's team, 2026-10-23):
// why an order is stuck, noted from the daily follow-up calls, kept per
// order for future reference. Append-only log — the latest remark per
// order is what the dashboards show.
const SPREADSHEET_ID = "1T0vSzAgHoO21DifCUcPMRLR4yOy-kFteJ2bv6pG-UTc"; // same as O2D sheet
const SHEET_NAME = "Followup Remarks";

export interface OrderFollowupRemark {
  id: string;
  order_no: string;
  remark: string;
  remark_by?: string;
  created_at?: string;
}

class O2DRemarksService extends BaseSheetsService<OrderFollowupRemark> {
  protected spreadsheetId = SPREADSHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:E";
  protected idColumnIndex = 0;

  mapRowToItem(row: unknown[]): OrderFollowupRemark {
    const r = row as string[];
    return {
      id: String(r[0] || ""),
      order_no: String(r[1] || "").trim(),
      remark: String(r[2] || ""),
      remark_by: String(r[3] || ""),
      created_at: String(r[4] || ""),
    };
  }

  mapItemToRow(item: OrderFollowupRemark): unknown[] {
    return [
      item.id,
      item.order_no,
      item.remark,
      item.remark_by || "",
      item.created_at || new Date().toISOString(),
    ];
  }
}

export const o2dRemarksService = new O2DRemarksService();

export async function getOrderFollowupRemarks(): Promise<OrderFollowupRemark[]> {
  try {
    return await o2dRemarksService.getAll();
  } catch (error) {
    console.error("Error fetching followup remarks:", error);
    return [];
  }
}

/** Latest remark per order_no (case-insensitive key). */
export function latestRemarkByOrder(remarks: OrderFollowupRemark[]): Record<string, OrderFollowupRemark> {
  const map: Record<string, OrderFollowupRemark> = {};
  remarks.forEach((r) => {
    const key = r.order_no.toLowerCase();
    if (!key) return;
    const existing = map[key];
    if (!existing || String(r.created_at || "") > String(existing.created_at || "")) {
      map[key] = r;
    }
  });
  return map;
}

export async function addOrderFollowupRemark(
  entry: Omit<OrderFollowupRemark, "id" | "created_at">
): Promise<boolean> {
  try {
    return await o2dRemarksService.add({
      ...entry,
      id: `FR${Date.now()}`,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error adding followup remark:", error);
    return false;
  }
}
