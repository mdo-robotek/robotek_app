import { BaseSheetsService } from "./sheets/base-service";
import { globalCache } from "./cache";
import { NewLaunch } from "@/types/new-launch";
import { NEW_LAUNCH_TOTAL_STEPS, NewLaunchStepConfig } from "./new-launch-steps";

// New Launch FMS (Sahil, 2026-10-26). One row per upcoming launch, with
// planned / actual / done-by / remark for each of the 42 steps. Lives in the
// I2R (purchase) spreadsheet; both tabs are created on first use.
const SPREADSHEET_ID = process.env.NEW_LAUNCH_SHEET_ID || "1xOumI7LUWcde8C2PZv3Yd0pA6r0eJXdUOkJ_DiTFmZs";
const SHEET_NAME = "NewLaunchFMS";
const CONFIG_SHEET_NAME = "NewLaunchConfig";

const BASE_HEADERS = [
  "id", "launch_no", "product_name", "filled_by", "form_date", "remark",
  "status", "current_step", "launch_date", "created_at", "updated_at", "fields", "history",
];
const STEP_HEADERS: string[] = [];
for (let n = 1; n <= NEW_LAUNCH_TOTAL_STEPS; n++) {
  STEP_HEADERS.push(`planned_${n}`, `actual_${n}`, `done_by_${n}`, `remark_${n}`);
}
export const NEW_LAUNCH_HEADERS = [...BASE_HEADERS, ...STEP_HEADERS];

async function ensureTab(sheetName: string, headers: string[]): Promise<void> {
  const cacheKey = `${SPREADSHEET_ID}_${sheetName}_tab_ok`;
  if (globalCache.get<boolean>(cacheKey)) return;
  const sheets = await newLaunchService.client();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: "sheets.properties.title" });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === sheetName);
  if (!exists) {
    console.log(`[NEW LAUNCH] Creating tab ${sheetName}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: { rowCount: 500, columnCount: Math.max(headers.length + 5, 26), frozenRowCount: 1 },
            },
          },
        }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
  globalCache.set(cacheKey, true, 24 * 60 * 60 * 1000);
}

class NewLaunchService extends BaseSheetsService<NewLaunch> {
  protected spreadsheetId = SPREADSHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:HZ";
  protected idColumnIndex = 0;

  client() {
    return this.getSheetsClient();
  }

  mapRowToItem(row: unknown[]): NewLaunch {
    const item: Record<string, string> = {};
    NEW_LAUNCH_HEADERS.forEach((h) => {
      const idx = this.hMap[h.toLowerCase()];
      item[h] = idx === undefined ? "" : String(row[idx] ?? "");
    });
    return item as NewLaunch;
  }

  mapItemToRow(item: NewLaunch): unknown[] {
    const totalCols = Math.max(...Object.values(this.hMap), NEW_LAUNCH_HEADERS.length - 1) + 1;
    const row: unknown[] = Array(totalCols).fill("");
    NEW_LAUNCH_HEADERS.forEach((h) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = item[h] ?? "";
    });
    return row;
  }

  async prepare(): Promise<void> {
    await ensureTab(SHEET_NAME, NEW_LAUNCH_HEADERS);
    await this.ensureColumns(NEW_LAUNCH_HEADERS);
  }
}

export const newLaunchService = new NewLaunchService();

export async function getNewLaunches(): Promise<NewLaunch[]> {
  await newLaunchService.prepare();
  const rows = await newLaunchService.getAll();
  return rows.filter((r) => String(r.id || "").trim() !== "");
}

export async function addNewLaunch(item: NewLaunch): Promise<boolean> {
  await newLaunchService.prepare();
  return newLaunchService.add(item);
}

export async function updateNewLaunch(item: NewLaunch): Promise<boolean> {
  await newLaunchService.prepare();
  return newLaunchService.update(item.id, item);
}

export async function deleteNewLaunch(id: string): Promise<boolean> {
  return newLaunchService.delete(id);
}

// ── Step configuration (doer / TAT overrides, admin-editable) ──────────────

const CONFIG_CACHE_KEY = `${SPREADSHEET_ID}_new_launch_config`;

export async function getNewLaunchConfig(): Promise<NewLaunchStepConfig[]> {
  const cached = globalCache.get<NewLaunchStepConfig[]>(CONFIG_CACHE_KEY);
  if (cached) return cached;
  try {
    await ensureTab(CONFIG_SHEET_NAME, ["step", "doer", "tat_days"]);
    const sheets = await newLaunchService.client();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONFIG_SHEET_NAME}!A2:C`,
    });
    const data: NewLaunchStepConfig[] = (res.data.values || [])
      .map((r) => ({ step: Number(r[0]), doer: String(r[1] ?? ""), tat_days: r[2] === undefined || r[2] === "" ? NaN : Number(r[2]) }))
      .filter((c) => c.step >= 1 && c.step <= NEW_LAUNCH_TOTAL_STEPS);
    globalCache.set(CONFIG_CACHE_KEY, data, 60 * 60 * 1000);
    return data;
  } catch (error) {
    console.error("Error reading New Launch config:", error);
    return [];
  }
}

export async function saveNewLaunchConfig(configs: NewLaunchStepConfig[]): Promise<boolean> {
  try {
    await ensureTab(CONFIG_SHEET_NAME, ["step", "doer", "tat_days"]);
    const sheets = await newLaunchService.client();
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${CONFIG_SHEET_NAME}!A2:C` });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONFIG_SHEET_NAME}!A2:C${configs.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: configs.map((c) => [c.step, c.doer, c.tat_days]) },
    });
    globalCache.delete(CONFIG_CACHE_KEY);
    return true;
  } catch (error) {
    console.error("Error saving New Launch config:", error);
    return false;
  }
}
