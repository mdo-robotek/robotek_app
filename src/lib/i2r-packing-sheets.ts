import { BaseSheetsService } from "./sheets/base-service";
import { I2RPacking, I2RPackingStepConfig } from "@/types/i2r-packing";
import { globalCache } from "./cache";

const GOOGLE_SHEET_ID = "1bU0PAuk7J7hKCAsQ46Z78An3bXbA8EB4npTd9H7XkKM";
const SHEET_NAME = "I2R Packing";

class I2RPackingService extends BaseSheetsService<I2RPacking> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:AF"; 
  protected idColumnIndex = 0;

  private readonly CANONICAL_HEADERS = [
    "id", "PPF_Num", "Packing_Design", "Total_Qty", "Last_Suppliar", "Item_Name", "Required_by", 
    "created_at", "updated_at", "Cancelled",
    "Planned_1", "Actual_1", "Status_1",
    "Planned_2", "Actual_2", "Status_2",
    "Planned_3", "Actual_3", "Status_3", "Vendor_Name_3", "Lead_Time_3", "PI_3",
    "Planned_4", "Actual_4", "Status_4", "PO_Num_4",
    "Planned_5", "Actual_5", "Status_5",
    "Planned_6", "Actual_6", "Status_6"
  ];

  mapRowToItem(row: any[]): I2RPacking {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] ?? "";
    const item: any = {
      id: get("id"),
      ppf_num: get("ppf_num"),
      packing_design: get("packing_design"),
      total_qty: get("total_qty"),
      last_suppliar: get("last_suppliar"),
      item_name: get("item_name"),
      required_by: get("required_by"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
      cancelled: get("cancelled"),
    };
    for (let i = 1; i <= 6; i++) {
      item[`planned_${i}`] = get(`planned_${i}`);
      item[`actual_${i}`] = get(`actual_${i}`);
      item[`status_${i}`] = get(`status_${i}`);
    }
    item.vendor_name_3 = get("vendor_name_3");
    item.lead_time_3 = get("lead_time_3");
    item.pi_3 = get("pi_3");
    item.po_num_4 = get("po_num_4");
    return item as I2RPacking;
  }

  mapItemToRow(item: I2RPacking): any[] {
    const totalCols = Object.keys(this.hMap).length || 35;
    const row: any[] = Array(totalCols).fill("");
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("id", item.id);
    set("ppf_num", item.ppf_num);
    set("packing_design", item.packing_design);
    set("total_qty", item.total_qty);
    set("last_suppliar", item.last_suppliar);
    set("item_name", item.item_name);
    set("required_by", item.required_by);
    set("created_at", item.created_at);
    set("updated_at", item.updated_at);
    set("cancelled", item.cancelled);

    for (let i = 1; i <= 6; i++) {
      set(`planned_${i}`, (item as any)[`planned_${i}`]);
      set(`actual_${i}`, (item as any)[`actual_${i}`]);
      set(`status_${i}`, (item as any)[`status_${i}`]);
    }

    set("vendor_name_3", item.vendor_name_3);
    set("lead_time_3", item.lead_time_3);
    set("pi_3", item.pi_3);
    set("po_num_4", item.po_num_4);

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getNextPPFNum(): Promise<string> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const ppfColIdx = this.hMap["ppf_num"];
      if (ppfColIdx === undefined) return "PPF- 1";

      const letter = this.getColLetter(ppfColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${letter}:${letter}`,
      });

      const values = response.data.values?.slice(1) || [];
      let maxNum = 0;
      for (const row of values) {
        const val = String(row[0] || "");
        const match = val.match(/PPF-\s*(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      return `PPF- ${maxNum + 1}`;
    } catch (error) {
      console.error("Error generating PPF num:", error);
      return "PPF- 1";
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

  async getStepConfig(): Promise<I2RPackingStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_i2r_packing_step_config`;
    const cached = globalCache.get<I2RPackingStepConfig[]>(cacheKey);
    if (cached) return cached;

    const sheets = await this.getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `I2R Packing Step Configuration!A2:C`,
    });
    const data: I2RPackingStepConfig[] =
      response.data.values?.map((row) => ({
        step_name: row[0] || "",
        tat: row[1] || "",
        responsible_person: row[2] || "",
      })) || [];

    globalCache.set(cacheKey, data, 60 * 60 * 1000);
    return data;
  }
}

export const i2rPackingService = new I2RPackingService();

export async function getI2RPackingItems(): Promise<I2RPacking[]> {
  return i2rPackingService.getAll();
}

let packingLock: Promise<any> = Promise.resolve();

export async function addI2RPackingItem(data: Partial<I2RPacking>): Promise<boolean> {
  return (packingLock = packingLock
    .then(async () => {
      if (!data.id) {
        data.id = (await i2rPackingService.getNextNumericalId()).toString();
      }
      if (!data.ppf_num) {
        data.ppf_num = await i2rPackingService.getNextPPFNum();
      }
      const now = new Date().toISOString();
      data.created_at = now;
      data.updated_at = now;
      await i2rPackingService.ensureColumns((i2rPackingService as any).CANONICAL_HEADERS);
      return i2rPackingService.add(data as I2RPacking);
    })
    .catch((err) => {
      console.error("Error in addI2RPackingItem lock:", err);
      return false;
    }));
}

export async function updateI2RPackingItem(id: string, data: I2RPacking): Promise<boolean> {
  data.updated_at = new Date().toISOString();
  await i2rPackingService.ensureColumns((i2rPackingService as any).CANONICAL_HEADERS);
  return i2rPackingService.update(id, data);
}

export async function deleteI2RPackingItem(id: string): Promise<boolean> {
  return i2rPackingService.delete(id);
}

export async function getNextPPFNum(): Promise<string> {
  return i2rPackingService.getNextPPFNum();
}

export async function getI2RPackingStepConfig(): Promise<I2RPackingStepConfig[]> {
  return i2rPackingService.getStepConfig();
}

export async function updateI2RPackingStepConfig(configs: I2RPackingStepConfig[]): Promise<boolean> {
  try {
    const sheets = await (i2rPackingService as any).getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `I2R Packing Step Configuration!A2:C${configs.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: configs.map((c) => [c.step_name, c.tat, c.responsible_person]),
      },
    });
    globalCache.delete(`${GOOGLE_SHEET_ID}_i2r_packing_step_config`);
    return true;
  } catch (error) {
    console.error("Error updating I2R Packing step config:", error);
    return false;
  }
}
