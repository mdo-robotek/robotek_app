export function normalizePackedStatus(value?: string): "packed" | "unpacked" | "" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "packed") return "packed";
  if (v === "unpacked") return "unpacked";
  return "";
}

export function isGrnPacked(grn: { Packed_Unpacked?: string }): boolean {
  return normalizePackedStatus(grn.Packed_Unpacked) === "packed";
}

export function isGrnUnpacked(grn: { Packed_Unpacked?: string }): boolean {
  return normalizePackedStatus(grn.Packed_Unpacked) === "unpacked";
}

/** Packed GRN and legacy rows with no packed flag stay on G Floor. Unpacked GRN go to SFG. */
export function isGrnForGFloor(grn: { Packed_Unpacked?: string }): boolean {
  return !isGrnUnpacked(grn);
}

export function sfgVirtualGrnId(grnId: string | number): string {
  return `grn-${grnId}`;
}

export function isSfgVirtualGrnId(id: string | number): boolean {
  return String(id).startsWith("grn-");
}
