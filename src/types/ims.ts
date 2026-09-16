export interface IMS {
  id: string;
  item_name: string;
  est_amount_item: string;
  gst: string;
  final_amount: string;
  category: string;
  in_qty?: number;
  out_qty?: number;
  live_stock?: number;
  sale_percent?: number;
  avg_daily_con?: number;
  lead_time?: number;
  safety_factor?: number;
  max_level?: number;
  sku_code?: string;
  active_status?: string;
  in_master?: boolean;
  /** True when item exists only in GRN/Out Form — not yet in Details sheet */
  is_pending?: boolean;
  /** Where this row originates: Details sheet, GRN, or O2D */
  source?: "Details" | "GRN" | "O2D" | "GRN, O2D";
}
