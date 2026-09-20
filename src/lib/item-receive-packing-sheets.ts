import { BaseSheetsService } from "./sheets/base-service";
import { ItemReceivePacking, ItemReceivePackingStepConfig } from "@/types/item-receive-packing";
import { globalCache } from "./cache";

const GOOGLE_SHEET_ID = "16vzYK1_Y2WI7Lsus_KHUB36BAzN4fLhUhy__Ug3f23M";
const SHEET_NAME = "Item Receive (PACKING)";

class ItemReceivePackingService extends BaseSheetsService<ItemReceivePacking> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:AA"; 
  protected idColumnIndex = 0;

  private readonly CANONICAL_HEADERS = [
    "id", "PPR_Num", "Item_Name", "Supplier_Name", "Po_No.", "Qty", "Attach_Bill", "Payment_Completed", "Payment_Terms_(In Days)",
    "created_at", "updated_at", "Cancelled",
    "Planned_1", "Actual_1", "Status_1",
    "Planned_2", "Actual_2", "Status_2", "Quality_Status_2", "Quality Status Remarks_2",
    "Planned_3", "Actual_3", "Status_3",
    "Planned_4", "Actual_4", "Status_4"
  ];

  mapRowToItem(row: any[]): ItemReceivePacking {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] ?? "";
    const item: any = {
      id: get("id"),
      ppr_num: get("ppr_num"),
      item_name: get("item_name"),
      supplier_name: get("supplier_name"),
      po_no: get("po_no."),
      qty: get("qty"),
      attach_bill: get("attach_bill"),
      payment_completed: get("payment_completed"),
      payment_terms_in_days: get("payment_terms_(in days)"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
      cancelled: get("cancelled"),
    };
    for (let i = 1; i <= 4; i++) {
      item[`planned_${i}`] = get(`planned_${i}`);
      item[`actual_${i}`] = get(`actual_${i}`);
      item[`status_${i}`] = get(`status_${i}`);
    }
    item.quality_status_2 = get("quality_status_2");
    item.quality_status_remarks_2 = get("quality status remarks_2");
    return item as ItemReceivePacking;
  }

  mapItemToRow(item: ItemReceivePacking): any[] {
    const totalCols = Object.keys(this.hMap).length || 25;
    const row: any[] = Array(totalCols).fill("");
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("id", item.id);
    set("ppr_num", item.ppr_num);
    set("item_name", item.item_name);
    set("supplier_name", item.supplier_name);
    set("po_no.", item.po_no);
    set("qty", item.qty);
    set("attach_bill", item.attach_bill);
    set("payment_completed", item.payment_completed);
    set("payment_terms_(in days)", item.payment_terms_in_days);
    set("created_at", item.created_at);
    set("updated_at", item.updated_at);
    set("cancelled", item.cancelled);

    for (let i = 1; i <= 4; i++) {
      set(`planned_${i}`, (item as any)[`planned_${i}`]);
      set(`actual_${i}`, (item as any)[`actual_${i}`]);
      set(`status_${i}`, (item as any)[`status_${i}`]);
    }

    set("quality_status_2", item.quality_status_2);
    set("quality status remarks_2", item.quality_status_remarks_2);

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getNextPPRNum(): Promise<string> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const pprColIdx = this.hMap["ppr_num"];
      if (pprColIdx === undefined) return "PPR- 1";

      const letter = this.getColLetter(pprColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${letter}:${letter}`,
      });

      const values = response.data.values?.slice(1) || [];
      let maxNum = 0;
      for (const row of values) {
        const val = String(row[0] || "");
        const match = val.match(/PPR-\s*(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      return `PPR- ${maxNum + 1}`;
    } catch (error) {
      console.error("Error generating PPR num:", error);
      return "PPR- 1";
    }
  }

  private getColLetter(colIndex: number): string {
    let temp,
      letter = "";
    let col = colIndex + 1;
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = Math.floor((col - temp - 1) / 26);
    }
    return letter;
  }

  async getStepConfig(): Promise<ItemReceivePackingStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_item_receive_packing_step_config`;
    const cached = globalCache.get<ItemReceivePackingStepConfig[]>(cacheKey);
    if (cached) return cached;

    const sheets = await this.getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `Item Receive (PACKING) Step Configuration!A2:C`,
    });
    const data: ItemReceivePackingStepConfig[] =
      response.data.values?.map((row) => ({
        step_name: row[0] || "",
        tat: row[1] || "",
        responsible_person: row[2] || "",
      })) || [];

    globalCache.set(cacheKey, data, 60 * 60 * 1000);
    return data;
  }
}

export const itemReceivePackingService = new ItemReceivePackingService();

export async function getItemReceivePackingItems(): Promise<ItemReceivePacking[]> {
  return itemReceivePackingService.getAll();
}

function calculatePlannedDate(base: Date | string, tat: string): string {
  let date = new Date(base);
  if (isNaN(date.getTime())) return "";
  const val = parseFloat(tat);
  const unit = tat.toLowerCase().includes("day") ? "day" : "hr";
  let mins = unit === "day" ? val * 10 * 60 : val * 60;
  while (mins > 0) {
    if (date.getDay() === 0) {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 30, 0, 0);
      continue;
    }
    const cur = date.getHours() + date.getMinutes() / 60;
    if (cur >= 19.5) {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 30, 0, 0);
      continue;
    }
    if (cur < 9.5) date.setHours(9, 30, 0, 0);
    const avail = (19.5 - (date.getHours() + date.getMinutes() / 60)) * 60;
    if (mins <= avail) {
      date.setMinutes(date.getMinutes() + mins);
      mins = 0;
    } else {
      mins -= avail;
      date.setDate(date.getDate() + 1);
      date.setHours(9, 30, 0, 0);
    }
  }
  return date.toISOString();
}

let itemReceiveLock: Promise<any> = Promise.resolve();

export async function addItemReceivePackingItem(data: Partial<ItemReceivePacking>): Promise<boolean> {
  return (itemReceiveLock = itemReceiveLock
    .then(async () => {
      if (!data.id) {
        data.id = (await itemReceivePackingService.getNextNumericalId()).toString();
      }
      if (!data.ppr_num) {
        data.ppr_num = await itemReceivePackingService.getNextPPRNum();
      }
      const now = new Date().toISOString();
      data.created_at = now;
      data.updated_at = now;

      // Compute Planned_1 based on the configured TAT for Step 1
      try {
        const configs = await itemReceivePackingService.getStepConfig();
        const tat1 = configs[0]?.tat || "24 Hrs";
        console.log("=== BACKEND Planned_1 Calculation ===");
        console.log("now (created_at):", now);
        console.log("configs:", configs);
        console.log("tat1:", tat1);
        data.planned_1 = calculatePlannedDate(now, tat1); // Server-side calculation!
        console.log("calculated planned_1:", data.planned_1);
        console.log("======================================");
      } catch (err) {
        console.error("Error calculating Planned_1 on backend:", err);
        data.planned_1 = calculatePlannedDate(now, "24 Hrs");
      }

      // Compute Planned_4 based on created_at + Payment_Terms_(In Days)
      try {
        if (data.payment_terms_in_days) {
          const days = parseFloat(data.payment_terms_in_days) || 0;
          const p4 = new Date(now);
          p4.setDate(p4.getDate() + days);
          data.planned_4 = p4.toISOString();
        }
      } catch (err) {
        console.error("Error calculating Planned_4 on backend:", err);
      }

      await itemReceivePackingService.ensureColumns((itemReceivePackingService as any).CANONICAL_HEADERS);
      return itemReceivePackingService.add(data as ItemReceivePacking);
    })
    .catch((err) => {
      console.error("Error in addItemReceivePackingItem lock:", err);
      return false;
    }));
}

export async function updateItemReceivePackingItem(id: string, data: ItemReceivePacking): Promise<boolean> {
  data.updated_at = new Date().toISOString();

  // Recalculate Planned_4 based on created_at + Payment_Terms_(In Days)
  try {
    const createdAt = data.created_at;
    if (createdAt && data.payment_terms_in_days) {
      const days = parseFloat(data.payment_terms_in_days) || 0;
      const p4 = new Date(createdAt);
      p4.setDate(p4.getDate() + days);
      data.planned_4 = p4.toISOString();
    }
  } catch (err) {
    console.error("Error recalculating Planned_4 on backend update:", err);
  }

  await itemReceivePackingService.ensureColumns((itemReceivePackingService as any).CANONICAL_HEADERS);
  return itemReceivePackingService.update(id, data);
}

export async function deleteItemReceivePackingItem(id: string): Promise<boolean> {
  return itemReceivePackingService.delete(id);
}

export async function getNextPPRNum(): Promise<string> {
  return itemReceivePackingService.getNextPPRNum();
}

export async function getItemReceivePackingStepConfig(): Promise<ItemReceivePackingStepConfig[]> {
  return itemReceivePackingService.getStepConfig();
}

export async function updateItemReceivePackingStepConfig(configs: ItemReceivePackingStepConfig[]): Promise<boolean> {
  try {
    const sheets = await (itemReceivePackingService as any).getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Item Receive (PACKING) Step Configuration!A2:C${configs.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: configs.map((c) => [c.step_name, c.tat, c.responsible_person]),
      },
    });
    globalCache.delete(`${GOOGLE_SHEET_ID}_item_receive_packing_step_config`);
    return true;
  } catch (error) {
    console.error("Error updating Item Receive (PACKING) step config:", error);
    return false;
  }
}
