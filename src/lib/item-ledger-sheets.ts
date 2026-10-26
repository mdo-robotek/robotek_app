import { BaseSheetsService } from "./sheets/base-service";
import { ItemLedgerEntry, ItemLedgerSourceType } from "@/types/item-ledger";

// Same spreadsheet as the IMS Master sheet (one place Sahil/HO already works in).
const SPREADSHEET_ID = "12lk8GV7ZBpm6J-bA5TBWfHQ1qY0eEHIrwOICSnsuceE";
const SHEET_NAME = "Item Ledger Entries";

class ItemLedgerService extends BaseSheetsService<ItemLedgerEntry> {
  protected spreadsheetId = SPREADSHEET_ID;
  protected sheetName = SHEET_NAME;
  protected range = "A:H";
  protected idColumnIndex = 0;

  mapRowToItem(row: unknown[]): ItemLedgerEntry {
    const r = row as string[];
    return {
      id: String(r[0] || ""),
      date: String(r[1] || ""),
      item_name: String(r[2] || "").trim(),
      qty: parseFloat(r[3] || "") || 0,
      source_type: (String(r[4] || "").trim() as ItemLedgerSourceType) || "Locally Packed",
      remarks: String(r[5] || ""),
      entered_by: String(r[6] || ""),
      created_at: String(r[7] || ""),
    };
  }

  mapItemToRow(item: ItemLedgerEntry): unknown[] {
    return [
      item.id,
      item.date,
      item.item_name,
      item.qty,
      item.source_type,
      item.remarks || "",
      item.entered_by || "",
      item.created_at || new Date().toISOString(),
    ];
  }
}

export const itemLedgerService = new ItemLedgerService();

export async function getItemLedgerEntries(): Promise<ItemLedgerEntry[]> {
  try {
    return await itemLedgerService.getAll();
  } catch (error) {
    console.error("Error fetching Item Ledger entries:", error);
    return [];
  }
}

export async function addItemLedgerEntry(
  entry: Omit<ItemLedgerEntry, "id" | "created_at">
): Promise<boolean> {
  try {
    const id = `IL${Date.now()}`;
    return await itemLedgerService.add({
      ...entry,
      id,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error adding Item Ledger entry:", error);
    return false;
  }
}

export async function deleteItemLedgerEntry(id: string): Promise<boolean> {
  try {
    return await itemLedgerService.delete(id);
  } catch (error) {
    console.error("Error deleting Item Ledger entry:", error);
    return false;
  }
}

export type { ItemLedgerSourceType };
