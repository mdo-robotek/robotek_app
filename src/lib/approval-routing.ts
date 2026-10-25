/**
 * Who sees which pending approval on their dashboard.
 *
 * Sahil, 2026-10-25: approvals should not all pile up on the MD dashboard —
 * each one shows up for the person who actually clears it, plus EA as the hub.
 *   Leave Requests      -> HR, EA, Nikita Mam
 *   IMS G-Floor Approval-> Process Coordinator (Abhishek), EA
 *   Payment Vendor      -> MD (Sahil / Nikita), EA
 *
 * Owners are matched on the Users sheet's `designation` (case-insensitive) or
 * on `username`, so adding a new HR person needs no code change — only the
 * Users sheet row.
 */

export type ApprovalKey = "leave" | "ims-gfloor" | "payment-vendor";

export interface ApprovalDefinition {
  key: ApprovalKey;
  title: string;          // English UI label
  href: string;           // where the user goes to clear it
  designations: string[]; // Users sheet "designation" values that own this
  usernames: string[];    // specific people, when designation is not enough
}

export const APPROVAL_DEFINITIONS: ApprovalDefinition[] = [
  {
    key: "leave",
    title: "Leave Requests",
    href: "/leave",
    designations: ["hr", "ea"],
    usernames: ["nikita mam"],
  },
  {
    key: "ims-gfloor",
    title: "Floor Stock Approval",
    href: "/ims",
    designations: ["process coordinator", "ea"],
    usernames: [],
  },
  {
    key: "payment-vendor",
    title: "Vendor Payment Approval",
    href: "/payment-vendor-approval",
    designations: ["md", "ea"],
    usernames: ["sahil sir", "nikita mam"],
  },
];

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Approvals this user is responsible for. Empty array = card stays hidden. */
export function approvalsForUser(user: {
  username?: string;
  designation?: string;
}): ApprovalDefinition[] {
  const uname = norm(user.username);
  const desig = norm(user.designation);
  return APPROVAL_DEFINITIONS.filter(
    (d) =>
      (desig && d.designations.includes(desig)) ||
      (uname && d.usernames.includes(uname))
  );
}

/** A status counts as pending when it is blank or explicitly says pending. */
export function isPendingStatus(status: unknown): boolean {
  const s = norm(status);
  return s === "" || s === "pending" || s === "pending approval";
}
