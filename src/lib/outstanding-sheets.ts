import { google } from "googleapis";
import { globalCache } from "./cache";

/**
 * Party-wise outstanding, exported from Busy into a Google Sheet.
 *
 * Sahil, 2026-10-25: the ERP has no receivables data of its own, so the
 * Collection card reads a sheet the accounts team refreshes from Busy.
 *
 * Sheet (set up 2026-10-26): "Sarthi - Busy Outstanding", tab "Outstanding",
 * headings  Party Name | Outstanding Amount | Overdue Days | As On Date
 * Only the first two are needed. A "How to update" tab tells the accounts
 * team what to paste. OUTSTANDING_SHEET_ID in .env can point somewhere else.
 *
 * States the card can show:
 *   connected   — rows found, real numbers
 *   sheetReady  — sheet opens but nothing pasted yet ("Waiting for data")
 *   neither     — sheet can't be opened (not shared with the ERP account)
 * Never a made-up number.
 */
const DEFAULT_SHEET_ID = "1gK3ZgHG6_hGV_FjknPKuijtfG-sd4RqtfF1swoBXSak";

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
  sheetReady: boolean;
  totalOutstanding: number;
  overdueOutstanding: number;
  partyCount: number;
  asOnDate: string;
  topParties: { party: string; amount: number; overdueDays: number }[];
}

const EMPTY: OutstandingSummary = {
  connected: false,
  sheetReady: false,
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

/** Busy writes balances like "12,345.00 Dr" — "Cr" means the party has paid
 *  in advance, which is not money to collect. */
const isCredit = (v: unknown) => /\bcr\.?\s*$/i.test(String(v ?? "").trim());

/** Pure: rows from the sheet -> summary. Exported for tests. */
export function summarizeOutstanding(rows: unknown[][]): OutstandingSummary {
  const ready: OutstandingSummary = { ...EMPTY, sheetReady: true };
  if (!rows || rows.length === 0) return ready;

  const norm = (h: unknown) => String(h ?? "").trim().toLowerCase();
  const find = (headers: string[], names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h === n);
      if (i !== -1) return i;
    }
    for (const n of names) {
      const i = headers.findIndex((h) => h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };
  const PARTY = ["party name", "party", "particulars", "account name", "account"];
  const AMOUNT = ["outstanding amount", "outstanding", "closing balance", "balance", "pending amount", "amount"];
  const DAYS = ["overdue days", "overdue", "days"];
  const DATE = ["as on date", "as on", "date"];

  // Busy exports often have a title line or two above the headings.
  let headerAt = -1;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const h = (rows[r] || []).map(norm);
    if (find(h, PARTY) !== -1 && find(h, AMOUNT) !== -1) { headerAt = r; break; }
  }
  if (headerAt === -1) return ready;

  const headers = rows[headerAt].map(norm);
  const iParty = find(headers, PARTY);
  const iAmt = find(headers, AMOUNT);
  const iDays = find(headers, DAYS);
  const iDate = find(headers, DATE);

  let total = 0;
  let overdue = 0;
  let parties = 0;
  let asOn = "";
  const list: { party: string; amount: number; overdueDays: number }[] = [];

  rows.slice(headerAt + 1).forEach((r) => {
    const party = String(r[iParty] ?? "").trim();
    if (!party || /^(grand )?total$/i.test(party)) return;
    if (isCredit(r[iAmt])) return;
    const amount = num(r[iAmt]);
    if (amount <= 0) return;
    const days = iDays === -1 ? 0 : num(r[iDays]);
    total += amount;
    if (days > 0) overdue += amount;
    parties += 1;
    list.push({ party, amount, overdueDays: days });
    if (!asOn && iDate !== -1 && r[iDate]) asOn = String(r[iDate]).trim();
  });

  if (parties === 0) return ready;
  return {
    connected: true,
    sheetReady: true,
    totalOutstanding: Math.round(total),
    overdueOutstanding: Math.round(overdue),
    partyCount: parties,
    asOnDate: asOn,
    topParties: list.sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

export async function getOutstandingSummary(): Promise<OutstandingSummary> {
  const sheetId = process.env.OUTSTANDING_SHEET_ID || DEFAULT_SHEET_ID;

  const cached = globalCache.get<OutstandingSummary>(CACHE_KEY);
  if (cached) return cached;

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const summary = summarizeOutstanding((res.data.values || []) as unknown[][]);
    globalCache.set(CACHE_KEY, summary, CACHE_TTL);
    return summary;
  } catch (error) {
    console.error("getOutstandingSummary failed", error);
    globalCache.set(CACHE_KEY, EMPTY, 2 * 60 * 1000);
    return EMPTY;
  }
}
