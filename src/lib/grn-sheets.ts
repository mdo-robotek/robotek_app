import { BaseSheetsService } from "./sheets/base-service";
import { GRN, GRNStepConfig } from "@/types/grn";
import { globalCache } from "./cache";
import { calculatePlannedTimeIST } from "./workingHours";

const GOOGLE_SHEET_ID = "170_kSzQKoO5N7euODaLz1kaJVXN7QRlRqHdnBn0kdos";
const SHEET_NAME = "GRN";

/** Company work day: 9:30 AM – 6:30 PM IST = 9 hours (Sundays off) */
const WORK_DAY_HOURS = 9;

class GRNService extends BaseSheetsService<GRN> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:AZ"; // Wider range for all columns
  protected idColumnIndex = 0;

  mapRowToItem(row: any[]): GRN {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] ?? "";
    const item: any = {
      id: get("id"),
      GRN_No: get("grn_no"),
      PO_Number: get("po_number"),
      Item_Name: get("item_name"),
      Category: get("category"),
      Qty: get("qty"),
      Country: get("country"),
      Attach_Bill: get("attach_bill"),
      Payment_Terms_In_days: get("payment_terms_(in_days)") || get("payment_terms_in_days"),
      Payment_Completed: get("payment_completed"),
      filled_by: get("filled_by"),
      Packed_Unpacked: get("packed/unpacked") || get("packed_unpacked") || get("packed unpacked"),
      updated_at: get("updated_at"),
      indent_id: get("indent_id"),
      cancelled: get("cancelled"),
    };

    // Map 9 steps
    for (let i = 1; i <= 9; i++) {
      item[`planned_${i}`] = get(`planned_${i}`);
      item[`actual_${i}`] = get(`actual_${i}`);
      item[`status_${i}`] = get(`status_${i}`);
      if ([1, 3].includes(i)) item[`remarks_${i}`] = get(`remarks_${i}`);
      if (i === 4) item[`vendor_visit_date_4`] = get(`vendor_visit_date_4`);
    }

    return item;
  }

  mapItemToRow(item: GRN): any[] {
    const totalCols = Math.max(...Object.values(this.hMap)) + 1 || 44;
    const row: any[] = Array(totalCols).fill("");
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("id", item.id);
    set("grn_no", item.GRN_No);
    set("po_number", item.PO_Number);
    set("item_name", item.Item_Name);
    set("category", item.Category);
    set("qty", item.Qty);
    set("country", item.Country);
    set("attach_bill", item.Attach_Bill);
    set("payment_terms_(in_days)", item.Payment_Terms_In_days);
    set("payment_completed", item.Payment_Completed);
    set("filled_by", item.filled_by);
    set("packed/unpacked", item.Packed_Unpacked);
    set("packed_unpacked", item.Packed_Unpacked);
    set("updated_at", item.updated_at);
    set("indent_id", item.indent_id);
    set("cancelled", item.cancelled);

    // Map 9 steps
    for (let i = 1; i <= 9; i++) {
      set(`planned_${i}`, (item as any)[`planned_${i}`]);
      set(`actual_${i}`, (item as any)[`actual_${i}`]);
      set(`status_${i}`, (item as any)[`status_${i}`]);
      if ([1, 3].includes(i)) set(`remarks_${i}`, (item as any)[`remarks_${i}`]);
      if (i === 4) set(`vendor_visit_date_4`, (item as any)[`vendor_visit_date_4`]);
    }

    return row;
  }

  async getStepConfig(options?: { forceRefresh?: boolean }): Promise<GRNStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_grn_step_config_v2`;
    // Drop legacy long-lived cache key if present
    globalCache.delete(`${this.spreadsheetId}_grn_step_config`);
    if (options?.forceRefresh) {
      globalCache.delete(cacheKey);
    } else {
      const cached = globalCache.get<GRNStepConfig[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const sheets = await this.getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `GRN Step Configuration!A2:C`,
      });
      const data: GRNStepConfig[] = (response.data.values || [])
        .map(row => ({
          step_name: String(row[0] || "").trim(),
          tat: String(row[1] || "").trim(),
          responsible_person: String(row[2] || "").trim(),
        }))
        .filter(row => row.step_name);

      // Short TTL — TAT changes must apply to new POs quickly
      globalCache.set(cacheKey, data, 30 * 1000);
      return data;
    } catch (error) {
      console.error("Error fetching GRN step config:", error);
      return [];
    }
  }

  async updateStepConfig(configs: GRNStepConfig[]): Promise<boolean> {
    try {
      const sheets = await this.getSheetsClient();
      const values = configs.map(c => [c.step_name, c.tat, c.responsible_person]);
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `GRN Step Configuration!A2:C${configs.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
      globalCache.delete(`${this.spreadsheetId}_grn_step_config`);
      globalCache.delete(`${this.spreadsheetId}_grn_step_config_v2`);
      return true;
    } catch (error) {
      console.error("Error updating GRN step config:", error);
      return false;
    }
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getNextGRNNum(): Promise<string> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const colIdx = this.hMap["grn_no"];
      if (colIdx === undefined) return "GRN-1";

      const letter = this.getColLetter(colIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${letter}:${letter}`,
      });

      const values = response.data.values?.slice(1) || [];
      let maxNum = 0;
      for (const row of values) {
        const val = String(row[0] || "");
        const match = val.match(/GRN-(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      return `GRN-${maxNum + 1}`;
    } catch (error) {
      console.error("Error generating GRN num:", error);
      return "GRN-1";
    }
  }

  async getNextGlobalPONum(): Promise<string> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const colIdx = this.hMap["po_number"];
      if (colIdx === undefined) return "PO0001";

      const letter = this.getColLetter(colIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${letter}:${letter}`,
      });

      const values = response.data.values?.slice(1) || [];
      let maxNum = 0;
      for (const row of values) {
        const val = String(row[0] || "");
        const match = val.match(/PO(\d+)/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = maxNum + 1;
      return `PO${nextNum.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error("Error generating global PO num:", error);
      return "PO0001";
    }
  }

  hasColumn(name: string): boolean {
    return this.hMap[name.toLowerCase()] !== undefined;
  }

  async refreshHeaders(): Promise<void> {
    globalCache.delete(`${this.spreadsheetId}_${this.sheetName}_headers`);
    this.hMap = {};
    await this.ensureHeaders();
  }

  private getColLetter(colIndex: number): string {
    let temp, letter = "";
    let col = colIndex + 1;
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = Math.floor((col - temp - 1) / 26);
    }
    return letter;
  }
}

function parseTatToWorkingHours(tat: string): number {
  const raw = String(tat || "").trim();
  const val = parseFloat(raw);
  if (!Number.isFinite(val) || val <= 0) return 24; // safe default
  const isDay = /day/i.test(raw);
  return isDay ? val * WORK_DAY_HOURS : val;
}

function calculateGRNPlannedDate(base: Date | string, tat: string): string {
  const date = new Date(base);
  if (isNaN(date.getTime())) return "";
  return calculatePlannedTimeIST(date, parseTatToWorkingHours(tat)).toISOString();
}

export const grnService = new GRNService();

export async function addGRNEntry(data: Partial<GRN>): Promise<string> {
  if (!data.id) {
    data.id = (await grnService.getNextNumericalId()).toString();
  }
  if (!data.GRN_No) {
    data.GRN_No = await grnService.getNextGRNNum();
  }
  
  const now = new Date().toISOString();
  data.updated_at = now;

  // Final column list for GRN
  const headers = [
    "id", "GRN_No", "PO_Number", "Item_Name", "Category", "Qty", "Country", "Attach_Bill", 
    "Payment_Terms_(In_days)", "Payment_Completed", "filled_by", "Packed/Unpacked", "Cancelled",
    "Planned_1", "Actual_1", "Status_1", "Remarks_1",
    "Planned_2", "Actual_2", "Status_2",
    "Planned_3", "Actual_3", "Status_3", "Remarks_3",
    "Planned_4", "Actual_4", "Status_4", "Vendor_Visit_Date_4",
    "Planned_5", "Actual_5", "Status_5",
    "Planned_6", "Actual_6", "Status_6",
    "Planned_7", "Actual_7", "Status_7",
    "Planned_8", "Actual_8", "Status_8",
    "Planned_9", "Actual_9", "Status_9",
    "updated_at", "indent_id"
  ];

  await grnService.ensureHeaders();
  if (!grnService.hasColumn("packed/unpacked") && !grnService.hasColumn("packed_unpacked")) {
    await grnService.refreshHeaders();
  }
  await grnService.ensureColumns(headers);

  // Initialize Step 1 only — always read fresh TAT from sheet (avoid stale cache)
  const stepConfig = await grnService.getStepConfig({ forceRefresh: true });
  const config =
    stepConfig.find(c => c.step_name.toLowerCase() === "quantity check") ||
    stepConfig[0];
  if (config) {
    const tat = config.tat || "24 Hrs";
    console.log(`[GRN] planned_1 TAT="${tat}" for step "${config.step_name}"`);
    data.planned_1 = calculateGRNPlannedDate(now, tat);
    data.status_1 = "Pending";
  }

  const success = await grnService.add(data as GRN);
  return success ? data.PO_Number! : "";
}

export async function getGRNItems(): Promise<GRN[]> {
  return grnService.getAll();
}

export async function updateGRNItem(id: string, updates: Partial<GRN>): Promise<boolean> {
  const items = await grnService.getAll();
  const existing = items.find(it => String(it.id) === String(id));
  if (!existing) return false;

  const merged = { ...existing, ...updates };

  // Trigger next step planned date if a step was just completed
  const stepConfig = await grnService.getStepConfig({ forceRefresh: true });
  for (let i = 1; i < 9; i++) {
    const actKey = `actual_${i}` as keyof GRN;
    const statusKey = `status_${i}` as keyof GRN;

    // If step i was just completed in this update
    if (updates[actKey] && !existing[actKey]) {
      const status = (updates[statusKey] || existing[statusKey]) as string;
      let nextStepIdx = i + 1;

      // Branching logic
      if (i === 1) {
        if (status === "Approved") nextStepIdx = 3;
        else nextStepIdx = 2;
      } else if (i === 3) {
        if (status === "Approved") nextStepIdx = 7;
        else nextStepIdx = 4;
      } else if (i === 5) {
        if (status === "Approved") nextStepIdx = 7;
        else nextStepIdx = 6;
      }

      const nextPlanKey = `planned_${nextStepIdx}` as keyof GRN;
      const nextStatusKey = `status_${nextStepIdx}` as keyof GRN;
      const nextCfg = stepConfig[nextStepIdx - 1];

      if (nextCfg) {
        const nextPlanned = calculateGRNPlannedDate(updates[actKey] as string, nextCfg.tat || "24 Hrs");
        (merged as any)[nextPlanKey] = nextPlanned;
        (merged as any)[nextStatusKey] = "Pending";
      }
    }
  }

  return grnService.update(id, merged);
}

export async function deleteGRNItem(id: string): Promise<boolean> {
  return grnService.delete(id);
}

export async function getNextGlobalPONumber(): Promise<string> {
  return grnService.getNextGlobalPONum();
}

export async function getGRNStepConfig(): Promise<GRNStepConfig[]> {
  return grnService.getStepConfig();
}

export async function updateGRNStepConfig(configs: GRNStepConfig[]): Promise<boolean> {
  return grnService.updateStepConfig(configs);
}
