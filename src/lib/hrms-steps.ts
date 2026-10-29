import type { HrmsModuleType } from "@/types/hrms";

/**
 * HR flow layouts (Sahil, 2026-10-27).
 *
 * The app works with step numbers 1..N in the order people do them. The
 * sheets keep their old columns, so a new or moved step does NOT shift
 * anybody's saved data. This table says which sheet column suffix holds each
 * step:  logical step i  ->  columns Planned_<s>, Actual_<s>, Status_<s>, Remark_<s>
 *
 *  Recruitment: new step 1 "Requirement approved" lives in *_AP columns;
 *               old steps 1-5 become 2-6.
 *  Sales:       new order Basic Q, Full Q, 2nd round, 3rd round, Final
 *               decision, Documentation, Verification. Old step 7 (company
 *               profile / product demo) moved to Onboard as "Product training".
 *  Onboard:     14 steps (was 11). No live records existed, so straight 1..14.
 *  Offboard:    new step 4 "Remove access" lives in *_RA columns; old step 4
 *               (closure) becomes step 5.
 *
 * The new step lists live in new config tabs ("... v2") so the old app
 * keeps reading the old lists until this version goes live.
 */
export const STEP_COLUMNS: Record<HrmsModuleType, string[]> = {
  recruitment: ["AP", "1", "2", "3", "4", "5"],
  candidate: ["1", "2", "3", "4", "5", "6", "7"],
  sales: ["1", "2", "5", "6", "8", "3", "4"],
  onboard: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
  offboard: ["1", "2", "3", "RA", "4"],
};

export const STEP_CONFIG_TABS: Record<HrmsModuleType, string> = {
  recruitment: "Recruitment_Step Configuration v2",
  candidate: "Candidate_Step Configuration",
  sales: "Sales_Step Configuration v2",
  onboard: "Onboard_Step Configuration v2",
  offboard: "Offboard_Step Configuration v2",
};

/** Step numbers that carry extra fields or rules. */
export const RECRUITMENT_POST_STEP = 2;   // job-site / social media list
export const OFFBOARD_CLOSURE_STEP = 5;   // relieving letter, F&F ...
export const ONBOARD_DOCS_STEP = 3;       // needs the 5 required joining documents

/** "Not needed" marks a step as skipped (e.g. assessment for an Office Boy). */
export const NOT_NEEDED = "Not needed";

export function stepCols(module: HrmsModuleType): string[] {
  return STEP_COLUMNS[module];
}

/** Planned/Actual/Status/Remark headers for every step, in step order. */
export function stepHeaders(module: HrmsModuleType, remarkWord = "Remark"): string[] {
  return STEP_COLUMNS[module].flatMap((s) => [`Planned_${s}`, `Actual_${s}`, `Status_${s}`, `${remarkWord}_${s}`]);
}
