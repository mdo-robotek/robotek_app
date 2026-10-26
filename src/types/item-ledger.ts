export type ItemLedgerSourceType = "Locally Packed" | "Assembled";

export interface ItemLedgerEntry {
  id: string;
  date: string;
  item_name: string;
  qty: number;
  source_type: ItemLedgerSourceType;
  remarks?: string;
  entered_by?: string;
  created_at?: string;
}
