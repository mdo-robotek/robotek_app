import { BaseSheetsService } from "./sheets/base-service";

const GOOGLE_SHEET_ID = "1SSWWCTVanxELVZdBagShBuALzVLkYUeb5CK-ETmw_18";
const SHEET_NAME = "tickets";
const HISTORY_SHEET = "tickets_history";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  raised_by: string;
  solver_person: string;
  planned_resolution: string;
  status: string;
  created_at: string;
  updated_at: string;
  attachment_url: string;
  voice_note: string;
  suggestion_1?: string;
  suggestion_2?: string;
  suggestion_3?: string;
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  action_type: string; // 'STATUS_CHANGE' | 'COMMENT'
  actor_username: string;
  old_status: string;
  new_status: string;
  comment_text: string;
  created_at: string;
  attachment_url: string;
  voice_note: string;
}

class TicketService extends BaseSheetsService<Ticket> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:P";
  protected idColumnIndex = 0;


  mapRowToItem(row: any[]): Ticket {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] || "";
    return {
      id: get("id"),
      title: get("title"),
      description: get("description"),
      category: get("category"),
      priority: get("priority"),
      raised_by: get("raised_by") || get("raisedby"),
      solver_person: get("solver_person") || get("solverperson"),
      planned_resolution: get("planned_resolution") || get("plannedresolution"),
      status: get("status"),
      created_at: get("created_at") || get("createdat"),
      updated_at: get("updated_at") || get("updatedat"),
      attachment_url: get("attachment_url") || get("attachmenturl"),
      voice_note: get("voice_note") || get("voicenote"),
      suggestion_1: get("suggestion_1"),
      suggestion_2: get("suggestion_2"),
      suggestion_3: get("suggestion_3"),
    };
  }

  mapItemToRow(t: Ticket): any[] {
    const row: any[] = [];
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val;
    };

    set("id", t.id);
    set("title", t.title);
    set("description", t.description);
    set("category", t.category);
    set("priority", t.priority);
    set("raised_by", t.raised_by);
    set("solver_person", t.solver_person);
    set("planned_resolution", t.planned_resolution);
    set("status", t.status);
    set("created_at", t.created_at);
    set("updated_at", t.updated_at);
    set("attachment_url", t.attachment_url || "");
    set("voice_note", t.voice_note || "");
    set("suggestion_1", t.suggestion_1 || "");
    set("suggestion_2", t.suggestion_2 || "");
    set("suggestion_3", t.suggestion_3 || "");

    const maxIdx = Math.max(...Object.values(this.hMap), 0);
    for (let i = 0; i <= maxIdx; i++) {
        if (row[i] === undefined) row[i] = "";
    }
    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map(id => {
      const match = String(id).match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }).filter(n => !isNaN(n));
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }
}

class TicketHistoryService extends BaseSheetsService<TicketHistory> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = HISTORY_SHEET;
  protected range = "A:J";
  protected idColumnIndex = 0;


  mapRowToItem(row: any[]): TicketHistory {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] || "";
    return {
      id: get("id"),
      ticket_id: get("ticket_id") || get("ticketid"),
      action_type: get("action_type") || get("actiontype"),
      actor_username: get("actor_username") || get("actorusername"),
      old_status: get("old_status") || get("oldstatus"),
      new_status: get("new_status") || get("newstatus"),
      comment_text: get("comment_text") || get("commenttext"),
      created_at: get("created_at") || get("createdat"),
      attachment_url: get("attachment_url") || get("attachmenturl"),
      voice_note: get("voice_note") || get("voicenote"),
    };
  }

  mapItemToRow(h: TicketHistory): any[] {
    const row: any[] = [];
    const set = (h_key: string, val: any) => {
      const idx = this.hMap[h_key.toLowerCase()];
      if (idx !== undefined) row[idx] = val;
    };

    set("id", h.id);
    set("ticket_id", h.ticket_id);
    set("action_type", h.action_type);
    set("actor_username", h.actor_username);
    set("old_status", h.old_status);
    set("new_status", h.new_status);
    set("comment_text", h.comment_text);
    set("created_at", h.created_at);
    set("attachment_url", h.attachment_url || "");
    set("voice_note", h.voice_note || "");

    const maxIdx = Math.max(...Object.values(this.hMap), 0);
    for (let i = 0; i <= maxIdx; i++) {
        if (row[i] === undefined) row[i] = "";
    }
    return row;
  }
}

export const ticketService = new TicketService();
export const ticketHistoryService = new TicketHistoryService();

 export async function getTickets(): Promise<Ticket[]> {
   return ticketService.getAll();
 }
 
 let ticketLock: Promise<any> = Promise.resolve();
 
 export async function addTicket(ticket: Ticket): Promise<boolean> {
   return ticketLock = ticketLock.then(async () => {
     if (!ticket.id) {
       const nextId = await ticketService.getNextNumericalId();
       ticket.id = nextId.toString();
     }
     return ticketService.add(ticket);
   }).catch(err => {
     console.error("Error in addTicket lock:", err);
     return false;
   });
 }

export async function updateTicket(id: string, ticket: Ticket): Promise<boolean> {
  return ticketService.update(id, ticket);
}

async function deleteRelatedTicketRows(id: string) {
  try {
    const sheets = await (ticketService as any).getSheetsClient();

    const fullRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${HISTORY_SHEET}!A:Z`,
    });

    const rows = fullRes.data.values || [];
    const toDelete: number[] = [];
    rows.forEach((row: any[], i: number) => {
      if (i === 0) return;
      // column B (index 1) = ticket_id in tickets_history
      if (String(row[1] || "").trim() === String(id).trim()) {
        toDelete.push(i);
      }
    });

    if (toDelete.length === 0) return;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
    const sheetId = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === HISTORY_SHEET)?.properties?.sheetId;
    if (sheetId === undefined) return;

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
  } catch (err) {
    console.error("Error cascade-deleting ticket history rows:", err);
  }
}

export async function deleteTicket(id: string): Promise<boolean> {
  const result = await ticketService.delete(id);
  if (result) await deleteRelatedTicketRows(id);
  return result;
}

export async function getTicketHistory(ticketId: string): Promise<TicketHistory[]> {
  const all = await ticketHistoryService.getAll();
  return all
    .filter((h) => String(h.ticket_id) === String(ticketId))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addTicketHistory(history: TicketHistory): Promise<boolean> {
  const result = await ticketHistoryService.add(history);
  if (result) void ticketService.triggerSync();
  return result;
}
