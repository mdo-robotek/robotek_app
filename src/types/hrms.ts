export interface HrmsStepConfig {
  step_name: string;
  tat: string;
  responsible_person: string;
}

export interface Recruitment {
  id: string;
  post_for_recruitment: string;
  no_of_post_for_recruitment: string;
  for_which_location: string;
  urgency: string;
  male_female: string;
  age_group: string;
  qualifications: string;
  skills_required: string;
  experience_needed_for_the_role: string;
  work_and_responsibilities: string;
  planned_ctc: string;
  requirement_by: string;
  created_at: string;
  cancelled: string;

  planned_1: string;
  actual_1: string;
  social_medias: string;
  remark_1: string;

  planned_2: string;
  actual_2: string;
  status_2: string;
  remark_2: string;

  planned_3: string;
  actual_3: string;
  status_3: string;
  remark_3: string;

  planned_4: string;
  actual_4: string;
  status_4: string;
  remark_4: string;

  planned_5: string;
  actual_5: string;
  status_5: string;
  remark_5: string;
}

export interface CandidateBase {
  id: string;
  candidate_name: string;
  date_of_birth: string;
  applied_for: string;
  total_experience: string;
  current_ctc: string;
  expected_ctc: string;
  notice_period_in_days: string;
  reason_for_quit: string;
  share_two_professional_references: string;
  current_living_location: string;
  upload_updated_cv: string;
  whatsapp_number: string;
  gtk_office_comfortable: string;
  slot_booking: string;
  remark: string;
  created_at: string;
  cancelled: string;
}

export interface Candidate extends CandidateBase {
  planned_1: string; actual_1: string; status_1: string; remark_1: string;
  planned_2: string; actual_2: string; status_2: string; remark_2: string;
  planned_3: string; actual_3: string; status_3: string; remark_3: string;
  planned_4: string; actual_4: string; status_4: string; remark_4: string;
  planned_5: string; actual_5: string; status_5: string; remark_5: string;
  planned_6: string; actual_6: string; status_6: string; remark_6: string;
  planned_7: string; actual_7: string; status_7: string; remark_7: string;
  lead_time_for_emp_joining_7: string;
}

export interface Sales extends CandidateBase {
  lead_time: string;
  planned_1: string; actual_1: string; status_1: string; remark_1: string;
  planned_2: string; actual_2: string; status_2: string; remark_2: string;
  planned_3: string; actual_3: string; status_3: string; remark_3: string;
  planned_4: string; actual_4: string; status_4: string; remark_4: string;
  planned_5: string; actual_5: string; status_5: string; remark_5: string;
  planned_6: string; actual_6: string; status_6: string; remark_6: string;
  planned_7: string; actual_7: string; status_7: string; remark_7: string;
  planned_8: string; actual_8: string; status_8: string; remark_8: string;
}

export interface Onboard extends CandidateBase {
  lead_time: string;
  /** Candidate id this onboarding was created from (step 7 = Selected). */
  source_id?: string;
  planned_1: string; actual_1: string; status_1: string; remark_1: string;
  planned_2: string; actual_2: string; status_2: string; remark_2: string;
  planned_3: string; actual_3: string; status_3: string; remark_3: string;
  planned_4: string; actual_4: string; status_4: string; remark_4: string;
  planned_5: string; actual_5: string; status_5: string; remark_5: string;
  planned_6: string; actual_6: string; status_6: string; remark_6: string;
  planned_7: string; actual_7: string; status_7: string; remark_7: string;
  planned_8: string; actual_8: string; status_8: string; remark_8: string;
  planned_9: string; actual_9: string; status_9: string; remark_9: string;
  planned_10: string; actual_10: string; status_10: string; remark_10: string;
  planned_11: string; actual_11: string; status_11: string; remark_11: string;
}

export interface OffboardRecord {
  id: string;
  off_bd_num: string;
  emp_id: string;
  emp_name: string;
  emp_designation: string;
  reporting_manager_name: string;
  other_info: string;
  created_at: string;
  updated_at: string;
  cancelled: string;

  planned_1: string; actual_1: string; status_1: string; hr_remarks_1: string; remark_1?: string;
  notice_period_in_days_1: string; lwd_1: string; handover_name_1: string;
  reason_of_leaving_1: string; remarks_of_management_1: string;

  planned_2: string; actual_2: string; status_2: string; hr_remarks_2: string; remark_2?: string;
  knowledge_transfer_2: string; asset_recovery_2: string;

  planned_3: string; actual_3: string; status_3: string; discussion_with_hr_3: string; conclusion_3: string; remark_3?: string;

  planned_4: string; actual_4: string; status_4: string; remarks_4: string; remark_4?: string;
  relieving_letter_4: string; experience_letter_4: string; f_and_f_statement_4: string;
  salary_slips_if_requested_4: string;
}

export type HrmsModuleType = "recruitment" | "candidate" | "sales" | "onboard" | "offboard";
export type AnyHrmsRecord = Recruitment | Candidate | Sales | Onboard | OffboardRecord;
