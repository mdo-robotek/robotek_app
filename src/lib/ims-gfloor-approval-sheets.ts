import { BaseSheetsService } from "./sheets/base-service";
import { IMSGFloorApproval, IMS_GFLOOR_APPROVAL_HEADERS } from "@/types/ims-gfloor-approval";
import { approvalToTxKey } from "./ims-datewise-key";

const GOOGLE_SHEET_ID = "12lk8GV7ZBpm6J-bA5TBWfHQ1qY0eEHIrwOICSnsuceE";
const SHEET_NAME = "IMS-G Floor Approval";

class IMSGFloorApprovalService extends BaseSheetsService<IMSGFloorApproval> {
  protected spreadsheetId = GOOGLE_SHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:Z";
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
      checked_status: get("checked status"),
      tx_uid: get("tx uid"),
      updated_at: get("updated_at"),
    };
  }

  mapItemToRow(item: IMSGFloorApproval): unknown[] {
    const maxIdx = Math.max(...Object.values(this.hMap), IMS_GFLOOR_APPROVAL_HEADERS.length - 1);
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
    set("approval status", item.approval_status || "");
    set("checked status", item.checked_status || "");
    set("tx uid", item.tx_uid || "");
    set("updated_at", item.updated_at || "");

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }

  async getStatusKeySets(): Promise<{ approvedKeys: Set<string>; checkedKeys: Set<string> }> {
    const rows = await this.getAll();
    const approvedKeys = new Set<string>();
    const checkedKeys = new Set<string>();
    rows.forEach((row) => {
      const key = approvalToTxKey(row);
      if ((row.approval_status || "").toLowerCase() === "approved") {
        approvedKeys.add(key);
      }
      if ((row.checked_status || "").trim().toUpperCase() === "CHECKED") {
        checkedKeys.add(key);
      }
    });
    return { approvedKeys, checkedKeys };
  }

  async getApprovalKeySet(): Promise<Set<string>> {
    const { approvedKeys } = await this.getStatusKeySets();
    return approvedKeys;
  }
}

export const imsGfloorApprovalService = new IMSGFloorApprovalService();

export async function getIMSGFloorApprovals(): Promise<IMSGFloorApproval[]> {
  return imsGfloorApprovalService.getAll();
}

export async function getIMSGFloorApprovalKeys(): Promise<Set<string>> {
  return imsGfloorApprovalService.getApprovalKeySet();
}

export async function getIMSGFloorStatusKeys(): Promise<{
  approvedKeys: string[];
  checkedKeys: string[];
}> {
  const { approvedKeys, checkedKeys } = await imsGfloorApprovalService.getStatusKeySets();
  return {
    approvedKeys: Array.from(approvedKeys),
    checkedKeys: Array.from(checkedKeys),
  };
}

let approvalLock: Promise<unknown> = Promise.resolve();

export type ApprovalInput = {
  item_name: string;
  category?: string;
  date: string;
  in_qty?: number;
  out_qty?: number;
  tx_uid?: string;
};

function toDateOnly(dateStr: string) {
  const ts = Date.parse(dateStr);
  if (isNaN(ts)) return dateStr;
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Upsert rows on IMS-G Floor Approval.
 * Same tx key can be Approved and/or Checked independently.
 */
export async function upsertIMSGFloorStatuses(
  transactions: ApprovalInput[],
  flags: { approve?: boolean; check?: boolean }
): Promise<{ added: number; updated: number; skipped: number }> {
  if (!flags.approve && !flags.check) {
    return { added: 0, updated: 0, skipped: 0 };
  }

  return (approvalLock = approvalLock
    .then(async () => {
      await imsGfloorApprovalService.ensureColumns([...IMS_GFLOOR_APPROVAL_HEADERS]);

      const existingRows = await imsGfloorApprovalService.getAll();
      const byUid = new Map<string, IMSGFloorApproval>();
      const byLegacyContent = new Map<string, IMSGFloorApproval>();
      existingRows.forEach((row) => {
        const uid = (row.tx_uid || "").trim();
        if (uid) byUid.set(uid, row);
        else byLegacyContent.set(approvalToTxKey(row), row);
      });

      const toAdd: IMSGFloorApproval[] = [];
      let updated = 0;
      let skipped = 0;
      let nextId = await imsGfloorApprovalService.getNextNumericalId();
      const now = new Date().toISOString();

      for (const tx of transactions) {
        const candidate: ApprovalInput = {
          item_name: tx.item_name,
          category: tx.category || "",
          date: tx.date,
          in_qty: tx.in_qty || 0,
          out_qty: tx.out_qty || 0,
          tx_uid: (tx.tx_uid || "").trim(),
        };
        const key = approvalToTxKey({
          ...candidate,
          in_qty: candidate.in_qty,
          out_qty: candidate.out_qty,
        });
        const uid = candidate.tx_uid || "";

        let existing = uid ? byUid.get(uid) : undefined;
        if (!existing && uid) {
          existing = byLegacyContent.get(key);
        } else if (!existing) {
          existing = byLegacyContent.get(key);
        }

        if (existing) {
          let changed = false;
          const next: IMSGFloorApproval = { ...existing };

          if (uid && (existing.tx_uid || "").trim() !== uid) {
            next.tx_uid = uid;
            changed = true;
          }

          if (flags.approve) {
            if ((existing.approval_status || "").toLowerCase() === "approved") {
              // already approved for this action
            } else {
              next.approval_status = "Approved";
              changed = true;
            }
          }

          if (flags.check) {
            if ((existing.checked_status || "").trim().toUpperCase() === "CHECKED") {
              // already checked
            } else {
              next.checked_status = "CHECKED";
              changed = true;
            }
          }

          if (!changed) {
            skipped++;
            continue;
          }

          next.updated_at = now;
          const ok = await imsGfloorApprovalService.update(existing.id, next);
          if (!ok) throw new Error("Failed to update approval/check status");
          if (uid) byUid.set(uid, next);
          if ((existing.tx_uid || "").trim() === "") byLegacyContent.delete(key);
          updated++;
          continue;
        }

        // New row — only set fields requested
        const row: IMSGFloorApproval = {
          id: String(nextId++),
          item_name: candidate.item_name.trim(),
          category: (candidate.category || "").trim(),
          in_qty: String(candidate.in_qty || 0),
          out_qty: String(candidate.out_qty || 0),
          date: toDateOnly(candidate.date),
          approval_status: flags.approve ? "Approved" : "",
          checked_status: flags.check ? "CHECKED" : "",
          tx_uid: uid,
          updated_at: now,
        };
        toAdd.push(row);
        if (uid) byUid.set(uid, row);
        else byLegacyContent.set(key, row);
      }

      if (toAdd.length > 0) {
        const ok = await imsGfloorApprovalService.addMany(toAdd);
        if (!ok) throw new Error("Failed to save approval/check status");
      }

      return { added: toAdd.length, updated, skipped };
    })
    .catch((err) => {
      console.error("Error in upsertIMSGFloorStatuses:", err);
      throw err;
    })) as Promise<{ added: number; updated: number; skipped: number }>;
}

/** @deprecated Prefer upsertIMSGFloorStatuses({ approve: true }) */
export async function addIMSGFloorApprovals(
  transactions: ApprovalInput[]
): Promise<{ added: number; skipped: number }> {
  const result = await upsertIMSGFloorStatuses(transactions, { approve: true });
  return { added: result.added + result.updated, skipped: result.skipped };
}
