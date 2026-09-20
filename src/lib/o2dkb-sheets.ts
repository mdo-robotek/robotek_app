import { BaseSheetsService, getColumnLetter } from "./sheets/base-service";
import { O2DKB, O2DKBStepConfig } from "@/types/o2dkb";
import { globalCache } from "./cache";

const GOOGLE_SHEET_ID = "1Ce_SJBgAKVj6yKWwJb5MjmjkZg5noSaieLbrC7SsG84";
const SHEET_NAME = "O2D KB";
const CONFIG_SHEET_NAME = "Step Configuration";

class O2DKBService extends BaseSheetsService<O2DKB> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:BH";
  protected idColumnIndex = 0;

  mapRowToItem(row: any[]): O2DKB {
    const get = (h: string) => {
      const normalized = h.toLowerCase();
      // Try exact match first
      if (this.hMap[normalized] !== undefined) return row[this.hMap[normalized]] || "";

      // Try common variations
      const variations = [
        normalized.replace(/ /g, "_"),
        normalized.replace(/_/g, " "),
      ];

      for (const v of variations) {
        if (this.hMap[v] !== undefined) return row[this.hMap[v]] || "";
      }
      return "";
    };

    const item: O2DKB = {
      id: get("id"),
      order_no: get("order no.") || get("order_no") || get("order_no."),
      party_name: get("party name") || get("party_name"),
      item_details: get("item details") || get("item_details"),
      remark: get("remarks") || get("remark"),
      filled_by: get("crm - filled by") || get("crm_-_filled_by"),
      created_at: get("created_at") || get("created at"),
      updated_at: get("updated_at") || get("updated at"),
      cancelled: get("cancelled"),
      hold: get("hold"),
    };

    for (let i = 1; i <= 7; i++) {
      (item as any)[`planned_${i}`] = get(`planned_${i}`);
      (item as any)[`actual_${i}`] = get(`actual_${i}`);
      (item as any)[`status_${i}`] = get(`status_${i}`);
    }

    item.voucher_num_1 = get("voucher_num_1");
    item.attach_bill_1 = get("attach_bill_1");
    item.attach_billty_7 = get("attech_billty_7") || get("attach_billty_7") || get("attech_billty_5") || get("attach_billty_5");

    return item;
  }

  mapItemToRow(o2dkb: O2DKB): any[] {
    const row: any[] = [];
    const set = (h: string, val: any) => {
      const normalized = h.toLowerCase();
      const variations = [
        normalized,
        normalized.replace(/ /g, "_"),
        normalized.replace(/_/g, " "),
      ];

      for (const v of variations) {
        const idx = this.hMap[v];
        if (idx !== undefined) {
          row[idx] = val;
          return;
        }
      }
    };

    set("id", o2dkb.id);
    set("order no.", o2dkb.order_no);
    set("party name", o2dkb.party_name);
    set("item details", o2dkb.item_details || "");
    set("remarks", o2dkb.remark);
    set("crm - filled by", o2dkb.filled_by);
    set("created_at", o2dkb.created_at);
    set("updated_at", o2dkb.updated_at);
    set("cancelled", o2dkb.cancelled || "");
    set("hold", o2dkb.hold || "");

    for (let i = 1; i <= 7; i++) {
      set(`planned_${i}`, (o2dkb as any)[`planned_${i}`]);
      set(`actual_${i}`, (o2dkb as any)[`actual_${i}`]);
      set(`status_${i}`, (o2dkb as any)[`status_${i}`]);
    }

    set("voucher_num_1", o2dkb.voucher_num_1 || "");
    set("attach_bill_1", o2dkb.attach_bill_1 || "");
    if (this.hMap["attach_billty_7"] !== undefined) {
      set("attach_billty_7", o2dkb.attach_billty_7 || "");
    } else if (this.hMap["attach_billty_5"] !== undefined) {
      set("attach_billty_5", o2dkb.attach_billty_7 || "");
    } else {
      set("attech_billty_7", o2dkb.attach_billty_7 || "");
    }

    const maxIdx = Math.max(...Object.values(this.hMap));
    for (let i = 0; i <= maxIdx; i++) {
      if (row[i] === undefined) row[i] = "";
    }
    return row;
  }

  // Override to handle multi-row updates and broadcast all affected items
  async updateOrder(orderNo: string, o2dkbs: O2DKB[]): Promise<boolean> {
    await this.ensureHeaders();
    try {
      const sheets = await this.getSheetsClient();

      // 1. Find all existing rows for this order
      const orderNoColIdx = this.hMap["order no."] !== undefined ? this.hMap["order no."] : this.hMap["order no"];
      const colLetter = getColumnLetter(orderNoColIdx);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${colLetter}:${colLetter}`,
      });
      const rows = response.data.values;
      if (!rows) return await this.addMany(o2dkbs);

      const indices = rows
        .map((row, index) => (row[0] === orderNo ? index : -1))
        .filter(index => index !== -1);

      if (indices.length === 0) return await this.addMany(o2dkbs);

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === this.sheetName)?.properties?.sheetId;
      if (sheetId === undefined) return false;

      const maxColIdx = Math.max(...Object.values(this.hMap));
      const lastCol = getColumnLetter(maxColIdx);

      // 1. Update existing indices up to newCount
      const updateData = [];
      for (let i = 0; i < Math.min(indices.length, o2dkbs.length); i++) {
        const rowIdx = indices[i];
        updateData.push({
          range: `${this.sheetName}!A${rowIdx + 1}:${lastCol}${rowIdx + 1}`,
          values: [this.mapItemToRow(o2dkbs[i])]
        });
      }
      
      if (updateData.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: updateData }
        });
      }

      // 2. Add extra new items if newCount > oldCount
      if (o2dkbs.length > indices.length) {
        const extraItems = o2dkbs.slice(indices.length);
        await sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:${lastCol}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: extraItems.map(o => this.mapItemToRow(o)) }
        });
      }

      // 3. Delete extra old rows if newCount < oldCount
      if (o2dkbs.length < indices.length) {
        const extraIndices = indices.slice(o2dkbs.length).reverse(); // delete from bottom to top
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

  async addMany(o2dkbs: O2DKB[]): Promise<boolean> {
    await this.ensureHeaders();
    const maxColIdx = Math.max(...Object.values(this.hMap));
    const lastCol = getColumnLetter(maxColIdx);
    try {
      const sheets = await this.getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:${lastCol}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: o2dkbs.map(o => this.mapItemToRow(o)),
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
      console.error("Error deleting O2DKB:", error);
      return false;
    }
  }

  async updateOrderToggleStatus(orderNo: string, action: 'cancelled' | 'hold', value: string): Promise<boolean> {
    await this.ensureHeaders();
    const sheets = await this.getSheetsClient();

    // Guard: check column exists
    const updatedColIdx = this.hMap[action];
    if (updatedColIdx === undefined) {
      console.error(`[toggleStatus] Column '${action}' not found in hMap. Keys:`, Object.keys(this.hMap));
      return false;
    }

    // Always read row positions directly from sheet (avoids cache double-offset bugs)
    const orderNoColIdx = this.hMap["order no."] !== undefined ? this.hMap["order no."] : this.hMap["order no"];
    const colLetter = getColumnLetter(orderNoColIdx);
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
      const cachedData = globalCache.get<O2DKB[]>(cacheKey);

      if (cachedData) {
        indicesToUpdate = cachedData
          .map((item: O2DKB, index: number) => (item.order_no === orderNo ? index + 1 : -1))
          .filter((index: number) => index !== -1);
      }

      if (indicesToUpdate.length === 0) {
        const orderNoColIdx = this.hMap["order no."] !== undefined ? this.hMap["order no."] : this.hMap["order no"];
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

      const endStep = onlyThisStep ? startStep : 7;
      const data = indicesToUpdate.map(index => {
        const row = [...rows[index]];
        const maxIdx = Math.max(...Object.values(this.hMap));
        while (row.length <= maxIdx) row.push("");

        for (let s = startStep; s <= endStep; s++) {
          const pIdx = this.hMap[`planned_${s}`];
          const aIdx = this.hMap[`actual_${s}`] || this.hMap[`acual_${s}`];
          const stIdx = this.hMap[`status_${s}`];

          if (pIdx !== undefined && s > startStep) row[pIdx] = "";
          if (aIdx !== undefined) row[aIdx] = "";
          if (stIdx !== undefined) row[stIdx] = "";
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

  async getStepConfig(): Promise<O2DKBStepConfig[]> {
    const cacheKey = `${this.spreadsheetId}_step_config`;
    const cached = globalCache.get<O2DKBStepConfig[]>(cacheKey);
    if (cached) return cached;

    const sheets = await this.getSheetsClient();
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${CONFIG_SHEET_NAME}!A2:C`,
      });
      const data = response.data.values?.map(row => ({
        step_name: row[0] || "", tat: row[1] || "", responsible_person: row[2] || ""
      })) || [];

      globalCache.set(cacheKey, data, 60 * 60 * 1000); // 1 hour TTL
      return data;
    } catch (error) {
      console.error("Error fetching Step Configuration, returning defaults:", error);
      return [];
    }
  }

  async updateStepConfig(config: O2DKBStepConfig[]): Promise<boolean> {
    const sheets = await this.getSheetsClient();
    try {
      const data = config.map(c => [c.step_name, c.tat, c.responsible_person]);
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${CONFIG_SHEET_NAME}!A2:C`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: data }
      });
      globalCache.delete(`${this.spreadsheetId}_step_config`);
      return true;
    } catch (e) {
      console.error("Error updating Step Configuration:", e);
      return false;
    }
  }

  async getDetails(): Promise<{ parties: string[]; items: { name: string; amount: string }[] }> {
    // For O2DKB we might not have a Details sheet, or maybe we do. We will return empty for now if it doesn't exist.
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
      const parties: string[] = [];
      const items = rows.map(row => ({ name: row[1] || "", amount: row[4] || row[2] || "" })).filter(item => item.name);
      const data = { parties, items };

      globalCache.set(cacheKey, data, 30 * 60 * 1000);
      return data;
    } catch (error) {
      return { parties: [], items: [] };
    }
  }

  async deleteOrderByNo(orderNo: string): Promise<boolean> {
    try {
      const sheets = await this.getSheetsClient();
      let indicesToDelete: number[] = [];
      const cacheKey = `${this.spreadsheetId}_${this.sheetName}`;
      const cachedData = globalCache.get<O2DKB[]>(cacheKey);

      if (cachedData) {
        indicesToDelete = cachedData
          .map((item: O2DKB, index: number) => (item.order_no === orderNo ? index + 1 : -1))
          .filter((index: number) => index !== -1);
      }

      if (indicesToDelete.length === 0) {
        const orderNoColIdx = this.hMap["order no."] !== undefined ? this.hMap["order no."] : this.hMap["order no"];
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

export const o2dkbService = new O2DKBService();

// Helper: Get pending step index for an order
export function getPendingStepIdx(orderItems: O2DKB[]): number {
  if (!orderItems || orderItems.length === 0) return -1;
  const firstItem = orderItems[0] as any;
  for (let i = 1; i <= 7; i++) {
    const pVal = (firstItem[`planned_${i}`] || "").toString().trim();
    const aVal = (firstItem[`actual_${i}`] || "").toString().trim();
    const sVal = (firstItem[`status_${i}`] || "").toString().trim();

    if (pVal && pVal !== "-") {
      const hasActual = aVal && aVal !== "-";
      let stepDone = hasActual && sVal !== "No";

      if (!stepDone) return i;
    }
  }
  return -1;
}

// Helper: Check if order matches date filter
function orderMatchesDateFilter(orderItems: O2DKB[], filter: string): boolean {
  if (!filter) return true;
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
export async function getO2DKBsPaginated(
  page: number = 1,
  limit: number = 10,
  searchTerm: string = "",
  selectedDateFilters: string[] = [],
  selectedStepFilters: number[] = [],
  tableFilterParty: string = "",
  tableFilterOrderNo: string = "",
  tableFilterPending: boolean = false,
  filterStartDate: string = "",
  filterEndDate: string = "",
  currentUser: string = "",
  userRole: string = ""
) {
  const allO2DKBs = await o2dkbService.getAll();

  const stepConfigs = (userRole.toUpperCase() === "USER" && currentUser)
    ? await o2dkbService.getStepConfig()
    : null;

  // Group by order_no to get unique orders
  const groupedByOrder: Record<string, O2DKB[]> = {};
  allO2DKBs.forEach((item) => {
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
    const isCancelled = !!firstItem.cancelled;

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        orderNo.toLowerCase().includes(searchLower) ||
        firstItem?.party_name?.toLowerCase().includes(searchLower);
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
    if (tableFilterPending && (isCancelled || pIdx === -1)) {
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
    // For USER role, hide cancelled and completed orders (unless a status filter is active)
    if (userRole.toUpperCase() === "USER" && currentUser) {
      const hasStatusFilter = selectedDateFilters.includes("Cancelled");
      if (isCancelled && !hasStatusFilter) return false;
      if (pIdx === -1 && !isCancelled) return false;
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
    return items;
  });

  return {
    data: paginatedData,
    orders: paginatedOrderNumbers,
    total: orderNumbers.length, // Total filtered orders, not rows
    page,
    limit,
    totalPages: limit === -1 ? 1 : Math.ceil(orderNumbers.length / limit),
    totalRows: allO2DKBs.length, // Total rows for reference
  };
}

export async function getO2DKBSummary(currentUser: string = "", userRole: string = "") {
  const allO2DKBs = await o2dkbService.getAll();

  const stepConfigs = (userRole.toUpperCase() === "USER" && currentUser)
    ? await o2dkbService.getStepConfig()
    : null;

  const groupedByOrder: Record<string, O2DKB[]> = {};
  allO2DKBs.forEach((item) => {
    const orderNo = item.order_no || "Unknown";
    if (!groupedByOrder[orderNo]) {
      groupedByOrder[orderNo] = [];
    }
    groupedByOrder[orderNo].push(item);
  });

  const stepCounts = Array(7).fill(0);

  Object.values(groupedByOrder).forEach((orderItems) => {
    const firstItem = orderItems[0];
    if (firstItem.cancelled) return;

    const pendingStep = getPendingStepIdx(orderItems);

    if (pendingStep !== -1) {
      if (stepConfigs) {
        const stepConfig = stepConfigs[pendingStep - 1];
        if (stepConfig?.responsible_person) {
          const responsible = stepConfig.responsible_person.split(",").map((s) => s.trim());
          if (!responsible.includes(currentUser)) return;
        } else {
          return;
        }
      }
      stepCounts[pendingStep - 1]++;
    }
  });

  return {
    stepCounts,
    totalOrders: Object.keys(groupedByOrder).length,
    totalRows: allO2DKBs.length
  };
}
