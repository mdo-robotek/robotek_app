import { BaseSheetsService } from "./sheets/base-service";
import { Delegation } from "@/types/delegation";
import { getUsers } from "./google-sheets";
import { buildRevisionIndex, rowFromSheet, type RevisionInfo, type RevisionRow } from "./delegation-revisions";

const GOOGLE_SHEET_ID = "1kqX1fWoTyk2Y7IUCpO5PrrcF0fvGSj0n3xZaNdmm3Iw";
const SHEET_NAME = "delegation";

class DelegationService extends BaseSheetsService<Delegation> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:N";
  protected idColumnIndex = 0;


  mapRowToItem(row: any[]): Delegation {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] || "";
    return {
      id: get("id"),
      title: get("title"),
      description: get("description"),
      assigned_by: get("assigned_by"),
      assigned_to: get("assigned_to"),
      department: get("department"),
      priority: get("priority"),
      due_date: get("due_date"),
      status: get("status"),
      voice_note_url: get("voice_note_url"),
      reference_docs: get("reference_docs"),
      evidence_required: get("evidence_required"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
    };
  }

  mapItemToRow(d: Delegation): any[] {
    const row: any[] = [];
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val;
    };

    set("id", String(d.id));
    set("title", d.title);
    set("description", d.description);
    set("assigned_by", d.assigned_by);
    set("assigned_to", d.assigned_to);
    set("department", d.department);
    set("priority", d.priority);
    set("due_date", d.due_date);
    set("status", d.status);
    set("voice_note_url", d.voice_note_url);
    set("reference_docs", d.reference_docs);
    set("evidence_required", d.evidence_required);
    set("created_at", d.created_at);
    set("updated_at", d.updated_at);

    const maxIdx = Math.max(...Object.values(this.hMap), 0);
    for (let i = 0; i <= maxIdx; i++) {
        if (row[i] === undefined) row[i] = "";
    }
    return row;
   }
 
   async getNextNumericalId(): Promise<number> {
     const ids = await this.getLatestIds();
     const numericIds = ids.map(id => parseInt(String(id)) || 0);
     return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
   }
 }
 
 export const delegationService = new DelegationService();
 
 export async function getDelegations(): Promise<Delegation[]> {
  const all = await delegationService.getAll();
  try {
    const users = await getUsers();
    const activeUsernames = new Set(users.filter(u => u.isActive !== false).map(u => String(u.username).trim()).filter(Boolean));
    // Exclude delegations assigned to users who are not active or deleted (no matching user)
    return all.filter(d => {
      if (!d.assigned_to) return true;
      return activeUsernames.has(String(d.assigned_to).trim());
    });
  } catch (err) {
    // If users can't be fetched for any reason, fallback to returning all delegations
    console.error("Error filtering delegations by active users:", err);
    return all;
  }
 }
 
 let delegationLock: Promise<any> = Promise.resolve();
 
 export async function addDelegation(data: Partial<Delegation>): Promise<boolean> {
   return delegationLock = delegationLock.then(async () => {
     if (!data.id) {
       data.id = (await delegationService.getNextNumericalId()).toString();
     }
     return delegationService.add(data as Delegation);
   }).catch(err => {
     console.error("Error in addDelegation lock:", err);
     return false;
   });
 }

export async function updateDelegation(id: string, d: Delegation) { return delegationService.update(id, d); }

async function deleteRelatedDelegationRows(id: string) {
  try {
    const sheets = await (delegationService as any).getSheetsClient();

    const subSheets = [
      { name: "delegation_revision_history", idCol: 1 },  // column B = delegation_id
      { name: "delegation_remarks", idCol: 1 },            // column B = delegation_id
    ];

    for (const sub of subSheets) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sub.name}!A:A`,
      });

      // Get the full sheet to find matching rows
      const fullRes = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sub.name}!A:Z`,
      });

      const rows = fullRes.data.values || [];
      // Collect 0-based row indices (skipping header) where col[idCol] === id, in reverse order
      const toDelete: number[] = [];
      rows.forEach((row: any[], i: number) => {
        if (i === 0) return; // skip header
        if (String(row[sub.idCol] || "").trim() === String(id).trim()) {
          toDelete.push(i);
        }
      });

      if (toDelete.length === 0) continue;

      // Get sheetId
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
      const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === sub.name)?.properties?.sheetId;
      if (sheetId === undefined) continue;

      // Delete rows from bottom to top so indices don't shift
      const requests = toDelete
        .sort((a, b) => b - a)
        .map((rowIdx) => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 },
          },
        }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        requestBody: { requests },
      });
    }
  } catch (err) {
    console.error("Error cascade-deleting delegation sub-rows:", err);
  }
}

export async function deleteDelegation(id: string) {
  const result = await delegationService.delete(id);
  if (result) await deleteRelatedDelegationRows(id);
  return result;
}

export async function getDelegationHistory(id: string) {
  const sheets = await (delegationService as any).getSheetsClient();
  const revResponse = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: `delegation_revision_history!A:J` });
  const remResponse = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: `delegation_remarks!A:F` });
  const history: any[] = [];
  (revResponse.data.values || []).slice(1).forEach((row: any) => {
    if (String(row[1]) === String(id)) history.push({ type: 'revision', id: row[0], old_status: row[2], new_status: row[3], old_due_date: row[4], new_due_date: row[5], reason: row[6], created_at: row[7], evidence_urls: row[8], requested_due_date: row[9] || "" });
  });
  (remResponse.data.values || []).slice(1).forEach((row: any) => {
    if (String(row[1]) === String(id)) history.push({ type: 'remark', id: row[0], user_id: row[2], username: row[3], remark: row[4], created_at: row[5] });
  });
  return history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addDelegationRemark(remark: any) {
  const sheets = await (delegationService as any).getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID, range: `delegation_remarks!A:F`, valueInputOption: "USER_ENTERED",
    requestBody: { values: [[remark.id, remark.delegation_id, remark.user_id, remark.username, remark.remark, remark.created_at]] }
  });
  void delegationService.triggerSync();
  return true;
}

export async function addDelegationRevision(rev: any) {
  const sheets = await (delegationService as any).getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID, range: `delegation_revision_history!A:J`, valueInputOption: "USER_ENTERED",
    requestBody: { values: [[rev.id, rev.delegation_id, rev.old_status, rev.new_status, rev.old_due_date, rev.new_due_date, rev.reason, rev.created_at, rev.evidence_urls, rev.requested_due_date || ""]] }
  });
  revisionCache = null; // the next read sees this row
  void delegationService.triggerSync();
  return true;
}

// ── Date-change index (see src/lib/delegation-revisions.ts) ──
let revisionCache: { at: number; rows: RevisionRow[] } | null = null;
const REVISION_TTL = 30 * 1000;

export async function getRevisionRows(): Promise<RevisionRow[]> {
  if (revisionCache && Date.now() - revisionCache.at < REVISION_TTL) return revisionCache.rows;
  const sheets = await (delegationService as any).getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: `delegation_revision_history!A:J` });
  const rows = ((res.data.values || []) as unknown[][]).slice(1).map(rowFromSheet);
  revisionCache = { at: Date.now(), rows };
  return rows;
}

/** id -> { count of date moves, open "new date" ask } */
export async function getRevisionIndex(): Promise<Map<string, RevisionInfo>> {
  return buildRevisionIndex(await getRevisionRows());
}
