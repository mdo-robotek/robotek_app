import { BaseSheetsService } from "./sheets/base-service";
import { Replace, ReplaceStepConfig } from "@/types/replace";
import { globalCache } from "./cache";

const GOOGLE_SHEET_ID = "1qvzHJ-QHkmzVoPyOw7KoQKFGIUkAdQb_Rf3j0xLFdr0";
const SHEET_NAME = "Replace";

class ReplaceService extends BaseSheetsService<Replace> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:AQ"; 
  protected idColumnIndex = 0;

  private readonly CANONICAL_HEADERS = [
    "id", "RN_Num", "Receiver_Name", "Party_Name", "Num_of_Parcel", "Parcel_Photo", "Send_Kundli", "PC_Remarks", 
    "created_at", "updated_at", "Cancelled",
    "Planned_1", "Actual_1", "Status_1",
    "Planned_2", "Actual_2", "Status_2",
    "Planned_3", "Actual_3", "Status_3", "Total_Weight_3", "Weight_Image_3",
    "Planned_4", "Actual_4", "Status_4", "SS_of_detail_4",
    "Planned_5", "Actual_5", "Status_5", "Voucher_No._5", "Voucher_Image_5",
    "Planned_6", "Actual_6", "Status_6",
    "Planned_7", "Actual_7", "Status_7",
    "Planned_8", "Actual_8", "Status_8",
    "Planned_9", "Actual_9", "Status_9"
  ];

  mapRowToItem(row: any[]): Replace {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] ?? "";
    const item: any = {
      id: get("id"),
      rn_num: get("rn_num"),
      receiver_name: get("receiver_name"),
      party_name: get("party_name"),
      num_of_parcel: get("num_of_parcel"),
      parcel_photo: get("parcel_photo"),
      send_kundli: get("send_kundli"),
      pc_remarks: get("pc_remarks"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
      cancelled: get("cancelled"),
    };
    for (let i = 1; i <= 9; i++) {
      item[`planned_${i}`] = get(`planned_${i}`);
      item[`actual_${i}`] = get(`actual_${i}`);
      item[`status_${i}`] = get(`status_${i}`);
    }
    item.total_weight_3 = get("total_weight_3");
    item.weight_image_3 = get("weight_image_3");
    item.ss_of_detail_4 = get("ss_of_detail_4");
    item.voucher_no_5 = get("voucher_no._5");
    item.voucher_image_5 = get("voucher_image_5");
    return item as Replace;
  }

  mapItemToRow(item: Replace): any[] {
    const totalCols = Object.keys(this.hMap).length || 43;
    const row: any[] = Array(totalCols).fill("");
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("id", item.id);
    set("rn_num", item.rn_num);
    set("receiver_name", item.receiver_name);
    set("party_name", item.party_name);
    set("num_of_parcel", item.num_of_parcel);
    set("parcel_photo", item.parcel_photo);
    set("send_kundli", item.send_kundli);
    set("pc_remarks", item.pc_remarks);
    set("created_at", item.created_at);
    set("updated_at", item.updated_at);
    set("cancelled", item.cancelled);

    for (let i = 1; i <= 9; i++) {
      set(`planned_${i}`, (item as any)[`planned_${i}`]);
      set(`actual_${i}`, (item as any)[`actual_${i}`]);
      set(`status_${i}`, (item as any)[`status_${i}`]);
    }

    set("total_weight_3", item.total_weight_3);
    set("weight_image_3", item.weight_image_3);
    set("ss_of_detail_4", item.ss_of_detail_4);
    set("voucher_no._5", item.voucher_no_5);
    set("voucher_image_5", item.voucher_image_5);

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getNextRNNum(): Promise<string> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const rnColIdx = this.hMap["rn_num"];
      if (rnColIdx === undefined) return "RN- 1";

      const letter = this.getColLetter(rnColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${letter}:${letter}`,
      });

      const values = response.data.values?.slice(1) || [];
      let maxNum = 0;
      for (const row of values) {
        const val = String(row[0] || "");
        const match = val.match(/RN-\s*(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      return `RN- ${maxNum + 1}`;
    } catch (error) {
      console.error("Error generating RN num:", error);
      return "RN- 1";
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

  async getStepConfig(): Promise<ReplaceStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_replace_step_config`;
    const cached = globalCache.get<ReplaceStepConfig[]>(cacheKey);
    if (cached) return cached;

    const sheets = await this.getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `Replace Step Configuration!A2:C`,
    });
    const data: ReplaceStepConfig[] =
      response.data.values?.map((row) => ({
        step_name: row[0] || "",
        tat: row[1] || "",
        responsible_person: row[2] || "",
      })) || [];

    globalCache.set(cacheKey, data, 60 * 60 * 1000);
    return data;
  }
}

export const replaceService = new ReplaceService();

export async function getReplaceItems(): Promise<Replace[]> {
  return replaceService.getAll();
}

let replaceLock: Promise<any> = Promise.resolve();

export async function addReplaceItem(data: Partial<Replace>): Promise<boolean> {
  return (replaceLock = replaceLock
    .then(async () => {
      if (!data.id) {
        data.id = (await replaceService.getNextNumericalId()).toString();
      }
      if (!data.rn_num) {
        data.rn_num = await replaceService.getNextRNNum();
      }
      const now = new Date().toISOString();
      data.created_at = now;
      data.updated_at = now;
      await replaceService.ensureColumns((replaceService as any).CANONICAL_HEADERS);
      return replaceService.add(data as Replace);
    })
    .catch((err) => {
      console.error("Error in addReplaceItem lock:", err);
      return false;
    }));
}

export async function updateReplaceItem(id: string, data: Replace): Promise<boolean> {
  data.updated_at = new Date().toISOString();
  await replaceService.ensureColumns((replaceService as any).CANONICAL_HEADERS);
  return replaceService.update(id, data);
}

export async function deleteReplaceItem(id: string): Promise<boolean> {
  return replaceService.delete(id);
}

export async function getNextRNNum(): Promise<string> {
  return replaceService.getNextRNNum();
}

export async function getReplaceStepConfig(): Promise<ReplaceStepConfig[]> {
  return replaceService.getStepConfig();
}

export async function updateReplaceStepConfig(configs: ReplaceStepConfig[]): Promise<boolean> {
  try {
    const sheets = await (replaceService as any).getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Replace Step Configuration!A2:C${configs.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: configs.map((c) => [c.step_name, c.tat, c.responsible_person]),
      },
    });
    globalCache.delete(`${GOOGLE_SHEET_ID}_replace_step_config`);
    return true;
  } catch (error) {
    console.error("Error updating Replace step config:", error);
    return false;
  }
}
