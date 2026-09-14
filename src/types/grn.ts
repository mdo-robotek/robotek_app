export interface GRN {
  id: string;
  GRN_No: string;
  PO_Number: string;
  Item_Name: string;
  Category: string;
  Qty: string;
  Country: string;
  Attach_Bill: string;
  Payment_Terms_In_days: string;
  Payment_Completed: string;
  filled_by: string;
  Packed_Unpacked?: string;
  updated_at: string;
  indent_id?: string;
  cancelled?: string;

  // Step fields
  planned_1?: string; actual_1?: string; status_1?: string; remarks_1?: string;
  planned_2?: string; actual_2?: string; status_2?: string;
  planned_3?: string; actual_3?: string; status_3?: string; remarks_3?: string;
  planned_4?: string; actual_4?: string; status_4?: string; vendor_visit_date_4?: string;
  planned_5?: string; actual_5?: string; status_5?: string;
  planned_6?: string; actual_6?: string; status_6?: string;
  planned_7?: string; actual_7?: string; status_7?: string;
  planned_8?: string; actual_8?: string; status_8?: string;
  planned_9?: string; actual_9?: string; status_9?: string;
}

export interface GRNStepConfig {
  step_name: string;
  tat: string;
  responsible_person: string;
}
