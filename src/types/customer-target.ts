export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

export type MessageType = "TARGET" | "ACHIEVEMENT";

export type SendScope = "failed_only" | "not_sent" | "selected_force" | "selected";

export type SendStatus = "NOT_SENT" | "SENT" | "FAILED" | "SKIPPED";

export type MonthlyValues = Record<MonthName, number | "">;

export interface PlannedParty {
  rowNumber: number;
  partyName: string;
  customerName: string;
  mobile: string;
  months: MonthlyValues;
}

export interface AchievementParty {
  rowNumber: number;
  partyName: string;
  customerName: string;
  mobile: string;
  months: MonthlyValues;
}

export interface SendLogEntry {
  id: string;
  timestamp: string;
  partyName: string;
  mobile: string;
  month: MonthName;
  year: number;
  type: MessageType | "TEST" | "PLANNED";
  target: number;
  achieved: number;
  pending: number;
  achievementPct: number;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string;
  sentBy: string;
  message: string;
}

export interface CustomerTargetRow {
  partyName: string;
  customerName: string;
  mobile: string;
  plannedRowNumber: number;
  achievementRowNumber: number | null;
  target: number;
  achieved: number;
  pending: number;
  achievementPct: number;
  sendStatus: SendStatus;
  lastError?: string;
  preview: string;
}

export interface PlannedInput {
  partyName: string;
  customerName?: string;
  mobile: string;
  months?: Partial<MonthlyValues>;
  originalPartyName?: string;
}
