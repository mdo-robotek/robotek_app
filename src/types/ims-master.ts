export interface IMSMasterItem {
  id: string;
  sku_code: string;
  category: string;
  item_name: string;
  active_status: string;
  lead_time: string;
  safety_factor: string;
}

export const IMS_MASTER_HEADERS = [
  "Sku Code",
  "Category",
  "Item Name",
  "Active/Inactive",
  "Lead Time",
  "Safety Factor",
] as const;

export const IMS_MASTER_ACTIVE = "Active";
export const IMS_MASTER_INACTIVE = "Inactive";
