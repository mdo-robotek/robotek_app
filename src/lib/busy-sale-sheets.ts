import { google } from "googleapis";
import { globalCache } from "./cache";

// Busy sale register (auto-exported from Busy software) — single source of
// truth for item-wise sales OUT quantities. Tab "sale":
// A=Date, B=Month, C=Company Performance, D=Item Details, E=Sub Category,
// F=Category, G=Qty, H=Amount (headers on row 2, data from row 3).
const BUSY_SALE_SHEET_ID = "1gRW6urNBoqP0I-R3xTGQzay3f26AfEgDFo8k0ILVVb0";
const CACHE_KEY = `${BUSY_SALE_SHEET_ID}_busy_sales`;
const CACHE_TTL_MS = 10 * 60 * 1000;

export type BusySaleRow = {
  date: string; // ISO yyyy-mm-dd ("" when unparseable)
  item: string;
  qty: number;
};

async function getSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
  );
  const tokensStr = process.env.GOOGLE_OAUTH_TOKENS;
  if (!tokensStr) throw new Error("GOOGLE_OAUTH_TOKENS environment variable is not set");
  oauth2Client.setCredentials(JSON.parse(tokensStr));
  return google.sheets({ version: "v4", auth: oauth2Client });
}

function toISODate(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (/^\d+(\.\d+)?$/.test(s)) {
    // Google Sheets serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setUTCDate(d.getUTCDate() + Math.floor(Number(s)));
    return d.toISOString().slice(0, 10);
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}

export async function getBusySales(): Promise<BusySaleRow[]> {
  const cached = globalCache.get<BusySaleRow[]>(CACHE_KEY);
  if (cached) return cached;
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: BUSY_SALE_SHEET_ID,
      range: "sale!A3:G100000",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = (res.data.values || []) as unknown[][];
    const out: BusySaleRow[] = [];
    for (const r of rows) {
      const item = String(r?.[3] ?? "").trim();
      if (!item) continue;
      const qty = parseFloat(String(r?.[6] ?? "")) || 0;
      if (!qty) continue;
      out.push({ date: toISODate(r?.[0]), item, qty });
    }
    globalCache.set(CACHE_KEY, out, CACHE_TTL_MS);
    return out;
  } catch (error: any) {
    console.error("[Busy Sales] Failed to fetch sale register:", error?.message);
    return [];
  }
}
