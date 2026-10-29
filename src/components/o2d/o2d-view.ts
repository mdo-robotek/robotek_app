import type { O2D, O2DStepConfig } from "@/types/o2d";
import { O2D_STEP_LABELS } from "@/types/o2d";
import { parseHold, holdCheckState, type HoldInfo } from "@/lib/o2d-hold";
import { parseCheck, type SoCheck } from "@/lib/so-check";

/** Shared helpers for the O2D list and the order window. */

const filled = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-";
};

/** Same rule as the page and the server: the first planned step that is not done. */
export function pendingStep(items: O2D[]): number {
  const f = items[0] as any;
  if (!f) return -1;
  for (let i = 1; i <= 11; i++) {
    if (!filled(f[`planned_${i}`])) continue;
    const st = String(f[`status_${i}`] || "").trim();
    let done = filled(f[`actual_${i}`]) && st !== "No";
    if (i === 3 && st === "No" && filled(f.planned_4)) done = true;
    if (i === 4 && st === "No") return -1;
    if (!done) return i;
  }
  return -1;
}

export const amountOf = (items: O2D[]) => items.reduce((s, it) => s + (parseFloat(String(it.est_amount).replace(/[^\d.-]/g, "")) || 0), 0);
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function toDate(v: unknown): Date | null {
  if (!filled(v)) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

const IST = { timeZone: "Asia/Kolkata" } as const;
export const fmtWhen = (d: Date) =>
  `${d.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" })}`;
export const fmtDay = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00+05:30`);
  return isNaN(d.getTime()) ? ymd : d.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" });
};
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", IST);

export type Tone = "late" | "soon" | "ok" | "done" | "hold" | "cancel" | "plain";

/** Short due text for a planned time: "Late 2 h", "Today 2:00 pm", "Tomorrow 11:00 am", "2 Nov". */
export function dueText(planned: Date | null, now = Date.now()): { text: string; tone: Tone } {
  if (!planned) return { text: "No date", tone: "plain" };
  const diff = now - planned.getTime();
  if (diff > 0) {
    const h = diff / 3600000;
    if (h < 1) return { text: `Late ${Math.max(1, Math.round(diff / 60000))} min`, tone: "late" };
    if (h < 24) return { text: `Late ${Math.round(h)} h`, tone: "late" };
    const d = Math.round(h / 24);
    return { text: `Late ${d} day${d > 1 ? "s" : ""}`, tone: "late" };
  }
  const t = planned.toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" });
  const today = dayKey(new Date(now));
  const tomorrow = dayKey(new Date(now + 86400000));
  if (dayKey(planned) === today) return { text: `Today ${t}`, tone: "soon" };
  if (dayKey(planned) === tomorrow) return { text: `Tomorrow ${t}`, tone: "ok" };
  return { text: planned.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" }), tone: "ok" };
}

export function whoFor(step: number, configs: O2DStepConfig[]): string {
  const raw = configs[step - 1]?.responsible_person || "";
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const pretty = (n: string) => n.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
  if (!names.length) return "";
  return names.length > 2 ? `${pretty(names[0])} +${names.length - 1}` : names.map(pretty).join(", ");
}

export interface OrderState {
  step: number; // -1 = finished
  stepLabel: string;
  planned: Date | null;
  due: { text: string; tone: Tone };
  who: string;
  hold: HoldInfo | null;
  holdCheck: ReturnType<typeof holdCheckState>;
  cancel: HoldInfo | null;
  soCheck: SoCheck | null;
  status: { text: string; tone: Tone };
}

export function orderState(items: O2D[], configs: O2DStepConfig[], now = Date.now()): OrderState {
  const f = items[0] as any;
  const step = pendingStep(items);
  const planned = step > 0 ? toDate(f?.[`planned_${step}`]) : null;
  const due = dueText(planned, now);
  const hold = parseHold(f?.hold);
  const cancel = parseHold(f?.cancelled);
  const holdCheck = holdCheckState(hold, now);
  let status: { text: string; tone: Tone };
  if (cancel) status = { text: "Cancelled", tone: "cancel" };
  else if (hold) status = { text: holdCheck === "overdue" ? "Hold · check overdue" : holdCheck === "due" ? "Hold · check today" : "On hold", tone: holdCheck === "overdue" ? "late" : "hold" };
  else if (step === -1) status = { text: "Done", tone: "done" };
  else status = due;
  return {
    step,
    stepLabel: step > 0 ? O2D_STEP_LABELS[step - 1] : "",
    planned,
    due,
    who: step > 0 ? whoFor(step, configs) : "",
    hold,
    holdCheck,
    cancel,
    soCheck: parseCheck(f?.so_check),
    status,
  };
}

export const TONE_TEXT: Record<Tone, string> = {
  late: "text-[#DC2626]",
  soon: "text-[#B45309]",
  ok: "text-[#5B6472]",
  done: "text-[#15803D]",
  hold: "text-[#B45309]",
  cancel: "text-[#5B6472]",
  plain: "text-[#5B6472]",
};
export const TONE_PILL: Record<Tone, string> = {
  late: "bg-[#FEF2F2] text-[#DC2626]",
  soon: "bg-[#FFFBEB] text-[#B45309]",
  ok: "bg-[#F1F3F6] text-[#5B6472]",
  done: "bg-[#ECFDF3] text-[#15803D]",
  hold: "bg-[#FFFBEB] text-[#B45309]",
  cancel: "bg-[#F1F3F6] text-[#5B6472]",
  plain: "bg-[#F1F3F6] text-[#5B6472]",
};
