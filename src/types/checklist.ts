export interface Checklist {
  id: string;
  task: string;
  assigned_by: string;
  assigned_to: string;
  priority: string;
  department: string;
  frequency: string;
  due_date: string;
  group_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Completion row in checklists_revision_history
 * - group_id: links to checklists.group_id (task reference)
 * - id: sequential submission index only (1, 2, 3…) — not the checklist task id
 */
export interface ChecklistRevision {
  group_id: string;
  id: string;
  new_status: string;
  due_date: string;
  timestamp: string;
}

/** Virtual occurrence shown on the Tasks tab */
export interface ChecklistOccurrence extends Checklist {
  occurrence_due_date: string;
  completed_date: string;
  display_status: string;
  is_late_complete: boolean;
  occurrence_key: string;
}
