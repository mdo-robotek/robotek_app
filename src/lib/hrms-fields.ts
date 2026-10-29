import { HrmsModuleType } from "@/types/hrms";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "file" | "textarea" | "radio";
  options?: string[]; // for select
}

export const RECRUITMENT_FIELDS: FormField[] = [
  { name: "post_for_recruitment", label: "Post for Recruitment", type: "text" },
  { name: "no_of_post_for_recruitment", label: "No. of Post for Recruitment", type: "number" },
  { name: "for_which_location", label: "For Which Location", type: "text" },
  { name: "urgency", label: "Urgency", type: "select", options: ["High", "Medium", "Low"] },
  { name: "male_female", label: "Male /Female", type: "select", options: ["Any", "Male", "Female"] },
  { name: "age_group", label: "Age Group", type: "text" },
  { name: "qualifications", label: "Qualifications", type: "text" },
  { name: "skills_required", label: "Skills Required", type: "textarea" },
  { name: "experience_needed_for_the_role", label: "Experience needed for the role", type: "text" },
  { name: "work_and_responsibilities", label: "Work and Responsibilities", type: "textarea" },
  { name: "planned_ctc", label: "Planned CTC", type: "text" },
  { name: "requirement_by", label: "Requirement By", type: "text" },
];

export const CANDIDATE_BASE_FIELDS: FormField[] = [
  { name: "candidate_name", label: "Candidate Name", type: "text" },
  { name: "date_of_birth", label: "Date Of Birth", type: "date" },
  { name: "applied_for", label: "Applied For", type: "select", options: ["Accountant", "Admin", "Driver", "E-Commerce", "Executive Assistant", "Graphic Designer", "Guard", "HR", "Lead Generator", "MIS", "Office Admin", "Office Boy", "Process Coordinator", "Purchase Manager", "Sales", "Sales & Marketing Executive", "UVX Designer", "Other"] },
  { name: "total_experience", label: "Total Experience", type: "text" },
  { name: "current_ctc", label: "Current CTC", type: "text" },
  { name: "expected_ctc", label: "Expected CTC", type: "text" },
  { name: "notice_period_in_days", label: "Notice Period (In days)", type: "number" },
  { name: "whatsapp_number", label: "WhatsApp Number", type: "text" },
  { name: "current_living_location", label: "Current Living Location", type: "text" },
  { name: "upload_updated_cv", label: "Upload Updated CV", type: "file" },
  { name: "reason_for_quit", label: "Reason for Quit", type: "textarea" },
  { name: "share_two_professional_references", label: "Share two Professional References", type: "textarea" },
  { name: "gtk_office_comfortable", label: "GTK Office Comfortable", type: "select", options: ["Yes", "No"] },
  { name: "slot_booking", label: "Slot Booking", type: "radio", options: ["Monday (11 AM to 2 PM)", "Tuesday (11 AM to 2 PM)", "Wednesday (11 AM to 2 PM)", "Thursday (11 AM to 2 PM)", "Friday (11 AM to 2 PM)", "Saturday (11 AM to 2 PM)"] },
  { name: "remark", label: "Remark", type: "textarea" },
];

export const CANDIDATE_FIELDS: FormField[] = [
  ...CANDIDATE_BASE_FIELDS,
];

export const SALES_FIELDS: FormField[] = [
  ...CANDIDATE_BASE_FIELDS,
  { name: "lead_time", label: "Lead Time", type: "text" },
];

export const ONBOARD_FIELDS: FormField[] = [
  ...CANDIDATE_BASE_FIELDS,
  { name: "lead_time", label: "Lead Time", type: "text" },
];

export const OFFBOARD_FIELDS: FormField[] = [
  { name: "emp_id", label: "Employee ID", type: "text" },
  { name: "emp_name", label: "Employee Name", type: "text" },
  { name: "emp_designation", label: "Employee Designation", type: "text" },
  { name: "reporting_manager_name", label: "Reporting Manager Name", type: "text" },
  { name: "other_info", label: "Other Info", type: "textarea" },
];

export function getFieldsForModule(module: HrmsModuleType): FormField[] {
  switch (module) {
    case "recruitment": return RECRUITMENT_FIELDS;
    case "candidate": return CANDIDATE_FIELDS;
    case "sales": return SALES_FIELDS;
    case "onboard": return ONBOARD_FIELDS;
    case "offboard": return OFFBOARD_FIELDS;
  }
}

export function getStepCount(module: HrmsModuleType): number {
  switch (module) {
    case "recruitment": return 6;
    case "candidate": return 7;
    case "sales": return 7;
    case "onboard": return 14;
    case "offboard": return 5;
  }
}

export function getModuleName(module: HrmsModuleType): string {
  switch (module) {
    case "recruitment": return "Recruitment";
    case "candidate": return "Candidate Selection";
    case "sales": return "Sales Candidates";
    case "onboard": return "Onboarding";
    case "offboard": return "Offboarding";
  }
}
