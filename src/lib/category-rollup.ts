// Dashboard-level category rollup (display only — sheet data untouched).
// POLY-* → POLY, ANS POLY-* → ANS POLY, DS ADD MAT. → ADD M,
// TWS + TWS (W) → TWS, N Band + N Band (W) → N Band,
// CHGR + ANS CHGR + ANS SC → ANS CHGR, plus case-duplicate merge (sc/SC).
const CAT_CANON: Record<string, string> = {
  "sc": "SC", "dc": "DC", "ear": "EAR", "headphone": "Headphone",
  "chgr": "ANS CHGR", "ans chgr": "ANS CHGR", "ans sc": "ANS CHGR",
  "tws": "TWS", "tws (w)": "TWS",
  "n band": "N Band", "n band (w)": "N Band",
  "spk": "SPK", "pb": "PB", "rb": "RB",
  "add m": "ADD M", "general": "General", "long": "Long", "touch": "Touch",
  "dc (w)": "DC (W)", "mic": "MIC",
};

export function rollupCategory(raw?: string): string {
  const c = (raw || "").trim();
  if (!c) return "Other";
  const l = c.toLowerCase();
  if (l.startsWith("ans poly")) return "ANS POLY";
  if (l.startsWith("poly")) return "POLY";
  if (l.startsWith("ds add mat")) return "ADD M";
  return CAT_CANON[l] || c;
}
