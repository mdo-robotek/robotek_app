import { BaseSheetsService } from "./sheets/base-service";
import { Checklist, ChecklistOccurrence, ChecklistRevision } from "@/types/checklist";
import { getUsers } from "./google-sheets";
import {
  getIstDateString,
  getWeeklyOffDayOfWeek,
  isWeeklyOffForUser,
  toDateOnlyString,
} from "./dateUtils";

const GOOGLE_SHEET_ID = "1RG5I4QET9WLjKmSeGCzsbmgraMDH-HXZHfWcOprPBA0";
const SHEET_NAME = "checklists";
const HISTORY_SHEET = "checklists_revision_history";

class ChecklistService extends BaseSheetsService<Checklist> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:K";
  protected idColumnIndex = 0;

  mapRowToItem(row: any[]): Checklist {
    const get = (h: string) => row[this.hMap[h.toLowerCase()]] || "";
    return {
      id: String(get("id") || "").trim(),
      task: get("task"),
      assigned_by: get("assigned_by"),
      assigned_to: get("assigned_to"),
      priority: get("priority"),
      department: get("department"),
      frequency: get("frequency"),
      due_date: toDateOnlyString(get("due_date")),
      group_id: get("group_id"),
      created_at: toDateOnlyString(get("created_at")) || String(get("created_at") || ""),
      updated_at: toDateOnlyString(get("updated_at")) || String(get("updated_at") || ""),
    };
  }

  mapItemToRow(c: Checklist): any[] {
    const row: any[] = [];
    const set = (h: string, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val;
    };

    set("id", String(c.id));
    set("task", c.task);
    set("assigned_by", c.assigned_by);
    set("assigned_to", c.assigned_to);
    set("priority", c.priority);
    set("department", c.department);
    set("frequency", c.frequency);
    set("due_date", toDateOnlyString(c.due_date) || c.due_date);
    set("group_id", c.group_id);
    set("created_at", toDateOnlyString(c.created_at) || c.created_at);
    set("updated_at", toDateOnlyString(c.updated_at) || c.updated_at);

    const maxIdx = Math.max(...Object.values(this.hMap), 0);
    for (let i = 0; i <= maxIdx; i++) {
      if (row[i] === undefined) row[i] = "";
    }
    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id), 10) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }
}

export const checklistService = new ChecklistService();

export async function getChecklists(): Promise<Checklist[]> {
  return checklistService.getAll();
}

let checklistLock: Promise<any> = Promise.resolve();

export async function addChecklist(data: Partial<Checklist>): Promise<Checklist | false> {
  return (checklistLock = checklistLock
    .then(async () => {
      const id = String(data.id || (await checklistService.getNextNumericalId()));
      const group_id = data.group_id || `chk_${id}`;
      const today = getIstDateString();
      const item: Checklist = {
        id,
        task: data.task || "",
        assigned_by: data.assigned_by || "",
        assigned_to: data.assigned_to || "",
        priority: data.priority || "Medium",
        department: data.department || "",
        frequency: data.frequency || "Daily",
        due_date: toDateOnlyString(data.due_date) || "",
        group_id,
        created_at: toDateOnlyString(data.created_at) || today,
        updated_at: toDateOnlyString(data.updated_at) || today,
      };
      const ok = await checklistService.add(item);
      return ok ? item : false;
    })
    .catch((err) => {
      console.error("Error in addChecklist lock:", err);
      return false as const;
    }));
}

export async function updateChecklist(id: string, data: Checklist): Promise<boolean> {
  const cleaned: Checklist = {
    ...data,
    id: String(id),
    due_date: toDateOnlyString(data.due_date) || data.due_date,
    updated_at: toDateOnlyString(data.updated_at) || getIstDateString(),
    group_id: data.group_id || `chk_${id}`,
  };
  return checklistService.update(id, cleaned);
}

async function deleteRelatedHistoryRows(groupId: string) {
  try {
    if (!groupId) return;
    const sheets = await (checklistService as any).getSheetsClient();
    const fullRes = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${HISTORY_SHEET}!A:Z`,
    });
    const rows = fullRes.data.values || [];
    const toDelete: number[] = [];
    rows.forEach((row: any[], i: number) => {
      if (i === 0) return;
      // Column A = group_id (task reference)
      if (String(row[0] || "").trim() === String(groupId).trim()) toDelete.push(i);
    });
    if (toDelete.length === 0) return;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
    const sheetId = spreadsheet.data.sheets?.find(
      (s: any) => s.properties?.title === HISTORY_SHEET
    )?.properties?.sheetId;
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
    console.error("Error cascade-deleting checklist history rows:", err);
  }
}

export async function deleteChecklist(id: string) {
  const all = await checklistService.getAll();
  const current = all.find((c) => String(c.id) === String(id));
  const groupId = current?.group_id || `chk_${id}`;
  const result = await checklistService.delete(id);
  if (result) await deleteRelatedHistoryRows(groupId);
  return result;
}

function mapHistoryRow(row: any[], hMap?: Record<string, number>): ChecklistRevision {
  if (hMap && Object.keys(hMap).length > 0) {
    const get = (h: string) => row[hMap[h.toLowerCase()]] || "";
    return {
      group_id: String(get("group_id") || "").trim(),
      id: String(get("id") || "").trim(),
      new_status: String(get("new_status") || "").trim(),
      due_date: toDateOnlyString(get("due_date")),
      timestamp: toDateOnlyString(get("timestamp")),
    };
  }
  // Positional fallback: group_id | id | new_status | due_date | timestamp
  return {
    group_id: String(row[0] || "").trim(),
    id: String(row[1] || "").trim(),
    new_status: String(row[2] || "").trim(),
    due_date: toDateOnlyString(row[3]),
    timestamp: toDateOnlyString(row[4]),
  };
}

/** Always read history fresh from Sheets — no server cache (avoids stale Pending after complete). */
export async function getAllChecklistRevisions(): Promise<ChecklistRevision[]> {
  const sheets = await (checklistService as any).getSheetsClient();
  const revResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${HISTORY_SHEET}!A:E`,
  });
  const rows = revResponse.data.values || [];
  if (rows.length === 0) return [];
  const header = (rows[0] || []).map((h: any) => String(h || "").toLowerCase().trim());
  const hMap: Record<string, number> = {};
  header.forEach((h: string, i: number) => {
    if (h) hMap[h] = i;
  });
  return rows
    .slice(1)
    .map((row: any[]) => mapHistoryRow(row, hMap))
    .filter((r: ChecklistRevision) => Boolean(r.group_id));
}

async function getNextHistoryNumericalId(): Promise<number> {
  const all = await getAllChecklistRevisions();
  const nums = all.map((r) => parseInt(String(r.id), 10) || 0);
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

/** History lookup by checklist group_id (not history row id / not checklist numeric id). */
export async function getChecklistHistory(groupIdOrChecklistId: string) {
  const all = await getAllChecklistRevisions();
  const masters = await getChecklists();
  const master = masters.find(
    (m) =>
      String(m.group_id) === String(groupIdOrChecklistId) ||
      String(m.id) === String(groupIdOrChecklistId)
  );
  const groupId = master?.group_id || String(groupIdOrChecklistId);
  return all
    .filter((r) => String(r.group_id) === String(groupId))
    .map((r) => ({
      type: "revision" as const,
      group_id: r.group_id,
      id: r.id,
      new_status: r.new_status,
      due_date: r.due_date,
      timestamp: r.timestamp,
      created_at: r.timestamp,
    }))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

let historyLock: Promise<any> = Promise.resolve();

export async function addChecklistRevision(
  rev: Omit<ChecklistRevision, "id"> & { id?: string }
): Promise<ChecklistRevision> {
  return (historyLock = historyLock.then(async () => {
    const sheets = await (checklistService as any).getSheetsClient();
    const id = rev.id || String(await getNextHistoryNumericalId());
    const row: ChecklistRevision = {
      group_id: rev.group_id,
      id,
      new_status: rev.new_status,
      due_date: toDateOnlyString(rev.due_date) || rev.due_date,
      timestamp: toDateOnlyString(rev.timestamp) || rev.timestamp,
    };
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${HISTORY_SHEET}!A:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[row.group_id, String(row.id), row.new_status, row.due_date, row.timestamp]],
      },
    });
    return row;
  }));
}

// --- Occurrence expansion ---

function parseLocalDate(dateStr: string): Date | null {
  const iso = toDateOnlyString(dateStr);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftOffDayEarlier(d: Date, office?: string): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const off = getWeeklyOffDayOfWeek(office);
  if (result.getDay() === off) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

function addMonthsClamped(anchor: Date, months: number): Date {
  const day = anchor.getDate();
  const base = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(day, last));
  return base;
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export function expandChecklistOccurrences(
  master: Checklist,
  todayStr: string,
  office?: string
): string[] {
  const anchor = parseLocalDate(master.due_date);
  const today = parseLocalDate(todayStr);
  if (!anchor || !today) return [];

  const freqRaw = master.frequency || "Daily";
  const freqBase = freqRaw.includes(":")
    ? freqRaw.split(":")[0].trim()
    : freqRaw.trim();
  const dates: string[] = [];
  const seen = new Set<string>();
  const push = (d: Date) => {
    if (d > today) return;
    const key = formatLocalDate(d);
    if (!seen.has(key)) {
      seen.add(key);
      dates.push(key);
    }
  };

  if (freqBase.toLowerCase() === "daily") {
    const cur = new Date(anchor);
    while (cur <= today) {
      if (!isWeeklyOffForUser(office, cur.getFullYear(), cur.getMonth(), cur.getDate())) {
        push(cur);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  if (freqBase.toLowerCase() === "weekly") {
    const dayPart = freqRaw.includes(":") ? freqRaw.split(":").slice(1).join(":") : "";
    const tokens = dayPart.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    let selected = tokens
      .map((t) => WEEKDAY_MAP[t] ?? WEEKDAY_MAP[t.slice(0, 3)])
      .filter((n) => n !== undefined && n >= 0) as number[];
    if (selected.length === 0) selected = [anchor.getDay()];

    const cur = new Date(anchor);
    while (cur <= today) {
      if (selected.includes(cur.getDay())) push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  const step =
    /^quarterly$/i.test(freqBase)
      ? 3
      : /half\s*yearly/i.test(freqBase)
        ? 6
        : /^yearly$/i.test(freqBase)
          ? 12
          : 1; // Monthly default

  for (let i = 0; i < 600; i++) {
    const raw = addMonthsClamped(anchor, i * step);
    const occ = shiftOffDayEarlier(raw, office);
    if (occ > today && raw > today) break;
    if (occ <= today) push(occ);
  }
  return dates;
}

/** Occurrence key uses checklist group_id (task ref) + due date */
function completionKey(groupId: string, dueDate: string) {
  return `${String(groupId)}|${toDateOnlyString(dueDate)}`;
}

function masterGroupId(master: Checklist): string {
  return master.group_id || `chk_${master.id}`;
}

function buildOccurrences(
  masters: Checklist[],
  revisions: ChecklistRevision[],
  officeByUser: Map<string, string>,
  todayStr: string
): ChecklistOccurrence[] {
  const completedMap = new Map<string, string>();
  for (const r of revisions) {
    if (String(r.new_status || "").toLowerCase() !== "completed") continue;
    const gid = String(r.group_id || "").trim();
    if (!gid) continue;
    const due = toDateOnlyString(r.due_date);
    const ts = toDateOnlyString(r.timestamp) || r.timestamp;
    if (due) {
      const key = completionKey(gid, due);
      const prev = completedMap.get(key);
      if (!prev || ts > prev) completedMap.set(key, ts);
    }
  }

  const masterByGroup = new Map(
    masters.map((m) => [masterGroupId(m), m])
  );
  const out: ChecklistOccurrence[] = [];
  const seenKeys = new Set<string>();

  for (const master of masters) {
    const gid = masterGroupId(master);
    const office = officeByUser.get(String(master.assigned_to || "").trim());
    const occDates = expandChecklistOccurrences(master, todayStr, office);
    for (const occDate of occDates) {
      const key = completionKey(gid, occDate);
      seenKeys.add(key);
      const completed_date = completedMap.get(key) || "";
      let display_status = "Pending";
      if (completed_date) display_status = "Completed";
      else if (occDate < todayStr) display_status = "Overdue";
      else display_status = "Pending";

      const is_late_complete = Boolean(
        completed_date && completed_date > occDate
      );

      out.push({
        ...master,
        group_id: gid,
        occurrence_due_date: occDate,
        due_date: occDate,
        completed_date,
        display_status,
        is_late_complete,
        occurrence_key: key,
      });
    }
  }

  // Legacy / unmatched completions: show through today with completion date as due + completed
  for (const r of revisions) {
    if (String(r.new_status || "").toLowerCase() !== "completed") continue;
    const gid = String(r.group_id || "").trim();
    if (!gid) continue;
    const doneDate =
      toDateOnlyString(r.timestamp) || toDateOnlyString(r.due_date);
    if (!doneDate || doneDate > todayStr) continue;
    const master = masterByGroup.get(gid);
    if (!master) continue;

    const dueKey = r.due_date ? completionKey(gid, r.due_date) : "";
    const doneKey = completionKey(gid, doneDate);
    if (
      (dueKey && seenKeys.has(dueKey) && completedMap.has(dueKey)) ||
      (seenKeys.has(doneKey) &&
        out.some(
          (o) =>
            o.occurrence_key === doneKey && o.display_status === "Completed"
        ))
    ) {
      continue;
    }
    if (seenKeys.has(doneKey)) continue;
    seenKeys.add(doneKey);

    out.push({
      ...master,
      group_id: gid,
      occurrence_due_date: doneDate,
      due_date: doneDate,
      completed_date: doneDate,
      display_status: "Completed",
      is_late_complete: false,
      occurrence_key: doneKey,
    });
  }

  return out;
}

export type ChecklistListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  statusFilters?: string[];
  assignmentFilter?: string;
  currentUser?: string;
  userRole?: string;
  dateFilters?: string[];
  startDate?: string;
  endDate?: string;
  modalStatusFilter?: string[];
  modalPriorityFilter?: string[];
  modalAssignedToFilter?: string[];
  modalAssignedByFilter?: string[];
  modalDepartmentFilter?: string[];
  modalFrequencyFilter?: string[];
  sortKey?: string;
  sortDir?: string;
  view?: "tasks" | "master";
};

async function loadActiveMastersAndUsers() {
  const [allChecklists, users] = await Promise.all([getChecklists(), getUsers()]);
  const activeUsernames = new Set(
    users
      .filter((u) => u.isActive !== false)
      .map((u) => String(u.username).trim())
      .filter(Boolean)
  );
  const officeByUser = new Map<string, string>();
  users.forEach((u) => {
    const name = String(u.username || "").trim();
    if (name) officeByUser.set(name, String(u.office || ""));
  });

  const masters = allChecklists.filter((c) => {
    const at = c.assigned_to ? String(c.assigned_to).trim() : "";
    const ab = c.assigned_by ? String(c.assigned_by).trim() : "";
    if (at && !activeUsernames.has(at)) return false;
    if (ab && !activeUsernames.has(ab)) return false;
    return true;
  });

  return { masters, officeByUser };
}

function applyRoleFilter(
  items: Checklist[],
  userRole: string,
  currentUser: string,
  assignmentFilter: string
) {
  const role = userRole.toUpperCase();
  const isRegularUser = role === "USER" || role === "SALES" || role === "CRM";
  let base = isRegularUser
    ? items.filter((c) => c.assigned_to === currentUser)
    : items;

  if (!isRegularUser) {
    if (assignmentFilter === "ToMe") base = base.filter((c) => c.assigned_to === currentUser);
    else if (assignmentFilter === "ByMe") base = base.filter((c) => c.assigned_by === currentUser);
  }
  return { base, isRegularUser };
}

export async function getChecklistsPaginated(
  page: number = 1,
  limit: number = 10,
  searchTerm: string = "",
  statusFilters: string[] = [],
  assignmentFilter: string = "All",
  currentUser: string = "",
  userRole: string = "USER",
  dateFilters: string[] = [],
  startDate: string = "",
  endDate: string = "",
  modalStatusFilter: string[] = [],
  modalPriorityFilter: string[] = [],
  modalAssignedToFilter: string[] = [],
  modalAssignedByFilter: string[] = [],
  modalDepartmentFilter: string[] = [],
  modalFrequencyFilter: string[] = [],
  sortKey: string = "due_date",
  sortDir: string = "desc",
  view: "tasks" | "master" = "tasks"
) {
  const todayStr = getIstDateString();
  const { masters, officeByUser } = await loadActiveMastersAndUsers();
  // Expand once from role-scoped masters (ignore ToMe/ByMe for the base set)
  const { base: roleAll } = applyRoleFilter(masters, userRole, currentUser, "All");

  if (view === "master") {
    const { base: roleFiltered } = applyRoleFilter(
      masters,
      userRole,
      currentUser,
      assignmentFilter
    );
    return paginateMasterView({
      items: roleFiltered,
      allForCounts: roleAll,
      page,
      limit,
      searchTerm,
      statusFilters,
      dateFilters,
      startDate,
      endDate,
      modalStatusFilter,
      modalPriorityFilter,
      modalAssignedToFilter,
      modalAssignedByFilter,
      modalDepartmentFilter,
      modalFrequencyFilter,
      sortKey,
      sortDir,
      currentUser,
      masters,
      userRole,
    });
  }

  const revisions = await getAllChecklistRevisions();
  const occurrences = buildOccurrences(roleAll, revisions, officeByUser, todayStr);

  const toMeCount = occurrences.filter((c) => c.assigned_to === currentUser).length;
  const byMeCount = occurrences.filter((c) => c.assigned_by === currentUser).length;

  // Assignment filter applied after a single expand
  let assignmentScoped = occurrences;
  if (assignmentFilter === "ToMe") {
    assignmentScoped = occurrences.filter((c) => c.assigned_to === currentUser);
  } else if (assignmentFilter === "ByMe") {
    assignmentScoped = occurrences.filter((c) => c.assigned_by === currentUser);
  }

  const statusCounts: Record<string, number> = { All: assignmentScoped.length };
  const dateCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const assignedToCounts: Record<string, number> = {};
  const assignedByCounts: Record<string, number> = {};
  const departmentCounts: Record<string, number> = {};
  const frequencyCounts: Record<string, number> = {};

  for (const c of assignmentScoped) {
    statusCounts[c.display_status] = (statusCounts[c.display_status] || 0) + 1;
    if (c.display_status === "Overdue") {
      statusCounts.Delayed = (statusCounts.Delayed || 0) + 1;
    }
    if (c.priority) priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
    if (c.assigned_to) assignedToCounts[c.assigned_to] = (assignedToCounts[c.assigned_to] || 0) + 1;
    if (c.assigned_by) assignedByCounts[c.assigned_by] = (assignedByCounts[c.assigned_by] || 0) + 1;
    if (c.department) departmentCounts[c.department] = (departmentCounts[c.department] || 0) + 1;
    if (c.frequency) {
      const freqBase = c.frequency.includes(":")
        ? c.frequency.split(":")[0].trim()
        : c.frequency;
      frequencyCounts[freqBase] = (frequencyCounts[freqBase] || 0) + 1;
    }
  }

  const filtered = assignmentScoped.filter((c) => {
    if (statusFilters.length > 0) {
      const normalized = statusFilters.map((f) =>
        f === "Delayed" ? "Overdue" : f
      );
      if (!normalized.includes(c.display_status)) return false;
    }

    if (dateFilters.length > 0) {
      if (c.display_status === "Completed") return false;
      const matchesAny = dateFilters.some((f) => {
        if (f === "Today") return c.occurrence_due_date === todayStr;
        if (f === "Delayed" || f === "Overdue") {
          return c.display_status === "Overdue" || c.occurrence_due_date < todayStr;
        }
        return false;
      });
      if (!matchesAny) return false;
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      const hay = [
        c.task,
        c.assigned_to,
        c.assigned_by,
        c.department,
        c.priority,
        c.frequency,
        c.occurrence_due_date,
        c.id,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(lower)) return false;
    }

    if (startDate || endDate) {
      const due = c.occurrence_due_date;
      if (startDate && due < toDateOnlyString(startDate)) return false;
      if (endDate && due > toDateOnlyString(endDate)) return false;
    }

    if (modalStatusFilter.length > 0) {
      const normalizedModal = modalStatusFilter.map((f) =>
        f === "Delayed" ? "Overdue" : f
      );
      if (!normalizedModal.includes(c.display_status)) return false;
    }
    if (modalPriorityFilter.length > 0 && !modalPriorityFilter.includes(c.priority || "")) return false;
    if (modalAssignedToFilter.length > 0 && !modalAssignedToFilter.includes(c.assigned_to || "")) return false;
    if (modalAssignedByFilter.length > 0 && !modalAssignedByFilter.includes(c.assigned_by || "")) return false;
    if (modalDepartmentFilter.length > 0 && !modalDepartmentFilter.includes(c.department || "")) return false;
    if (
      modalFrequencyFilter.length > 0 &&
      !modalFrequencyFilter.some((f) => (c.frequency || "").startsWith(f))
    )
      return false;

    return true;
  });

  const key = sortKey === "due_date" ? "occurrence_due_date" : sortKey;
  filtered.sort((a, b) => {
    const aVal: any = (a as any)[key] ?? (a as any)[sortKey] ?? "";
    const bVal: any = (b as any)[key] ?? (b as any)[sortKey] ?? "";
    if (sortKey === "id") {
      const aNum = parseInt(String(aVal), 10);
      const bNum = parseInt(String(bVal), 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;
  const data = filtered.slice(startIdx, startIdx + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    statusCounts,
    dateCounts,
    toMeCount,
    byMeCount,
    counts: {
      priority: priorityCounts,
      assignedTo: assignedToCounts,
      assignedBy: assignedByCounts,
      department: departmentCounts,
      frequency: frequencyCounts,
    },
  };
}

function paginateMasterView(opts: {
  items: Checklist[];
  allForCounts: Checklist[];
  page: number;
  limit: number;
  searchTerm: string;
  statusFilters: string[];
  dateFilters: string[];
  startDate: string;
  endDate: string;
  modalStatusFilter: string[];
  modalPriorityFilter: string[];
  modalAssignedToFilter: string[];
  modalAssignedByFilter: string[];
  modalDepartmentFilter: string[];
  modalFrequencyFilter: string[];
  sortKey: string;
  sortDir: string;
  currentUser: string;
  masters: Checklist[];
  userRole: string;
}) {
  const {
    items,
    page,
    limit,
    searchTerm,
    startDate,
    endDate,
    modalPriorityFilter,
    modalAssignedToFilter,
    modalAssignedByFilter,
    modalDepartmentFilter,
    modalFrequencyFilter,
    sortKey,
    sortDir,
    currentUser,
    masters,
    userRole,
  } = opts;

  const statusCounts: Record<string, number> = { All: items.length };
  const dateCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const assignedToCounts: Record<string, number> = {};
  const assignedByCounts: Record<string, number> = {};
  const departmentCounts: Record<string, number> = {};
  const frequencyCounts: Record<string, number> = {};

  for (const c of items) {
    if (c.priority) priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
    if (c.assigned_to) assignedToCounts[c.assigned_to] = (assignedToCounts[c.assigned_to] || 0) + 1;
    if (c.assigned_by) assignedByCounts[c.assigned_by] = (assignedByCounts[c.assigned_by] || 0) + 1;
    if (c.department) departmentCounts[c.department] = (departmentCounts[c.department] || 0) + 1;
    if (c.frequency) {
      const freqBase = c.frequency.includes(":")
        ? c.frequency.split(":")[0].trim()
        : c.frequency;
      frequencyCounts[freqBase] = (frequencyCounts[freqBase] || 0) + 1;
    }
  }

  const roleAll = applyRoleFilter(masters, userRole, currentUser, "All").base;
  const toMeCount = roleAll.filter((c) => c.assigned_to === currentUser).length;
  const byMeCount = roleAll.filter((c) => c.assigned_by === currentUser).length;

  const filtered = items.filter((c) => {
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      const matches = Object.values(c).some((v) =>
        v?.toString().toLowerCase().includes(lower)
      );
      if (!matches) return false;
    }
    if (startDate || endDate) {
      const due = toDateOnlyString(c.due_date);
      if (!due) return false;
      if (startDate && due < toDateOnlyString(startDate)) return false;
      if (endDate && due > toDateOnlyString(endDate)) return false;
    }
    if (modalPriorityFilter.length > 0 && !modalPriorityFilter.includes(c.priority || "")) return false;
    if (modalAssignedToFilter.length > 0 && !modalAssignedToFilter.includes(c.assigned_to || "")) return false;
    if (modalAssignedByFilter.length > 0 && !modalAssignedByFilter.includes(c.assigned_by || "")) return false;
    if (modalDepartmentFilter.length > 0 && !modalDepartmentFilter.includes(c.department || "")) return false;
    if (
      modalFrequencyFilter.length > 0 &&
      !modalFrequencyFilter.some((f) => (c.frequency || "").startsWith(f))
    )
      return false;
    return true;
  });

  filtered.sort((a, b) => {
    const aVal: any = (a as any)[sortKey] || "";
    const bVal: any = (b as any)[sortKey] || "";
    if (sortKey === "id") {
      const aNum = parseInt(String(aVal), 10);
      const bNum = parseInt(String(bVal), 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;

  return {
    data: filtered.slice(startIdx, startIdx + limit),
    total,
    page,
    limit,
    totalPages,
    statusCounts,
    dateCounts,
    toMeCount,
    byMeCount,
    counts: {
      priority: priorityCounts,
      assignedTo: assignedToCounts,
      assignedBy: assignedByCounts,
      department: departmentCounts,
      frequency: frequencyCounts,
    },
  };
}
