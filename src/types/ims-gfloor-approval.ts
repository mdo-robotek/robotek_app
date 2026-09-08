export interface IMSGFloorApproval {
  id: string;
  item_name: string;
  category: string;
  in_qty: string;
  out_qty: string;
  date: string;
  approval_status: string;
  checked_status?: string;
  updated_at?: string;
}

/** Expected sheet headers (column order in sheet can vary — matched by header name) */
export const IMS_GFLOOR_APPROVAL_HEADERS = [
  "ID",
  "Item Name",
  "Category",
  "In Qty",
  "Out Qty",
  "Date",
  "Approval Status",
  "Checked Status",
  "updated_at",
] as const;
