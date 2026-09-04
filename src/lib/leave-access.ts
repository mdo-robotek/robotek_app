/**
 * PC owns org leave follow-up (clear pending leaves).
 * Exception: Vandana is PC even when her system role is User.
 */
export function ownsLeaveFollowUp(user: {
  username?: string | null;
  role?: string | null;
  role_name?: string | null;
  designation?: string | null;
} | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.role_name || user.role || "").trim().toUpperCase();
  const designation = String(user.designation || "").trim().toUpperCase();
  const username = String(user.username || "").trim().toUpperCase();
  return role === "PC" || designation === "PC" || username === "VANDANA";
}
