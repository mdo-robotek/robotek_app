// Dashboard-level category rollup (display only — sheet data untouched).
// POLY-* → POLY, ANS POLY-* → ANS POLY,
// DC + DC (W) + ANS DC + ANS DC W → DC,
// EAR + ANS EAR → EAR, N Band + N Band (W) + ANS NB → N Band,
// TWS + TWS (W) + ANS TWS → TWS, CHGR + ANS CHGR + ANS SC → ANS CHGR,
// Touch + ADD M + DS ADD MAT. + MIC + plain cell → General,
// plus case-duplicate merge (sc/SC).
const CAT_CANON: Record<string, string> = {
  "sc": "SC", "headphone": "Headphone",
  "chgr": "ANS CHGR", "ans chgr": "ANS CHGR", "ans sc": "ANS CHGR",
  "dc": "DC", "dc (w)": "DC", "ans dc": "DC", "ans dc w": "DC",
  "ear": "EAR", "ans ear": "EAR",
  "tws": "TWS", "tws (w)": "TWS", "ans tws": "TWS",
  "n band": "N Band", "n band (w)": "N Band", "ans nb": "N Band",
  "spk": "SPK", "pb": "PB", "rb": "RB",
  "general": "General", "add m": "General", "touch": "General",
  "mic": "General", "plain cell": "General",
  "long": "Long", "pro": "PRO",
};

export function rollupCategory(raw?: string): string {
  const c = (raw || "").trim();
  if (!c) return "Other";
  const l = c.toLowerCase();
  if (l.startsWith("ans poly")) return "ANS POLY";
  if (l.startsWith("poly")) return "POLY";
  if (l.startsWith("ds add mat")) return "General";
  return CAT_CANON[l] || c;
}
