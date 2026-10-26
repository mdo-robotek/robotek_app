export type NewLaunchStatus = "Active" | "Completed" | "Cancelled";

export interface NewLaunchHistoryEntry {
  at: string;
  by: string;
  step: number;
  action: "created" | "done" | "approved" | "rejected" | "cancelled" | "restored" | "edited";
  remark?: string;
}

export interface NewLaunch {
  id: string;
  launch_no: string;
  product_name: string;
  filled_by: string;
  form_date: string;
  remark: string;
  status: NewLaunchStatus | string;
  current_step: string;
  launch_date: string;
  created_at: string;
  updated_at: string;
  /** JSON: values captured at steps, keyed `${step}_${fieldKey}`. */
  fields: string;
  /** JSON: NewLaunchHistoryEntry[] — every action incl. rejections. */
  history: string;
  // planned_N, actual_N, done_by_N, remark_N for N = 1..42
  [key: string]: string;
}
