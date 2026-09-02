import { BaseSheetsService } from "./sheets/base-service";
import { IMSGFloorApproval, IMS_GFLOOR_APPROVAL_HEADERS } from "@/types/ims-gfloor-approval";
import { approvalToTxKey } from "./ims-datewise-key";

const GOOGLE_SHEET_ID = "12lk8GV7ZBpm6J-bA5TBWfHQ1qY0eEHIrwOICSnsuceE";
const SHEET_NAME = "IMS-G Floor Approval";

class IMSGFloorApprovalService extends BaseSheetsService<IMSGFloorApproval> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:G";
  protected idColumnIndex = 0;

  mapRowToItem(row: unknown[]): IMSGFloorApproval {
    const r = row as string[];
    const get = (h: string) => {
      const idx = this.hMap[h.toLowerCase()];
      return idx !== undefined ? (r[idx] ?? "") : "";
    };
    return {
      id: String(get("id")),
      item_name: get("item name"),
      category: get("category"),
      in_qty: String(get("in qty")),
      out_qty: String(get("out qty") || ""),
      date: get("date"),
      approval_status: get("approval status"),
    };
  }

  mapItemToRow(item: IMSGFloorApproval): unknown[] {
    const maxIdx = Math.max(...Object.values(this.hMap), 6);
    const row: unknown[] = new Array(maxIdx + 1).fill("");
    const set = (h: string, val: unknown) => {
      const idx = this.hMap[h.toLowerCase()];
      if (idx !== undefined) row[idx] = val ?? "";
    };

    set("id", String(item.id));
    set("item name", item.item_name);
    set("category", item.category);
    set("in qty", item.in_qty);
    set("out qty", item.out_qty ?? "");
    set("date", item.date);
    set("approval status", item.approval_status);

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getApprovalKeySet(): Promise<Set<string>> {
    const rows = await this.getAll();
    const keys = new Set<string>();
    rows.forEach((row) => {
      if ((row.approval_status || "").toLowerCase() === "approved") {
        keys.add(approvalToTxKey(row));
      }
    });
    return keys;
  }
}

export const imsGfloorApprovalService = new IMSGFloorApprovalService();

export async function getIMSGFloorApprovals(): Promise<IMSGFloorApproval[]> {
  return imsGfloorApprovalService.getAll();
}

export async function getIMSGFloorApprovalKeys(): Promise<Set<string>> {
  return imsGfloorApprovalService.getApprovalKeySet();
}

let approvalLock: Promise<unknown> = Promise.resolve();

export type ApprovalInput = {
  item_name: string;
  category?: string;
  date: string;
  in_qty?: number;
  out_qty?: number;
};

export async function addIMSGFloorApprovals(
  transactions: ApprovalInput[]
): Promise<{ added: number; skipped: number }> {
  return (approvalLock = approvalLock
    .then(async () => {
      await imsGfloorApprovalService.ensureColumns([...IMS_GFLOOR_APPROVAL_HEADERS]);

      const existingKeys = await imsGfloorApprovalService.getApprovalKeySet();
      const toAdd: IMSGFloorApproval[] = [];
      let skipped = 0;
      let nextId = await imsGfloorApprovalService.getNextNumericalId();

      for (const tx of transactions) {
        const candidate: ApprovalInput = {
          item_name: tx.item_name,
          category: tx.category || "",
          date: tx.date,
          in_qty: tx.in_qty || 0,
          out_qty: tx.out_qty || 0,
        };
        const key = approvalToTxKey({
          ...candidate,
          in_qty: candidate.in_qty,
          out_qty: candidate.out_qty,
        });

        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        const dateOnly = (() => {
          const ts = Date.parse(candidate.date);
          if (isNaN(ts)) return candidate.date;
          return new Date(ts).toISOString().slice(0, 10);
        })();

        toAdd.push({
          id: String(nextId++),
          item_name: candidate.item_name.trim(),
          category: (candidate.category || "").trim(),
          in_qty: String(candidate.in_qty || 0),
          out_qty: String(candidate.out_qty || 0),
          date: dateOnly,
          approval_status: "Approved",
        });
        existingKeys.add(key);
      }

      if (toAdd.length > 0) {
        const ok = await imsGfloorApprovalService.addMany(toAdd);
        if (!ok) throw new Error("Failed to save approvals");
      }

      return { added: toAdd.length, skipped };
    })
    .catch((err) => {
      console.error("Error in addIMSGFloorApprovals:", err);
      throw err;
    })) as Promise<{ added: number; skipped: number }>;
}
