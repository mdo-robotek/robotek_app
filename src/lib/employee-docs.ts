/**
 * Joining documents checklist (Sahil, 2026-10-27).
 * HR uploads each document against its own name, so "only a CV" can't pass
 * as "documents done". The 5 required ones must be there before onboarding
 * is marked complete; the other 3 within the first week.
 * (PF UAN was proposed and dropped by Sahil.)
 */

export interface DocType {
  key: string;
  label: string;
  hint: string;
  required: boolean;
}

export const EMPLOYEE_DOCS: DocType[] = [
  { key: "aadhaar", label: "Aadhaar card", hint: "Front and back", required: true },
  { key: "pan", label: "PAN card", hint: "For salary and TDS", required: true },
  { key: "bank", label: "Bank proof", hint: "Cancelled cheque or passbook first page", required: true },
  { key: "photo", label: "Passport size photo", hint: "Clear, recent", required: true },
  { key: "cv", label: "Resume / CV", hint: "Taken from the candidate form if already there", required: true },
  { key: "education", label: "Highest education certificate", hint: "10th / 12th / graduation", required: false },
  { key: "last_job", label: "Previous company letter or salary slips", hint: "Relieving letter, or last 3 salary slips", required: false },
  { key: "offer_signed", label: "Signed offer letter and company policy", hint: "Our offer letter, signed by the employee", required: false },
];

export interface DocUpload {
  doc_key: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

/** Same person across Candidate → Onboard: last 10 digits of the WhatsApp number. */
export function personKey(record: { whatsapp_number?: string; id?: string }, module: string): string {
  const digits = String(record.whatsapp_number ?? "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return `${module}-${String(record.id ?? "").trim()}`;
}

/** Latest upload per document; the CV also counts from the candidate form. */
export function docsFor(
  uploads: DocUpload[] | undefined,
  record: { upload_updated_cv?: string }
): Record<string, DocUpload | null> {
  const out: Record<string, DocUpload | null> = {};
  for (const d of EMPLOYEE_DOCS) out[d.key] = null;
  const sorted = [...(uploads ?? [])].sort((a, b) => Date.parse(a.uploaded_at || "") - Date.parse(b.uploaded_at || ""));
  for (const u of sorted) if (u.doc_key in out && u.file_url) out[u.doc_key] = u;
  if (!out.cv && String(record.upload_updated_cv ?? "").trim()) {
    out.cv = { doc_key: "cv", file_url: String(record.upload_updated_cv), uploaded_by: "Candidate form", uploaded_at: "" };
  }
  return out;
}

export function docProgress(have: Record<string, DocUpload | null>) {
  const required = EMPLOYEE_DOCS.filter((d) => d.required);
  const requiredDone = required.filter((d) => have[d.key]).length;
  const allDone = EMPLOYEE_DOCS.filter((d) => have[d.key]).length;
  return {
    requiredDone,
    requiredTotal: required.length,
    allDone,
    allTotal: EMPLOYEE_DOCS.length,
    missingRequired: required.filter((d) => !have[d.key]).map((d) => d.label),
  };
}

/** HR page access (page id "hrms") or ADMIN / EA role may see and upload. */
export function canSeeEmployeeDocs(session: unknown): boolean {
  const u = (session as { user?: { role?: string; permissions?: string[] } } | null)?.user;
  if (!u) return false;
  const role = String(u.role || "").toUpperCase();
  if (role === "ADMIN" || role === "EA") return true;
  return (u.permissions || []).some((p) => String(p).toLowerCase() === "hrms");
}
