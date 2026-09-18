import { BaseSheetsService, getColumnLetter } from "./sheets/base-service";
import { O2D, O2DStepConfig } from "@/types/o2d";
import { OutFormLineItem, OutFormRow } from "@/types/ims-out-form";
import { google } from "googleapis";
import { globalCache } from "./cache";

const GOOGLE_SHEET_ID = "1T0vSzAgHoO21DifCUcPMRLR4yOy-kFteJ2bv6pG-UTc";
const SHEET_NAME = "O2D";
const ARCHIVED_SHEET_NAME = "O2D Archived";
const CONFIG_SHEET_NAME = "Step Configuration";

class O2DService extends BaseSheetsService<O2D> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName: string;
  protected range = "A:ZZ";
  protected idColumnIndex = 0;

  constructor(sheetName: string = SHEET_NAME) {
    super();
    this.sheetName = sheetName;
  }

  mapRowToItem(row: any[]): O2D {
    const get = (h: string) => {
      const normalized = h.toLowerCase();
      // Try exact match first
      if (this.hMap[normalized] !== undefined) return row[this.hMap[normalized]] || "";
      
      // Try common variations/typos
      const variations = [
        normalized.replace("upload", "upoad"),
        normalized.replace("bilty", "billty"),
        normalized.replace("billty", "bilty"), // cover reverse
      ];
      
      for (const v of variations) {
        if (this.hMap[v] !== undefined) return row[this.hMap[v]] || "";
      }
      return "";
    };
    const item: O2D = {
      id: get("id"),
      order_no: get("order_no."),
      party_name: get("party_name"),
      item_name: get("item_name"),
      item_qty: get("item_qty"),
      est_amount: get("est._amount"),
      item_specification: get("item_specification"),
      remark: get("remark"),
      order_screenshot: get("order_screenshot"),
      filled_by: get("filled_by"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
      hold: get("hold"),
      cancelled: get("cancelled"),
    };

    for (let i = 1; i <= 11; i++) {
      (item as any)[`planned_${i}`] = get(`planned_${i}`);
      (item as any)[`actual_${i}`] = get(`actual_${i}`);
      (item as any)[`status_${i}`] = get(`status_${i}`);
      if (i === 1) {
        item.final_amount_1 = get("final_amount_1");
        item.so_number_1 = get("so_number_1");
        item.merge_order_with_1 = get("merge_order_with_1");
        item.upload_so_1 = get("upload_so_(attachment)_1");
      } else if (i === 5) {
        item.num_of_parcel_5 = get("num_of_parcel_5");
        item.upload_pi_5 = get("upload_pi_(attachment)_5");
        item.actual_date_of_order_packed_5 = get("actual_date_of_order_packed_5");
      } else if (i === 7) {
        item.voucher_num_7 = get("voucher_num_7");
      } else if (i === 8) {
        item.order_details_checked_8 = get("order_details_checked_in_order_sheet_(yes,no)_8");
        item.voucher_num_51_8 = get("voucher_num_(51)_8");
        item.t_amt_8 = get("t._amt_8");
      } else if (i === 9) {
        item.attach_bilty_9 = get("attach_bilty_(attachment)_9");
        item.num_of_parcel_9 = get("num_of_parcel_9");
      }
    }
    return item;
  }

  mapItemToRow(o2d: O2D): any[] {
    const row: any[] = [];
    const set = (h: string, val: any) => {
      const normalized = h.toLowerCase();
      const variations = [
        normalized,
        normalized.replace("upload", "upoad"),
        normalized.replace("bilty", "billty"),
        normalized.replace("billty", "bilty"),
      ];
      
      for (const v of variations) {
        const idx = this.hMap[v];
        if (idx !== undefined) {
          row[idx] = val;
          return;
        }
      }
    };
    set("id", o2d.id);
    set("order_no.", o2d.order_no);
    set("party_name", o2d.party_name);
    set("item_name", o2d.item_name);
    set("item_qty", o2d.item_qty);
    set("est._amount", o2d.est_amount);
    set("item_specification", o2d.item_specification);
    set("remark", o2d.remark);
    set("order_screenshot", o2d.order_screenshot);
    set("filled_by", o2d.filled_by);
    set("created_at", o2d.created_at);
    set("updated_at", o2d.updated_at);
    set("hold", o2d.hold || "");
    set("cancelled", o2d.cancelled || "");
    for (let i = 1; i <= 11; i++) {
      set(`planned_${i}`, (o2d as any)[`planned_${i}`]);
      set(`actual_${i}`, (o2d as any)[`actual_${i}`]);
      set(`status_${i}`, (o2d as any)[`status_${i}`]);
      if (i === 1) {
        set("final_amount_1", o2d.final_amount_1);
        set("so_number_1", o2d.so_number_1);
        set("merge_order_with_1", o2d.merge_order_with_1);
        set("upload_so_(attachment)_1", o2d.upload_so_1);
      } else if (i === 5) {
        set("num_of_parcel_5", o2d.num_of_parcel_5);
        set("upload_pi_(attachment)_5", o2d.upload_pi_5);
        set("actual_date_of_order_packed_5", o2d.actual_date_of_order_packed_5);
      } else if (i === 7) {
        set("voucher_num_7", o2d.voucher_num_7);
      } else if (i === 8) {
        set("order_details_checked_in_order_sheet_(yes,no)_8", o2d.order_details_checked_8);
        set("voucher_num_(51)_8", o2d.voucher_num_51_8);
        set("t._amt_8", o2d.t_amt_8);
      } else if (i === 9) {
        set("attach_bilty_(attachment)_9", o2d.attach_bilty_9);
        set("num_of_parcel_9", o2d.num_of_parcel_9);
      }
    }
    const maxIdx = Math.max(...Object.values(this.hMap));
    for (let i = 0; i <= maxIdx; i++) {
      if (row[i] === undefined) row[i] = "";
    }
    return row;
  }

  // Override to handle multi-row updates and broadcast all affected items
  async updateOrder(orderNo: string, o2ds: O2D[]): Promise<boolean> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();

      // 1. Find all existing rows for this order
      const orderNoColIdx = this.hMap["order_no."];
      const colLetter = getColumnLetter(orderNoColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${colLetter}:${colLetter}`,
      });
      const rows = response.data.values;
      if (!rows) return await this.addMany(o2ds);

      const indices = rows
        .map((row, index) => (row[0] === orderNo ? index : -1))
        .filter(index => index !== -1);

      if (indices.length === 0) return await this.addMany(o2ds);

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === this.sheetName)?.properties?.sheetId;
      if (sheetId === undefined) return false;

      const maxColIdx = Math.max(...Object.values(this.hMap));
      const lastCol = getColumnLetter(maxColIdx);

      // 1. Update existing indices up to newCount
      const updateData = [];
      for (let i = 0; i < Math.min(indices.length, o2ds.length); i++) {
        const rowIdx = indices[i];
        updateData.push({
          range: `${this.sheetName}!A${rowIdx + 1}:${lastCol}${rowIdx + 1}`,
          values: [this.mapItemToRow(o2ds[i])]
        });
      }
      
      if (updateData.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: updateData }
        });
      }

      // 2. Add extra new items if newCount > oldCount
      if (o2ds.length > indices.length) {
        const extraItems = o2ds.slice(indices.length);
        await sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:${lastCol}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: extraItems.map(o => this.mapItemToRow(o)) }
        });
      }

      // 3. Delete extra old rows if newCount < oldCount
      if (o2ds.length < indices.length) {
        const extraIndices = indices.slice(o2ds.length).reverse(); // delete from bottom to top
        const requests = extraIndices.map(idx => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 }
          }
        }));
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { requests }
        });
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error("Error updating order:", error);
      return false;
    }
  }

  async addMany(o2ds: O2D[]): Promise<boolean> {
    const maxColIdx = Math.max(...Object.values(this.hMap));
    const lastCol = getColumnLetter(maxColIdx);
    try {
      const sheets = await this.getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:${lastCol}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: o2ds.map(o => this.mapItemToRow(o)),
        },
      });
      this.invalidateCache();
      return true;
    } catch (error) {
      return false;
    }
  }


  async delete(id: string | number): Promise<boolean> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      const idColIdx = this.hMap["id"];
      const idColLetter = getColumnLetter(idColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${idColLetter}:${idColLetter}`,
      });

      const rows = response.data.values;
      if (!rows) return false;

      const rowIndex = rows.findIndex(row => String(row[0]).trim() === String(id).trim());
      if (rowIndex === -1) return false;

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === this.sheetName)?.properties?.sheetId;

      if (sheetId === undefined) return false;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
            }
          }]
        }
      });

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error("Error deleting O2D:", error);
      return false;
    }
  }

  async updateOrderToggleStatus(orderNo: string, action: 'hold' | 'cancelled', value: string): Promise<boolean> {
    await this.ensureHeaders();
    const sheets = await this.getSheetsClient();

    // Guard: check column exists
    const updatedColIdx = this.hMap[action];
    if (updatedColIdx === undefined) {
      console.error(`[toggleStatus] Column '${action}' not found in hMap. Keys:`, Object.keys(this.hMap));
      return false;
    }

    // Always read row positions directly from sheet (avoids cache double-offset bugs)
    const orderNoColIdx = this.hMap["order_no."];
    const colLetter = String.fromCharCode(65 + orderNoColIdx);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${colLetter}:${colLetter}`,
    });
    const rows = response.data.values;
    if (!rows) return false;

    // rows[0] = header row; get 1-based sheet row numbers for matching data rows
    const sheetRows: number[] = rows
      .map((row, index) => (String(row[0]).trim() === String(orderNo).trim() ? index + 1 : -1))
      .filter(n => n !== -1);

    if (sheetRows.length === 0) {
      console.error(`[toggleStatus] Order '${orderNo}' not found`);
      return false;
    }

    const updatedLoc = getColumnLetter(updatedColIdx);

    const data: any[] = sheetRows.map(sheetRow => {
      return { range: `${this.sheetName}!${updatedLoc}${sheetRow}`, values: [[value]] };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data }
    });

    this.invalidateCache();
    // Use base class logic to stamp ZZ1 meta-timestamp
    void this.writeLastModified();
    return true;
  }

  async removeFollowUp(orderNo: string, startStep: number, onlyThisStep: boolean): Promise<boolean> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();
      let indicesToUpdate: number[] = [];
      const cacheKey = `${this.spreadsheetId}_${this.sheetName}`;
      const cachedData = globalCache.get<O2D[]>(cacheKey);

      if (cachedData) {
        indicesToUpdate = cachedData
          .map((item: O2D, index: number) => (item.order_no === orderNo ? index + 1 : -1))
          .filter((index: number) => index !== -1);
      }

      if (indicesToUpdate.length === 0) {
        const orderNoColIdx = this.hMap["order_no."];
        const colLetter = getColumnLetter(orderNoColIdx);
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!${colLetter}:${colLetter}`,
        });
        const rows = response.data.values;
        if (!rows) return false;
        indicesToUpdate = rows
          .map((row, index) => (row[0] === orderNo ? index : -1))
          .filter(index => index !== -1);
      }
      if (indicesToUpdate.length === 0) return false;

      const maxColIdx = Math.max(...Object.values(this.hMap));
      const lastCol = getColumnLetter(maxColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:${lastCol}`,
      });
      const rows = response.data.values;
      if (!rows) return false;

      const endStep = onlyThisStep ? startStep : 11;
      const data = indicesToUpdate.map(index => {
        const row = [...rows[index]];
        const maxIdx = Math.max(...Object.values(this.hMap));
        while (row.length <= maxIdx) row.push("");

        for (let s = startStep; s <= endStep; s++) {
          const pIdx = this.hMap[`planned_${s}`];
          const aIdx = this.hMap[`acual_${s}`];
          const stIdx = this.hMap[`status_${s}`];

          if (pIdx !== undefined && s > startStep) row[pIdx] = "";
          if (aIdx !== undefined) row[aIdx] = "";
          if (stIdx !== undefined) row[stIdx] = "";

          // Clear step-specific extra fields
          if (s === 1) {
            const fields = ["final_amount_1", "so_number_1", "merge_order_with_1", "upload_so_(attachment)_1"];
            fields.forEach(f => { const idx = this.hMap[f]; if (idx !== undefined) row[idx] = ""; });
          } else if (s === 5) {
            const fields = ["num_of_parcel_5", "upoad_pi_(attachment)_5", "actual_date_of_order_packed_5"];
            fields.forEach(f => { const idx = this.hMap[f]; if (idx !== undefined) row[idx] = ""; });
          } else if (s === 7) {
            const idx = this.hMap["voucher_num_7"]; if (idx !== undefined) row[idx] = "";
          } else if (s === 8) {
            const fields = ["order_details_checked_in_order_sheet_(yes,no)_8", "voucher_num_(51)_8", "t._amt_8"];
            fields.forEach(f => { const idx = this.hMap[f]; if (idx !== undefined) row[idx] = ""; });
          } else if (s === 9) {
            const fields = ["attach_billty_(attachment)_9", "num_of_parcel_9"];
            fields.forEach(f => { const idx = this.hMap[f]; if (idx !== undefined) row[idx] = ""; });
          }
        }

        const rowRange = `${this.sheetName}!A${index + 1}:${lastCol}${index + 1}`;
        return { range: rowRange, values: [row] };
      });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data }
      });

      this.invalidateCache();
      void this.writeLastModified();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getStepConfig(): Promise<O2DStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_step_config`;
    const cached = globalCache.get<O2DStepConfig[]>(cacheKey);
    if (cached) return cached;

    const sheets = await this.getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${CONFIG_SHEET_NAME}!A2:C`,
    });
    const data = response.data.values?.map(row => ({
      step_name: row[0] || "", tat: row[1] || "", responsible_person: row[2] || ""
    })) || [];

    globalCache.set(cacheKey, data, 60 * 60 * 1000); // 1 hour TTL
    return data;
  }

  async getDetails(): Promise<{ parties: string[]; items: { name: string; amount: string }[] }> {
    const cacheKey = `${this.spreadsheetId}_details`;
    const cached = globalCache.get<{ parties: string[]; items: { name: string; amount: string }[] }>(cacheKey);
    if (cached) return cached;

    try {
      const sheets = await this.getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `Details!A2:E`,
      });
      const rows = response.data.values || [];
      const parties: string[] = []; // Parties are now managed in party-management-sheets
      // Column layout: A=ID, B=item_name, C=est_amount, D=gst, E=final_amount
      const items = rows.map(row => ({ name: row[1] || "", amount: row[4] || row[2] || "" })).filter(item => item.name);
      const data = { parties, items };

      globalCache.set(cacheKey, data, 30 * 60 * 1000); // 30 mins TTL
      return data;
    } catch (error) {
      return { parties: [], items: [] };
    }
  }

  async addItem(name: string, price: string, gst: string = "", finalPrice: string = ""): Promise<boolean> {
    try {
      const sheets = await this.getSheetsClient();

      // Fetch existing rows to determine next ID
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `Details!A2:A`,
      });
      const existingIds = (existing.data.values || [])
        .map(row => parseInt(row[0], 10))
        .filter(id => !isNaN(id));
      const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

      // Column layout: A=ID, B=item_name, C=est_amount, D=gst, E=final_amount
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `Details!A:E`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[nextId, name, price, gst, finalPrice]],
        },
      });
      globalCache.delete(`${this.spreadsheetId}_details`);
      return true;
    } catch (error) {
      console.error("Error adding item:", error);
      return false;
    }
  }

  async deleteOrderByNo(orderNo: string): Promise<boolean> {
    try {
      const sheets = await this.getSheetsClient();
      let indicesToDelete: number[] = [];
      const cacheKey = `${this.spreadsheetId}_${this.sheetName}`;
      const cachedData = globalCache.get<O2D[]>(cacheKey);

      if (cachedData) {
        indicesToDelete = cachedData
          .map((item: O2D, index: number) => (item.order_no === orderNo ? index + 1 : -1))
          .filter((index: number) => index !== -1);
      }

      if (indicesToDelete.length === 0) {
        const orderNoColIdx = this.hMap["order_no."];
        const colLetter = getColumnLetter(orderNoColIdx);
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!${colLetter}:${colLetter}`,
        });
        const rows = response.data.values;
        if (!rows) return false;
        rows.forEach((row, idx) => {
          if (String(row[0]).trim() === orderNo.trim()) {
            indicesToDelete.push(idx);
          }
        });
      }

      if (indicesToDelete.length === 0) return false;

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === this.sheetName)?.properties?.sheetId;
      if (sheetId === undefined) return false;

      // Delete from bottom to top to preserve indices
      const requests = indicesToDelete.reverse().map(idx => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 }
        }
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests }
      });

      this.invalidateCache();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const o2dService = new O2DService(SHEET_NAME);
export const o2dArchivedService = new O2DService(ARCHIVED_SHEET_NAME);

/** Live O2D + O2D Archived combined for analytics/metrix (prefer live row on same id). */
export async function getAllO2DsForAnalytics(): Promise<O2D[]> {
  const [live, archived] = await Promise.all([
    o2dService.getAll(),
    o2dArchivedService.getAll().catch((err) => {
      console.error("Error fetching O2D Archived sheet:", err);
      return [] as O2D[];
    }),
  ]);

  const byKey = new Map<string, O2D>();
  const noKeyRows: O2D[] = [];

  const rowKey = (row: O2D) => {
    const id = String(row.id || "").trim();
    if (id) return `id:${id}`;
    const orderNo = String(row.order_no || "").trim().toLowerCase();
    const item = String(row.item_name || "").trim().toLowerCase();
    const created = String(row.created_at || "").trim();
    if (orderNo || item || created) return `row:${orderNo}|${item}|${created}`;
    return "";
  };

  // Archived first, then live overwrites duplicates
  archived.forEach((row) => {
    const key = rowKey(row);
    if (!key) {
      noKeyRows.push(row);
      return;
    }
    byKey.set(key, row);
  });
  live.forEach((row) => {
    const key = rowKey(row);
    if (!key) {
      noKeyRows.push(row);
      return;
    }
    byKey.set(key, row);
  });

  return [...byKey.values(), ...noKeyRows];
}

// Helper: Get pending step index for an order
function getPendingStepIdx(orderItems: O2D[]): number {
  const firstItem = orderItems[0] as any;
  for (let i = 1; i <= 11; i++) {
    const pVal = (firstItem[`planned_${i}`] || "").toString().trim();
    const aVal = (firstItem[`actual_${i}`] || "").toString().trim();
    const sVal = (firstItem[`status_${i}`] || "").toString().trim();

    if (pVal && pVal !== "-") {
      const hasActual = aVal && aVal !== "-";
      const isStep3CompletedNo = i === 3 && sVal === "No";
      const isStep4CompletedNo = i === 4 && sVal === "No";

      let stepDone = hasActual && sVal !== "No";
      if (isStep3CompletedNo) {
        const step4Plan = (firstItem[`planned_4`] || "").toString().trim();
        if (step4Plan && step4Plan !== "-") stepDone = true;
      }
      if (isStep4CompletedNo) stepDone = true;

      if (!stepDone) return i;
      if (isStep4CompletedNo) return -1;
    }
  }
  return -1;
}

// Helper: Check if order matches date filter
function orderMatchesDateFilter(orderItems: O2D[], filter: string): boolean {
  if (!filter) return true;
  if (filter === "Hold") return !!orderItems[0].hold && !orderItems[0].cancelled;
  if (filter === "Cancelled") return !!orderItems[0].cancelled;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const pendingStepIdx = getPendingStepIdx(orderItems);
  if (pendingStepIdx === -1) return false;

  const firstItem = orderItems[0] as any;
  const plannedRaw = firstItem[`planned_${pendingStepIdx}`] as string;
  if (!plannedRaw || plannedRaw === "-" || plannedRaw.trim() === "") return false;

  const pd = new Date(plannedRaw);
  if (isNaN(pd.getTime())) return false;

  const pdDay = new Date(pd);
  pdDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round((pdDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (filter === "Delayed") return pd < now;
  if (filter === "Today") return diffDays === 0;
  if (filter === "Tomorrow") return diffDays === 1;
  if (filter === "Next5") return diffDays > 0 && diffDays <= 5;
  if (filter === "Next10") return diffDays > 0 && diffDays <= 10;

  return false;
}

// Comprehensive pagination with all filters applied server-side
export async function getO2DsPaginated(
  page: number = 1,
  limit: number = 10,
  searchTerm: string = "",
  selectedDateFilters: string[] = [],
  selectedStepFilters: number[] = [],
  tableFilterParty: string = "",
  tableFilterOrderNo: string = "",
  tableFilterItemName: string = "",
  tableFilterPending: boolean = false,
  filterStartDate: string = "",
  filterEndDate: string = "",
  currentUser: string = "",
  userRole: string = "",
  includeArchived: boolean = false
) {
  const allO2Ds = includeArchived
    ? await getAllO2DsForAnalytics()
    : await o2dService.getAll();

  // Fetch step configs once for user-role filtering (cached)
  const stepConfigs = (userRole.toUpperCase() === "USER" && currentUser)
    ? await o2dService.getStepConfig()
    : null;

  // Group by order_no to get unique orders
  const groupedByOrder: Record<string, O2D[]> = {};
  allO2Ds.forEach((item) => {
    const orderNo = item.order_no || "Unknown";
    if (!groupedByOrder[orderNo]) {
      groupedByOrder[orderNo] = [];
    }
    groupedByOrder[orderNo].push(item);
  });

  // Get sorted order numbers (descending)
  let orderNumbers = Object.keys(groupedByOrder).sort((a, b) => b.localeCompare(a));

  // Apply ALL filters across ALL orders BEFORE pagination
  orderNumbers = orderNumbers.filter((orderNo) => {
    const items = groupedByOrder[orderNo];
    const firstItem = items[0];
    const pIdx = getPendingStepIdx(items);
    const isHold = !!firstItem.hold;
    const isCancelled = !!firstItem.cancelled;

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        orderNo.toLowerCase().includes(searchLower) ||
        firstItem?.party_name?.toLowerCase().includes(searchLower) ||
        items.some((item) => item.item_name?.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    // Party filter
    if (tableFilterParty && !firstItem.party_name.toLowerCase().includes(tableFilterParty.toLowerCase())) {
      return false;
    }

    // Order ID filter
    if (tableFilterOrderNo && !orderNo.toLowerCase().includes(tableFilterOrderNo.toLowerCase())) {
      return false;
    }

    // Item name filter
    if (tableFilterItemName) {
      const searchTarget = tableFilterItemName.toLowerCase().trim();
      const hasMatch = items.some((item) => {
        if (!item.item_name) return false;
        if (/^1\.\s/.test(item.item_name)) {
          const names = item.item_name.split(" | ").map(s => s.replace(/^\d+\.\s*/, "").trim().toLowerCase());
          return names.includes(searchTarget);
        }
        return item.item_name.toLowerCase().trim() === searchTarget;
      });
      if (!hasMatch) return false;
    }

    // Date range filter
    if (filterStartDate || filterEndDate) {
      const itemDate = new Date(firstItem.created_at || firstItem.updated_at || "");
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }
    }

    // Pending filter
    if (tableFilterPending && (isHold || isCancelled || pIdx === -1)) {
      return false;
    }

    // Step filter
    if (selectedStepFilters.length > 0 && !selectedStepFilters.includes(pIdx)) {
      return false;
    }

    // Date/Status filters
    if (selectedDateFilters.length > 0) {
      if (!selectedDateFilters.some((f) => orderMatchesDateFilter(items, f))) {
        return false;
      }
    }

    // User role filter: only show orders where the pending step's responsible_person includes the current user
    if (stepConfigs && pIdx !== -1) {
      const stepConfig = stepConfigs[pIdx - 1];
      if (stepConfig?.responsible_person) {
        const responsible = stepConfig.responsible_person.split(",").map((s) => s.trim());
        if (!responsible.includes(currentUser)) return false;
      }
    }
    // For USER role, hide hold/cancelled and completed orders (unless a status filter is active)
    if (userRole.toUpperCase() === "USER" && currentUser) {
      const hasStatusFilter = selectedDateFilters.includes("Hold") || selectedDateFilters.includes("Cancelled");
      if ((isHold || isCancelled) && !hasStatusFilter) return false;
      if (pIdx === -1 && !isHold && !isCancelled) return false;
    }

    return true;
  });

  // Paginate the filtered orders
  const startIdx = (page - 1) * limit;
  const endIdx = limit === -1 ? orderNumbers.length : startIdx + limit;
  const paginatedOrderNumbers = limit === -1 ? orderNumbers : orderNumbers.slice(startIdx, endIdx);

  // Get all rows for the paginated orders
  const paginatedData = paginatedOrderNumbers.flatMap((orderNo) => {
    let items = groupedByOrder[orderNo];
    
    // If filtering by item name, only show the matching items in the table
    if (tableFilterItemName) {
      const searchTarget = tableFilterItemName.toLowerCase().trim();
      items = items.filter((item) => {
        if (!item.item_name) return false;
        if (/^1\.\s/.test(item.item_name)) {
          const names = item.item_name.split(" | ").map(s => s.replace(/^\d+\.\s*/, "").trim().toLowerCase());
          return names.includes(searchTarget);
        }
        return item.item_name.toLowerCase().trim() === searchTarget;
      });
    }
    
    return items;
  });

  return {
    data: paginatedData,
    orders: paginatedOrderNumbers,
    total: orderNumbers.length, // Total filtered orders, not rows
    page,
    limit,
    totalPages: limit === -1 ? 1 : Math.ceil(orderNumbers.length / limit),
    totalRows: allO2Ds.length, // Total rows for reference
  };
}

// Summary method - returns step counts without full data (for button counts)
export async function getO2DSummary(currentUser: string = "", userRole: string = "") {
  const allO2Ds = await o2dService.getAll();

  const stepConfigs = (userRole.toUpperCase() === "USER" && currentUser)
    ? await o2dService.getStepConfig()
    : null;

  // Group by order_no to get unique orders
  const groupedByOrder: Record<string, O2D[]> = {};
  allO2Ds.forEach((item) => {
    const orderNo = item.order_no || "Unknown";
    if (!groupedByOrder[orderNo]) {
      groupedByOrder[orderNo] = [];
    }
    groupedByOrder[orderNo].push(item);
  });

  // Count orders by step â€” exclude hold/cancelled (matches left panel default view)
  const stepCounts = Array(11).fill(0);

  Object.values(groupedByOrder).forEach((orderItems) => {
    const firstItem = orderItems[0];
    // Skip hold and cancelled orders (left panel hides them by default)
    if (firstItem.hold || firstItem.cancelled) return;

    const pendingStep = getPendingStepIdx(orderItems);

    if (pendingStep >= 1 && pendingStep <= 11) {
      // Apply user role filter on step counts
      if (stepConfigs) {
        const stepConfig = stepConfigs[pendingStep - 1];
        if (stepConfig?.responsible_person) {
          const responsible = stepConfig.responsible_person.split(",").map((s) => s.trim());
          if (!responsible.includes(currentUser)) return;
        }
      }
      stepCounts[pendingStep - 1]++;
    }
  });

  return {
    stepCounts,
    totalOrders: Object.keys(groupedByOrder).length,
    totalRows: allO2Ds.length,
  };
}

// Legacy function bridges
export async function getO2Ds() { return o2dService.getAll(); }
export async function addO2D(o2d: O2D) { return o2dService.add(o2d); }
export async function addO2Ds(o2ds: O2D[]) { return o2dService.addMany(o2ds); }
export async function updateO2D(id: string, o2d: O2D) { return o2dService.update(id, o2d); }
export async function deleteO2D(id: string) { return o2dService.delete(id); }
export async function deleteOrderByNo(orderNo: string) { return o2dService.deleteOrderByNo(orderNo); }
export async function updateOrder(orderNo: string, o2ds: O2D[]) { return o2dService.updateOrder(orderNo, o2ds); }
export async function updateOrderToggleStatus(oNo: string, act: 'hold' | 'cancelled', val: string) { return o2dService.updateOrderToggleStatus(oNo, act, val); }
export async function removeFollowUp(oNo: string, sS: number, oTS: boolean) { return o2dService.removeFollowUp(oNo, sS, oTS); }
export async function getO2DStepConfig() { return o2dService.getStepConfig(); }
export async function getO2DDetails() { return o2dService.getDetails(); }

export async function getScotDashboardMetrics() {
  const o2dData = await getAllO2DsForAnalytics();
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const partyMonths: Record<string, Record<string, Set<string>>> = {};
  o2dData.forEach((order: any) => {
    const party = (order.party_name || '').trim().toLowerCase();
    const orderNo = (order.order_no || '').trim();
    if (!party || !orderNo) return;
    const created = new Date(order.created_at || '');
    if (isNaN(created.getTime())) return;
    const monthKey = `${created.getFullYear()}-${created.getMonth()}`;
    if (!partyMonths[party]) partyMonths[party] = {};
    if (!partyMonths[party][monthKey]) partyMonths[party][monthKey] = new Set();
    partyMonths[party][monthKey].add(orderNo);
  });

  const thisMonthKey = `${thisYear}-${thisMonth}`;
  const counts: Record<string, number> = {};
  const avgOrders: Record<string, number> = {};

  Object.entries(partyMonths).forEach(([party, months]) => {
    counts[party] = months[thisMonthKey]?.size ?? 0;
    const monthlyCounts = Object.values(months).map(s => s.size);
    const avg = monthlyCounts.reduce((a, b) => a + b, 0) / monthlyCounts.length;
    avgOrders[party] = Math.round(avg);
  });

  return { dashboardOrderCounts: counts, dashboardHistoricalAvg: avgOrders };
}

export async function addItem(name: string, price: string, gst?: string, finalPrice?: string) {
  return o2dService.addItem(name, price, gst, finalPrice);
}

export async function updateO2DStepConfig(configs: O2DStepConfig[]): Promise<boolean> {
  try {
    const sheets = await (o2dService as any).getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${CONFIG_SHEET_NAME}!A2:C${configs.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: configs.map(c => [c.step_name, c.tat, c.responsible_person]),
      },
    });
    globalCache.delete(`${GOOGLE_SHEET_ID}_step_config`);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getAllItemNames() {
  const allO2Ds = await o2dService.getAll();
  const itemNames = new Set<string>();
  
  allO2Ds.forEach(item => {
    if (item.item_name) {
      if (/^1\.\s/.test(item.item_name)) {
        item.item_name.split(" | ").forEach(s => {
          if (s.trim()) itemNames.add(s.replace(/^\d+\.\s*/, "").trim());
        });
      } else if (item.item_name.includes('\n')) {
        item.item_name.split('\n').forEach(s => {
          if (s.trim()) itemNames.add(s.trim());
        });
      } else {
        if (item.item_name.trim()) itemNames.add(item.item_name.trim());
      }
    }
  });
  
  return Array.from(itemNames).sort();
}

export async function appendOutFormData(
  o2dNo: string,
  extractedData: any
): Promise<boolean> {
  try {
    const sheets = await (o2dService as any).getSheetsClient();
    
    // Fallback/Format extracted values
    const orderNo = extractedData.OrderNo || extractedData.orderNo || "";
    const date = extractedData.Date || extractedData.date || "";
    const partyName = extractedData.PartyName || extractedData.partyName || "";
    const status = extractedData.Status || "Success";
    const lineItems = extractedData.LineItems || extractedData.lineItems || [];

    let rowsToAppend: any[][] = [];

    if (lineItems.length === 0) {
      // If no line items found or it's an error status, still push one row
      rowsToAppend = [
        [o2dNo, orderNo, date, partyName, "", "", "", "", status]
      ];
    } else {
      // Push a single row with line items as JSON
      rowsToAppend = [
        [
          o2dNo,
          orderNo,
          date,
          partyName,
          JSON.stringify(lineItems),
          "",
          "",
          "",
          status
        ]
      ];
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `Out Form!A:I`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rowsToAppend,
      },
    });

    globalCache.delete(`${GOOGLE_SHEET_ID}_out_form`);
    return true;
  } catch (error) {
    console.error("Error appending to Out Form:", error);
    return false;
  }
}

export type { OutFormLineItem, OutFormRow } from "@/types/ims-out-form";

function parseOutFormLineItems(description: string, fallbackQty?: string): OutFormLineItem[] {
  const raw = String(description || "").trim();
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => ({
            description: String(item.Description || item.description || "").trim(),
            qty: parseFloat(String(item.Qty ?? item.qty ?? 0)) || 0,
          }))
          .filter((item) => item.description || item.qty > 0);
      }
    } catch {
      // keep raw text below
    }
  }
  if (!raw) return [];
  return [{ description: raw, qty: parseFloat(String(fallbackQty || 0)) || 0 }];
}

export async function getOutFormData(): Promise<OutFormRow[]> {
  const cacheKey = `${GOOGLE_SHEET_ID}_out_form`;
  const cached = globalCache.get<OutFormRow[]>(cacheKey);
  if (cached) return cached;

  try {
    const sheets = await (o2dService as any).getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Out Form!A:I",
    });

    const rows = response.data.values || [];
    // rows[0] is header, skip it.
    if (rows.length <= 1) return [];

    const data: OutFormRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const description = row[3] || "";
      const qty = row[4] || "";
      const items = parseOutFormLineItems(description, qty);
      const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
      data.push({
        rowIndex: i + 1,
        date: row[0] || "",
        orderNo: row[1] || "",
        partyName: row[2] || "",
        description,
        qty,
        updated_at: row[0] || "",
        items,
        totalQty,
      });
    }

    globalCache.set(cacheKey, data, 60_000); // 60s — matches other sheet caches
    return data;
  } catch (error) {
    console.error("Error fetching Out Form data:", error);
    return [];
  }
}

export async function deleteOutFormRows(rowIndexes: number[]): Promise<{ success: boolean; deleted: number }> {
  const unique = Array.from(
    new Set(
      rowIndexes
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 2)
    )
  );
  if (unique.length === 0) return { success: true, deleted: 0 };

  try {
    const sheets = await (o2dService as any).getSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
    const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === "Out Form")?.properties?.sheetId;
    if (sheetId === undefined) return { success: false, deleted: 0 };

    unique.sort((a, b) => b - a);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: unique.map((rowIndex) => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        })),
      },
    });

    globalCache.delete(`${GOOGLE_SHEET_ID}_out_form`);
    return { success: true, deleted: unique.length };
  } catch (error) {
    console.error("Error deleting Out Form rows:", error);
    return { success: false, deleted: 0 };
  }
}

