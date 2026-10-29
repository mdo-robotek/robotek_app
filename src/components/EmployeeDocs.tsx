"use client";

import { useRef, useState } from "react";
import { CheckCircleIcon, DocumentArrowUpIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { EMPLOYEE_DOCS, docsFor, docProgress, personKey, type DocUpload } from "@/lib/employee-docs";

/**
 * "Documents 3/5" chip on an HR card + the checklist popup.
 * Each document has its own row and its own Upload button, so HR can't pass
 * a CV off as "documents done" (Sahil, 2026-10-27).
 */
export default function EmployeeDocs({
  record,
  module,
  uploads,
  onUploaded,
}: {
  record: { id?: string; candidate_name?: string; whatsapp_number?: string; upload_updated_cv?: string };
  module: string;
  uploads: DocUpload[] | undefined;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKey = useRef<string>("");

  const have = docsFor(uploads, record);
  const p = docProgress(have);
  const tone =
    p.requiredDone === p.requiredTotal
      ? "bg-emerald-50 text-[#15803D] border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30"
      : "bg-rose-50 text-[#DC2626] border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30";

  const pick = (key: string) => {
    pendingKey.current = key;
    setError("");
    inputRef.current?.click();
  };

  const upload = async (file: File | undefined) => {
    const key = pendingKey.current;
    if (!file || !key) return;
    setBusyKey(key);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_key", key);
      fd.append("person_key", personKey(record, module));
      fd.append("person_name", String(record.candidate_name || ""));
      fd.append("module", module);
      fd.append("record_id", String(record.id || ""));
      const res = await fetch("/api/hrms/documents", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Please try again.");
      onUploaded();
    } catch (e: any) {
      setError(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusyKey(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-full border text-[13px] font-semibold whitespace-nowrap ${tone}`}
        title={p.missingRequired.length ? `Missing: ${p.missingRequired.join(", ")}` : "All required documents are in"}
      >
        <DocumentArrowUpIcon className="w-4 h-4" />
        Docs {p.requiredDone}/{p.requiredTotal}
      </button>

      {open && (
        <div className="fixed inset-0 z-[300] bg-black/30 flex items-end md:items-center justify-center" onClick={() => setOpen(false)}>
          <div
            className="w-full md:max-w-lg bg-white dark:bg-navy-900 rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E5E7EB] dark:border-navy-800">
              <div className="min-w-0">
                <p className="text-[18px] font-semibold text-[#1A1D21] dark:text-white truncate">Documents — {record.candidate_name || "Employee"}</p>
                <p className="text-[14px] text-[#5B6472] dark:text-gray-400 mt-0.5">
                  Required {p.requiredDone} of {p.requiredTotal} · All {p.allDone} of {p.allTotal}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-[#5B6472]">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {error && <p className="mx-5 mt-3 px-3 py-2 rounded-lg bg-rose-50 text-[#DC2626] text-[14px]">{error}</p>}

            {[true, false].map((req) => (
              <div key={String(req)} className="px-5 pt-4">
                <p className="text-[13px] font-semibold text-[#5B6472] mb-1">{req ? "Required before joining" : "Within the first week"}</p>
                <div className="divide-y divide-[#E5E7EB] dark:divide-navy-800">
                  {EMPLOYEE_DOCS.filter((d) => d.required === req).map((d) => {
                    const u = have[d.key];
                    return (
                      <div key={d.key} className="flex items-center gap-3 py-3 min-h-[56px]">
                        {u ? (
                          <CheckCircleIcon className="w-6 h-6 text-[#15803D] shrink-0" />
                        ) : (
                          <span className={`w-5 h-5 mx-0.5 rounded-full border-2 shrink-0 ${req ? "border-[#DC2626]" : "border-[#D1D5DB]"}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white">{d.label}</p>
                          <p className="text-[13px] text-[#5B6472] dark:text-gray-400 truncate">
                            {u ? (u.uploaded_by ? `Added by ${u.uploaded_by}` : "Added") : d.hint}
                          </p>
                        </div>
                        {u && (
                          <a href={u.file_url} target="_blank" rel="noreferrer" className="shrink-0 text-[14px] font-semibold text-[#2563EB] px-2 py-2">
                            View
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!!busyKey}
                          onClick={() => pick(d.key)}
                          className="shrink-0 min-h-[40px] px-3 rounded-lg border border-[#E5E7EB] dark:border-navy-700 text-[14px] font-semibold text-[#1A1D21] dark:text-white disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {busyKey === d.key ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
                          {u ? "Replace" : "Upload"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="px-5 py-4 text-[13px] text-[#5B6472] dark:text-gray-400">
              Files are private — only HR and admins can open them in Sarthi. Photo, PDF or scan, up to 15 MB.
            </p>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </div>
      )}
    </>
  );
}
