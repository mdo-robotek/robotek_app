/** "28 Oct, 6:00 pm" in India time, for WhatsApp messages. */
export function shortIst(iso: string): string {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return String(iso || "");
  return new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
