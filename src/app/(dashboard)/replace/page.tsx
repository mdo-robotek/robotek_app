"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useIsPhone } from "@/hooks/useIsPhone";
import PhoneStepSelect from "@/components/PhoneStepSelect";
import { useSession } from "next-auth/react";
import { Replace, ReplaceStepConfig, REPLACE_STEPS } from "@/types/replace";
import useSWR from "swr";
import { useSSE } from "@/hooks/useSSE";
import { applyIncrementalUpdate } from "@/lib/utils/swr-sync";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  ClockIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  CubeIcon,
  TagIcon,
  UserIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  PhotoIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ArrowUturnLeftIcon,
  GlobeAltIcon,
  QueueListIcon,
  HashtagIcon,
  LinkIcon,
  CheckBadgeIcon
} from "@heroicons/react/24/outline";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const REPLACE_STEP_SHORT = [
  "Send Parcel To Kundli",
  "Ask And Share Detail With Gst Bill From Customer To Replacement Team",
  "Physical Checking",
  "Update Rep Detail In Google Sheet",
  "Rep. Update",
  "Detail Match And Confirmation",
  "Price Checking",
  "Share Rep Bill",
  "Call Customer And Confirm Replacement Detail"
];

const EMPTY_FORM: Partial<Replace> = {
  id: "", rn_num: "", receiver_name: "", party_name: "", num_of_parcel: "",
  parcel_photo: "", send_kundli: "", pc_remarks: "",
  created_at: "", updated_at: "", cancelled: "",
  planned_1: "", actual_1: "", status_1: "",
  planned_2: "", actual_2: "", status_2: "",
  planned_3: "", actual_3: "", status_3: "",
  planned_4: "", actual_4: "", status_4: "",
  planned_5: "", actual_5: "", status_5: "",
  planned_6: "", actual_6: "", status_6: "",
  planned_7: "", actual_7: "", status_7: "",
  planned_8: "", actual_8: "", status_8: "",
  planned_9: "", actual_9: "", status_9: "",
  total_weight_3: "", weight_image_3: "", ss_of_detail_4: "", voucher_no_5: "", voucher_image_5: "",
};

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

export default function ReplacePage() {
  const { data: session } = useSession();
  const userRole: string = (session?.user as any)?.role || "User";
  const isAdmin = userRole.toUpperCase() === "ADMIN" || userRole.toUpperCase() === "EA";
  const currentUser: string = (session?.user?.name || session?.user?.email || "") as string;
  
  const [items, setItems] = useState<Replace[]>([]);
  const [now, setNow] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Replace | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Replace;
    direction: "asc" | "desc";
  } | null>({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | "all" | "completed">("all");
  const [formData, setFormData] = useState<Partial<Replace>>({ ...EMPTY_FORM });
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<ReplaceStepConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<ReplaceStepConfig[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");
  const [layoutMode, setLayoutMode] = useState<"smart" | "standard">("smart");
  const isPhone = useIsPhone();
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  // Bulk specific states
  const [bulkToggles, setBulkToggles] = useState<Record<string, boolean>>({});
  const [bulkWeightInputs, setBulkWeightInputs] = useState<Record<string, string>>({});
  const [bulkVoucherNoInputs, setBulkVoucherNoInputs] = useState<Record<string, string>>({});
  const [bulkStepFiles, setBulkStepFiles] = useState<Record<string, File>>({});
  const [bulkStep1Choices, setBulkStep1Choices] = useState<Record<string, "Yes" | "No">>({});
  const [parcelPhotoFile, setParcelPhotoFile] = useState<File | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);

  const [isRemoveFollowUpModalOpen, setIsRemoveFollowUpModalOpen] = useState(false);
  const [targetItemForRemoveFollowUp, setTargetItemForRemoveFollowUp] = useState<Replace | null>(null);
  const [removeFollowUpStep, setRemoveFollowUpStep] = useState(1);
  const [removeFollowUpType, setRemoveFollowUpType] = useState<'particular' | 'onwards'>('particular');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: swrItems, mutate: mutateItems } = useSWR<Replace[]>("/api/replace", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: true,
    revalidateOnMount: true,
  });

  useSSE({ 
    modules: ['replace'], 
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === 'replace');
      if (updates) {
        mutateItems((current) => applyIncrementalUpdate(current, updates.upserts, updates.currentIds), false);
      }
    } 
  });

  const { data: usersData } = useSWR<{ username: string }[]>("/api/users", fetcher);
  const usersList: string[] = useMemo(() => (usersData || []).map((u) => u.username).filter(Boolean), [usersData]);

  const { data: partiesData } = useSWR<{ data: { partyName: string }[] }>("/api/party-management?limit=-1", fetcher);
  const partiesList: string[] = useMemo(() => (partiesData?.data || []).map((p) => p.partyName).filter(Boolean), [partiesData]);

  useEffect(() => {
    fetch("/api/replace/config")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const merged = REPLACE_STEPS.map((step, idx) => {
            const found = data.find((c: ReplaceStepConfig) => c.step_name === step) || data[idx];
            return { step_name: step, tat: found?.tat || "24 Hrs", responsible_person: found?.responsible_person || "" };
          });
          setGlobalConfigs(merged);
          setStepConfigs(merged);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (swrItems) { setItems(swrItems); setIsLoading(false); }
  }, [swrItems]);

  const getActiveStep = (item: Replace): number => {
    if (item.cancelled) return -1;
    
    let hasAnyPlanned = false;
    for (let i = 1; i <= 9; i++) {
      if ((item as any)[`planned_${i}`]?.trim()) {
        hasAnyPlanned = true;
        break;
      }
    }

    if (hasAnyPlanned) {
      for (let i = 1; i <= 9; i++) {
        const act = (item as any)[`actual_${i}`];
        const pl = (item as any)[`planned_${i}`];
        if ((!act || act.trim() === "") && (pl && pl.trim() !== "")) return i;
      }
      
      if ((item as any)[`actual_9`]?.trim()) return 0;

      let highestActual = 0;
      for (let i = 1; i <= 9; i++) {
        if ((item as any)[`actual_${i}`]?.trim()) highestActual = i;
      }
      return highestActual < 9 ? highestActual + 1 : 0;
    }

    for (let i = 1; i <= 9; i++) {
      const act = (item as any)[`actual_${i}`];
      if (!act || act.trim() === "") return i;
    }
    return 0;
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      list = list.filter(it => (it.rn_num || "").toLowerCase().includes(q) || (it.party_name || "").toLowerCase().includes(q) || (it.receiver_name || "").toLowerCase().includes(q));
    }
    if (viewMode === "active") list = list.filter(it => !(it.cancelled || "").trim());
    else list = list.filter(it => !!(it.cancelled || "").trim());

    if (selectedStepFilter !== "all") {
      if (selectedStepFilter === "completed") list = list.filter(it => getActiveStep(it) === 0);
      else list = list.filter(it => getActiveStep(it) === selectedStepFilter);
    }

    if (!isAdmin && viewMode === "active") {
      list = list.filter(item => {
        const step = getActiveStep(item);
        // Completed items are visible to all users (read-only actions handled in UI)
        if (step === 0) return true;
        if (step > 0) {
          const cfg = globalConfigs[step - 1];
          return cfg?.responsible_person?.split(",").map(s => s.trim()).includes(currentUser);
        }
        return false;
      });
    }

    if (dateFilter) {
      const today = new Date(); today.setHours(0,0,0,0);
      list = list.filter(item => {
        const d = item.created_at ? new Date(item.created_at) : null;
        if (!d) return false; d.setHours(0,0,0,0);
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
        return (dateFilter === 'Yesterday' && diff === -1) || (dateFilter === 'Today' && diff === 0) || (dateFilter === 'Tomorrow' && diff === 1);
      });
    }
    return list;
  }, [items, searchTerm, viewMode, selectedStepFilter, isAdmin, currentUser, globalConfigs, dateFilter]);

  const stepCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, completed: 0 };
    for (let i = 1; i <= 9; i++) counts[i] = 0;
    items.forEach(it => {
      if (it.cancelled) return; counts.all++;
      const s = getActiveStep(it);
      if (s === 0) counts.completed++; else if (s > 0) counts[s]++;
    });
    return counts;
  }, [items]);

  const calculatePlannedDate = (base: Date | string, tat: string): string => {
    let date = new Date(base); if (isNaN(date.getTime())) return "";
    const val = parseFloat(tat); const unit = tat.toLowerCase().includes("day") ? "day" : "hr";
    let mins = unit === "day" ? val * 10 * 60 : val * 60;
    while (mins > 0) {
      if (date.getDay() === 0) { date.setDate(date.getDate() + 1); date.setHours(9, 30, 0, 0); continue; }
      const cur = date.getHours() + date.getMinutes() / 60;
      if (cur >= 19.5) { date.setDate(date.getDate() + 1); date.setHours(9, 30, 0, 0); continue; }
      if (cur < 9.5) date.setHours(9, 30, 0, 0);
      const avail = (19.5 - (date.getHours() + date.getMinutes() / 60)) * 60;
      if (mins <= avail) { date.setMinutes(date.getMinutes() + mins); mins = 0; }
      else { mins -= avail; date.setDate(date.getDate() + 1); date.setHours(9, 30, 0, 0); }
    }
    return date.toISOString();
  };

  const fmtDt = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtTm = (iso: string) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

  const getDelayInfo = (pl: string, act: string | null, customNow?: Date) => {
    if (!pl) return null;
    const pD = new Date(pl);
    const aD = act ? new Date(act) : (customNow || new Date());
    const diffMs = aD.getTime() - pD.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffMs <= 0) return { text: `${Math.abs(diffHrs)}h ${Math.abs(diffMins)}m Left`, color: "text-emerald-500" };
    return { text: `${diffHrs}h ${diffMins}m Late`, color: "text-red-500" };
  };

  const handleSave = async () => {
    setActionStatus("loading"); setActionMessage("Saving..."); setIsStatusModalOpen(true);
    
    let parcelPhotoUrl = formData.parcel_photo || "";
    if (parcelPhotoFile) {
      setActionMessage("Uploading parcel photo...");
      const fd = new FormData();
      fd.append("file", parcelPhotoFile);
      try {
        const res = await fetch("/api/replace/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.fileId) parcelPhotoUrl = `https://drive.google.com/uc?id=${data.fileId}`;
      } catch (err) {
        console.error("Upload failed", err);
      }
    }

    setActionMessage("Saving record...");
    const now = new Date().toISOString();
    const payload = { ...formData, parcel_photo: parcelPhotoUrl, updated_at: now };
    if (!editingItem) { 
      payload.created_at = now; 
      if (formData.send_kundli === "No") {
        payload.planned_2 = calculatePlannedDate(now, globalConfigs[1]?.tat || "24 Hrs");
      } else {
        payload.planned_1 = calculatePlannedDate(now, globalConfigs[0]?.tat || "24 Hrs"); 
      }
    }
    try {
      const res = await fetch("/api/replace", { method: editingItem ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsModalOpen(false); setParcelPhotoFile(null); mutateItems(); }, 1500);
  };

  const openEditModal = (item: Replace) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTargetId) return;
    const item = items.find(r => r.id === cancelTargetId); if (!item) return;
    setCancelTargetId(null); setActionStatus("loading"); setActionMessage("Cancelling..."); setIsStatusModalOpen(true);
    const now = new Date().toISOString();
    try {
      const res = await fetch("/api/replace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: now, updated_at: now }) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTargetId) return;
    const item = items.find(r => r.id === restoreTargetId); if (!item) return;
    setRestoreTargetId(null); setActionStatus("loading"); setActionMessage("Restoring..."); setIsStatusModalOpen(true);
    const now = new Date().toISOString();
    try {
      const res = await fetch("/api/replace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: "", updated_at: now }) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const openRemoveFollowUpModal = (item: Replace) => {
    setTargetItemForRemoveFollowUp(item);
    setRemoveFollowUpStep(getActiveStep(item) || 9);
    setRemoveFollowUpType('particular');
    setIsRemoveFollowUpModalOpen(true);
  };

  const handleRemoveFollowUp = async () => {
    if (!targetItemForRemoveFollowUp) return;
    setActionStatus("loading"); setActionMessage("Removing Follow Up..."); setIsStatusModalOpen(true);
    const upd = { ...targetItemForRemoveFollowUp } as any;
    const now = new Date().toISOString();
    const startStep = removeFollowUpStep;

    if (removeFollowUpType === 'particular') {
      upd[`actual_${startStep}`] = "";
      upd[`status_${startStep}`] = "";
      if (startStep === 3) { upd.total_weight_3 = ""; upd.weight_image_3 = ""; }
      if (startStep === 4) upd.ss_of_detail_4 = "";
      if (startStep === 5) { upd.voucher_no_5 = ""; upd.voucher_image_5 = ""; }
    } else {
      for (let s = startStep; s <= 9; s++) {
        upd[`actual_${s}`] = "";
        upd[`status_${s}`] = "";
        if (s > startStep) upd[`planned_${s}`] = "";
        if (s === 3) { upd.total_weight_3 = ""; upd.weight_image_3 = ""; }
        if (s === 4) upd.ss_of_detail_4 = "";
        if (s === 5) { upd.voucher_no_5 = ""; upd.voucher_image_5 = ""; }
      }
    }
    upd.updated_at = now;

    try {
      const res = await fetch("/api/replace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsRemoveFollowUpModalOpen(false); mutateItems(); }, 1500);
  };

  const handleExport = () => {
    const headers = [
      "ID", "RN Num", "Receiver Name", "Party Name", "Parcels", "Parcel Photo", "Send Kundli", "PC Remarks", "Created At", "Updated At",
      "Total Weight (ST3)", "Weight Image (ST3)", "SS Detail (ST4)", "Voucher No (ST5)", "Voucher Image (ST5)",
      ...REPLACE_STEP_SHORT.flatMap((s, i) => [`ST${i+1} Planned`, `ST${i+1} Actual`, `ST${i+1} Status`]),
      "Cancelled"
    ];

    const fmtCsvDt = (iso: any) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const rows = sortedItems.map(i => {
      const row = [
        i.id, i.rn_num, i.receiver_name, i.party_name, i.num_of_parcel, i.parcel_photo, i.send_kundli, i.pc_remarks, fmtCsvDt(i.created_at), fmtCsvDt(i.updated_at),
        i.total_weight_3, i.weight_image_3, i.ss_of_detail_4, i.voucher_no_5, i.voucher_image_5,
        ...Array.from({length: 9}, (_, idx) => {
          const n = idx + 1;
          return [fmtCsvDt((i as any)[`planned_${n}`]), fmtCsvDt((i as any)[`actual_${n}`]), (i as any)[`status_${n}`]];
        }).flat(),
        fmtCsvDt(i.cancelled)
      ];
      return row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `replace_full_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const openBulkModal = () => {
    const ts: Record<string, boolean> = {}; const ws: Record<string, string> = {}; const vs: Record<string, string> = {};
    const s1: Record<string, "Yes" | "No"> = {};
    selectedIds.forEach(id => {
      const it = items.find(r => r.id === id); if (!it) return;
      ts[id] = true; ws[id] = it.total_weight_3 || ""; vs[id] = it.voucher_no_5 || "";
      s1[id] = "Yes";
    });
    setBulkToggles(ts); setBulkWeightInputs(ws); setBulkVoucherNoInputs(vs); setBulkStepFiles({});
    setBulkStep1Choices(s1);
    setIsBulkModalOpen(true);
  };

  const handleBulkStepSave = async () => {
    const toProc = Array.from(selectedIds).filter(id => bulkToggles[id]);
    if (!toProc.length) return;
    setActionStatus("loading"); setActionMessage("Processing updates..."); setIsStatusModalOpen(true); setIsBulkModalOpen(false);
    const now = new Date().toISOString(); let errors = 0;
    
    const uploadedUrls: Record<string, string> = {};
    for (const id of toProc) {
      const it = items.find(r => r.id === id); if (!it) continue;
      if (bulkStepFiles[id]) {
        const fd = new FormData(); fd.append("file", bulkStepFiles[id]);
        try {
          const res = await fetch("/api/replace/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (data.fileId) uploadedUrls[id] = `https://drive.google.com/uc?id=${data.fileId}`;
        } catch { errors++; }
      }
    }

    for (const id of toProc) {
      const it = items.find(r => r.id === id); if (!it) continue;
      const n = getActiveStep(it); if (n <= 0) continue;
      const upd = { ...it } as any; upd[`actual_${n}`] = now; upd[`status_${n}`] = "Done"; upd.updated_at = now;
      if (n === 3) { upd.total_weight_3 = bulkWeightInputs[id]; upd.weight_image_3 = uploadedUrls[id] || it.weight_image_3; }
      if (n === 4) { upd.ss_of_detail_4 = uploadedUrls[id] || it.ss_of_detail_4; }
      if (n === 5) { upd.voucher_no_5 = bulkVoucherNoInputs[id]; upd.voucher_image_5 = uploadedUrls[id] || it.voucher_image_5; }

      if (n === 1 && bulkStep1Choices[id] === "No") {
        // Skip Step 2: keep actual/status blank, clear planned_2, set planned_3
        upd[`actual_2`] = "";
        upd[`status_2`] = "";
        upd[`planned_2`] = "";
        if (n < 8) upd[`planned_3`] = calculatePlannedDate(now, globalConfigs[2].tat || "24 Hrs");
      } else {
        if (n < 9) upd[`planned_${n+1}`] = calculatePlannedDate(now, globalConfigs[n].tat || "24 Hrs");
      }

      try { await fetch("/api/replace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) }); } catch { errors++; }
    }
    setActionStatus(errors ? "error" : "success"); setActionMessage(errors ? `Finished with ${errors} errors` : "All updated!");
    setTimeout(() => { setIsStatusModalOpen(false); setSelectedIds(new Set()); mutateItems(); }, 2000);
  };

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aV = a[key] || ""; let bV = b[key] || "";
    if (aV < bV) return direction === "asc" ? -1 : 1;
    if (aV > bV) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-2 py-0.5 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#2563EB] dark:text-white tracking-tight">Replace Management</h1>
          <p className="text-[13px] font-bold text-[#5B6472] dark:text-slate-400">INWARD REPLACEMENTS — RECOVERY WORKFLOW</p>
        </div>

        <div className="self-start flex flex-wrap items-center gap-1 rounded-2xl md:rounded-full border-2 border-[#2563EB] dark:border-[#60A5FA] bg-white dark:bg-navy-900 shadow-xl p-0.5">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> <span>Export</span>
          </button>
          <button onClick={() => setIsConfigModalOpen(true)} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <Cog6ToothIcon className="w-3.5 h-3.5" /> <span>Config</span>
          </button>
          <button onClick={() => { setEditingItem(null); setFormData({...EMPTY_FORM}); setIsModalOpen(true); }} className="px-3 py-1 text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div className="hidden md:block w-[1px] h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
          <button onClick={() => setViewMode(viewMode==='cancelled'?'active':'cancelled')} className={`flex items-center gap-2 px-4 py-1 font-semibold   text-[13px] transition-all rounded-full ${viewMode==='cancelled'?'bg-red-500 text-white shadow-md':'text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800'}`}>
            <NoSymbolIcon className="w-3.5 h-3.5" /> <span>CANCELLED ({items.filter(i => !!(i.cancelled || "").trim()).length})</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-0.5 bg-slate-100 dark:bg-navy-900 rounded-full p-0.5 border border-slate-200 dark:border-navy-800 shadow-inner">
          <button onClick={() => setLayoutMode("standard")} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${layoutMode === "standard" ? "bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>Standard</button>
          <button onClick={() => setLayoutMode("smart")} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${(layoutMode === "smart" || isPhone) ? "bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>Smart View</button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden mt-1 px-1">
        {/* Sidebar */}
        <div className="w-60 hidden md:flex flex-col shrink-0 h-full overflow-y-auto custom-scrollbar border-r border-slate-100 dark:border-navy-800 pr-3 py-0.5">
          <p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-500 mb-1.5 px-2">Filters</p>
          <div className="space-y-1.5 pb-10">
            <button onClick={() => setSelectedStepFilter("all")} className={`w-full flex items-center justify-start gap-3 px-5 py-2.5 rounded-full transition-all border-b-4 ${selectedStepFilter === "all" ? "bg-[#EFF4FF] dark:bg-[#D1D5DB]/20 border-[#D1D5DB] text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400"}`}>
              <span className="font-semibold text-[14px] text-left">All Replaces</span>
            </button>
            <button onClick={() => setSelectedStepFilter("completed")} className={`w-full flex items-center justify-start gap-3 px-5 py-2.5 rounded-full transition-all border-b-4 ${selectedStepFilter === "completed" ? "bg-emerald-500 border-emerald-700 text-white shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400"}`}>
              <span className="font-semibold text-[14px] text-left">Completed</span>
              {stepCounts.completed > 0 && <span className="w-5 h-5 ml-auto flex items-center justify-center rounded-full text-[13px] font-semibold bg-white text-emerald-500">{stepCounts.completed}</span>}
            </button>
            {REPLACE_STEP_SHORT.map((name, i) => (
              <button key={i} onClick={() => setSelectedStepFilter(i+1)} className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl transition-all border border-slate-50 dark:border-navy-800 bg-white dark:bg-navy-900 ${selectedStepFilter === i+1 ? "bg-[#EFF4FF] dark:bg-[#D1D5DB]/20 border-[#D1D5DB] shadow-md" : "text-slate-500 dark:text-navy-400"}`}>
                <span className="text-[13px] font-semibold tracking-tight text-left">Step {i+1} — {name}</span>
                {stepCounts[i+1] > 0 && <span className="w-5 h-5 ml-auto shrink-0 flex items-center justify-center rounded-full text-[13px] font-semibold bg-blue-500 text-white">{stepCounts[i+1]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full py-0.5">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3 shrink-0 px-1">
            <PhoneStepSelect
              steps={REPLACE_STEP_SHORT}
              counts={REPLACE_STEP_SHORT.map((_: unknown, i: number) => stepCounts[i + 1] || 0)}
              value={selectedStepFilter}
              onChange={setSelectedStepFilter}
              allLabel="All replacements"
              completedCount={stepCounts.completed || 0}
            />
            <div className="relative group flex-1 min-w-[160px] md:max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5B6472] dark:text-navy-600" />
              <input type="text" placeholder="Search RN, Party..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-xl text-[14px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <p className="text-[13px] font-semibold text-[#5B6472] whitespace-nowrap">Page <span className="text-[#2563EB] dark:text-[#60A5FA]">{currentPage}</span> OF {totalPages||1}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage-1))} className="p-1 text-[#5B6472] hover:text-slate-800 transition-colors"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage+1))} className="p-1 text-[#5B6472] hover:text-slate-800 transition-colors"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
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
                return (
                  <div key={item.id} className="px-1">
                    <div onClick={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className={`bg-white dark:bg-navy-800 rounded-2xl border transition-all cursor-pointer overflow-hidden ${sel ? "border-[#2563EB] dark:border-[#60A5FA] border-2 shadow-lg" : "border-slate-100 dark:border-navy-700 shadow-sm"}`}>
                      <div className="p-3">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-2">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={sel} readOnly className="w-4 h-4 mt-1 rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA]" />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold border border-blue-100 dark:border-blue-900/50">{item.rn_num}</span>
                                <h3 className="text-base font-semibold text-slate-800 dark:text-white tracking-tight leading-none">{item.party_name}</h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-1.5">
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-500"><UserIcon className="w-3.5 h-3.5" /> {item.receiver_name}</span>
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-purple-500"><CubeIcon className="w-3.5 h-3.5" /> Parcels: {item.num_of_parcel}</span>
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472]"><CalendarIcon className="w-3.5 h-3.5" /> {fmtDt(item.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {step > 0 && (
                              <div className="flex items-center bg-white dark:bg-navy-800 border border-[#2563EB] rounded-full shadow-sm overflow-hidden divide-x divide-[#2563EB]/30 mr-1">
                                <div className="flex flex-col items-center justify-center px-3 py-1.5 min-w-[120px]">
                                  <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] tracking-tighter leading-none whitespace-nowrap">{fmtDt((item as any)[`planned_${step}`])} {fmtTm((item as any)[`planned_${step}`])}</p>
                                  <p className={`text-[14px] font-semibold   mt-0.5 ${getDelayInfo((item as any)[`planned_${step}`], null, now)?.color}`}>{getDelayInfo((item as any)[`planned_${step}`], null, now)?.text}</p>
                                </div>
                                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2563EB]/5 dark:bg-[#60A5FA]/10">
                                  <ClockIcon className="w-3.5 h-3.5 text-[#2563EB] stroke-[3]" />
                                  <span className="text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">STEP {step} PENDING</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-navy-800 rounded-full border border-slate-100 dark:border-navy-700 shadow-lg">
                              <button onClick={e => { e.stopPropagation(); setExpandedTiles(p => ({ ...p, [item.id]: !exp })); }} className={`p-1.5 rounded-full transition-all ${exp ? "bg-[#2563EB] text-white" : "text-[#2563EB] dark:text-[#60A5FA] hover:bg-yellow-50"}`}><ChevronDownIcon className={`w-3.5 h-3.5 stroke-[3] transition-transform ${exp ? "rotate-180" : ""}`} /></button>
                              {(isAdmin || step > 0) && (
                                <>
                                  <button onClick={e => { e.stopPropagation(); openEditModal(item); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-full transition-all" title="Edit"><PencilSquareIcon className="w-3.5 h-3.5" /></button>
                                  <button onClick={e => { e.stopPropagation(); openRemoveFollowUpModal(item); }} className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-full transition-all" title="Remove Follow Up"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>
                                  {item.cancelled ? (
                                    <button onClick={e => { e.stopPropagation(); setRestoreTargetId(item.id); }} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-full transition-all" title="Restore Process"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); setCancelTargetId(item.id); }} className="p-1.5 text-[#D97706] hover:bg-[#F7F8FA] rounded-full transition-all" title="Cancel Process"><NoSymbolIcon className="w-3.5 h-3.5" /></button>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); handleDeleteClick(item.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-all" title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-50 dark:border-navy-700 pt-3">
                          <div className="grid grid-cols-2 md:grid-cols-8 gap-3 items-start">
                            {/* Receiver */}
                            <div className="space-y-0.5">
                              <p className="text-[13px] font-semibold text-emerald-500">Receiver</p>
                              <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.receiver_name || "—"}</p>
                            </div>
                            
                            {/* Weight */}
                            <div className="space-y-0.5">
                              <p className="text-[13px] font-semibold text-[#D97706]">Weight</p>
                              <div className="flex items-center gap-1.5">
                                <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.total_weight_3 || "—"}</p>
                                {item.weight_image_3 && (
                                  <a href={item.weight_image_3} target="_blank" className="text-[#D97706] hover:scale-110 transition-all"><PhotoIcon className="w-3 h-3" /></a>
                                )}
                              </div>
                            </div>

                            {/* Voucher */}
                            <div className="space-y-0.5">
                              <p className="text-[13px] font-semibold text-rose-500">Voucher</p>
                              <div className="flex items-center gap-1.5">
                                <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.voucher_no_5 || "—"}</p>
                                {item.voucher_image_5 && (
                                  <a href={item.voucher_image_5} target="_blank" className="text-rose-500 hover:scale-110 transition-all"><PhotoIcon className="w-3 h-3" /></a>
                                )}
                              </div>
                            </div>

                            {/* Parcel Photo */}
                            <div className="space-y-0.5">
                              <p className="text-[13px] font-semibold text-blue-500">Parcel</p>
                              {item.parcel_photo ? (
                                <a href={item.parcel_photo} target="_blank" className="text-[14px] font-semibold text-blue-600 hover:underline flex items-center gap-1 whitespace-nowrap"><LinkIcon className="w-3 h-3" /> VIEW</a>
                              ) : (
                                <p className="text-[14px] font-semibold text-[#5B6472]">—</p>
                              )}
                            </div>

                            {/* SS Detail */}
                            <div className="space-y-0.5">
                              <p className="text-[13px] font-semibold text-indigo-500">Analysis</p>
                              {item.ss_of_detail_4 ? (
                                <a href={item.ss_of_detail_4} target="_blank" className="text-[14px] font-semibold text-indigo-600 hover:underline flex items-center gap-1 whitespace-nowrap"><PhotoIcon className="w-3 h-3" /> VIEW SS</a>
                              ) : (
                                <p className="text-[14px] font-semibold text-[#5B6472]">—</p>
                              )}
                            </div>

                            {/* Send Kundli */}
                            <div className="space-y-0.5 text-center">
                              <p className="text-[13px] font-semibold text-teal-500">Kundli</p>
                              <span className={`px-1.5 py-0.5 rounded text-[13px] font-semibold  inline-block ${item.send_kundli === "Yes" ? "bg-teal-50 text-teal-600 border border-teal-100" : "bg-slate-50 text-[#5B6472] border border-slate-100"}`}>
                                {item.send_kundli || "No"}
                              </span>
                            </div>

                            {/* PC Remarks */}
                            <div className="col-span-2 space-y-0.5">
                              <p className="text-[13px] font-semibold text-[#5B6472]">PC Remarks</p>
                              <p className="text-[14px] font-bold text-slate-500 dark:text-slate-400 line-clamp-1 italic truncate overflow-hidden">"{item.pc_remarks || "—"}"</p>
                            </div>
                          </div>
                        </div>

                        {exp && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 animate-in slide-in-from-top-2 duration-300">
                            {Array.from({ length: 9 }, (_, i) => {
                              const n = i + 1; const act = (item as any)[`actual_${n}`]; const pl = (item as any)[`planned_${n}`]; 
                              const done = !!act; const isPending = !done && n === getActiveStep(item);
                              const delayInfo = getDelayInfo(pl, act);
                              let statusClasses = "bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-[#5B6472]";
                              if (done) statusClasses = "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm";
                              else if (isPending) statusClasses = "bg-[#F7F8FA] dark:bg-[#FEF3C7] border-[#E5E7EB] text-[#D97706] dark:text-[#D97706] shadow-sm";
                              return (
                                <div key={n} className={`p-1.5 rounded-lg border transition-all ${statusClasses}`}>
                                  <div className="flex items-center justify-between mb-0.5"><p className={`text-[13px] font-semibold   ${done ? "text-emerald-600" : isPending ? "text-[#D97706]" : "text-[#5B6472]"}`}>ST {n}</p>{done ? <CheckCircleIcon className="w-2.5 h-2.5 text-emerald-600" /> : isPending ? <ClockIcon className="w-2.5 h-2.5 text-[#D97706] animate-pulse" /> : null}</div>
                                  <p className={`text-[14px] font-semibold leading-tight line-clamp-1 ${done ? "text-emerald-900 dark:text-emerald-200" : isPending ? "text-[#D97706] dark:text-[#D97706]" : "text-slate-600"}`}>{REPLACE_STEP_SHORT[i]}</p>
                                  <div className={`mt-0.5 space-y-0 pt-0.5 border-t ${done ? "border-emerald-100 dark:border-emerald-900/50" : "border-slate-100 dark:border-navy-700"}`}><div className="flex justify-between items-center text-[13px] font-semibold"><span className="opacity-50">Pl</span><span>{fmtDt(pl)}</span></div><div className="flex justify-between items-center text-[13px] font-semibold"><span className="opacity-50">Ac</span><span className={done ? "text-emerald-700 dark:text-emerald-400" : "opacity-30"}>{act ? fmtDt(act) : "—"}</span></div></div>
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
                      <th className="p-3 whitespace-nowrap sticky left-24 z-10 bg-[#2563EB]">RN NO.</th>
                      <th className="p-3 whitespace-nowrap">Party Name</th>
                      <th className="p-3 whitespace-nowrap">Receiver</th>
                      <th className="p-3 whitespace-nowrap">Parcels</th>
                      <th className="p-3 whitespace-nowrap">WEIGHT (ST3)</th>
                      <th className="p-3 whitespace-nowrap">VOUCHER (ST5)</th>
                      <th className="p-3 whitespace-nowrap">SS OF DETAIL (ST4)</th>
                      <th className="p-3 whitespace-nowrap">Parcel Photo</th>
                      <th className="p-3 whitespace-nowrap">Send Kundli</th>
                      <th className="p-3 whitespace-nowrap">PC Remarks</th>
                      <th className="p-3 whitespace-nowrap">Created At</th>
                      {REPLACE_STEP_SHORT.map((s, i) => <th key={i} className="p-3 whitespace-nowrap border-l border-white/10 min-w-[200px]">STEP {i+1} — {s.toUpperCase()}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                    {paginatedItems.map(it => (
                      <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-900/30 transition-all font-bold">
                        <td className="p-3 sticky left-0 z-10 bg-white dark:bg-navy-800"><input type="checkbox" checked={selectedIds.has(it.id)} onChange={() => { const n = new Set(selectedIds); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); setSelectedIds(n); }} className="rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA]" /></td>
                        <td className="p-3 sticky left-10 z-10 bg-white dark:bg-navy-800">
                          {(isAdmin || getActiveStep(it) > 0) ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditModal(it)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit"><PencilSquareIcon className="w-3.5 h-3.5" /></button>
                              <button onClick={() => openRemoveFollowUpModal(it)} className="p-1 text-purple-500 hover:bg-purple-50 rounded" title="Remove Follow Up"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>
                              {it.cancelled ? (
                                <button onClick={() => setRestoreTargetId(it.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded" title="Restore"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
                              ) : (
                                <button onClick={() => setCancelTargetId(it.id)} className="p-1 text-[#D97706] hover:bg-[#F7F8FA] rounded" title="Cancel"><NoSymbolIcon className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => handleDeleteClick(it.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <span className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600">View only</span>
                          )}
                        </td>
                        <td className="p-3 sticky left-24 z-10 bg-white dark:bg-navy-800">
                          <div className="flex flex-col">
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded border border-blue-100 dark:border-blue-900/50">{it.rn_num}</span>
                            {it.cancelled && <span className="text-[14px] text-red-500 font-semibold mt-0.5">Cancelled</span>}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-white">{it.party_name}</td>
                        <td className="p-3">{it.receiver_name}</td>
                        <td className="p-3">{it.num_of_parcel}</td>
                        <td className="p-3 text-[#D97706]">{it.total_weight_3 || "—"}</td>
                        <td className="p-3 text-rose-600">
                          <div className="flex items-center gap-1.5">
                            <span>{it.voucher_no_5 || "—"}</span>
                            {it.voucher_image_5 && <a href={it.voucher_image_5} target="_blank" className="text-rose-400 hover:text-rose-600"><PhotoIcon className="w-3 h-3" /></a>}
                          </div>
                        </td>
                        <td className="p-3">
                          {it.ss_of_detail_4 ? (
                            <a href={it.ss_of_detail_4} target="_blank" className="text-indigo-500 hover:underline flex items-center gap-1"><PhotoIcon className="w-3 h-3" /> View</a>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          {it.parcel_photo ? (
                            <a href={it.parcel_photo} target="_blank" className="text-blue-500 hover:underline flex items-center gap-1"><LinkIcon className="w-3 h-3" /> View</a>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-semibold  ${it.send_kundli === "Yes" ? "bg-teal-50 text-teal-600 border border-teal-100" : "bg-slate-50 text-[#5B6472] border border-slate-100"}`}>
                            {it.send_kundli || "No"}
                          </span>
                        </td>
                        <td className="p-3 max-w-[150px] truncate italic text-[#5B6472]" title={it.pc_remarks}>{it.pc_remarks || "—"}</td>
                        <td className="p-3 whitespace-nowrap">{fmtDt(it.created_at)}</td>
                        {Array.from({length: 9}, (_, i) => {
                          const n = i+1; const act = (it as any)[`actual_${n}`]; const pl = (it as any)[`planned_${n}`];
                          const done = !!act; const isPending = !done && n === getActiveStep(it);
                          return (
                            <td key={i} className={`p-3 border-l border-slate-50 dark:border-navy-800 ${isPending ? 'bg-[#F7F8FA] dark:bg-[#FEF3C7]' : ''}`}>
                              {pl ? (
                                <div className="space-y-1">
                                  <div className="flex justify-between gap-4 text-[13px]"><span className="text-[#5B6472] font-bold">Planned</span><span className="font-semibold text-slate-600 dark:text-white/70">{fmtDt(pl)}</span></div>
                                  <div className="flex justify-between gap-4 text-[13px]"><span className="text-[#5B6472] font-bold">Actual</span><span className={`font-semibold ${done ? 'text-emerald-500' : isPending ? 'text-[#D97706]' : 'text-[#5B6472]'}`}>{act ? fmtDt(act) : isPending ? 'Pending' : '—'}</span></div>
                                </div>
                              ) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
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

      {/* New/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-white/10">
            <div className="p-6 pb-4 bg-[#FFFFFF] dark:bg-navy-950 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2563EB] dark:text-white leading-none">{editingItem ? "Edit Replacement" : "New Replacement"}</h2>
                <p className="text-[14px] font-semibold text-blue-600 dark:text-[#60A5FA] mt-2 flex items-center gap-2"><HashtagIcon className="w-3.5 h-3.5" /> {editingItem?.rn_num || "NEW_ENTRY"}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#5B6472] hover:text-slate-900 transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6 pt-6 space-y-4 bg-white dark:bg-navy-900 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Party Name *</label>
                  <UserSingleCombobox 
                    value={formData.party_name || ""} 
                    onChange={(val) => setFormData({ ...formData, party_name: val })} 
                    users={partiesList} 
                    placeholder="Search or select party..."
                  />
                </div>
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Receiver Name *</label>
                  <UserSingleCombobox value={formData.receiver_name || ""} users={usersList} onChange={val => setFormData({ ...formData, receiver_name: val })} />
                </div>
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Num of Parcels *</label>
                  <input type="text" value={formData.num_of_parcel || ""} onChange={e => setFormData({ ...formData, num_of_parcel: e.target.value })} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" />
                </div>
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Parcel Photo</label>
                  <input type="file" onChange={e => setParcelPhotoFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-[13px] outline-none" />
                </div>
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Send Kundli</label>
                  <div className="flex items-center gap-2 bg-[#FFFFFF] dark:bg-navy-900 p-1.5 border border-[#E5E7EB] dark:border-navy-800 rounded-xl">
                    <button 
                      onClick={() => setFormData({ ...formData, send_kundli: "Yes" })}
                      className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold  transition-all ${formData.send_kundli === "Yes" ? "bg-emerald-500 text-white shadow-md" : "text-[#5B6472] hover:bg-emerald-50"}`}
                    >Yes</button>
                    <button 
                      onClick={() => setFormData({ ...formData, send_kundli: "No" })}
                      className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold  transition-all ${formData.send_kundli === "No" ? "bg-red-500 text-white shadow-md" : "text-[#5B6472] hover:bg-red-50"}`}
                    >No</button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">PC Remarks</label>
                  <textarea value={formData.pc_remarks || ""} onChange={e => setFormData({ ...formData, pc_remarks: e.target.value })} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] h-20 resize-none" />
                </div>
              </div>
            </div>
            <div className="p-6 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 rounded-xl font-semibold text-[14px]">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl font-semibold text-[14px] shadow-lg">
                {editingItem ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Processor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-5xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 md:px-10 pt-6 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-navy-700">
              <div><h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Bulk Processor</h2><p className="text-[13px] font-semibold mt-1 text-[#5B6472]">Processing {Array.from(selectedIds).length} items</p></div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-[#5B6472]"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 pt-4 space-y-3 custom-scrollbar">
              {Array.from(selectedIds).map(id => {
                const it = items.find(r => r.id === id); if (!it) return null; const n = getActiveStep(it); const t = bulkToggles[id] ?? true;
                return (
                  <div key={id} className={`p-4 md:p-5 bg-white dark:bg-navy-900 rounded-3xl border transition-all ${t ? "border-[#2563EB]/20 dark:border-[#60A5FA]/20 shadow-sm" : "opacity-40"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr_auto] items-center gap-3 md:gap-8">
                      <div><span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold">{it.rn_num}</span><h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white mt-1">{it.party_name}</h3></div>
                      <div>
                        {t && (
                          <div className="space-y-1">
                            {n === 3 && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472]">Total Weight</label><input type="text" value={bulkWeightInputs[id]||""} onChange={e => setBulkWeightInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px]" placeholder="Weight..." /></div>
                                <div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472]">Weight Image</label><input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkStepFiles(p => ({ ...p, [id]: f })); }} className="text-[13px]" /></div>
                              </div>
                            )}
                            {n === 4 && (<div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472]">Detail Screenshot</label><input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkStepFiles(p => ({ ...p, [id]: f })); }} className="text-[13px]" /></div>)}
                            {n === 5 && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472]">Voucher No</label><input type="text" value={bulkVoucherNoInputs[id]||""} onChange={e => setBulkVoucherNoInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px]" placeholder="Voucher..." /></div>
                                <div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472]">Voucher Image</label><input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkStepFiles(p => ({ ...p, [id]: f })); }} className="text-[13px]" /></div>
                              </div>
                            )}
                            {n === 1 && (
                              <div className="space-y-1.5">
                                <label className="text-[13px] font-semibold text-[#5B6472]">Continue with Verification (Step 2)?</label>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-900 p-1 rounded-xl border border-slate-100 dark:border-navy-800 max-w-[160px]">
                                  <button 
                                    onClick={() => setBulkStep1Choices(p => ({ ...p, [id]: "Yes" }))}
                                    className={`flex-1 py-1 rounded-lg text-[13px] font-semibold  transition-all ${bulkStep1Choices[id] === "Yes" ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472] hover:bg-slate-100"}`}
                                  >Yes</button>
                                  <button 
                                    onClick={() => setBulkStep1Choices(p => ({ ...p, [id]: "No" }))}
                                    className={`flex-1 py-1 rounded-lg text-[13px] font-semibold  transition-all ${bulkStep1Choices[id] === "No" ? "bg-red-500 text-white shadow-md" : "text-[#5B6472] hover:bg-red-50"}`}
                                  >No</button>
                                </div>
                              </div>
                            )}
                            {![1,3,4,5].includes(n) && <p className="text-[13px] font-semibold text-[#5B6472] italic">Update Step {n} Status Only</p>}
                            {n === 1 && <p className="text-[13px] font-bold text-[#5B6472] italic mt-1">{bulkStep1Choices[id] === "No" ? "Will skip Step 2" : "Will proceed to Step 2"}</p>}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setBulkToggles(p => ({...p, [id]: !t}))} className={`w-10 h-5 rounded-full relative p-0.5 transition-all ${t ? "bg-[#2563EB] dark:bg-[#60A5FA]" : "bg-slate-200"}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${t ? "translate-x-5" : "translate-x-0"}`} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472]">Cancel</button>
              <button onClick={handleBulkStepSave} className="bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg">Execute Bulk Update</button>
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
              <div><h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Step Configuration</h2><p className="text-[13px] font-semibold mt-1 text-[#5B6472]">Define TAT and Operators for Replace Workflow</p></div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-[#5B6472]"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 space-y-3 custom-scrollbar">
              {stepConfigs.map((cfg, i) => (
                <div key={i} className="p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-700 shadow-sm transition-all group">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_350px] items-center gap-3 md:gap-8">
                    <div className="space-y-0.5"><p className="text-[13px] font-semibold text-[#5B6472]">Step {i+1}</p><h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white leading-tight">{cfg.step_name}</h3></div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600">
                        <ClockIcon className="w-3 h-3" />
                        <p className="text-[13px] font-semibold">TAT</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 dark:bg-navy-900 p-0.5 rounded-full flex items-center border border-slate-200 dark:border-navy-800">
                          <button 
                            onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Days", "Hrs"); setStepConfigs(n); }} 
                            className={`px-3 py-1 rounded-full text-[14px] font-semibold  transition-all ${cfg.tat.includes("Hrs") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}
                          >HRS</button>
                          <button 
                            onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Hrs", "Days"); setStepConfigs(n); }} 
                            className={`px-3 py-1 rounded-full text-[14px] font-semibold  transition-all ${cfg.tat.includes("Days") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472]"}`}
                          >Days</button>
                        </div>
                        <input 
                          type="text" 
                          value={parseFloat(cfg.tat) || 0} 
                          onChange={e => { 
                            const n = [...stepConfigs]; 
                            const unit = cfg.tat.includes("Days") ? "Days" : "Hrs"; 
                            n[i].tat = `${e.target.value} ${unit}`; 
                            setStepConfigs(n); 
                          }} 
                          className="w-12 h-8 bg-slate-50 dark:bg-navy-800 border-none rounded-lg text-center font-semibold text-[14px] text-[#2563EB] dark:text-[#60A5FA] outline-none" 
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600">
                        <UserIcon className="w-3 h-3" />
                        <p className="text-[13px] font-semibold">Responsible Operator</p>
                      </div>
                      <UserMultiCombobox value={cfg.responsible_person} isSimple onChange={val => { const n = [...stepConfigs]; n[i].responsible_person = val; setStepConfigs(n); }} users={usersList} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472]">Cancel</button>
              <button onClick={async () => {
                await fetch("/api/replace/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stepConfigs) });
                setIsConfigModalOpen(false);
              }} className="bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg">Save Configuration</button>
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
                <p className="text-[13px] font-semibold text-purple-600 dark:text-purple-400 mt-2">RN: {targetItemForRemoveFollowUp?.rn_num}</p>
              </div>
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="text-[#5B6472] dark:text-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[14px] font-semibold text-slate-800 dark:text-white/80 block mb-3">Select Step to Reset</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Array.from({ length: 9 }, (_, i) => i + 1).map(s => (
                    <button
                      key={s}
                      onClick={() => setRemoveFollowUpStep(s)}
                      className={`py-2 rounded-xl text-[13px] font-semibold transition-all border-2 ${
                        removeFollowUpStep === s 
                          ? "bg-purple-500 border-purple-500 text-white shadow-lg scale-110 z-10" 
                          : "bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-navy-700 text-[#5B6472] dark:text-navy-600 hover:border-purple-200 dark:hover:border-purple-900"
                      }`}
                    >
                      ST {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] font-bold text-[#5B6472] dark:text-navy-600 italic line-clamp-1">
                  {REPLACE_STEP_SHORT[removeFollowUpStep-1]}
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[14px] font-semibold text-slate-800 dark:text-white/80 block">Removal Logic</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemoveFollowUpType('particular')}
                    className={`flex-1 py-4 px-4 rounded-2xl border-2 text-left transition-all ${
                      removeFollowUpType === 'particular'
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
                    className={`flex-1 py-4 px-4 rounded-2xl border-2 text-left transition-all ${
                      removeFollowUpType === 'onwards'
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
                  This action will clear "Actual" dates and extra details (Weight, Voucher, etc) for selected steps. Planned time for Step {removeFollowUpStep} will be preserved.
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

      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} />
      <ConfirmModal isOpen={isConfirmOpen} onClose={() => { setIsConfirmOpen(false); setPendingDeleteId(null); }} onConfirm={async () => {
        if (pendingDeleteId) { await fetch(`/api/replace?id=${pendingDeleteId}`, { method: "DELETE" }); mutateItems(); }
        setIsConfirmOpen(false);
      }} title="Confirm Deletion" message="This action cannot be undone." confirmLabel="Delete Record" type="danger" />
      <ConfirmModal isOpen={!!cancelTargetId} onClose={() => setCancelTargetId(null)} onConfirm={handleCancelConfirm} title="Cancel Process" message="Mark this replacement as inactive?" confirmLabel="Mark Inactive" type="danger" />
      <ConfirmModal isOpen={!!restoreTargetId} onClose={() => setRestoreTargetId(null)} onConfirm={handleRestoreConfirm} title="Restore Process" message="Bring this replacement back to the active workflow?" confirmLabel="Restore Entry" type="info" />
    </div>
  );
}
