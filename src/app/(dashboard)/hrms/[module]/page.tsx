"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import ModuleStrip from "@/components/ModuleStrip";
import { useFindFromLink } from "@/hooks/useFindFromLink";
import { useIsPhone } from "@/hooks/useIsPhone";
import PhoneStepSelect from "@/components/PhoneStepSelect";
import { useSession } from "next-auth/react";
import { useSSE } from "@/hooks/useSSE";
import { applyIncrementalUpdate } from "@/lib/utils/swr-sync";
import useSWR from "swr";
import EmployeeDocs from "@/components/EmployeeDocs";
import { docsFor, docProgress, personKey, type DocUpload } from "@/lib/employee-docs";
import { HrmsModuleType, AnyHrmsRecord, HrmsStepConfig } from "@/types/hrms";
import { getFieldsForModule, getStepCount, getModuleName } from "@/lib/hrms-fields";
import { RECRUITMENT_POST_STEP, OFFBOARD_CLOSURE_STEP, ONBOARD_DOCS_STEP, NOT_NEEDED } from "@/lib/hrms-steps";
import {
  PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon,
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ClockIcon, CheckCircleIcon,
  ArrowPathIcon, DocumentTextIcon, UserIcon, CalendarIcon, BriefcaseIcon, NoSymbolIcon, ArrowUturnLeftIcon, ExclamationCircleIcon,
  Cog8ToothIcon, QuestionMarkCircleIcon, ArrowDownTrayIcon, Cog6ToothIcon, CubeIcon, PhoneIcon,
  GlobeAltIcon, HashtagIcon, BanknotesIcon, MapPinIcon, ClipboardDocumentCheckIcon, SparklesIcon, ShareIcon, FingerPrintIcon
} from "@heroicons/react/24/outline";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import { useParams } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserSingleCombobox({
  value,
  onChange,
  users,
  placeholder = "Select user...",
}: {
  value: string;
  onChange: (val: string) => void;
  users: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = users.filter((u) => u.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="relative w-full">
      <div
        className="min-h-[46px] px-4 py-2 border border-[#E5E7EB] dark:border-navy-800 rounded-xl flex items-center bg-[#FFFFFF] dark:bg-navy-900 cursor-text transition-all"
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          value={open ? q : value}
          placeholder={placeholder}
          onChange={(e) => {
            const val = e.target.value;
            setQ(val);
            onChange(val);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQ(value);
          }}
          className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 dark:text-white placeholder:text-gray-300"
        />
        <ChevronDownIcon className={`w-4 h-4 text-[#5B6472] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <ul className="absolute z-[10001] mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-100 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl p-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-[14px] text-[#5B6472] italic">No users found</li>
          ) : (
            filtered.map((u) => (
              <li
                key={u}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(u);
                  setOpen(false);
                  setQ("");
                }}
                className="px-4 py-2 text-[14px] font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] rounded-lg transition-all"
              >
                {u}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function UserMultiCombobox({
  value,
  onChange,
  users,
  isSimple = false,
}: {
  value: string;
  onChange: (val: string) => void;
  users: string[];
  isSimple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = useMemo(
    () => (value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []),
    [value]
  );

  const toggle = (user: string) => {
    if (selected.includes(user)) {
      onChange(selected.filter((u) => u !== user).join(", "));
    } else {
      onChange([...selected, user].join(", "));
    }
    setQ("");
  };

  const filtered = users.filter(
    (u) => u.toLowerCase().includes(q.toLowerCase()) && !selected.includes(u)
  );
  const listToShow = q ? filtered : users.filter((u) => !selected.includes(u));

  return (
    <div ref={ref} className="relative w-full">
      <div
        className={`min-h-[40px] px-3 py-1.5 border border-slate-200 dark:border-navy-700 rounded-xl flex flex-wrap gap-1.5 items-center cursor-text transition-all ${isSimple ? 'bg-slate-50 dark:bg-navy-900/50' : 'bg-white dark:bg-navy-900 shadow-sm'}`}
        onClick={() => setOpen(true)}
      >
        {selected.map((u) => (
          <span
            key={u}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#2563EB] text-white rounded-md text-[13px] font-semibold"
          >
            {u}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                toggle(u);
              }}
            >
              <XMarkIcon className="w-3 h-3 stroke-[3]" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-[14px] font-bold text-gray-700 dark:text-white placeholder:text-gray-300 dark:placeholder:text-navy-600"
        />
        <ChevronDownIcon className="w-4 h-4 text-[#5B6472] ml-auto" />
      </div>
      {open && listToShow.length > 0 && (
        <ul className="absolute z-[10001] mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-100 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl p-2">
          {listToShow.map((u) => (
            <li
              key={u}
              onMouseDown={(e) => {
                e.preventDefault();
                toggle(u);
              }}
              className="px-4 py-2 text-[14px] font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] rounded-lg transition-all"
            >
              {u}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HRMSModulePage({ params }: { params: Promise<{ module: string }> }) {
  const resolvedParams = React.use(params);
  const module = resolvedParams.module as HrmsModuleType;
  const moduleName = getModuleName(module);
  const stepCount = getStepCount(module);
  const formFields = getFieldsForModule(module);

  const { data: session } = useSession();
  const userRole: string = (session?.user as any)?.role || "User";
  const isAdmin = userRole.toUpperCase() === "ADMIN" || userRole.toUpperCase() === "EA";
  const currentUser: string = (session?.user?.name || session?.user?.email || "") as string;

  const [items, setItems] = useState<AnyHrmsRecord[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<HrmsStepConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");
  const [layoutMode, setLayoutMode] = useState<"smart" | "standard">("smart");
  const isPhone = useIsPhone();
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | "all" | "completed">("all");
  const [currentPage, setCurrentPage] = useState(1);
  // "Open" in the work-list window lands here with ?find=<number>
  useFindFromLink((t) => { setSelectedStepFilter("all"); setViewMode("active"); setSearchTerm(t); setCurrentPage(1); });
  const itemsPerPage = 10;
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnyHrmsRecord | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configFormData, setConfigFormData] = useState<HrmsStepConfig[]>([]);
  const [now, setNow] = useState(new Date());
  const [usersList, setUsersList] = useState<any[]>([]);

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkRemarkInputs, setBulkRemarkInputs] = useState<Record<string, string>>({});
  const [bulkToggles, setBulkToggles] = useState<Record<string, boolean>>({});
  // "Not needed" per person: the step is skipped, not done (e.g. assessment for an Office Boy).
  const [bulkNotNeeded, setBulkNotNeeded] = useState<Record<string, boolean>>({});
  const [bulkSocialMedia, setBulkSocialMedia] = useState<Record<string, string[]>>({});
  const [bulkLeadTimeInputs, setBulkLeadTimeInputs] = useState<Record<string, string>>({});
  // Candidate step 7 final decision (Sahil, 2026-10-27): Selected → auto Onboarding, Rejected → closed.
  const [bulkDecisionInputs, setBulkDecisionInputs] = useState<Record<string, "Selected" | "Rejected" | "">>({});
  const [bulkOffboardInputs, setBulkOffboardInputs] = useState<Record<string, Record<string, string>>>({});

  const [isRemoveFollowUpModalOpen, setIsRemoveFollowUpModalOpen] = useState(false);
  const [targetItemForRemoveFollowUp, setTargetItemForRemoveFollowUp] = useState<AnyHrmsRecord | null>(null);
  const [removeFollowUpStep, setRemoveFollowUpStep] = useState(1);
  const [removeFollowUpType, setRemoveFollowUpType] = useState<'particular' | 'onwards'>('particular');

  const [isOnboardImportModalOpen, setIsOnboardImportModalOpen] = useState(false);
  const [onboardSourceModule, setOnboardSourceModule] = useState<'candidate' | 'sales'>('candidate');
  const [onboardSourceItems, setOnboardSourceItems] = useState<AnyHrmsRecord[]>([]);
  const [selectedOnboardSourceId, setSelectedOnboardSourceId] = useState<string>("");
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);


  useEffect(() => {
    if (isOnboardImportModalOpen) {
      setIsFetchingSource(true);
      fetch(`/api/hrms/${onboardSourceModule}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setOnboardSourceItems(data);
          else setOnboardSourceItems([]);
        })
        .catch(() => setOnboardSourceItems([]))
        .finally(() => setIsFetchingSource(false));
    }
  }, [isOnboardImportModalOpen, onboardSourceModule]);

  const handleOnboardImport = async () => {
    if (!selectedOnboardSourceId) return;
    const sourceItem = onboardSourceItems.find(it => it.id === selectedOnboardSourceId) as any;
    if (!sourceItem) return;

    setActionStatus("loading"); setActionMessage("Importing..."); setIsStatusModalOpen(true);

    const currentNow = new Date().toISOString();
    const payload: any = {
      candidate_name: sourceItem.candidate_name || "",
      date_of_birth: sourceItem.date_of_birth || "",
      applied_for: sourceItem.applied_for || "",
      total_experience: sourceItem.total_experience || "",
      current_ctc: sourceItem.current_ctc || "",
      expected_ctc: sourceItem.expected_ctc || "",
      notice_period_in_days: sourceItem.notice_period_in_days || "",
      whatsapp_number: sourceItem.whatsapp_number || "",
      current_living_location: sourceItem.current_living_location || "",
      upload_updated_cv: sourceItem.upload_updated_cv || "",
      reason_for_quit: sourceItem.reason_for_quit || "",
      share_two_professional_references: sourceItem.share_two_professional_references || "",
      gtk_office_comfortable: sourceItem.gtk_office_comfortable || "",
      slot_booking: sourceItem.slot_booking || "",
      remark: sourceItem.remark || "",
      lead_time: sourceItem.lead_time || sourceItem.lead_time_for_emp_joining_7 || "",
      created_at: currentNow,
      planned_1: calculatePlannedDate(currentNow, globalConfigs[0]?.tat || "24 Hrs"),
    };

    try {
      const res = await fetch(`/api/hrms/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => {
      setIsStatusModalOpen(false);
      setIsOnboardImportModalOpen(false);
      setSelectedOnboardSourceId("");
      mutateItems();
    }, 1500);
  };


  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsersList(data); })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: swrItems, mutate: mutateItems } = useSWR<AnyHrmsRecord[]>(`/api/hrms/${module}`, fetcher, {
    refreshInterval: 0, revalidateOnFocus: true, revalidateOnMount: true,
  });

  // Joining documents checklist (Sahil, 2026-10-27): Onboard records, and
  // candidates who have reached the last step / finished.
  const showsDocs = module === "onboard" || module === "candidate";
  const { data: docsByPerson, mutate: mutateDocs } = useSWR<Record<string, DocUpload[]>>(showsDocs ? "/api/hrms/documents" : null, fetcher, { revalidateOnFocus: true });
  const docsVisibleFor = (it: any) => module === "onboard" || (module === "candidate" && !!(String(it.actual_6 || "").trim() || String(it.actual_7 || "").trim()));
  const missingDocsFor = (it: any) => docProgress(docsFor(docsByPerson?.[personKey(it, module)], it)).missingRequired;

  useSSE({
    modules: [module],
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === module);
      if (updates) mutateItems((current) => applyIncrementalUpdate(current, updates.upserts, updates.currentIds), false);
    }
  });

  useEffect(() => {
    fetch(`/api/hrms/${module}/config`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const merged = Array.from({ length: stepCount }).map((_, idx) => {
            const found = data[idx];
            return { step_name: found?.step_name || `Step ${idx + 1}`, tat: found?.tat || "24 Hrs", responsible_person: found?.responsible_person || "" };
          });
          setGlobalConfigs(merged);
        }
      })
      .catch(() => { });
  }, [module, stepCount]);

  useEffect(() => {
    if (swrItems) { setItems(swrItems); setIsLoading(false); }
  }, [swrItems]);

  const getActiveStep = (item: AnyHrmsRecord): number => {
    if (item.cancelled) return -1;
    let hasAnyPlanned = false;
    for (let i = 1; i <= stepCount; i++) {
      if ((item as any)[`planned_${i}`]?.trim()) { hasAnyPlanned = true; break; }
    }
    if (hasAnyPlanned) {
      for (let i = 1; i <= stepCount; i++) {
        const act = (item as any)[`actual_${i}`];
        const pl = (item as any)[`planned_${i}`];
        if ((!act || act.trim() === "") && (pl && pl.trim() !== "")) return i;
      }
      if ((item as any)[`actual_${stepCount}`]?.trim()) return 0;
      let highestActual = 0;
      for (let i = 1; i <= stepCount; i++) {
        if ((item as any)[`actual_${i}`]?.trim()) highestActual = i;
      }
      return highestActual < stepCount ? highestActual + 1 : 0;
    }
    for (let i = 1; i <= stepCount; i++) {
      const act = (item as any)[`actual_${i}`];
      if (!act || act.trim() === "") return i;
    }
    return 0;
  };

  const calculatePlannedDate = (base: Date | string, tat: string): string => {
    let date = new Date(base); if (isNaN(date.getTime())) return "";
    const val = parseFloat(tat);
    const isDay = tat.toLowerCase().includes("day");

    if (isDay) {
      let daysToAdd = Math.ceil(val);
      while (daysToAdd > 0) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0) daysToAdd--; // Skip Sundays
      }
      const cur = date.getHours() + date.getMinutes() / 60;
      if (cur < 9.5) date.setHours(9, 30, 0, 0);
      else if (cur > 18.5) date.setHours(18, 30, 0, 0);
      return date.toISOString();
    } else {
      let mins = val * 60;
      while (mins > 0) {
        if (date.getDay() === 0) { date.setDate(date.getDate() + 1); date.setHours(9, 30, 0, 0); continue; }
        const cur = date.getHours() + date.getMinutes() / 60;
        if (cur >= 18.5) { date.setDate(date.getDate() + 1); date.setHours(9, 30, 0, 0); continue; }
        if (cur < 9.5) date.setHours(9, 30, 0, 0);
        const avail = (18.5 - (date.getHours() + date.getMinutes() / 60)) * 60;
        if (mins <= avail) { date.setMinutes(date.getMinutes() + mins); mins = 0; }
        else { mins -= avail; date.setDate(date.getDate() + 1); date.setHours(9, 30, 0, 0); }
      }
      return date.toISOString();
    }
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      list = list.filter(it => {
        const n1 = module === 'recruitment' ? (it as any).post_for_recruitment : (it as any).candidate_name;
        return (n1 || "").toLowerCase().includes(q) || (it.id || "").toLowerCase().includes(q);
      });
    }
    if (viewMode === "active") list = list.filter(it => !(it.cancelled || "").trim());
    else list = list.filter(it => !!(it.cancelled || "").trim());

    if (selectedStepFilter !== "all") {
      if (selectedStepFilter === "completed") list = list.filter(it => getActiveStep(it) === 0);
      else list = list.filter(it => getActiveStep(it) === selectedStepFilter);
    }

    // RBAC Filter: Non-admins only see records where they are responsible for the active pending step
    if (!isAdmin && currentUser) {
      list = list.filter(it => {
        const step = getActiveStep(it);
        if (step <= 0) return false; // Hide completed or cancelled items
        const config = globalConfigs[step - 1];
        if (!config || !config.responsible_person) return false;
        return config.responsible_person.toLowerCase().includes(currentUser.toLowerCase());
      });
    }

    return list;
  }, [items, searchTerm, viewMode, selectedStepFilter, module, isAdmin, currentUser, globalConfigs]);

  const stepCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, completed: 0 };
    for (let i = 1; i <= stepCount; i++) counts[i] = 0;
    items.forEach(it => {
      if (it.cancelled) return; counts.all++;
      const s = getActiveStep(it);
      if (s === 0) counts.completed++; else if (s > 0) counts[s]++;
    });
    return counts;
  }, [items, stepCount]);

  const sortedItems = [...filteredItems].sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.id.replace(/\D/g, "")) || 0;
    return numB - numA;
  });

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionStatus("loading"); setActionMessage("Saving..."); setIsStatusModalOpen(true);

    let fileUrl = formData.upload_updated_cv || "";
    if (uploadFile) {
      setActionMessage("Uploading document...");
      const fd = new FormData(); fd.append("file", uploadFile);
      try {
        const res = await fetch("/api/hrms/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.fileId) fileUrl = `https://drive.google.com/uc?id=${data.fileId}`;
      } catch (err) { console.error("Upload failed", err); }
    }

    const currentNow = new Date().toISOString();
    const payload = { ...formData, upload_updated_cv: fileUrl };
    if (!editingItem) {
      payload.created_at = currentNow;
      payload.planned_1 = calculatePlannedDate(currentNow, globalConfigs[0]?.tat || "24 Hrs");
    }

    try {
      const res = await fetch(`/api/hrms/${module}`, {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsModalOpen(false); mutateItems(); setUploadFile(null); }, 1500);
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setIsConfirmOpen(false); setActionStatus("loading"); setActionMessage("Deleting..."); setIsStatusModalOpen(true);
    try {
      const res = await fetch(`/api/hrms/${module}?id=${pendingDeleteId}`, { method: "DELETE" });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTargetId) return;
    const item = items.find(r => r.id === cancelTargetId); if (!item) return;
    setCancelTargetId(null); setActionStatus("loading"); setActionMessage("Cancelling..."); setIsStatusModalOpen(true);
    const currentNow = new Date().toISOString();
    try {
      const res = await fetch(`/api/hrms/${module}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: currentNow }) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTargetId) return;
    const item = items.find(r => r.id === restoreTargetId); if (!item) return;
    setRestoreTargetId(null); setActionStatus("loading"); setActionMessage("Restoring..."); setIsStatusModalOpen(true);
    try {
      const res = await fetch(`/api/hrms/${module}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: "" }) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const openRemoveFollowUpModal = (item: AnyHrmsRecord) => {
    setTargetItemForRemoveFollowUp(item);
    setRemoveFollowUpStep(getActiveStep(item) || stepCount);
    setRemoveFollowUpType('particular');
    setIsRemoveFollowUpModalOpen(true);
  };

  const handleRemoveFollowUp = async () => {
    if (!targetItemForRemoveFollowUp) return;
    setActionStatus("loading"); setActionMessage("Removing Follow Up..."); setIsStatusModalOpen(true);

    const upd = { ...targetItemForRemoveFollowUp } as any;
    const startStep = removeFollowUpStep;

    const clearModuleSpecificFields = (s: number, upd: any) => {
      if (module === 'recruitment' && s === RECRUITMENT_POST_STEP) upd.social_medias_1 = "";
      if (module === 'candidate' && s === 7) upd.lead_time_for_emp_joining_7 = "";
      if (module === 'offboard') {
        if (s === 1) {
          upd.notice_period_in_days_1 = ""; upd.lwd_1 = ""; upd.handover_name_1 = ""; upd.reason_of_leaving_1 = ""; upd.remarks_of_management_1 = "";
        } else if (s === 2) {
          upd.knowledge_transfer_2 = ""; upd.asset_recovery_2 = "";
        } else if (s === 3) {
          upd.discussion_with_hr_3 = ""; upd.conclusion_3 = "";
        } else if (s === OFFBOARD_CLOSURE_STEP) {
          upd.relieving_letter_4 = ""; upd.experience_letter_4 = ""; upd.f_and_f_statement_4 = ""; upd.salary_slips_if_requested_4 = "";
        }
      }
    };

    if (removeFollowUpType === 'particular') {
      upd[`actual_${startStep}`] = "";
      upd[`status_${startStep}`] = "";
      upd[`remark_${startStep}`] = "";
      clearModuleSpecificFields(startStep, upd);
    } else {
      for (let s = startStep; s <= stepCount; s++) {
        upd[`actual_${s}`] = "";
        upd[`status_${s}`] = "";
        upd[`remark_${s}`] = "";
        if (s > startStep) upd[`planned_${s}`] = "";
        clearModuleSpecificFields(s, upd);
      }
    }

    try {
      const res = await fetch(`/api/hrms/${module}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsRemoveFollowUpModalOpen(false); mutateItems(); }, 1500);
  };

  const handleSaveConfig = async () => {
    setActionStatus("loading"); setActionMessage("Saving Configuration..."); setIsStatusModalOpen(true);
    try {
      const res = await fetch(`/api/hrms/${module}/config`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configFormData)
      });
      if (res.ok) {
        setActionStatus("success");
        setGlobalConfigs(configFormData);
      } else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsConfigModalOpen(false); }, 1500);
  };

  const handleExport = () => {
    const stepCols = Array.from({ length: stepCount }).flatMap((_, i) => [`ST${i + 1} Planned`, `ST${i + 1} Actual`, `ST${i + 1} Status`, `ST${i + 1} Remark`]);
    const headers = ["ID", ...formFields.map(f => f.label), "Created At", "Cancelled", ...stepCols];

    const fmtCsvDt = (iso: any) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const rows = sortedItems.map(i => {
      const row = [
        i.id,
        ...formFields.map(f => (i as any)[f.name] || ""),
        fmtCsvDt(i.created_at),
        fmtCsvDt(i.cancelled),
        ...Array.from({ length: stepCount }).flatMap((_, idx) => {
          const n = idx + 1;
          return [fmtCsvDt((i as any)[`planned_${n}`]), fmtCsvDt((i as any)[`actual_${n}`]), (i as any)[`status_${n}`], (i as any)[`remark_${n}`]];
        })
      ];
      return row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${module}_full_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const openBulkModal = () => {
    const rmks: Record<string, string> = {};
    const ts: Record<string, boolean> = {};
    const sm: Record<string, string[]> = {};
    const lt: Record<string, string> = {};
    const ob: Record<string, Record<string, string>> = {};
    selectedIds.forEach(id => {
      rmks[id] = "";
      ts[id] = true;
      sm[id] = [];
      lt[id] = "";
      ob[id] = {};
    });
    setBulkRemarkInputs(rmks);
    setBulkToggles(ts);
    setBulkNotNeeded({});
    setBulkSocialMedia(sm);
    setBulkLeadTimeInputs(lt);
    setBulkDecisionInputs({});
    setBulkOffboardInputs(ob);
    setIsBulkModalOpen(true);
  };

  const needsDecision = (id: string) => {
    if (module !== 'candidate') return false;
    const it = items.find(r => r.id === id);
    return !!it && getActiveStep(it) === 7;
  };
  const missingDecision = Array.from(selectedIds).some(id => bulkToggles[id] && needsDecision(id) && !bulkDecisionInputs[id]);

  const handleBulkStepSave = async () => {
    const toProc = Array.from(selectedIds).filter(id => bulkToggles[id]);
    if (!toProc.length) return;
    if (toProc.some(id => needsDecision(id) && !bulkDecisionInputs[id])) return;
    setActionStatus("loading"); setActionMessage("Processing updates..."); setIsStatusModalOpen(true); setIsBulkModalOpen(false);
    const currentNow = new Date().toISOString(); let errors = 0; let movedToOnboard = 0;

    const blocked: string[] = [];
    for (const id of toProc) {
      const it = items.find(r => r.id === id); if (!it) continue;
      const n = getActiveStep(it); if (n <= 0) continue;

      // Onboarding can't finish while required joining documents are missing.
      if (module === "onboard" && n === ONBOARD_DOCS_STEP) {
        const missing = missingDocsFor(it);
        if (missing.length) { blocked.push(`${(it as any).candidate_name || id}: ${missing.join(", ")}`); continue; }
      }

      const upd = { ...it } as any;
      const skip = !!bulkNotNeeded[id] && !(module === "onboard" && n === ONBOARD_DOCS_STEP);
      upd[`actual_${n}`] = currentNow;
      upd[`status_${n}`] = skip ? NOT_NEEDED : "Done";
      if (skip && !bulkRemarkInputs[id]) upd[`remark_${n}`] = "Not needed for this person";
      if (bulkRemarkInputs[id]) {
        upd[`remark_${n}`] = bulkRemarkInputs[id];
      }

      if (module === 'recruitment' && n === RECRUITMENT_POST_STEP) {
        upd.social_medias_1 = JSON.stringify(bulkSocialMedia[id] || []);
      }

      if (module === 'candidate' && n === 7) {
        const decision = bulkDecisionInputs[id];
        upd[`status_${n}`] = decision;
        upd.lead_time_for_emp_joining_7 = decision === "Selected" ? (bulkLeadTimeInputs[id] || "") : "";
        if (decision === "Selected") movedToOnboard++;
      }

      if (module === 'offboard') {
        const offbFields = bulkOffboardInputs[id] || {};
        for (const [k, v] of Object.entries(offbFields)) {
          upd[k] = v;
        }
      }

      if (n < stepCount) {
        upd[`planned_${n + 1}`] = calculatePlannedDate(currentNow, globalConfigs[n]?.tat || "24 Hrs");
      }

      try {
        const res = await fetch(`/api/hrms/${module}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
        if (!res.ok) errors++;
      } catch { errors++; }
    }
    if (blocked.length) {
      setActionStatus("error");
      setActionMessage(`Not completed — documents missing. ${blocked.join(" · ")}. Upload them from the Docs button, then try again.`);
    } else {
      setActionStatus(errors ? "error" : "success");
      setActionMessage(errors ? `Finished with ${errors} errors` : movedToOnboard ? `All updated! ${movedToOnboard} selected candidate${movedToOnboard > 1 ? "s" : ""} moved to Onboarding.` : "All updated!");
    }
    // Keep the "documents missing" message up long enough to read.
    setTimeout(() => { setIsStatusModalOpen(false); setSelectedIds(new Set()); mutateItems(); }, blocked.length ? 8000 : 2000);
  };

  const getDelayInfo = (pl: string, act: string | null) => {
    if (!pl) return null;
    const pD = new Date(pl);
    const aD = act ? new Date(act) : now;
    const diffMs = aD.getTime() - pD.getTime();
    // Over a day → show days, not "669h" (Sahil, 2026-10-26).
    const abs = Math.abs(diffMs);
    const days = Math.floor(abs / 86400000);
    const hrs = Math.floor((abs % 86400000) / 3600000);
    const mins = Math.floor((abs % 3600000) / 60000);
    const span = days > 0 ? `${days}d${hrs ? ` ${hrs}h` : ""}` : `${hrs}h ${mins}m`;
    if (diffMs <= 0) return { text: `${span} left`, color: "text-emerald-500" };
    return { text: `${span} late`, color: "text-red-500" };
  };

  const fmtDt = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtTm = (iso: string) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-2 py-0.5 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#2563EB] dark:text-white tracking-tight">{moduleName} Dashboard</h1>
          <p className="text-[13px] font-bold text-[#5B6472] dark:text-slate-400">Human Resource Management System</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="self-start flex flex-wrap items-center gap-1 rounded-2xl md:rounded-full border-2 border-[#2563EB] dark:border-[#60A5FA] bg-white dark:bg-navy-900 shadow-xl p-0.5">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> <span>Export</span>
            </button>
            <button onClick={() => { setConfigFormData(JSON.parse(JSON.stringify(globalConfigs))); setIsConfigModalOpen(true); }} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <Cog6ToothIcon className="w-3.5 h-3.5" /> <span>Config</span>
            </button>
            <button onClick={() => {
              if (module === 'onboard') {
                setIsOnboardImportModalOpen(true);
              } else {
                setEditingItem(null); setFormData({}); setUploadFile(null); setIsModalOpen(true);
              }
            }} className="px-3 py-1 text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <PlusIcon className="w-4 h-4 stroke-[2.5]" />
            </button>
            <div className="hidden md:block w-[1px] h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
            <button onClick={() => setViewMode(viewMode === 'cancelled' ? 'active' : 'cancelled')} className={`flex items-center gap-2 px-4 py-1 font-semibold   text-[13px] transition-all rounded-full ${viewMode === 'cancelled' ? 'bg-red-500 text-white shadow-md' : 'text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800'}`}>
              <NoSymbolIcon className="w-3.5 h-3.5" /> <span>CANCELLED ({items.filter(i => !!(i.cancelled || "").trim()).length})</span>
            </button>
          </div>

          {(module === 'candidate' || module === 'sales') && (
            <a href="https://script.google.com/macros/s/AKfycbxw5IrY05TYutqEA0WL9oQpSGc1RfYHqB4BrPE7YeUZ/dev" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-1.5 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] bg-white dark:bg-navy-900 border-2 border-[#2563EB] dark:border-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full shadow-md">
              <DocumentTextIcon className="w-3.5 h-3.5" /> <span>Google Form</span>
            </a>
          )}
        </div>

        <div className="hidden md:flex items-center gap-0.5 bg-slate-100 dark:bg-navy-900 rounded-full p-0.5 border border-slate-200 dark:border-navy-800 shadow-inner">
          <button onClick={() => setLayoutMode("standard")} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${layoutMode === "standard" ? "bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>Standard</button>
          <button onClick={() => setLayoutMode("smart")} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${(layoutMode === "smart" || isPhone) ? "bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>Smart View</button>
        </div>
      </div>

      {/* Standard tiles — tap one to see those items (Sahil, 2026-10-28) */}
      {["recruitment", "candidate", "sales", "onboard", "offboard"].includes(module) && <div className="pt-2 -mx-2"><ModuleStrip module={module as any} /></div>}
      <div className="flex gap-4 flex-1 overflow-hidden mt-1 px-1">
        {/* Sidebar */}
        <div className="w-64 hidden md:flex flex-col shrink-0 h-full overflow-y-auto custom-scrollbar border-r border-slate-100 dark:border-navy-800 pr-3 py-0.5">
          <p className="text-[14px] font-semibold text-[#5B6472] dark:text-navy-500 mb-2 px-2 mt-1">Filters</p>
          <div className="space-y-1.5 pb-10">
            <button onClick={() => setSelectedStepFilter("all")} className={`w-full flex items-center justify-start gap-3 px-5 py-3 rounded-full transition-all border-b-4 ${selectedStepFilter === "all" ? "bg-[#EFF4FF] dark:bg-[#D1D5DB]/20 border-[#D1D5DB] text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400"}`}>
              <span className="font-semibold text-[14px] text-left">All Records</span>
            </button>
            <button onClick={() => setSelectedStepFilter("completed")} className={`w-full flex items-center justify-start gap-3 px-5 py-3 rounded-full transition-all border-b-4 ${selectedStepFilter === "completed" ? "bg-emerald-500 border-emerald-700 text-white shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400"}`}>
              <span className="font-semibold text-[14px] text-left">Completed</span>
              {stepCounts.completed > 0 && <span className="w-5 h-5 ml-auto flex items-center justify-center rounded-full text-[14px] font-semibold bg-white text-emerald-500">{stepCounts.completed}</span>}
            </button>
            {Array.from({ length: stepCount }).map((_, i) => {
              const getStepIcon = (name: string) => {
                const n = (name || "").toLowerCase();
                if (n.includes("call") || n.includes("connect")) return <PhoneIcon className="w-4 h-4" />;
                if (n.includes("post") || n.includes("social")) return <ShareIcon className="w-4 h-4" />;
                if (n.includes("resume") || n.includes("form") || n.includes("cv")) return <DocumentTextIcon className="w-4 h-4" />;
                if (n.includes("interview") || n.includes("filter") || n.includes("check")) return <MagnifyingGlassIcon className="w-4 h-4" />;
                if (n.includes("done") || n.includes("confirm") || n.includes("join")) return <CheckCircleIcon className="w-4 h-4" />;
                return <ClipboardDocumentCheckIcon className="w-4 h-4" />;
              };

              return (
                <button key={i} onClick={() => setSelectedStepFilter(i + 1)} className={`w-full flex items-center justify-start gap-3 px-3 py-3 rounded-xl transition-all border border-slate-50 dark:border-navy-800 bg-white dark:bg-navy-900 ${selectedStepFilter === i + 1 ? "bg-[#EFF4FF] dark:bg-[#D1D5DB]/20 border-[#D1D5DB] shadow-md" : "text-slate-500 dark:text-navy-400"}`}>
                  <div className={`p-2 rounded-lg shrink-0 ${selectedStepFilter === i + 1 ? 'bg-[#2563EB] text-white' : 'bg-slate-50 dark:bg-navy-800 text-[#5B6472]'}`}>
                    {getStepIcon(globalConfigs[i]?.step_name)}
                  </div>
                  <span className="text-[14px] font-semibold tracking-tight text-left leading-tight">Step {i + 1} — {globalConfigs[i]?.step_name}</span>
                  {stepCounts[i + 1] > 0 && <span className="w-5 h-5 ml-auto shrink-0 flex items-center justify-center rounded-full text-[14px] font-semibold bg-blue-500 text-white">{stepCounts[i + 1]}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full py-0.5">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3 shrink-0 px-1">
            <PhoneStepSelect
              steps={Array.from({ length: stepCount }, (_, i) => globalConfigs[i]?.step_name || `Step ${i + 1}`)}
              counts={Array.from({ length: stepCount }, (_, i) => globalConfigs[i]?.step_name || `Step ${i + 1}`).map((_: unknown, i: number) => stepCounts[i + 1] || 0)}
              value={selectedStepFilter}
              onChange={setSelectedStepFilter}
              allLabel="All records"
              completedCount={stepCounts.completed || 0}
            />
            <div className="relative group flex-1 min-w-[160px] md:max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5B6472] dark:text-navy-600" />
              <input type="text" placeholder={`Search ${moduleName}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-xl text-[14px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <p className="text-[13px] font-semibold text-[#5B6472] whitespace-nowrap">Page <span className="text-[#2563EB] dark:text-[#60A5FA]">{currentPage}</span> OF {totalPages || 1}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} className="p-1 text-[#5B6472] hover:text-slate-800 transition-colors"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} className="p-1 text-[#5B6472] hover:text-slate-800 transition-colors"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-20 py-0.5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-10 animate-pulse text-slate-200"><ArrowPathIcon className="w-8 h-8 animate-spin mb-4" /><p className="text-[13px] font-semibold">SYNCHRONIZING...</p></div>
            ) : paginatedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-slate-100"><MagnifyingGlassIcon className="w-12 h-12 mb-4" /><p className="text-[13px] font-semibold">No Data Found</p></div>
            ) : (layoutMode === "smart" || isPhone) ? (
              paginatedItems.map(item => {
                const sel = selectedIds.has(item.id); const step = getActiveStep(item); const exp = expandedTiles[item.id];
                const title = module === 'recruitment' ? (item as any).post_for_recruitment
                  : module === 'offboard' ? (item as any).emp_name
                    : (item as any).candidate_name;
                const subTitle = module === 'recruitment' ? `Loc: ${(item as any).for_which_location}`
                  : module === 'offboard' ? `Desig: ${(item as any).emp_designation}`
                    : `Phone: ${(item as any).whatsapp_number}`;

                return (
                  <div key={item.id} className="px-1">
                    <div onClick={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className={`bg-white dark:bg-navy-800 rounded-2xl border transition-all cursor-pointer overflow-hidden ${sel ? "border-[#2563EB] dark:border-[#60A5FA] border-2 shadow-lg" : "border-slate-100 dark:border-navy-700 shadow-sm"}`}>
                      <div className="p-3">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-2">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={sel} readOnly className="w-4 h-4 mt-1 rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA]" />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold border border-blue-100 dark:border-blue-900/50">ID: {item.id}</span>
                                <h3 className="text-base font-semibold text-slate-800 dark:text-white tracking-tight leading-none">{title || "—"}</h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-1.5">
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-500"><UserIcon className="w-3.5 h-3.5" /> {subTitle}</span>
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472]"><CalendarIcon className="w-3.5 h-3.5" /> {fmtDt(item.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {step > 0 && (
                              <div className="flex items-center bg-white dark:bg-navy-800 border border-[#2563EB] rounded-full shadow-sm overflow-hidden divide-x divide-[#2563EB]/30 mr-1">
                                <div className="flex flex-col items-center justify-center px-3 py-1.5 min-w-[120px]">
                                  <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] tracking-tighter leading-none whitespace-nowrap">{fmtDt((item as any)[`planned_${step}`])} {fmtTm((item as any)[`planned_${step}`])}</p>
                                  <p className={`text-[14px] font-semibold   mt-0.5 ${getDelayInfo((item as any)[`planned_${step}`], null)?.color}`}>{getDelayInfo((item as any)[`planned_${step}`], null)?.text}</p>
                                </div>
                                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2563EB]/5 dark:bg-[#60A5FA]/10">
                                  <ClockIcon className="w-3.5 h-3.5 text-[#2563EB] stroke-[3]" />
                                  <span className="text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">STEP {step} PENDING</span>
                                </div>
                              </div>
                            )}
                            {item.cancelled && (
                              <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/10 text-[13px] font-semibold text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-900/30 mr-1">
                                <NoSymbolIcon className="w-3.5 h-3.5" /> CANCELLED ON: {fmtDt(item.cancelled)} {fmtTm(item.cancelled)}
                              </span>
                            )}
                            {showsDocs && docsVisibleFor(item) && (
                              <EmployeeDocs record={item as any} module={module} uploads={docsByPerson?.[personKey(item as any, module)]} onUploaded={() => mutateDocs()} />
                            )}
                            <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-navy-800 rounded-full border border-slate-100 dark:border-navy-700 shadow-lg">
                              <button onClick={e => { e.stopPropagation(); setExpandedTiles(p => ({ ...p, [item.id]: !exp })); }} className={`p-1.5 rounded-full transition-all ${exp ? "bg-[#2563EB] text-white" : "text-[#2563EB] dark:text-[#60A5FA] hover:bg-yellow-50"}`}><ChevronDownIcon className={`w-3.5 h-3.5 stroke-[3] transition-transform ${exp ? "rotate-180" : ""}`} /></button>
                              <button onClick={e => { e.stopPropagation(); setEditingItem(item); setFormData({ ...item }); setUploadFile(null); setIsModalOpen(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-full transition-all" title="Edit"><PencilSquareIcon className="w-3.5 h-3.5" /></button>
                              {(!item.cancelled && Array.from({ length: stepCount }).some((_, i) => (item as any)[`actual_${i + 1}`]?.trim())) && (
                                <button onClick={e => { e.stopPropagation(); openRemoveFollowUpModal(item); }} className="p-1.5 text-[#D97706] hover:bg-[#F7F8FA] rounded-full transition-all" title="Remove Follow-up"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>
                              )}
                              {item.cancelled ? (
                                <button onClick={e => { e.stopPropagation(); setRestoreTargetId(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-full transition-all" title="Restore Process"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
                              ) : (
                                <button onClick={e => { e.stopPropagation(); setCancelTargetId(item.id); setIsConfirmOpen(true); }} className="p-1.5 text-[#D97706] hover:bg-[#F7F8FA] rounded-full transition-all" title="Cancel Process"><NoSymbolIcon className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={e => { e.stopPropagation(); handleDeleteClick(item.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-all" title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-50 dark:border-navy-700 pt-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 items-start">
                            {formFields.filter(f => f.type !== "file").map((f, i) => {
                              const getFieldIcon = (name: string) => {
                                const n = name.toLowerCase();
                                if (n.includes("date") || n.includes("time") || n.includes("age") || n.includes("notice") || n.includes("period") || n.includes("lead")) return <CalendarIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                if (n.includes("name") || n.includes("by") || n.includes("male") || n.includes("reference")) return <UserIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                if (n.includes("location") || n.includes("office")) return <MapPinIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                if (n.includes("ctc") || n.includes("salary") || n.includes("price")) return <BanknotesIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                if (n.includes("post") || n.includes("experience") || n.includes("work")) return <BriefcaseIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                if (n.includes("skill") || n.includes("qualification")) return <SparklesIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                if (n.includes("social") || n.includes("share")) return <ShareIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                                return <HashtagIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />;
                              };
                              const shortLabel = (l: string) => {
                                const map: Record<string, string> = {
                                  "NO. OF POST FOR RECRUITMENT": "NO. OF POSTS",
                                  "EXPERIENCE NEEDED FOR THE ROLE": "EXPERIENCE",
                                  "WORK AND RESPONSIBILITIES": "RESPONSIBILITIES",
                                  "POST FOR RECRUITMENT": "POST",
                                  "FOR WHICH LOCATION": "LOCATION",
                                  "REQUIREMENT BY": "REQ. BY",
                                  "MALE /FEMALE": "GENDER",
                                  "SKILLS REQUIRED": "SKILLS",
                                  "WHICH PLATFORM": "PLATFORM",
                                  "PLAN TO CLOSE": "TAT (DAYS)",
                                  "NOTICE PERIOD (IN DAYS)": "NOTICE PERIOD",
                                  "SHARE TWO PROFESSIONAL REFERENCES": "REFERENCES",
                                  "CURRENT LIVING LOCATION": "LIVING LOCATION",
                                  "GTK OFFICE COMFORTABLE": "GTK OFFICE",
                                  "LEAD TIME FOR EMP. JOINING (STEP 7)": "LEAD TIME",
                                  "LEAD TIME": "LEAD TIME"
                                };
                                return map[l.toUpperCase()] || l;
                              };

                              return (
                                <div key={f.name} className="space-y-0.5">
                                  <p className={`text-[13px] font-semibold   truncate ${i % 3 === 0 ? 'text-emerald-500' : i % 3 === 1 ? 'text-blue-500' : 'text-purple-500'}`} title={f.label}>
                                    {getFieldIcon(f.name)}
                                    {shortLabel(f.label)}
                                  </p>
                                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">
                                    {f.type === 'date' && (item as any)[f.name] ? new Date((item as any)[f.name]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : (item as any)[f.name] || "—"}
                                  </p>
                                </div>
                              );
                            })}
                            {(item as any).upload_updated_cv && (
                              <div className="space-y-0.5">
                                <p className="text-[13px] font-semibold text-[#D97706] truncate" title="Document">
                                  <DocumentTextIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                  DOCUMENT
                                </p>
                                <a href={(item as any).upload_updated_cv} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-blue-500 hover:underline truncate inline-block">View File</a>
                              </div>
                            )}
                          </div>
                        </div>

                        {exp && (
                          <div className="mt-3 flex overflow-x-auto items-stretch gap-2 animate-in slide-in-from-top-2 duration-300 pb-2 custom-scrollbar">

                            {/* Step Tiles */}
                            {Array.from({ length: stepCount }, (_, i) => {
                              const n = i + 1; const act = (item as any)[`actual_${n}`]; const pl = (item as any)[`planned_${n}`];
                              const done = !!act; const isPending = !done && n === getActiveStep(item);
                              const skipped = done && String((item as any)[`status_${n}`] || "") === NOT_NEEDED;
                              let statusClasses = "bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-[#5B6472]";
                              if (skipped) statusClasses = "bg-[#F7F8FA] dark:bg-navy-900 border-dashed border-slate-300 dark:border-navy-700 text-[#5B6472]";
                              else if (done) statusClasses = "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm";
                              else if (isPending) statusClasses = "bg-[#F7F8FA] dark:bg-[#FEF3C7] border-[#E5E7EB] text-[#D97706] dark:text-[#D97706] shadow-sm";
                              return (
                                <div key={n} className={`flex-none w-64 p-3 rounded-xl border transition-all flex flex-col justify-between ${statusClasses}`}>
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <p className={`text-[13px] font-semibold   ${skipped ? "text-[#5B6472]" : done ? "text-emerald-600" : isPending ? "text-[#D97706]" : "text-[#5B6472]"}`}>STEP {n}{skipped ? " · Not needed" : ""}</p>
                                      {done ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" /> : isPending ? <ClockIcon className="w-3.5 h-3.5 text-[#D97706] animate-pulse" /> : null}
                                    </div>
                                    <p className={`text-[14px] font-semibold leading-snug line-clamp-2 ${done ? "text-emerald-900 dark:text-emerald-200" : isPending ? "text-[#D97706] dark:text-[#D97706]" : "text-slate-600"}`}>{globalConfigs[i]?.step_name}</p>
                                  </div>
                                  <div className={`mt-3 space-y-1.5 pt-2 border-t ${done ? "border-emerald-100 dark:border-emerald-900/50" : "border-slate-100 dark:border-navy-800"}`}>
                                    <div className="flex justify-between items-center text-[13px] font-semibold">
                                      <span className="opacity-50">Planned</span>
                                      <span>{pl ? (new Date(pl).toLocaleDateString('en-GB') + ' ' + new Date(pl).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })) : "—"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px] font-semibold">
                                      <span className="opacity-50">Actual</span>
                                      <span className={done ? "text-emerald-700 dark:text-emerald-400" : "opacity-30"}>{act ? (new Date(act).toLocaleDateString('en-GB') + ' ' + new Date(act).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })) : "—"}</span>
                                    </div>
                                    {((item as any)[`status_${n}`] || (item as any)[`remark_${n}`]) && (
                                      <div className={`mt-1.5 pt-1.5 border-t space-y-1 ${done ? "border-emerald-100 dark:border-emerald-900/50" : "border-slate-100 dark:border-navy-800"}`}>
                                        {(item as any)[`status_${n}`] && (
                                          <div className="flex justify-between items-center text-[13px] font-semibold">
                                            <span className="opacity-50">Status</span>
                                            <span className="truncate max-w-[120px]" title={(item as any)[`status_${n}`]}>{(item as any)[`status_${n}`]}</span>
                                          </div>
                                        )}
                                        {(item as any)[`remark_${n}`] && (
                                          <div className="flex justify-between items-start text-[13px] font-semibold">
                                            <span className="opacity-50 mr-2 mt-0.5">Remark</span>
                                            <span className="text-right line-clamp-2 max-w-[140px]" title={(item as any)[`remark_${n}`]}>{(item as any)[`remark_${n}`]}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {module === 'recruitment' && n === RECRUITMENT_POST_STEP && (item as any).social_medias_1 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-navy-800">
                                        {(() => {
                                          try {
                                            const arr = JSON.parse((item as any).social_medias_1);
                                            if (Array.isArray(arr) && arr.length > 0) {
                                              return arr.map((sm, idx) => (
                                                <span key={idx} className="px-1.5 py-0.5 bg-[#2563EB] text-white text-[14px] font-semibold rounded shadow-sm">{sm}</span>
                                              ));
                                            }
                                          } catch (e) { }
                                          return null;
                                        })()}
                                      </div>
                                    )}
                                    {module === 'offboard' && (
                                      <div className={`mt-1.5 pt-1.5 border-t space-y-1 ${done ? "border-emerald-100 dark:border-emerald-900/50" : "border-slate-100 dark:border-navy-800"}`}>
                                        {n === 1 && (
                                          <>
                                            {(item as any).notice_period_in_days_1 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">Notice Period</span><span className="text-right">{(item as any).notice_period_in_days_1} Days</span></div>}
                                            {(item as any).lwd_1 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">LWD</span><span className="text-right">{(item as any).lwd_1}</span></div>}
                                            {(item as any).handover_name_1 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">Handover To</span><span className="text-right">{(item as any).handover_name_1}</span></div>}
                                            {(item as any).reason_of_leaving_1 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">Reason</span><span className="text-right line-clamp-2 max-w-[120px]" title={(item as any).reason_of_leaving_1}>{(item as any).reason_of_leaving_1}</span></div>}
                                            {(item as any).remarks_of_management_1 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">Mgt Remark</span><span className="text-right line-clamp-2 max-w-[120px]" title={(item as any).remarks_of_management_1}>{(item as any).remarks_of_management_1}</span></div>}
                                          </>
                                        )}
                                        {n === 2 && (
                                          <>
                                            {(item as any).knowledge_transfer_2 && <div className="space-y-0.5 mt-1"><span className="opacity-50 text-[13px] font-semibold block">Knowledge Transfer:</span><div className="flex flex-wrap gap-1">{(item as any).knowledge_transfer_2.split(',').filter((x: string) => x.trim()).map((k: string, idx: number) => <span key={idx} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[14px] font-semibold rounded shadow-sm">{k.trim()}</span>)}</div></div>}
                                            {(item as any).asset_recovery_2 && <div className="space-y-0.5 mt-1"><span className="opacity-50 text-[13px] font-semibold block">Asset Recovery:</span><div className="flex flex-wrap gap-1">{(item as any).asset_recovery_2.split(',').filter((x: string) => x.trim()).map((k: string, idx: number) => <span key={idx} className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-[14px] font-semibold rounded shadow-sm">{k.trim()}</span>)}</div></div>}
                                          </>
                                        )}
                                        {n === 3 && (
                                          <>
                                            {(item as any).discussion_with_hr_3 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">HR Discussion</span><span className="text-right line-clamp-2 max-w-[120px]" title={(item as any).discussion_with_hr_3}>{(item as any).discussion_with_hr_3}</span></div>}
                                            {(item as any).conclusion_3 && <div className="flex justify-between items-start text-[13px] font-semibold"><span className="opacity-50">Conclusion</span><span className="text-right line-clamp-2 max-w-[120px]" title={(item as any).conclusion_3}>{(item as any).conclusion_3}</span></div>}
                                          </>
                                        )}
                                        {n === OFFBOARD_CLOSURE_STEP && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {['relieving_letter_4', 'experience_letter_4', 'f_and_f_statement_4', 'salary_slips_if_requested_4'].map((doc, idx) => {
                                              if ((item as any)[doc] === "Done") {
                                                const label = ['Relieving Ltr', 'Experience Ltr', 'F&F Stmt', 'Salary Slips'][idx];
                                                return <span key={idx} className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[14px] font-semibold rounded shadow-sm flex items-center gap-1"><CheckCircleIcon className="w-2.5 h-2.5" /> {label}</span>;
                                              }
                                              return null;
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-800 shadow-sm custom-scrollbar">
                <table className="w-full text-left border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-[#2563EB] dark:bg-navy-950 text-white font-semibold">
                      <th className="p-3 sticky left-0 z-10 bg-[#2563EB]"><input type="checkbox" checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0} onChange={() => { if (selectedIds.size === paginatedItems.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginatedItems.map(i => i.id))); }} className="rounded border-white/20 bg-transparent text-[#2563EB]" /></th>
                      <th className="p-3 whitespace-nowrap sticky left-10 z-10 bg-[#2563EB]">Actions</th>
                      <th className="p-3 whitespace-nowrap sticky left-24 z-10 bg-[#2563EB]">ID</th>
                      {formFields.map(f => <th key={f.name} className="p-3 whitespace-nowrap">{f.label}</th>)}
                      <th className="p-3 whitespace-nowrap border-l border-white/10">Created At</th>
                      {Array.from({ length: stepCount }).map((_, i) => <th key={i} className="p-3 whitespace-nowrap border-l border-white/10 min-w-[200px]">STEP {i + 1} — {globalConfigs[i]?.step_name?.toUpperCase() || ''}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                    {paginatedItems.map(item => {
                      const sel = selectedIds.has(item.id);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-900/30 transition-all font-bold">
                          <td className="p-3 sticky left-0 z-10 bg-white dark:bg-navy-800"><input type="checkbox" checked={sel} onChange={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className="rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA]" /></td>
                          <td className="p-3 sticky left-10 z-10 bg-white dark:bg-navy-800">
                            <div className="flex items-center gap-1">
                              <button onClick={e => { e.stopPropagation(); setEditingItem(item); setFormData({ ...item }); setUploadFile(null); setIsModalOpen(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit"><PencilSquareIcon className="w-3.5 h-3.5" /></button>
                              {item.cancelled ? (
                                <button onClick={() => setRestoreTargetId(item.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded" title="Restore"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
                              ) : (
                                <>
                                  <button onClick={() => setCancelTargetId(item.id)} className="p-1 text-[#D97706] hover:bg-[#F7F8FA] rounded" title="Cancel"><NoSymbolIcon className="w-3.5 h-3.5" /></button>
                                  {Array.from({ length: stepCount }).some((_, i) => (item as any)[`actual_${i + 1}`]?.trim()) && (
                                    <button onClick={e => { e.stopPropagation(); openRemoveFollowUpModal(item); }} className="p-1 text-[#D97706] hover:bg-[#F7F8FA] rounded" title="Remove Follow-up"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>
                                  )}
                                </>
                              )}
                              <button onClick={() => handleDeleteClick(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                          <td className="p-3 sticky left-24 z-10 bg-white dark:bg-navy-800">
                            <div className="flex flex-col">
                              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded border border-blue-100 dark:border-blue-900/50 whitespace-nowrap">{item.id.slice(0, 8).toUpperCase()}</span>
                              {item.cancelled && <span className="text-[14px] text-red-500 font-semibold mt-0.5" title={`${fmtDt(item.cancelled)} ${fmtTm(item.cancelled)}`}>Cancelled</span>}
                            </div>
                          </td>
                          {formFields.map(f => (
                            <td key={f.name} className="p-3 max-w-[200px] truncate" title={(item as any)[f.name]}>
                              {f.type === 'date' && (item as any)[f.name] ? new Date((item as any)[f.name]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : (item as any)[f.name] || "—"}
                            </td>
                          ))}
                          <td className="p-3 border-l border-slate-100 dark:border-navy-700 whitespace-nowrap text-slate-500">{new Date(item.created_at).toLocaleDateString('en-GB')} {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                          {Array.from({ length: stepCount }).map((_, i) => {
                            const n = i + 1; const act = (item as any)[`actual_${n}`]; const pl = (item as any)[`planned_${n}`];
                            const done = !!act; const isPending = !done && n === getActiveStep(item);
                            return (
                              <td key={i} className={`p-3 border-l ${done ? "bg-emerald-50/30 text-emerald-700" : isPending ? "bg-[#F7F8FA] text-[#D97706]" : "border-slate-100 dark:border-navy-700"}`}>
                                <div className="space-y-0.5 w-32">
                                  <div className="flex justify-between items-center text-[13px] font-semibold"><span className="opacity-50">Pl</span><span>{pl ? (new Date(pl).toLocaleDateString('en-GB') + ' ' + new Date(pl).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })) : "—"}</span></div>
                                  <div className="flex justify-between items-center text-[13px] font-semibold"><span className="opacity-50">Ac</span><span className={done ? "text-emerald-600" : "opacity-30"}>{act ? (new Date(act).toLocaleDateString('en-GB') + ' ' + new Date(act).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })) : "—"}</span></div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bulk Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 bg-[#FFFFFF] dark:bg-navy-800 px-1.5 py-1.5 rounded-full shadow-2xl flex items-center gap-4 border border-[#EFF4FF] dark:border-navy-700 z-[100] animate-in slide-in-from-bottom-12">
          <div className="flex items-center gap-2.5 pl-3">
            <div className="w-8 h-8 bg-[#2563EB] text-white rounded-full flex items-center justify-center font-semibold text-sm">{selectedIds.size}</div>
            <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">Selected</p>
          </div>
          <button onClick={openBulkModal} className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-2.5 rounded-full font-semibold text-[13px] hover:scale-[1.03] transition-all shadow-md">
            <SparklesIcon className="w-3.5 h-3.5" /> BULK PROCESS
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="pr-5 text-[#5B6472] hover:text-[#2563EB] text-[13px] font-semibold transition-colors">Clear</button>
        </div>
      )}

      {/* Bulk Processor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-4xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 md:px-10 pt-6 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-navy-700">
              <div><h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Bulk Processor</h2><p className="text-[13px] font-semibold mt-1 text-[#5B6472]">Processing {Array.from(selectedIds).length} items</p></div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-[#5B6472]"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 pt-4 space-y-3 custom-scrollbar">
              {Array.from(selectedIds).map(id => {
                const item = items.find(r => r.id === id); if (!item) return null;
                const step = getActiveStep(item); const t = bulkToggles[id] ?? true;
                const title = module === 'recruitment' ? (item as any).post_for_recruitment : module === 'offboard' ? (item as any).emp_name : (item as any).candidate_name;
                return (
                  <div key={id} className={`p-4 md:p-5 bg-white dark:bg-navy-900 rounded-3xl border transition-all ${t ? "border-[#2563EB]/20 dark:border-[#60A5FA]/20 shadow-sm" : "opacity-40"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr_auto] items-center gap-3 md:gap-8">
                      <div><span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold">{item.id}</span><h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white mt-1 line-clamp-1">{title || "—"}</h3></div>
                      <div>
                        {t && (
                          <div className="space-y-1">
                            {step > 0 ? (
                              <div className="space-y-3">
                                <p className={`text-[13px] font-semibold px-2 py-1 rounded w-max truncate max-w-full ${bulkNotNeeded[id] ? "text-[#5B6472] bg-slate-100" : "text-emerald-600 bg-emerald-50"}`} title={`Step ${step} — ${globalConfigs[step - 1]?.step_name}`}>
                                  {bulkNotNeeded[id] ? "Skipping" : "Marking"} Step {step} {bulkNotNeeded[id] ? "(not needed)" : "Done"} — {globalConfigs[step - 1]?.step_name}
                                </p>
                                {!(module === "onboard" && step === ONBOARD_DOCS_STEP) && (
                                  <label className="flex items-center gap-2 min-h-[36px] cursor-pointer w-max">
                                    <input
                                      type="checkbox"
                                      checked={!!bulkNotNeeded[id]}
                                      onChange={(e) => setBulkNotNeeded((p) => ({ ...p, [id]: e.target.checked }))}
                                      className="w-4 h-4 accent-[#2563EB]"
                                    />
                                    <span className="text-[14px] text-[#1A1D21] dark:text-white">Not needed for this person</span>
                                  </label>
                                )}

                                {module === 'recruitment' && step === RECRUITMENT_POST_STEP && (
                                  <div className="bg-slate-50 dark:bg-navy-900 p-3 rounded-xl border border-slate-100 dark:border-navy-800 space-y-2">
                                    <p className="text-[13px] font-semibold text-[#5B6472]">Social Media Platforms Posted</p>
                                    <div className="flex flex-wrap gap-2">
                                      {["LinkedIn", "Facebook", "Instagram", "Naukri", "Indeed", "Twitter"].map(platform => {
                                        const isSelected = (bulkSocialMedia[id] || []).includes(platform);
                                        return (
                                          <label key={platform} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isSelected ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                                            <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                              setBulkSocialMedia(prev => {
                                                const current = prev[id] || [];
                                                if (e.target.checked) return { ...prev, [id]: [...current, platform] };
                                                return { ...prev, [id]: current.filter(p => p !== platform) };
                                              });
                                            }} />
                                            <span className="text-[13px] font-semibold">{platform}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {module === 'candidate' && step === 7 && (
                                  <div className="bg-slate-50 dark:bg-navy-900 p-3 rounded-xl border border-slate-100 dark:border-navy-800 space-y-2">
                                    <p className="text-[13px] font-semibold text-[#5B6472]">Final decision (Step 7) *</p>
                                    <div className="flex gap-2">
                                      {(["Selected", "Rejected"] as const).map(opt => {
                                        const on = bulkDecisionInputs[id] === opt;
                                        const tone = opt === "Selected"
                                          ? (on ? "bg-emerald-600 border-emerald-600 text-white" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")
                                          : (on ? "bg-red-600 border-red-600 text-white" : "border-red-200 text-red-600 hover:bg-red-50");
                                        return (
                                          <button key={opt} type="button" onClick={() => setBulkDecisionInputs({ ...bulkDecisionInputs, [id]: opt })} className={`flex-1 min-h-[40px] rounded-xl border-2 text-[14px] font-semibold transition-colors ${tone}`}>
                                            {opt === "Selected" ? "✓ Selected" : "✕ Rejected"}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {bulkDecisionInputs[id] === "Selected" && (
                                      <>
                                        <p className="text-[13px] text-emerald-700">Will move to Onboarding automatically.</p>
                                        <p className="text-[13px] font-semibold text-[#5B6472]">Lead Time For Emp. Joining</p>
                                        <input type="text" placeholder="Enter Lead Time" value={bulkLeadTimeInputs[id] || ""} onChange={e => setBulkLeadTimeInputs({ ...bulkLeadTimeInputs, [id]: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-navy-950 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] outline-none focus:border-[#2563EB]" />
                                      </>
                                    )}
                                    {bulkDecisionInputs[id] === "Rejected" && (
                                      <p className="text-[13px] text-red-600">Candidate will be closed as Rejected. Add the reason in the remark.</p>
                                    )}
                                  </div>
                                )}

                                {module === 'offboard' && (
                                  <div className="bg-slate-50 dark:bg-navy-900 p-3 rounded-xl border border-slate-100 dark:border-navy-800 space-y-3">
                                    {step === 1 && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <input type="text" placeholder="Notice Period (In Days)" value={bulkOffboardInputs[id]?.notice_period_in_days_1 || ""} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), notice_period_in_days_1: e.target.value } })} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-[14px]" />
                                        <input type="text" placeholder="LWD (Last Working Day)" value={bulkOffboardInputs[id]?.lwd_1 || ""} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), lwd_1: e.target.value } })} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-[14px]" />
                                        <div className="col-span-2">
                                          <UserSingleCombobox
                                            value={bulkOffboardInputs[id]?.handover_name_1 || ""}
                                            onChange={val => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), handover_name_1: val } })}
                                            users={usersList.map(u => u.username || u.name).filter(Boolean)}
                                            placeholder="Select Handover Name..."
                                          />
                                        </div>
                                        <textarea placeholder="Reason of Leaving" value={bulkOffboardInputs[id]?.reason_of_leaving_1 || ""} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), reason_of_leaving_1: e.target.value } })} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-[14px] col-span-2 resize-none h-16" />
                                        <textarea placeholder="Remarks of Management" value={bulkOffboardInputs[id]?.remarks_of_management_1 || ""} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), remarks_of_management_1: e.target.value } })} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-[14px] col-span-2 resize-none h-16" />
                                      </div>
                                    )}
                                    {step === 2 && (
                                      <div className="space-y-4">
                                        <div className="space-y-2">
                                          <p className="text-[13px] font-semibold text-[#5B6472]">Knowledge Transfer</p>
                                          <div className="flex flex-wrap gap-2">
                                            {["Mandatory checklist", "Ongoing tasks", "Login credentials (official) and Files", "Reports", "Dashboards"].map(opt => {
                                              const currentStr = bulkOffboardInputs[id]?.knowledge_transfer_2 || "";
                                              const currentArr = currentStr ? currentStr.split(',').map(s => s.trim()) : [];
                                              const isSelected = currentArr.includes(opt);
                                              return (
                                                <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isSelected ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                                                  <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                                    const newArr = e.target.checked ? [...currentArr, opt] : currentArr.filter(x => x !== opt);
                                                    setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), knowledge_transfer_2: newArr.join(', ') } });
                                                  }} />
                                                  <span className="text-[13px] font-semibold">{opt}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <p className="text-[13px] font-semibold text-[#5B6472]">Asset Recovery</p>
                                          <div className="flex flex-wrap gap-2">
                                            {["Laptop / Desktop", "ID Card / SIM", "Phone", "Access card", "keys", "Asset clearance form sign"].map(opt => {
                                              const currentStr = bulkOffboardInputs[id]?.asset_recovery_2 || "";
                                              const currentArr = currentStr ? currentStr.split(',').map(s => s.trim()) : [];
                                              const isSelected = currentArr.includes(opt);
                                              return (
                                                <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isSelected ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                                                  <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                                    const newArr = e.target.checked ? [...currentArr, opt] : currentArr.filter(x => x !== opt);
                                                    setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), asset_recovery_2: newArr.join(', ') } });
                                                  }} />
                                                  <span className="text-[13px] font-semibold">{opt}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {step === 3 && (
                                      <div className="grid grid-cols-1 gap-2">
                                        <textarea placeholder="Discussion with HR" value={bulkOffboardInputs[id]?.discussion_with_hr_3 || ""} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), discussion_with_hr_3: e.target.value } })} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-[14px] resize-none h-16" />
                                        <textarea placeholder="Conclusion" value={bulkOffboardInputs[id]?.conclusion_3 || ""} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), conclusion_3: e.target.value } })} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-[14px] resize-none h-16" />
                                      </div>
                                    )}
                                    {step === OFFBOARD_CLOSURE_STEP && (
                                      <div className="grid grid-cols-2 gap-2">
                                        {['Relieving Letter', 'Experience Letter', 'F&F Statement', 'Salary Slips (if requested)'].map((doc, idx) => {
                                          const fName = ['relieving_letter_4', 'experience_letter_4', 'f_and_f_statement_4', 'salary_slips_if_requested_4'][idx];
                                          return (
                                            <label key={fName} className="flex items-center gap-2 text-[14px] font-bold text-slate-700">
                                              <input type="checkbox" checked={bulkOffboardInputs[id]?.[fName] === "Done"} onChange={e => setBulkOffboardInputs({ ...bulkOffboardInputs, [id]: { ...(bulkOffboardInputs[id] || {}), [fName]: e.target.checked ? "Done" : "" } })} className="rounded" />
                                              {doc}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <input type="text" placeholder="Add remark (optional)" value={bulkRemarkInputs[id] || ""} onChange={e => setBulkRemarkInputs({ ...bulkRemarkInputs, [id]: e.target.value })} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] outline-none focus:border-[#2563EB]" />
                              </div>
                            ) : (
                              <p className="text-[13px] font-semibold text-[#5B6472] italic">Completed</p>
                            )}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setBulkToggles(p => ({ ...p, [id]: !t }))} className={`w-10 h-5 rounded-full relative p-0.5 transition-all ${t ? "bg-[#2563EB] dark:bg-[#60A5FA]" : "bg-slate-200"}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${t ? "translate-x-5" : "translate-x-0"}`} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between gap-3">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472]">Cancel</button>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {missingDecision && <span className="text-[13px] font-semibold text-amber-600">Choose Selected or Rejected for every step 7 candidate</span>}
                <button onClick={handleBulkStepSave} disabled={missingDecision} className="bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100">Execute Bulk Update</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-900 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300 border border-[#E5E7EB] dark:border-navy-700 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[#E5E7EB] dark:border-navy-800 flex justify-between items-center bg-[#2563EB] dark:bg-navy-900 text-white">
              <div>
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-[#2563EB]" /> {editingItem ? "Edit" : "New"} {moduleName}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[#2563EB] dark:text-slate-400 font-bold text-[14px]">HRMS Configuration</p>
                  {editingItem && (
                    <span className="px-2 py-0.5 bg-white/10 text-[14px] font-semibold text-[#2563EB] rounded border border-white/20">
                      ID: {editingItem.id}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-navy-800/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formFields.map(f => {
                  const isFullWidth = (f.type === "textarea" && f.name !== "skills_required" && f.name !== "work_and_responsibilities") || f.name === "slot_booking" || f.name === "gtk_office_comfortable" || f.name.includes("lead_time");
                  return (
                    <div key={f.name} className={`relative mt-2 ${isFullWidth ? "col-span-1 md:col-span-2" : ""}`}>
                      <label className="absolute -top-2.5 left-3 bg-white dark:bg-navy-800 px-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] z-10">
                        <QuestionMarkCircleIcon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
                        {f.label}
                      </label>
                      {f.name === "male_female" || f.name === "urgency" ? (
                        <div className="flex bg-[#FFFFFF] dark:bg-navy-900 rounded-xl border border-[#E5E7EB] dark:border-navy-700 p-1 shadow-sm pt-2">
                          {f.options?.map(opt => (
                            <button type="button" key={opt} onClick={() => setFormData({ ...formData, [f.name]: opt })} className={`flex-1 text-[14px] font-semibold py-2 rounded-lg transition-all ${formData[f.name] === opt ? "bg-[#2563EB] text-white shadow-md" : "text-gray-500 hover:bg-white dark:hover:bg-navy-800"}`}>{opt}</button>
                          ))}
                        </div>
                      ) : f.name === "gtk_office_comfortable" ? (
                        <div className="bg-[#FFFFFF] dark:bg-navy-900 rounded-xl border border-[#E5E7EB] dark:border-navy-700 p-4 shadow-sm pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <p className="text-[14px] font-semibold text-slate-600 dark:text-navy-300">Are you comfortable working from our GTK Office?</p>
                            <a href="https://www.google.com/maps/place/Robotek+India/@28.7000325,77.1728141,5818m/data=!3m1!1e3!4m6!3m5!1s0x390d037b67f99bb7:0xb7fe05fbafc41e98!8m2!3d28.6949603!4d77.187099!16s%2Fg%2F11vcw95rvz!5m1!1e1?entry=ttu&g_ep=EgoyMDI2MDYwMS4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[14px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                              <MapPinIcon className="w-3.5 h-3.5" /> View Location on Map
                            </a>
                          </div>
                          <div className="flex items-center gap-3 bg-white dark:bg-navy-800 px-4 py-2 rounded-lg border border-slate-100 dark:border-navy-700 shadow-sm">
                            <span className={`text-[14px] font-bold ${formData[f.name] !== "Yes" ? "text-slate-900 dark:text-white" : "text-[#5B6472] dark:text-slate-500"}`}>No</span>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, [f.name]: formData[f.name] === "Yes" ? "No" : "Yes" })}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData[f.name] === "Yes" ? "bg-blue-600" : "bg-slate-300 dark:bg-navy-600"}`}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData[f.name] === "Yes" ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                            <span className={`text-[14px] font-bold ${formData[f.name] === "Yes" ? "text-slate-900 dark:text-white" : "text-[#5B6472] dark:text-slate-500"}`}>Yes</span>
                          </div>
                        </div>
                      ) : f.type === "radio" ? (
                        <div className="bg-[#FFFFFF] dark:bg-navy-900 rounded-xl border border-[#E5E7EB] dark:border-navy-700 p-3 shadow-sm pt-4 max-h-[240px] overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {f.options?.map(opt => (
                            <label key={opt} onClick={() => setFormData({ ...formData, [f.name]: opt })} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData[f.name] === opt ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm" : "border-slate-200 dark:border-navy-700 hover:border-blue-300 dark:hover:border-blue-700"}`}>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${formData[f.name] === opt ? "border-blue-600 bg-white dark:bg-navy-800" : "border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900"}`}>
                                {formData[f.name] === opt && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                              </div>
                              <span className="text-[14px] font-bold text-slate-700 dark:text-slate-300">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : f.name === "requirement_by" ? (
                        <div className="pt-0">
                          <UserSingleCombobox value={formData[f.name] || ""} onChange={val => setFormData({ ...formData, [f.name]: val })} users={usersList.map(u => u.username || u.name).filter(Boolean)} placeholder="Select User..." />
                        </div>
                      ) : f.name === "emp_name" && module === "offboard" ? (
                        <div className="pt-0">
                          <UserSingleCombobox
                            value={formData[f.name] || ""}
                            onChange={val => {
                              const selectedUser = usersList.find(u => (u.username || u.name) === val);
                              setFormData({
                                ...formData,
                                [f.name]: val,
                                emp_id: selectedUser?.id || "",
                                emp_designation: selectedUser?.designation || ""
                              });
                            }}
                            users={usersList.map(u => u.username || u.name).filter(Boolean)}
                            placeholder="Search Employee..."
                          />
                        </div>
                      ) : f.type === "textarea" ? (
                        <textarea value={formData[f.name] || ""} onChange={e => setFormData({ ...formData, [f.name]: e.target.value })} className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm resize-none min-h-[80px]" rows={3} />
                      ) : f.type === "select" ? (
                        <select value={formData[f.name] || ""} onChange={e => setFormData({ ...formData, [f.name]: e.target.value })} className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 focus:border-[#2563EB] outline-none font-semibold text-[14px] text-gray-900 dark:text-white transition-all shadow-sm">
                          <option value="">Select...</option>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === "file" ? (
                        <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full px-4 py-2.5 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-700 rounded-xl text-[14px] font-bold text-gray-800 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-[#2563EB] file:text-white hover:file:bg-[#1D4ED8] transition-all shadow-sm" />
                      ) : (
                        <input type={f.type} value={formData[f.name] || ""} onChange={e => setFormData({ ...formData, [f.name]: e.target.value })} className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700 focus:border-[#2563EB] outline-none font-semibold text-[14px] text-gray-900 dark:text-white transition-all shadow-sm" />
                      )}
                    </div>
                  );
                })}
              </div>


            </form>
            <div className="p-6 border-t border-[#E5E7EB] dark:border-navy-800 bg-[#FFFFFF] dark:bg-navy-900 flex justify-end gap-3 z-10">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-full text-[14px] font-semibold text-gray-500 hover:bg-gray-200 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button type="submit" onClick={handleSave} className="px-8 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">Save Record</button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsConfigModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-4xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 md:px-10 pt-6 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-navy-700">
              <div><h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Configuration Setup</h2><p className="text-[13px] font-semibold mt-1 text-[#2563EB]">Edit TAT and Responsible Persons</p></div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-[#5B6472]"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 space-y-3 custom-scrollbar mt-4">
              {configFormData.map((cfg, i) => (
                <div key={i} className="p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-700 shadow-sm transition-all group">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_350px] items-center gap-3 md:gap-8">
                    <div className="space-y-0.5"><p className="text-[13px] font-semibold text-[#5B6472]">Step {i + 1}</p><h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white leading-tight">{cfg.step_name}</h3></div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600">
                        <ClockIcon className="w-3 h-3" />
                        <p className="text-[13px] font-semibold">TAT</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 dark:bg-navy-900 p-0.5 rounded-full flex items-center border border-slate-200 dark:border-navy-800">
                          <button
                            onClick={() => { const n = [...configFormData]; n[i].tat = n[i].tat.replace("Days", "Hrs"); setConfigFormData(n); }}
                            className={`px-3 py-1 rounded-full text-[14px] font-semibold  transition-all ${cfg.tat.includes("Hrs") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}
                          >HRS</button>
                          <button
                            onClick={() => { const n = [...configFormData]; n[i].tat = n[i].tat.replace("Hrs", "Days"); setConfigFormData(n); }}
                            className={`px-3 py-1 rounded-full text-[14px] font-semibold  transition-all ${cfg.tat.includes("Days") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472]"}`}
                          >Days</button>
                        </div>
                        <input
                          type="text"
                          value={parseFloat(cfg.tat) || 0}
                          onChange={e => {
                            const n = [...configFormData];
                            const unit = cfg.tat.includes("Days") ? "Days" : "Hrs";
                            n[i].tat = `${e.target.value} ${unit}`;
                            setConfigFormData(n);
                          }}
                          className="w-12 h-8 bg-slate-50 dark:bg-navy-800 border-none rounded-lg text-center font-semibold text-[14px] text-[#2563EB] dark:text-[#60A5FA] outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600">
                        <UserIcon className="w-3 h-3" />
                        <p className="text-[13px] font-semibold">Responsible Person</p>
                      </div>
                      <UserMultiCombobox value={cfg.responsible_person} isSimple onChange={val => { const n = [...configFormData]; n[i].responsible_person = val; setConfigFormData(n); }} users={usersList.map(u => u.username || u.name).filter(Boolean)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472]">Cancel</button>
              <button onClick={handleSaveConfig} className="bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg">Save Setup</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Follow Up Modal */}
      {isRemoveFollowUpModalOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsRemoveFollowUpModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[#2563EB] dark:text-white leading-none">Remove Follow Up</h2>
                <p className="text-[13px] font-semibold text-purple-600 dark:text-purple-400 mt-2">ID: {targetItemForRemoveFollowUp?.id}</p>
              </div>
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="text-[#5B6472] dark:text-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[14px] font-semibold text-slate-800 dark:text-white/80 block mb-3">Select Step to Reset</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Array.from({ length: stepCount }, (_, i) => i + 1).map(s => (
                    <button
                      key={s}
                      onClick={() => setRemoveFollowUpStep(s)}
                      className={`py-2 rounded-xl text-[13px] font-semibold transition-all border-2 ${removeFollowUpStep === s
                        ? "bg-purple-500 border-purple-500 text-white shadow-lg scale-110 z-10"
                        : "bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-navy-700 text-[#5B6472] dark:text-navy-600 hover:border-purple-200 dark:hover:border-purple-900"
                        }`}
                    >
                      ST {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] font-bold text-[#5B6472] dark:text-navy-600 italic line-clamp-1">
                  {globalConfigs[removeFollowUpStep - 1]?.step_name}
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[14px] font-semibold text-slate-800 dark:text-white/80 block">Removal Logic</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemoveFollowUpType('particular')}
                    className={`flex-1 py-4 px-4 rounded-2xl border-2 text-left transition-all ${removeFollowUpType === 'particular'
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/10"
                      : "border-slate-100 dark:border-navy-700 bg-white dark:bg-navy-900"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full border-2 ${removeFollowUpType === 'particular' ? "border-purple-500 bg-purple-500" : "border-slate-300 dark:border-navy-700"}`} />
                      <span className={`text-[14px] font-semibold  ${removeFollowUpType === 'particular' ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-navy-400"}`}>Particular Step</span>
                    </div>
                    <p className="text-[13px] font-bold text-[#5B6472] dark:text-navy-600 leading-tight">Only reset the selected step. Keeps planned time.</p>
                  </button>
                  <button
                    onClick={() => setRemoveFollowUpType('onwards')}
                    className={`flex-1 py-4 px-4 rounded-2xl border-2 text-left transition-all ${removeFollowUpType === 'onwards'
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/10"
                      : "border-slate-100 dark:border-navy-700 bg-white dark:bg-navy-900"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full border-2 ${removeFollowUpType === 'onwards' ? "border-purple-500 bg-purple-500" : "border-slate-300 dark:border-navy-700"}`} />
                      <span className={`text-[14px] font-semibold  ${removeFollowUpType === 'onwards' ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-navy-400"}`}>Step Onwards</span>
                    </div>
                    <p className="text-[13px] font-bold text-[#5B6472] dark:text-navy-600 leading-tight">Reset selected step & remove all future steps.</p>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#F7F8FA] dark:bg-[#FEF3C7] rounded-2xl border border-[#E5E7EB] dark:border-[#E5E7EB] flex gap-3">
                <ExclamationCircleIcon className="w-5 h-5 text-[#D97706] shrink-0" />
                <p className="text-[13px] font-bold text-[#D97706] dark:text-[#D97706] leading-relaxed">
                  This action will clear "Actual" dates and statuses for selected steps. Planned time for Step {removeFollowUpStep} will be preserved.
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-xl font-semibold text-[14px] hover:bg-slate-50 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button onClick={handleRemoveFollowUp} className="flex-1 py-3.5 bg-purple-600 dark:bg-purple-500 text-white rounded-xl font-semibold text-[14px] hover:bg-purple-700 dark:hover:bg-purple-400 transition-all shadow-lg active:scale-95">Reset Step</button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Import Modal */}
      {isOnboardImportModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOnboardImportModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300 border border-[#E5E7EB] dark:border-navy-700 overflow-hidden">
            <div className="p-5 border-b border-[#E5E7EB] dark:border-navy-800 flex justify-between items-center bg-[#2563EB] dark:bg-navy-900 text-white">
              <div>
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-[#2563EB]" /> Import To Onboard
                </h2>
                <p className="text-[#2563EB] dark:text-slate-400 font-bold text-[14px] mt-0.5">Fetch Candidate/Sales Data</p>
              </div>
              <button onClick={() => setIsOnboardImportModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6 bg-white dark:bg-navy-800/50 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-400">Select Source</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${onboardSourceModule === 'candidate' ? 'border-[#2563EB] dark:border-[#60A5FA]' : 'border-slate-300 dark:border-navy-600'}`}>
                      {onboardSourceModule === 'candidate' && <div className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />}
                    </div>
                    <input type="radio" className="hidden" checked={onboardSourceModule === 'candidate'} onChange={() => { setOnboardSourceModule('candidate'); setSelectedOnboardSourceId(""); }} />
                    <span className={`text-[14px] font-semibold  tracking-wider transition-colors ${onboardSourceModule === 'candidate' ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-slate-500 dark:text-navy-400 group-hover:text-slate-700'}`}>Candidate Selection</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${onboardSourceModule === 'sales' ? 'border-[#2563EB] dark:border-[#60A5FA]' : 'border-slate-300 dark:border-navy-600'}`}>
                      {onboardSourceModule === 'sales' && <div className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />}
                    </div>
                    <input type="radio" className="hidden" checked={onboardSourceModule === 'sales'} onChange={() => { setOnboardSourceModule('sales'); setSelectedOnboardSourceId(""); }} />
                    <span className={`text-[14px] font-semibold  tracking-wider transition-colors ${onboardSourceModule === 'sales' ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-slate-500 dark:text-navy-400 group-hover:text-slate-700'}`}>Sales Candidates</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2 relative">
                <p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-400">Select Person</p>
                {isFetchingSource ? (
                  <div className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-800 rounded-xl text-[14px] font-bold text-[#5B6472] animate-pulse">Loading list...</div>
                ) : (
                  <div className="relative">
                    <div
                      className="w-full px-4 py-3 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl flex items-center cursor-text"
                      onClick={() => setIsSourceDropdownOpen(true)}
                    >
                      <input
                        type="text"
                        placeholder="Search candidate name, phone or ID..."
                        value={isSourceDropdownOpen ? sourceSearch : (onboardSourceItems.find(it => it.id === selectedOnboardSourceId) as any)?.candidate_name || sourceSearch}
                        onChange={(e) => {
                          setSourceSearch(e.target.value);
                          setIsSourceDropdownOpen(true);
                          if (selectedOnboardSourceId) setSelectedOnboardSourceId("");
                        }}
                        onFocus={() => {
                          setIsSourceDropdownOpen(true);
                          setSourceSearch("");
                        }}
                        className="flex-1 bg-transparent outline-none text-[14px] font-bold text-gray-800 dark:text-white placeholder:text-slate-400"
                      />
                      <ChevronDownIcon className={`w-4 h-4 text-[#5B6472] transition-transform ${isSourceDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isSourceDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsSourceDropdownOpen(false)} />
                        <ul className="relative z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl p-2 custom-scrollbar">
                          {onboardSourceItems.filter((it: any) =>
                            (it.candidate_name || "").toLowerCase().includes(sourceSearch.toLowerCase()) ||
                            (it.whatsapp_number || "").includes(sourceSearch) ||
                            (it.id || "").toLowerCase().includes(sourceSearch.toLowerCase())
                          ).length === 0 ? (
                            <li className="px-4 py-3 text-[14px] text-[#5B6472] italic text-center">No results found.</li>
                          ) : (
                            onboardSourceItems.filter((it: any) =>
                              (it.candidate_name || "").toLowerCase().includes(sourceSearch.toLowerCase()) ||
                              (it.whatsapp_number || "").includes(sourceSearch) ||
                              (it.id || "").toLowerCase().includes(sourceSearch.toLowerCase())
                            ).map((it: any) => (
                              <li
                                key={it.id}
                                onClick={() => {
                                  setSelectedOnboardSourceId(it.id);
                                  setIsSourceDropdownOpen(false);
                                  setSourceSearch("");
                                }}
                                className="px-4 py-3 text-[14px] font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800 text-[#2563EB] dark:text-white rounded-lg transition-all border-b border-slate-50 dark:border-navy-800 last:border-0"
                              >
                                <div className="flex justify-between items-center">
                                  <span>{it.candidate_name || "Unknown"}</span>
                                  <span className="text-[13px] text-[#5B6472] bg-slate-100 dark:bg-navy-950 px-2 py-0.5 rounded">{it.id}</span>
                                </div>
                                <div className="text-[13px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                                  <PhoneIcon className="w-3 h-3 inline mr-1 -mt-0.5" />{it.whatsapp_number || "N/A"}
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>

              {selectedOnboardSourceId && (
                <div className="p-5 bg-slate-50 dark:bg-navy-900/50 border border-slate-100 dark:border-navy-800 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-3">
                    <UserIcon className="w-5 h-5 text-[#2563EB] dark:text-[#60A5FA]" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white tracking-tight">Candidate Details Preview</h3>
                  </div>

                  {(() => {
                    const candidate = onboardSourceItems.find(it => it.id === selectedOnboardSourceId) as any;
                    if (!candidate) return null;
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[13px] font-semibold text-[#5B6472] mb-1">Applied For</p>
                          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300">{candidate.applied_for || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#5B6472] mb-1">Total Experience</p>
                          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300">{candidate.total_experience || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#5B6472] mb-1">Expected CTC</p>
                          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300">{candidate.expected_ctc || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#5B6472] mb-1">Location</p>
                          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300">{candidate.current_living_location || "—"}</p>
                        </div>
                        {candidate.upload_updated_cv && (
                          <div className="col-span-2">
                            <a href={candidate.upload_updated_cv} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB]/10 dark:bg-[#60A5FA]/10 text-[#2563EB] dark:text-[#60A5FA] rounded-lg text-[13px] font-semibold hover:bg-[#2563EB]/20 transition-colors">
                              <DocumentTextIcon className="w-3.5 h-3.5" /> View Resume
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="pt-3 border-t border-slate-200 dark:border-navy-700 mt-2">
                    <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Ready to Import
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3 bg-[#FFFFFF] dark:bg-navy-800/80">
              <button onClick={() => setIsOnboardImportModalOpen(false)} className="px-6 py-2.5 text-[14px] font-semibold text-[#5B6472] dark:text-navy-400 hover:text-slate-600 dark:hover:text-white transition-colors">Cancel</button>
              <button onClick={handleOnboardImport} disabled={!selectedOnboardSourceId} className={`px-6 py-2.5 rounded-xl text-[14px] font-semibold   shadow-lg transition-all ${selectedOnboardSourceId ? 'bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 hover:scale-[1.02]' : 'bg-slate-200 dark:bg-navy-700 text-[#5B6472] dark:text-navy-500 cursor-not-allowed'}`}>
                Import & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modals */}
      <ConfirmModal isOpen={isConfirmOpen} title={restoreTargetId ? "Restore Record?" : cancelTargetId ? "Cancel Record?" : "Delete Record?"} message={restoreTargetId ? "This will move the record back to active state." : cancelTargetId ? "This will cancel the record. Do you want to proceed?" : "This action cannot be undone. Do you want to proceed?"} onConfirm={restoreTargetId ? handleRestoreConfirm : cancelTargetId ? handleCancelConfirm : handleDelete} onClose={() => { setIsConfirmOpen(false); setCancelTargetId(null); setRestoreTargetId(null); setPendingDeleteId(null); }} confirmLabel={restoreTargetId ? "Restore" : cancelTargetId ? "Cancel Record" : "Delete"} cancelLabel="Cancel" type={restoreTargetId ? "info" : "danger"} />

      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} />
    </div>
  );
}
