import { BaseSheetsService } from "./sheets/base-service";
import {
  IMSMasterItem,
  IMS_MASTER_HEADERS,
} from "@/types/ims-master";
import { masterItemKey, normalizeActiveStatus } from "./ims-master-overlay";

export {
  masterItemKey,
  normalizeActiveStatus,
  indexMasterByName,
  overlayFromMaster,
} from "./ims-master-overlay";
export type { MasterOverlayFields } from "./ims-master-overlay";

const SPREADSHEET_ID = "12lk8GV7ZBpm6J-bA5TBWfHQ1qY0eEHIrwOICSnsuceE";
const SHEET_NAME = "Master";

class IMSMasterService extends BaseSheetsService<IMSMasterItem> {
  protected spreadsheetId = SPREADSHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:Z";
  protected idColumnIndex = 2;

  protected async ensureHeaders() {
    await super.ensureHeaders();
    if (this.hMap["item name"] !== undefined) {
      this.idColumnIndex = this.hMap["item name"];
    }
  }

  mapRowToItem(row: unknown[]): IMSMasterItem {
    const r = row as string[];
    const get = (h: string, fallbackIdx: number) => {
      const idx = this.hMap[h.toLowerCase()];
      return (idx !== undefined ? r[idx] : r[fallbackIdx]) || "";
    };
    const item_name = String(get("item name", 2)).trim();
    return {
      id: item_name,
      sku_code: String(get("sku code", 0)).trim(),
      category: String(get("category", 1)).trim(),
      item_name,
      active_status: normalizeActiveStatus(get("active/inactive", 3)),
      lead_time: String(get("lead time", 4)).trim(),
      safety_factor: String(get("safety factor", 5)).trim(),
    };
  }

  mapItemToRow(item: IMSMasterItem): unknown[] {
    const maxIdx = Math.max(...Object.values(this.hMap), IMS_MASTER_HEADERS.length - 1);
    const row: unknown[] = new Array(maxIdx + 1).fill("");
    const set = (h: string, val: unknown) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("sku code", item.sku_code || "");
    set("category", item.category || "");
    set("item name", item.item_name || "");
    set("active/inactive", item.active_status || "");
    set("lead time", item.lead_time || "");
    set("safety factor", item.safety_factor || "");

    return row;
  }
}

export const imsMasterService = new IMSMasterService();

export async function getIMSMasterItems(): Promise<IMSMasterItem[]> {
  try {
    await imsMasterService.ensureColumns([...IMS_MASTER_HEADERS]);
    return imsMasterService.getAll();
  } catch (error) {
    console.error("Error fetching IMS Master items:", error);
    return [];
  }
}

export type IMSMasterInput = {
  item_name: string;
  sku_code?: string;
  category?: string;
  active_status?: string;
  lead_time?: string | number;
  safety_factor?: string | number;
};

let masterLock: Promise<unknown> = Promise.resolve();

export async function upsertIMSMasterItem(
  input: IMSMasterInput
): Promise<{ success: boolean; added: boolean; item?: IMSMasterItem; error?: string }> {
  const item_name = (input.item_name || "").trim();
  if (!item_name) {
    return { success: false, added: false, error: "Item Name is required" };
  }

  return (masterLock = masterLock
    .then(async () => {
      await imsMasterService.ensureColumns([...IMS_MASTER_HEADERS]);
      const existingRows = await imsMasterService.getAll();
      const existing = existingRows.find(
        (row) => masterItemKey(row.item_name) === masterItemKey(item_name)
      );

      const row: IMSMasterItem = {
        id: existing?.item_name || item_name,
        sku_code: (input.sku_code || "").trim(),
        category: (input.category || "").trim(),
        item_name: existing?.item_name || item_name,
        active_status: normalizeActiveStatus(input.active_status),
        lead_time: String(input.lead_time ?? "").trim(),
        safety_factor: String(input.safety_factor ?? "").trim(),
      };

      if (existing) {
        const ok = await imsMasterService.update(existing.item_name, row);
        if (!ok) return { success: false, added: false, error: "Failed to update Master row" };
        imsMasterService.invalidateCache();
        return { success: true, added: false, item: row };
      }

      const ok = await imsMasterService.add(row);
      if (!ok) return { success: false, added: true, error: "Failed to add Master row" };
      imsMasterService.invalidateCache();
      return { success: true, added: true, item: row };
    })
    .catch((err) => {
      console.error("Error upserting IMS Master item:", err);
      return { success: false, added: false, error: "Failed to save Master row" };
    })) as Promise<{ success: boolean; added: boolean; item?: IMSMasterItem; error?: string }>;
}
