import { BaseSheetsService } from "./sheets/base-service";
import { I2R, I2RStepConfig } from "@/types/i2r";
import { globalCache } from "./cache";

const GOOGLE_SHEET_ID = "1xOumI7LUWcde8C2PZv3Yd0pA6r0eJXdUOkJ_DiTFmZs";
const SHEET_NAME = "I2R";

class I2RService extends BaseSheetsService<I2R> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:AX"; 
  protected idColumnIndex = 0;

  private readonly CANONICAL_HEADERS = [
    "id", "Indend_Num", "Item_Name", "Quantity", "Category", "filled_by", "created_at", "updated_at",
    "Planned_1", "Actual_1", "Status_1",
    "Planned_2", "Actual_2", "Status_2",
    "Planned_3", "Actual_3", "Status_3", "Supplier_Name_3",
    "Planned_4", "Actual_4", "Status_4", "Lead_time_Acc_to_Vendor_4",
    "Planned_5", "Actual_5", "Status_5", "Sample_Pic_5", "Sample_Qty_5",
    "Planned_6", "Actual_6", "Status_6", "PO_Number_6",
    "Planned_7", "Actual_7", "Status_7",
    "Planned_8", "Actual_8", "Status_8", "Photo/Video_8",
    "Planned_9", "Actual_9", "Status_9", "Cargo_9",
    "Planned_10", "Actual_10", "Status_10", "Received_Qty_10",
    "Planned_11", "Actual_11", "Status_11",
    "Cancelled"
  ];

  mapRowToItem(row: any[]): I2R {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] ?? "";
    const item: any = {
      id: get("id"),
      indend_num: get("indend_num"),
      item_name: get("item_name"),
      quantity: get("quantity"),
      category: get("category"),
      filled_by: get("filled_by"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
      cancelled: get("cancelled"),
    };
    for (let i = 1; i <= 11; i++) {
      item[`planned_${i}`] = get(`planned_${i}`);
      item[`actual_${i}`] = get(`actual_${i}`);
      item[`status_${i}`] = get(`status_${i}`);
    }
    item.supplier_name_3 = get("supplier_name_3");
    item.lead_time_acc_to_vendor_4 = get("lead_time_acc_to_vendor_4");
    item.sample_pic_5 = get("sample_pic_5");
    item.sample_qty_5 = get("sample_qty_5");
    item.po_number_6 = get("po_number_6");
    item.photo_video_8 = get("photo/video_8");
    item.cargo_9 = get("cargo_9");
    item.received_qty_10 = get("received_qty_10");
    return item as I2R;
  }

  mapItemToRow(item: I2R): any[] {
    const totalCols = Object.keys(this.hMap).length || 43;
    const row: any[] = Array(totalCols).fill("");
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("id", item.id);
    set("indend_num", item.indend_num);
    set("item_name", item.item_name);
    set("quantity", item.quantity);
    set("category", item.category);
    set("filled_by", item.filled_by);
    set("created_at", item.created_at);
    set("updated_at", item.updated_at);
    set("cancelled", item.cancelled);

    for (let i = 1; i <= 11; i++) {
      set(`planned_${i}`, (item as any)[`planned_${i}`]);
      set(`actual_${i}`, (item as any)[`actual_${i}`]);
      set(`status_${i}`, (item as any)[`status_${i}`]);
    }

    set("supplier_name_3", item.supplier_name_3);
    set("lead_time_acc_to_vendor_4", item.lead_time_acc_to_vendor_4);
    set("sample_pic_5", item.sample_pic_5);
    set("sample_qty_5", item.sample_qty_5);
    set("po_number_6", item.po_number_6);
    set("photo/video_8", (item as any).photo_video_8 ?? "");
    set("cargo_9", (item as any).cargo_9);
    set("received_qty_10", (item as any).received_qty_10);

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getNextIndentNum(): Promise<string> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const indentColIdx = this.hMap["indend_num"];
      if (indentColIdx === undefined) return "INDT- 1";

      // Import getColumnLetter inline since it's exported from base-service
      const letter = this.getColLetter(indentColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${letter}:${letter}`,
      });

      const values = response.data.values?.slice(1) || [];
      let maxNum = 0;
      for (const row of values) {
        const val = String(row[0] || "");
        const match = val.match(/INDT-\s*(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      return `INDT- ${maxNum + 1}`;
    } catch (error) {
      console.error("Error generating indent num:", error);
      return "INDT- 1";
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


  async getStepConfig(): Promise<I2RStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_i2r_step_config`;
    const cached = globalCache.get<I2RStepConfig[]>(cacheKey);
    if (cached) return cached;

    const sheets = await this.getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `Step Configuration!A2:C`,
    });
    const data: I2RStepConfig[] =
      response.data.values?.map((row) => ({
        step_name: row[0] || "",
        tat: row[1] || "",
        responsible_person: row[2] || "",
      })) || [];

    globalCache.set(cacheKey, data, 60 * 60 * 1000);
    return data;
  }
}

export const i2rService = new I2RService();

export async function getI2RItems(): Promise<I2R[]> {
  return i2rService.getAll();
}

let i2rLock: Promise<any> = Promise.resolve();

export async function addI2RItem(data: Partial<I2R>): Promise<boolean> {
  return (i2rLock = i2rLock
    .then(async () => {
      if (!data.id) {
        data.id = (await i2rService.getNextNumericalId()).toString();
      }
      if (!data.indend_num) {
        data.indend_num = await i2rService.getNextIndentNum();
      }
      const now = new Date().toISOString();
      data.created_at = now;
      data.updated_at = now;
      console.log(`[I2R] Adding item:`, data.id, data.item_name);
      await i2rService.ensureColumns((i2rService as any).CANONICAL_HEADERS);

      const success = await i2rService.add(data as I2R);
      console.log(`[I2R] Add result:`, success);
      return success;
    })
    .catch((err) => {
      console.error("Error in addI2RItem lock:", err);
      return false;
    }));
}

export async function updateI2RItem(id: string, data: I2R): Promise<boolean> {
  data.updated_at = new Date().toISOString();
  // Ensure the canonical columns exist in the sheet before writing
  await i2rService.ensureColumns((i2rService as any).CANONICAL_HEADERS);
  return i2rService.update(id, data);
}

export async function deleteI2RItem(id: string): Promise<boolean> {
  return i2rService.delete(id);
}

export async function getNextIndentNum(): Promise<string> {
  return i2rService.getNextIndentNum();
}

export async function getI2RStepConfig(): Promise<I2RStepConfig[]> {
  return i2rService.getStepConfig();
}

export async function updateI2RStepConfig(configs: I2RStepConfig[]): Promise<boolean> {
  try {
    const sheets = await (i2rService as any).getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Step Configuration!A2:C${configs.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: configs.map((c) => [c.step_name, c.tat, c.responsible_person]),
      },
    });
    globalCache.delete(`${GOOGLE_SHEET_ID}_i2r_step_config`);
    return true;
  } catch (error) {
    console.error("Error updating I2R step config:", error);
    return false;
  }
}
