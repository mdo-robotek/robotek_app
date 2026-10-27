import { google } from "googleapis";
import type { DocUpload } from "./employee-docs";

/** Tab "Employee_Documents" in the HRMS sheet — one row per uploaded document. */
const SHEET_ID = "1q00QfCvnk69ZHXZ9ZPPHXXLDBDfSAfqk20MK15xqOVk";
const TAB = "Employee_Documents";

async function sheetsClient() {
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.NEXTAUTH_URL);
  const tokens = process.env.GOOGLE_OAUTH_TOKENS;
  if (!tokens) throw new Error("GOOGLE_OAUTH_TOKENS environment variable is not set");
  oauth2Client.setCredentials(JSON.parse(tokens));
  return google.sheets({ version: "v4", auth: oauth2Client });
}

let cache: { at: number; byPerson: Record<string, DocUpload[]> } | null = null;

export async function getEmployeeDocs(): Promise<Record<string, DocUpload[]>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.byPerson;
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${TAB}!A:I` });
  const byPerson: Record<string, DocUpload[]> = {};
  for (const r of ((res.data.values || []) as string[][]).slice(1)) {
    const key = String(r[1] || "").trim();
    if (!key) continue;
    (byPerson[key] ||= []).push({ doc_key: r[5] || "", file_url: r[6] || "", uploaded_by: r[7] || "", uploaded_at: r[8] || "" });
  }
  cache = { at: Date.now(), byPerson };
  return byPerson;
}

export async function addEmployeeDoc(row: {
  person_key: string; person_name: string; module: string; record_id: string;
  doc_key: string; file_url: string; uploaded_by: string;
}) {
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:I`,
    valueInputOption: "RAW",
    requestBody: { values: [[`DOC-${Date.now()}`, row.person_key, row.person_name, row.module, row.record_id, row.doc_key, row.file_url, row.uploaded_by, new Date().toISOString()]] },
  });
  cache = null;
}
