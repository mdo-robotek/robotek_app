import { getSheetsClient } from "@/lib/sheet-utils";
import { globalCache } from "@/lib/cache";
import { norm } from "@/lib/so-check";

/**
 * Pairs of "our party name" ↔ "name / GSTIN printed on the Busy SO",
 * confirmed once by CRM (Sahil, 2026-10-29). Kept in the "SO Party Names"
 * tab of the O2D spreadsheet.
 */
const SHEET_ID = "1T0vSzAgHoO21DifCUcPMRLR4yOy-kFteJ2bv6pG-UTc";
const TAB = "SO Party Names";
const KEY = "so_party_names";
type Pair = { order: string; so: string; gstin: string; ok: boolean };

async function ensureTab() {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets.properties.title" });
  if (meta.data.sheets?.some((s) => s.properties?.title === TAB)) return;
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:F1`, valueInputOption: "RAW",
    requestBody: { values: [["Order party", "Party on SO", "GSTIN on SO", "Same party?", "Confirmed by", "Confirmed at"]] },
  });
}

export async function loadPairs(): Promise<Pair[]> {
  const c = globalCache.get<Pair[]>(KEY);
  if (c) return c;
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A2:D` });
    const list = (res.data.values || []).map((r) => ({ order: String(r[0] || ""), so: String(r[1] || ""), gstin: String(r[2] || "").toUpperCase(), ok: String(r[3] || "").toLowerCase() !== "no" }));
    globalCache.set(KEY, list, 5 * 60 * 1000);
    return list;
  } catch {
    return []; // tab not made yet
  }
}

/** true = confirmed same, false = confirmed wrong, null = never asked */
export async function pairAnswer(orderParty: string, soParty: string, gstin: string): Promise<boolean | null> {
  const a = norm(orderParty);
  const hit = (await loadPairs()).filter((p) => norm(p.order) === a && ((gstin && p.gstin === gstin.toUpperCase()) || norm(p.so) === norm(soParty)));
  if (!hit.length) return null;
  return hit[hit.length - 1].ok;
}

export async function savePair(orderParty: string, soParty: string, gstin: string, same: boolean, by: string) {
  await ensureTab();
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: `'${TAB}'!A:F`, valueInputOption: "RAW",
    requestBody: { values: [[orderParty, soParty, gstin, same ? "Yes" : "No", by, new Date().toISOString()]] },
  });
  globalCache.delete(KEY);
}
