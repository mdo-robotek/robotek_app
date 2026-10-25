import { google } from "googleapis";
import { globalCache } from "./cache";

/**
 * Party-wise outstanding, exported from Busy into a Google Sheet.
 *
 * Sahil, 2026-10-25: the ERP has no receivables data of its own, so the
 * Collection card reads a sheet the accounts team refreshes from Busy.
 *
 * Expected sheet: tab named "Outstanding" with these headers in row 1 —
 *   Party Name | Outstanding Amount | Overdue Days | As On Date
 * Only the first two are required. Put the spreadsheet id in .env as
 * OUTSTANDING_SHEET_ID. Until that is set the card shows a "not connected"
 * state instead of a wrong number.
 */

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

const SHEET_NAME = "Outstanding";
const CACHE_KEY = "outstanding:summary";
const CACHE_TTL = 10 * 60 * 1000;

export interface OutstandingSummary {
  connected: boolean;
  totalOutstanding: number;
  overdueOutstanding: number;
  partyCount: number;
  asOnDate: string;
  topParties: { party: string; amount: number; overdueDays: number }[];
}

const EMPTY: OutstandingSummary = {
  connected: false,
  totalOutstanding: 0,
  overdueOutstanding: 0,
  partyCount: 0,
  asOnDate: "",
  topParties: [],
};

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export async function getOutstandingSummary(): Promise<OutstandingSummary> {
  const sheetId = process.env.OUTSTANDING_SHEET_ID || "";
  if (!sheetId) return EMPTY;

  const cached = globalCache.get<OutstandingSummary>(CACHE_KEY);
  if (cached) return cached;

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A:D`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = (res.data.values || []) as unknown[][];
    if (rows.length <= 1) return EMPTY;

    const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
    const idx = (...names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex((h) => h === n || h.includes(n));
        if (i !== -1) return i;
      }
      return -1;
    };
    const iParty = idx("party name", "party");
    const iAmt = idx("outstanding amount", "outstanding", "amount");
    const iDays = idx("overdue days", "overdue", "days");
    const iDate = idx("as on date", "as on", "date");

    let total = 0;
    let overdue = 0;
    let parties = 0;
    let asOn = "";
    const list: { party: string; amount: number; overdueDays: number }[] = [];

    rows.slice(1).forEach((r) => {
      const party = String(r[iParty] ?? "").trim();
      const amount = num(r[iAmt]);
      if (!party || amount === 0) return;
      const days = iDays === -1 ? 0 : num(r[iDays]);
      total += amount;
      if (days > 0) overdue += amount;
      parties += 1;
      list.push({ party, amount, overdueDays: days });
      if (!asOn && iDate !== -1 && r[iDate]) asOn = String(r[iDate]).trim();
    });

    const summary: OutstandingSummary = {
      connected: true,
      totalOutstanding: Math.round(total),
      overdueOutstanding: Math.round(overdue),
      partyCount: parties,
      asOnDate: asOn,
      topParties: list.sort((a, b) => b.amount - a.amount).slice(0, 5),
    };
    globalCache.set(CACHE_KEY, summary, CACHE_TTL);
    return summary;
  } catch (error) {
    console.error("getOutstandingSummary failed", error);
    return EMPTY;
  }
}
