export interface FloorIMS {
  id: string;
  item_name: string;
  category: string;
  in_qty: string;
  out_qty: string;
  date?: string;
  updated_at?: string;
  packed_status?: string;
  checked_status?: string;
  source?: string;
  // Computed in frontend/API
  live_stock?: number;
  sku_code?: string;
  active_status?: string;
  lead_time?: number;
  safety_factor?: number;
  in_master?: boolean;
}
