import {
  MonthName,
  MessageType,
  MONTH_NAMES,
} from "@/types/customer-target";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function isMonthName(value: string): value is MonthName {
  return (MONTH_NAMES as readonly string[]).includes(value);
}

export function monthIndex(month: MonthName): number {
  return MONTH_NAMES.indexOf(month);
}

export function formatMonthDateRange(month: MonthName, year = new Date().getFullYear()): string {
  const idx = monthIndex(month);
  const lastDay = new Date(year, idx + 1, 0).getDate();
  const short = MONTH_SHORT[idx];
  return `1 ${short} – ${lastDay} ${short}`;
}

export function formatTargetNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function normalizePartyKey(name: string): string {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  const s = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function calcPending(target: number, achieved: number): number {
  return Math.max(0, Math.round((target - achieved) * 100) / 100);
}

export function calcAchievementPct(target: number, achieved: number): number {
  if (!target || target <= 0) return 0;
  return Math.round((achieved / target) * 100);
}

export function isValidMobile(mobile: string): boolean {
  const digits = String(mobile || "").replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
}

export function messageRecipientName(customerName?: string, partyName?: string): string {
  return String(customerName || partyName || "").trim();
}

export function buildTargetMessage(partyName: string, month: MonthName, target: number, year = new Date().getFullYear()): string {
  const party = String(partyName || "").trim().toUpperCase();
  return `Namaste *${party} JI*,

Aapka assigned target for ${month} month *(${formatMonthDateRange(month, year)})* niche share kiya gaya hai.

📊 *Target:* ${formatTargetNumber(target)}

👉 Request hai ki kindly isse review karke apni planning accordingly karein.

Kisi bhi *support ya discussion ke liye hum hamesha available hain.*`;
}

export function buildAchievementMessage(
  partyName: string,
  month: MonthName,
  target: number,
  achieved: number
): string {
  const party = String(partyName || "").trim().toUpperCase();
  const pending = calcPending(target, achieved);
  const pct = calcAchievementPct(target, achieved);

  return `Namaste *${party} JI* 🙏

Aapka ${month} month assigned target me se abhi *${formatTargetNumber(pending)}* pending hai.

📊 Target Details:

Total Target: *${formatTargetNumber(target)}*
Achieved: *${formatTargetNumber(achieved)}*
Pending: *${formatTargetNumber(pending)}*
Achievement: *${pct}%*


👉👉 Kindly target closure par focus karein. Kisi bhi support ki zarurat ho to hume zarur batayein.

Thank You`;
}

export function buildMessage(
  type: MessageType,
  partyName: string,
  month: MonthName,
  target: number,
  achieved: number,
  year = new Date().getFullYear(),
  customerName?: string
): string {
  const greeting = messageRecipientName(customerName, partyName);
  if (type === "TARGET") return buildTargetMessage(greeting, month, target, year);
  return buildAchievementMessage(greeting, month, target, achieved);
}
