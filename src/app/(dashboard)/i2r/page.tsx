"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFindFromLink } from "@/hooks/useFindFromLink";
import { useIsPhone } from "@/hooks/useIsPhone";
import PhoneStepSelect from "@/components/PhoneStepSelect";
import { useOpenFromLink } from "@/hooks/useOpenFromLink";
import { useSession } from "next-auth/react";
import { I2R, I2RStepConfig, I2R_STEPS } from "@/types/i2r";
import { GRN } from "@/types/grn";
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
  ChevronUpIcon,
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
  CheckBadgeIcon,
  QueueListIcon,
  HashtagIcon,
  PaperClipIcon,
  LinkIcon,
  ArchiveBoxIcon
} from "@heroicons/react/24/outline";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import IMSFormModal from "@/components/IMSFormModal";
import ModuleStrip from "@/components/ModuleStrip";
import ProcessScreen from "@/components/process/ProcessScreen";
import { autoDetails, autoFacts, type ProcessConfig } from "@/components/process/process-view";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// "Name not decided yet" flow (Sahil, 2026-10-23): an indent can be raised
// before the final item name is chosen — the name is stored with a "TBD - "
// prefix. The final name must be decided within 5 days of raising the
// indent; until then the row carries a NAME PENDING badge (task owner:
// HIMANSHI), turning red once the 5-day window is crossed.
const TBD_PREFIX = "TBD - ";
const NAME_DECIDE_DAYS = 5;
function isTbdName(name?: string): boolean {
  return String(name || "").trim().toUpperCase().startsWith("TBD");
}
function tbdDaysLeft(createdAt?: string): number {
  const ts = Date.parse(createdAt || "");
  if (isNaN(ts)) return 0;
  const deadline = ts + NAME_DECIDE_DAYS * 24 * 60 * 60 * 1000;
  return Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
}

function fileLinkUrl(val?: string): string {
  if (!val || !String(val).trim()) return "";
  const s = String(val).trim();
  if (s.startsWith("http")) return s;
  return `https://drive.google.com/uc?id=${s}`;
}

const I2R_STEP_SHORT = [
  "Get Quotation",
  "Approval",
  "Finalize Vendor",
  "Received PI",
  "Check Sample",
  "Make PO",
  "Check Packing",
  "Ask For Photo/Video of Ready Stock From Vendor",
  "Deliver to Cargo",
  "Receive Form",
  "Follow Up",
];

const EMPTY_FORM: Partial<I2R> = {
  id: "", indend_num: "", item_name: "", quantity: "", category: "",
  filled_by: "", created_at: "", updated_at: "", cancelled: "",
  planned_1: "", actual_1: "", status_1: "",
  planned_2: "", actual_2: "", status_2: "",
  planned_3: "", actual_3: "", status_3: "",
  planned_4: "", actual_4: "", status_4: "",
  planned_5: "", actual_5: "", status_5: "",
  planned_6: "", actual_6: "", status_6: "",
  planned_7: "", actual_7: "", status_7: "",
  planned_8: "", actual_8: "", status_8: "",
  planned_9: "", actual_9: "", status_9: "",
  planned_10: "", actual_10: "", status_10: "",
  planned_11: "", actual_11: "", status_11: "",
  supplier_name_3: "", lead_time_acc_to_vendor_4: "", sample_pic_5: "", sample_qty_5: "", po_number_6: "", photo_video_8: "", cargo_9: "", received_qty_10: "",
};

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
          className="flex-1 min-w-[80px] bg-transparent outline-none text-[14px] font-bold text-gray-800 dark:text-white placeholder:text-gray-300 dark:placeholder:text-navy-600"
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

export default function I2RPage() {
  const { data: session } = useSession();
  const userRole: string = (session?.user as any)?.role || "User";
  const isAdmin = userRole.toUpperCase() === "ADMIN" || userRole.toUpperCase() === "EA";
  const currentUser: string = (session?.user?.name || session?.user?.email || "") as string;
  const [items, setItems] = useState<I2R[]>([]);
  const [now, setNow] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<I2R | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof I2R;
    direction: "asc" | "desc";
  } | null>({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | "all" | "completed" | "tbd">("all");
  const [formData, setFormData] = useState<Partial<I2R>>({ ...EMPTY_FORM });
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<I2RStepConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<I2RStepConfig[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [bulkToggles, setBulkToggles] = useState<Record<string, boolean>>({});
  const [bulkSupplierInputs, setBulkSupplierInputs] = useState<Record<string, string>>({});
  const [bulkLeadTimeInputs, setBulkLeadTimeInputs] = useState<Record<string, string>>({});
  const [bulkSamplePicInputs, setBulkSamplePicInputs] = useState<Record<string, string>>({});
  const [bulkPOInputs, setBulkPOInputs] = useState<Record<string, string>>({});
  const [bulkSampleFiles, setBulkSampleFiles] = useState<Record<string, File>>({});
  const [bulkSampleQtyInputs, setBulkSampleQtyInputs] = useState<Record<string, string>>({});
  const [bulkCargoInputs, setBulkCargoInputs] = useState<Record<string, string>>({});
  const [bulkReceivedQtyInputs, setBulkReceivedQtyInputs] = useState<Record<string, string>>({});
  const [bulkPhotoPicInputs, setBulkPhotoPicInputs] = useState<Record<string, string>>({});

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");
  const [layoutMode, setLayoutMode] = useState<"smart" | "standard">("smart");
  const isPhone = useIsPhone();
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  // "Open" in the work-list window lands here with ?find=INDT-xx
  useFindFromLink((t) => { setSelectedStepFilter("all"); setDateFilter(null); setViewMode("active"); setSearchTerm(t); setCurrentPage(1); });

  const [isRemoveFollowUpModalOpen, setIsRemoveFollowUpModalOpen] = useState(false);
  const [targetItemForRemoveFollowUp, setTargetItemForRemoveFollowUp] = useState<I2R | null>(null);
  const [removeFollowUpStep, setRemoveFollowUpStep] = useState(1);
  const [removeFollowUpType, setRemoveFollowUpType] = useState<'particular' | 'onwards'>('particular');

  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poFormData, setPoFormData] = useState({
    PO_Number: "",
    Qty: "",
    Country: "",
    Attach_Bill: "",
    Payment_Terms_In_days: "",
    Payment_Completed: "No",
    Item_Name: "",
    Category: "",
    filled_by: "",
    indent_id: "",
    Packed_Unpacked: ""
  });
  const [poFile, setPoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: swrItems, mutate: mutateItems } = useSWR<I2R[]>("/api/i2r", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: true,
    revalidateOnMount: true,
  });

  useSSE({ 
    modules: ['i2r'], 
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === 'i2r');
      if (updates) {
        mutateItems((current) => applyIncrementalUpdate(current, updates.upserts, updates.currentIds), false);
      }
    } 
  });

  const { data: grnData } = useSWR<{ items: GRN[] }>("/api/grn", fetcher);
  const grnItems = Array.isArray(grnData?.items) ? grnData.items : [];

  const getGRNStats = (po: string) => {
    if (!po) return null;
    const items = grnItems.filter(g => g.PO_Number === po && !g.cancelled);
    if (items.length === 0) return null;
    const totalRec = items.reduce((sum, item) => sum + (parseFloat(item.Qty) || 0), 0);
    const countries = Array.from(new Set(items.map(i => i.Country).filter(Boolean)));
    return {
      totalRec,
      country: countries.join(", "),
      count: items.length
    };
  };

  const { data: imsData } = useSWR<{ item_name: string; category: string }[]>("/api/ims", fetcher);
  // Canonical names: Busy sale register (last 6 months — the "perfect"
  // spellings) + Master catalog, via /api/item-names. These head the
  // dropdown so I2R indents use the exact same names as sales OUT.
  const { data: canonicalData } = useSWR<{ names: string[] }>("/api/item-names", fetcher, { revalidateOnFocus: false });
  const imsItems = useMemo(() => {
    const unique = new Map<string, string>();
    (imsData || []).forEach(i => { if (i.item_name) unique.set(i.item_name, i.category || ""); });
    const catByKey = new Map<string, string>();
    unique.forEach((cat, name) => catByKey.set(name.trim().toLowerCase(), cat));
    (canonicalData?.names || []).forEach(n => {
      if (n && !catByKey.has(n.trim().toLowerCase())) unique.set(n, "");
    });
    return Array.from(unique.entries()).map(([name, cat]) => ({ item_name: name, category: cat })).sort((a,b) => a.item_name.localeCompare(b.item_name));
  }, [imsData, canonicalData]);
  const canonicalNameSet = useMemo(() => new Set((canonicalData?.names || []).map(n => n.trim().toLowerCase())), [canonicalData]);

  const existingIMSCategories = useMemo(() => {
    if (!imsData) return [];
    return Array.from(new Set(imsData.map(i => i.category).filter(Boolean))).sort();
  }, [imsData]);

  const { data: usersData } = useSWR<{ username: string }[]>("/api/users", fetcher);
  const usersList: string[] = useMemo(() => (usersData || []).map((u) => u.username).filter(Boolean), [usersData]);

  const [itemNameOpen, setItemNameOpen] = useState(false);
  const [isIMSModalOpen, setIsIMSModalOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/i2r/config")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const merged = I2R_STEPS.map((step, idx) => {
            const found = data.find((c: I2RStepConfig) => c.step_name === step) || data[idx];
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

  const getActiveStep = (item: I2R): number => {
    if (item.cancelled) return -1;
    const totalSteps = 11;

    // 1) If all actuals present => completed
    let maxCompleted = 0;
    for (let i = 1; i <= totalSteps; i++) {
      const actual = (item as any)[`actual_${i}`];
      if (actual && String(actual).trim() !== "") maxCompleted = i;
    }
    if (maxCompleted >= totalSteps) return 0;

    // 2) Prefer earliest step where planned exists but actual is empty
    for (let i = 1; i <= totalSteps; i++) {
      const planned = (item as any)[`planned_${i}`];
      const actual = (item as any)[`actual_${i}`];
      if (planned && String(planned).trim() !== "" && (!actual || String(actual).trim() === "")) return i;
    }

    // 3) If no planned exists but some steps completed, return next step after last completed
    if (maxCompleted > 0) return Math.min(maxCompleted + 1, totalSteps);

    // 4) Fallback: first step with empty actual (or 1)
    for (let i = 1; i <= totalSteps; i++) {
      const actual = (item as any)[`actual_${i}`];
      if (!actual || String(actual).trim() === "") return i;
    }
    return 0;
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      list = list.filter(it => (it.indend_num || "").toLowerCase().includes(q) || (it.item_name || "").toLowerCase().includes(q));
    }
    if (viewMode === "active") list = list.filter(it => !(it.cancelled || "").trim());
    else list = list.filter(it => !!(it.cancelled || "").trim());

    if (selectedStepFilter !== "all") {
      if (selectedStepFilter === "completed") list = list.filter(it => getActiveStep(it) === 0);
      else if (selectedStepFilter === "tbd") list = list.filter(it => isTbdName(it.item_name) && !it.cancelled);
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
  }, [items, searchTerm, viewMode, layoutMode, selectedStepFilter, isAdmin, currentUser, globalConfigs, dateFilter]);

  const stepCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, completed: 0 };
    for (let i = 1; i <= 11; i++) counts[i] = 0;
    items.forEach(it => {
      if (it.cancelled) return; counts.all++;
      const s = getActiveStep(it);
      if (s === 0) counts.completed++; else if (s > 0) counts[s]++;
    });
    return counts;
  }, [items]);

  useEffect(() => { setSelectedIds(new Set()); }, [currentPage]);

  const getDateFilterCount = (f: string) => {
    const today = new Date(); today.setHours(0,0,0,0);
    return items.filter(it => {
      if (it.cancelled) return false;
      const d = it.created_at ? new Date(it.created_at) : null;
      if (!d) return false; d.setHours(0,0,0,0);
      const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
      return (f === 'Yesterday' && diff === -1) || (f === 'Today' && diff === 0) || (f === 'Tomorrow' && diff === 1);
    }).length;
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
    
    if (diffMs <= 0) {
      const absHrs = Math.abs(diffHrs);
      const absMins = Math.abs(diffMins);
      return { text: `${absHrs}h ${absMins}m Left`, color: "text-emerald-500" };
    }
    return { text: `${diffHrs}h ${diffMins}m Late`, color: "text-red-500" };
  };

  const handleCancelConfirm = async () => {
    if (!cancelTargetId) return;
    const item = items.find(r => r.id === cancelTargetId); if (!item) return;
    setCancelTargetId(null); setActionStatus("loading"); setActionMessage("Cancelling..."); setIsStatusModalOpen(true);
    const now = new Date().toISOString();
    try {
      const res = await fetch("/api/i2r", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: now, updated_at: now }) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const [bulkPhotoFiles, setBulkPhotoFiles] = useState<Record<string, File>>({});

  const openBulkModal = (only?: string[]) => {
    const ids = only ? new Set(only) : selectedIds;
    if (only) setSelectedIds(ids);
    const ts: Record<string, boolean> = {}; const ss: Record<string, string> = {}; const ls: Record<string, string> = {}; const ps: Record<string, string> = {}; const qs: Record<string, string> = {}; const os: Record<string, string> = {}; const cs: Record<string, string> = {}; const rs: Record<string, string> = {}; const pvs: Record<string, string> = {};
    ids.forEach(id => {
      const it = items.find(r => r.id === id); if (!it) return;
      ts[id] = true;
      ss[id] = it.supplier_name_3 || "";
      ls[id] = it.lead_time_acc_to_vendor_4 || "";
      ps[id] = it.sample_pic_5 || "";
      qs[id] = it.sample_qty_5 || "";
      os[id] = it.po_number_6 || "";
      pvs[id] = (it as any).photo_video_8 || "";
      cs[id] = (it as any).cargo_9 || "";
      rs[id] = (it as any).received_qty_10 || "";
    });
    setBulkToggles(ts); setBulkSupplierInputs(ss); setBulkLeadTimeInputs(ls); setBulkSamplePicInputs(ps); setBulkSampleQtyInputs(qs); setBulkPOInputs(os); setBulkCargoInputs(cs); setBulkReceivedQtyInputs(rs); setBulkPhotoPicInputs(pvs);
    setBulkPhotoFiles({});
    setBulkSampleFiles({});
    setIsBulkModalOpen(true);
  };

  const handleBulkStepSave = async () => {
    const toProc = Array.from(selectedIds).filter(id => bulkToggles[id]);
    if (!toProc.length) return;
    setActionStatus("loading"); setActionMessage("Uploading attachments..."); setIsStatusModalOpen(true); setIsBulkModalOpen(false);
    const now = new Date().toISOString(); let errors = 0;
    
    const uploadedSampleUrls: Record<string, string> = {};
    const uploadedPhotoUrls: Record<string, string> = {};
    for (const id of toProc) {
      const it = items.find(r => r.id === id); if (!it) continue;
      const n = getActiveStep(it);
      if (n === 5 && bulkSampleFiles[id]) {
        const fd = new FormData();
        fd.append("file", bulkSampleFiles[id]);
        try {
          const res = await fetch("/api/i2r/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (data.fileId) uploadedSampleUrls[id] = `https://drive.google.com/uc?id=${data.fileId}`;
        } catch (err) {
          console.error(`Upload failed for ID ${id}`, err);
          errors++;
        }
      }
      if (n === 8 && bulkPhotoFiles[id]) {
        const fd = new FormData();
        fd.append("file", bulkPhotoFiles[id]);
        try {
          const res = await fetch("/api/i2r/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (data.fileId) uploadedPhotoUrls[id] = `https://drive.google.com/uc?id=${data.fileId}`;
        } catch (err) {
          console.error(`Upload failed for Photo/Video ID ${id}`, err);
          errors++;
        }
      }
    }

    setActionMessage(`Updating ${toProc.length} records...`);
    for (const id of toProc) {
      const it = items.find(r => r.id === id); if (!it) continue;
      const n = getActiveStep(it); if (n <= 0) continue;
      const upd = { ...it } as any; upd[`actual_${n}`] = now; upd[`status_${n}`] = "Done"; upd.updated_at = now;
      if (n === 3) upd.supplier_name_3 = bulkSupplierInputs[id]; if (n === 4) upd.lead_time_acc_to_vendor_4 = bulkLeadTimeInputs[id];
      if (n === 5) {
        upd.sample_pic_5 = uploadedSampleUrls[id] || bulkSamplePicInputs[id];
        upd.sample_qty_5 = bulkSampleQtyInputs[id];
      }
      if (n === 6) upd.po_number_6 = bulkPOInputs[id];
      if (n === 7) {
        // Generate Step 8 planned time based on Actual_7 (now) + Lead_time_Acc_to_Vendor_4
        const ltStr = (upd.lead_time_acc_to_vendor_4 || "").trim();
        const leadTimeTat = ltStr ? (/^\d+(\.\d+)?$/.test(ltStr) ? `${ltStr} Days` : ltStr) : "24 Hrs";
        upd.planned_8 = calculatePlannedDate(now, leadTimeTat);
      }
      if (n === 8) {
        upd.photo_video_8 = uploadedPhotoUrls[id] || bulkPhotoPicInputs[id] || "";
      }
      if (n === 9) upd.cargo_9 = bulkCargoInputs[id];
      if (n === 10) upd.received_qty_10 = bulkReceivedQtyInputs[id];
      if (n < 11) {
        if (n !== 7) {
          // Use the next step's TAT (globalConfigs[n]) when scheduling planned_{n+1}
          upd[`planned_${n+1}`] = calculatePlannedDate(now, globalConfigs[n]?.tat || "24 Hrs");
        }
      }
      try { const r = await fetch("/api/i2r", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) }); if (!r.ok) errors++; } catch { errors++; }
    }
    setActionStatus(errors ? "error" : "success"); setActionMessage(errors ? `Failed ${errors} updates` : "All updated!");
    setTimeout(() => { setIsStatusModalOpen(false); setSelectedIds(new Set()); setBulkSampleFiles({}); setBulkSampleQtyInputs({}); setBulkPhotoFiles({}); setBulkPhotoPicInputs({}); mutateItems(); }, 2000);
  };

  const handleExport = () => {
    const headers = [
      "ID", "Indent Num", "Item Name", "Quantity", "Category", "Filled By", "Created At", "Updated At",
      "Supplier (ST3)", "Lead Time (ST4)", "Sample Pic (ST5)", "Sample Qty (ST5)", "PO Number (ST6)", "Photo/Video (ST8)", "Cargo (ST9)", "Received Qty (ST10)",
      "Country (GRN)", "Total Received (GRN)", "Remaining Qty",
      ...I2R_STEP_SHORT.flatMap((s, i) => [`ST${i+1} Planned`, `ST${i+1} Actual`, `ST${i+1} Status`]),
      "Cancelled"
    ];

    const fmtCsvDt = (iso: any) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const rows = sortedItems.map(i => {
      const stats = getGRNStats(i.po_number_6 || "");
      const rem = (parseFloat(i.quantity) || 0) - (stats?.totalRec || 0);
      
      const row = [
        i.id, i.indend_num, i.item_name, i.quantity, i.category, i.filled_by, fmtCsvDt(i.created_at), fmtCsvDt(i.updated_at),
        i.supplier_name_3, i.lead_time_acc_to_vendor_4, i.sample_pic_5, i.sample_qty_5, i.po_number_6, (i as any).photo_video_8, (i as any).cargo_9, (i as any).received_qty_10,
        stats?.country || "—", stats?.totalRec || 0, rem,
        ...Array.from({length: 11}, (_, idx) => {
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
    link.download = `i2r_full_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const openAddModal = () => { setEditingItem(null); setFormData({ ...EMPTY_FORM, filled_by: "Robotek" }); setIsModalOpen(true); };
  // "+ New" → Indent opens the form straight away (/i2r?new=1).
  useOpenFromLink("new", "1", () => openAddModal());
  const openEditModal = (item: I2R) => { setEditingItem(item); setFormData({ ...item }); setIsModalOpen(true); };
  const closeModal = () => setIsModalOpen(false);
  const handleSave = async () => {
    setActionStatus("loading"); setActionMessage("Saving..."); setIsStatusModalOpen(true);
    const now = new Date().toISOString();
    const payload = { ...formData, updated_at: now };
    if (!editingItem) { payload.created_at = now; payload.planned_1 = calculatePlannedDate(now, stepConfigs[0]?.tat || globalConfigs[0]?.tat || "24 Hrs"); }
    try {
      const res = await fetch("/api/i2r", { method: editingItem ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsModalOpen(false); mutateItems(); }, 1500);
  };

  const handleDeleteClick = (id: string) => { setPendingDeleteId(id); setIsConfirmOpen(true); };
  const performDelete = async () => {
    if (!pendingDeleteId) return;
    try { await fetch(`/api/i2r?id=${pendingDeleteId}`, { method: "DELETE" }); mutateItems(); } catch {}
  };

  const openConfigModal = () => setIsConfigModalOpen(true);
  const handleSaveConfig = async () => {
    try { await fetch("/api/i2r/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stepConfigs) }); setIsConfigModalOpen(false); } catch {}
  };

  const openRemoveFollowUpModal = (item: I2R) => {
    setTargetItemForRemoveFollowUp(item);
    setRemoveFollowUpStep(getActiveStep(item) || 10);
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
      if (startStep === 3) upd.supplier_name_3 = "";
      if (startStep === 4) upd.lead_time_acc_to_vendor_4 = "";
      if (startStep === 5) { upd.sample_pic_5 = ""; upd.sample_qty_5 = ""; }
      if (startStep === 6) upd.po_number_6 = "";
      if (startStep === 8) upd.photo_video_8 = "";
      if (startStep === 9) upd.cargo_9 = "";
      if (startStep === 10) upd.received_qty_10 = "";
    } else {
      for (let s = startStep; s <= 11; s++) {
        upd[`actual_${s}`] = "";
        upd[`status_${s}`] = "";
        if (s > startStep) upd[`planned_${s}`] = "";
        if (s === 3) upd.supplier_name_3 = "";
        if (s === 4) upd.lead_time_acc_to_vendor_4 = "";
        if (s === 5) { upd.sample_pic_5 = ""; upd.sample_qty_5 = ""; }
        if (s === 6) upd.po_number_6 = "";
        if (s === 8) upd.photo_video_8 = "";
        if (s === 9) upd.cargo_9 = "";
        if (s === 10) upd.received_qty_10 = "";
      }
    }
    upd.updated_at = now;

    try {
      const res = await fetch("/api/i2r", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsRemoveFollowUpModalOpen(false); mutateItems(); }, 1500);
  };

  const openPOModal = async (item: I2R) => {
    let initialPO = item.po_number_6 || "";
    
    // If not in I2R, fetch next global PO from server
    if (!initialPO) {
      try {
        const res = await fetch("/api/grn");
        const data = await res.json();
        if (data.nextPO) initialPO = data.nextPO;
      } catch (err) {
        console.error("Failed to fetch next PO", err);
      }
    }

    setPoFormData({
      PO_Number: initialPO,
      Qty: "",
      Country: "",
      Attach_Bill: "",
      Payment_Terms_In_days: "",
      Payment_Completed: "No",
      Item_Name: item.item_name || "",
      Category: item.category || "",
      filled_by: currentUser,
      indent_id: item.id,
      Packed_Unpacked: ""
    });
    setPoFile(null);
    setIsPOModalOpen(true);
  };

  const handlePOSubmit = async () => {
    setActionStatus("loading");
    setActionMessage("Submitting PO...");
    setIsStatusModalOpen(true);
    
    let billUrl = "";
    if (poFile) {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("file", poFile);
      try {
        const res = await fetch("/api/i2r/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.fileId) billUrl = `https://drive.google.com/uc?id=${data.fileId}`;
      } catch (err) {
        console.error("Upload failed", err);
      }
      setIsUploading(false);
    }

    try {
      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...poFormData, Attach_Bill: billUrl })
      });
      if (res.ok) {
        setActionStatus("success");
        setActionMessage("GRN Entry Created!");
        setTimeout(() => {
          setIsStatusModalOpen(false);
          setIsPOModalOpen(false);
          mutateItems();
        }, 1500);
      } else {
        const errData = await res.json().catch(() => ({}));
        setActionStatus("error");
        setActionMessage(errData.error || "Failed to submit GRN");
      }
    } catch (err) {
      setActionStatus("error");
      setActionMessage("Submission failed");
    }
  };

  // One list + window, same as O2D (Sahil, 2026-10-29). Non-admins see only
  // the work at their step (and finished ones) — same rule as before.
  const screenItems: I2R[] = isAdmin ? items : items.filter((it) => {
    if (String((it as any).cancelled || "").trim()) return false;
    const st = getActiveStep(it);
    if (st === 0) return true;
    return !!globalConfigs[st - 1]?.responsible_person?.split(",").map((x: string) => x.trim()).includes(currentUser);
  });
  const procCfg: ProcessConfig<I2R> = {
    unit: "purchase requests",
    steps: I2R_STEPS,
    doers: I2R_STEPS.map((_: unknown, i: number) => globalConfigs[i]?.responsible_person || ""),
    id: (r) => String(r.id),
    ref: (r) => String(r.indend_num || ""),
    title: (r) => String(r.item_name || ""),
    sub: (r) => String(r.category || ""),
    amount: (r) => { const v = Number(String(r.quantity || "").replace(/[^\d.]/g, "")); return v ? `${v.toLocaleString("en-IN")} pcs` : ""; },
    step: (r) => getActiveStep(r),
    planned: (r, n) => (r as any)[`planned_${n}`] || "",
    actual: (r, n) => (r as any)[`actual_${n}`] || "",
    isCancelled: (r) => !!String((r as any).cancelled || "").trim(),
    search: (r) => Object.values(r as any).filter((v) => typeof v === "string").join(" "),
    created: (r) => String(r.created_at || ""),
    stepFacts: (r, n) => autoFacts(r, n),
    details: (r) => autoDetails(r, ["indend_num","item_name","quantity","category"]),
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-2 py-0.5 shrink-0">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white">I2R</h1>
          <p className="text-[14px] text-[#5B6472]">Purchase requests (indents)</p>
        </div>

        {/* Central Pill Actions */}
        <div className="self-start flex flex-wrap items-center gap-1 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 p-0.5">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> <span>Export</span>
          </button>
          <button onClick={openConfigModal} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <Cog6ToothIcon className="w-3.5 h-3.5" /> <span>Config</span>
          </button>
          <button onClick={openAddModal} className="flex items-center gap-1.5 px-3 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <PlusIcon className="w-4 h-4 stroke-[2.5]" /> <span>New</span>
          </button>
          <div className="hidden md:block w-[1px] h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
        </div>

        {/* Layout Toggles */}
      </div>
      {/* Key figures — same numbers as the Purchase tile on the CEO home.
          Admins only: other users see just the steps they own, so
          company-wide counts would not match their list. */}
      <ModuleStrip module="i2r" adminOnly onFigure={(f) => { if (f.step !== undefined) setSelectedStepFilter(f.step); }} />

      {/* One list + window, same as O2D (Sahil, 2026-10-29) */}
      <div className="flex-1 flex overflow-hidden mt-2 px-1 min-w-0">
        <ProcessScreen
          cfg={procCfg}
          items={screenItems}
          loading={isLoading}
          initialSearch={searchTerm}
          primary={[{ label: "Update step", onClick: (r) => openBulkModal([String(r.id)]) }]}
          footer={[{ label: "Edit", onClick: (r) => openEditModal(r), show: (r) => isAdmin || getActiveStep(r) > 0 }, { label: "Remove follow-up", onClick: (r) => openRemoveFollowUpModal(r), show: (r) => isAdmin && !String((r as any).cancelled || "").trim() }]}
          menu={[{ label: "Cancel", tone: "danger", onClick: (r) => setCancelTargetId(String(r.id)), show: (r) => !String((r as any).cancelled || "").trim() && (isAdmin || getActiveStep(r) > 0) }, { label: "Delete", tone: "danger", onClick: (r) => handleDeleteClick(String(r.id)), show: () => isAdmin }]}
        />
      </div>

      {/* ─── Floating Bulk Bar ─── */}
      {false && selectedIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 bg-[#FFFFFF] dark:bg-navy-800 px-1.5 py-1.5 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.15)] flex items-center gap-4 border border-[#EFF4FF] dark:border-navy-700 z-[100] animate-in slide-in-from-bottom-12 duration-500 ring-4 ring-[#FFFFFF] dark:ring-navy-950">
          <div className="flex items-center gap-2.5 pl-3">
            <div className="w-8 h-8 bg-[#2563EB] text-white rounded-full flex items-center justify-center font-semibold text-sm shadow-sm">{selectedIds.size}</div>
            <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">Selected</p>
          </div>
          <button onClick={() => openBulkModal()} className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-2.5 rounded-full font-semibold text-[13px] hover:scale-[1.03] active:scale-95 transition-all shadow-md border-b-2 border-[#ccaa00]">
            <SparklesIcon className="w-3.5 h-3.5 stroke-[2.5]" /> BULK PROCESS
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="pr-5 text-[#5B6472] dark:text-navy-500 hover:text-[#2563EB] dark:hover:text-[#60A5FA] text-[13px] font-semibold transition-colors">Clear</button>
        </div>
      )}

      {/* New/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-white/10">
            {/* Cream Header */}
            <div className="p-6 pb-4 bg-[#FFFFFF] dark:bg-navy-950 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2563EB] dark:text-white leading-none">{editingItem ? "Edit Indent Request" : "New Indent Request"}</h2>
                <p className="text-[14px] font-semibold text-blue-600 dark:text-[#60A5FA] mt-2 flex items-center gap-2">
                  <HashtagIcon className="w-3.5 h-3.5" />
                  INDT- {editingItem?.id || (items.length + 1)}
                </p>
              </div>
              <button onClick={closeModal} className="text-[#5B6472] dark:text-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            {/* White Body */}
            <div className="p-6 pt-6 space-y-5 bg-white dark:bg-navy-900">
              <div ref={comboRef} className="relative">
                <label className="text-[14px] font-semibold text-[#5B6472] flex items-center gap-2 mb-1.5">
                  <CubeIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  Item Name <span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type="text" value={formData.item_name || ""} placeholder="Type or select item name" onFocus={() => setItemNameOpen(true)} onChange={e => { setFormData({ ...formData, item_name: e.target.value }); setItemNameOpen(true); }} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" />
                    {itemNameOpen && (
                      <ul className="absolute z-[1001] w-full mt-1 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto p-1.5">
                        {imsItems.filter(i => i.item_name.toLowerCase().includes((formData.item_name||"").toLowerCase())).map(i => (
                          <li key={i.item_name} onMouseDown={() => { setFormData({...formData, item_name: i.item_name, category: i.category }); setItemNameOpen(false); }} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-navy-800 text-sm font-bold text-slate-700 dark:text-white rounded-lg cursor-pointer transition-all">{i.item_name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => setIsIMSModalOpen(true)}
                    className="p-3 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl hover:bg-[#1D4ED8] dark:hover:bg-[#1D4ED8] transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0"
                    title="Add new item to IMS"
                  >
                    <PlusIcon className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>
                {/* Name-not-decided (TBD) + official-list warning */}
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isTbdName(formData.item_name)}
                      onChange={e => {
                        const raw = String(formData.item_name || "");
                        if (e.target.checked) {
                          if (!isTbdName(raw)) setFormData({ ...formData, item_name: TBD_PREFIX + raw });
                        } else {
                          setFormData({ ...formData, item_name: raw.replace(/^\s*TBD\s*-?\s*/i, "") });
                        }
                      }}
                      className="w-4 h-4 accent-[#2563EB]"
                    />
                    <span className="text-[13px] font-semibold text-gray-500">Name not decided yet (TBD — must be finalised within {NAME_DECIDE_DAYS} days)</span>
                  </label>
                  {!isTbdName(formData.item_name) && String(formData.item_name || "").trim() !== "" && !canonicalNameSet.has(String(formData.item_name || "").trim().toLowerCase()) && (
                    <p className="text-[13px] font-semibold text-amber-600 tracking-wide">This name is not in the official (Busy/Master) list — check the spelling, or tick TBD</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[14px] font-semibold text-[#5B6472] flex items-center gap-2 mb-1.5">
                  <QueueListIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  Quantity <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input type="text" value={formData.quantity || ""} placeholder="Enter quantity" onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" />
              </div>
              <div>
                <label className="text-[14px] font-semibold text-[#5B6472] flex items-center gap-2 mb-1.5">
                  <TagIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  Category <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input type="text" value={formData.category || ""} placeholder="Enter category" onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" />
              </div>
              <div>
                <label className="text-[14px] font-semibold text-[#5B6472] flex items-center gap-2 mb-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  Filled By
                </label>
                <input type="text" value={formData.filled_by || ""} readOnly className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900/50 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-slate-500 dark:text-navy-600 cursor-not-allowed outline-none shadow-sm" />
              </div>
            </div>

            {/* Cream Footer */}
            <div className="p-6 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
              <button onClick={closeModal} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-xl font-semibold text-[14px] hover:bg-slate-50 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl font-semibold text-[14px] hover:bg-[#1D4ED8] dark:hover:bg-[#1D4ED8] transition-all shadow-lg active:scale-95">
                {editingItem ? "Update Indent" : "Create Indent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Processor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-5xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="px-5 md:px-10 pt-6 pb-3 bg-[#FFFFFF] dark:bg-navy-800 flex items-start justify-between relative shrink-0 border-b border-slate-100 dark:border-navy-700">
              <div><h2 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white leading-none">Update step</h2><p className="text-[13px] font-semibold mt-1 text-[#5B6472] dark:text-navy-600">Processing {Array.from(selectedIds).length} selected indents</p></div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full transition-all text-[#5B6472] hover:text-slate-900 dark:hover:text-white absolute top-5 right-8"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 pt-4 space-y-3 custom-scrollbar">
              {Array.from(selectedIds).map(id => {
                const it = items.find(r => r.id === id); if (!it) return null; const n = getActiveStep(it); const t = bulkToggles[id] ?? true;
                return (
                  <div key={id} className={`p-4 md:p-5 bg-white dark:bg-navy-900 rounded-3xl border transition-all ${t ? "border-[#2563EB]/20 dark:border-[#60A5FA]/20 shadow-sm" : "border-slate-100 dark:border-navy-800 opacity-40 shadow-none grayscale"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] items-center gap-3 md:gap-8">
                      <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold border border-blue-100 dark:border-blue-900/50">ID- {it.id}</span><span className="px-2 py-0.5 bg-[#F7F8FA] dark:bg-[#FEF3C7] text-[#D97706] dark:text-[#D97706] rounded text-[13px] font-semibold border border-[#E5E7EB] dark:border-[#E5E7EB]">ST- {n}</span></div><h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white tracking-tight leading-tight truncate max-w-[200px]">{it.item_name}</h3></div>
                      <div className="flex-1">{t && (<div className="animate-in fade-in slide-in-from-left-2 duration-300">{n === 3 && (<div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Supplier Name</label><input type="text" value={bulkSupplierInputs[id]||""} onChange={e => setBulkSupplierInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" placeholder="Enter supplier..." /></div>)}{n === 4 && (<div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Lead Time</label><input type="text" value={bulkLeadTimeInputs[id]||""} onChange={e => setBulkLeadTimeInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" placeholder="Enter days/hrs..." /></div>)}{n === 5 && (
                        <div className="grid grid-cols-[1fr_120px] gap-3">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Sample Pic / Link</label>
                            <div 
                              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[#2563EB]', 'bg-yellow-50/30'); }}
                              onDragLeave={e => { e.currentTarget.classList.remove('border-[#2563EB]', 'bg-yellow-50/30'); }}
                              onDrop={e => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-[#2563EB]', 'bg-yellow-50/30');
                                const f = e.dataTransfer.files?.[0];
                                if (f) setBulkSampleFiles(p => ({ ...p, [id]: f }));
                              }}
                              className={`relative flex items-center gap-3 w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border-2 border-dashed rounded-xl transition-all ${bulkSampleFiles[id] ? "border-emerald-500 bg-emerald-50/20" : "border-slate-100 dark:border-navy-800"}`}
                            >
                              <div className="flex-1 min-w-0">
                                {bulkSampleFiles[id] ? (
                                  <p className="text-[14px] font-semibold text-emerald-600 truncate flex items-center gap-1.5"><CheckCircleIcon className="w-3.5 h-3.5" /> {bulkSampleFiles[id].name}</p>
                                ) : (
                                  <input type="text" value={bulkSamplePicInputs[id]||""} onChange={e => setBulkSamplePicInputs(p=>({...p,[id]:e.target.value}))} className="w-full bg-transparent border-none p-0 font-bold text-[14px] text-gray-900 dark:text-white outline-none placeholder:text-slate-300" placeholder="Paste URL or Drag Photo here..." />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input type="file" id={`bulk-up-${id}`} hidden onChange={e => { const f = e.target.files?.[0]; if (f) setBulkSampleFiles(p => ({ ...p, [id]: f })); }} />
                                <label htmlFor={`bulk-up-${id}`} className="p-1.5 bg-white dark:bg-navy-800 rounded-lg shadow-sm border border-slate-100 dark:border-navy-700 cursor-pointer hover:scale-105 active:scale-95 transition-all">
                                  <PhotoIcon className={`w-4 h-4 ${bulkSampleFiles[id] ? "text-emerald-500" : "text-[#5B6472]"}`} />
                                </label>
                                {bulkSampleFiles[id] && (
                                  <button onClick={() => setBulkSampleFiles(p => { const n = {...p}; delete n[id]; return n; })} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><XMarkIcon className="w-4 h-4" /></button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Sample Qty</label>
                            <input type="text" value={bulkSampleQtyInputs[id]||""} onChange={e => setBulkSampleQtyInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" placeholder="Qty..." />
                          </div>
                        </div>
                      )}{n === 6 && (<div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">PO Number</label><input type="text" value={bulkPOInputs[id]||""} onChange={e => setBulkPOInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" placeholder="Enter PO#..." /></div>)}
                      {n === 8 && (
                        <div className="grid grid-cols-[1fr_120px] gap-3">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Photo / Video</label>
                            <div
                              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[#2563EB]', 'bg-yellow-50/30'); }}
                              onDragLeave={e => { e.currentTarget.classList.remove('border-[#2563EB]', 'bg-yellow-50/30'); }}
                              onDrop={e => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-[#2563EB]', 'bg-yellow-50/30');
                                const f = e.dataTransfer.files?.[0];
                                if (f) setBulkPhotoFiles(p => ({ ...p, [id]: f }));
                              }}
                              className={`relative flex items-center gap-3 w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border-2 border-dashed rounded-xl transition-all ${bulkPhotoFiles[id] ? "border-emerald-500 bg-emerald-50/20" : "border-slate-100 dark:border-navy-800"}`}
                            >
                              <div className="flex-1 min-w-0">
                                {bulkPhotoFiles[id] ? (
                                  <p className="text-[14px] font-semibold text-emerald-600 truncate flex items-center gap-1.5"><CheckCircleIcon className="w-3.5 h-3.5" /> {bulkPhotoFiles[id].name}</p>
                                ) : (
                                  <input type="text" value={bulkPhotoPicInputs[id] || ""} onChange={e => setBulkPhotoPicInputs(p => ({ ...p, [id]: e.target.value }))} className="w-full bg-transparent border-none p-0 font-bold text-[14px] text-gray-900 dark:text-white outline-none placeholder:text-slate-300" placeholder="Paste URL or Drag Photo/Video here..." />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input type="file" id={`bulk-photo-${id}`} hidden onChange={e => { const f = e.target.files?.[0]; if (f) setBulkPhotoFiles(p => ({ ...p, [id]: f })); }} />
                                <label htmlFor={`bulk-photo-${id}`} className="p-1.5 bg-white dark:bg-navy-800 rounded-lg shadow-sm border border-slate-100 dark:border-navy-700 cursor-pointer hover:scale-105 active:scale-95 transition-all">
                                  <PhotoIcon className={`w-4 h-4 ${bulkPhotoFiles[id] ? "text-emerald-500" : "text-[#5B6472]"}`} />
                                </label>
                                {bulkPhotoFiles[id] && (
                                  <button onClick={() => setBulkPhotoFiles(p => { const n = {...p}; delete n[id]; return n; })} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><XMarkIcon className="w-4 h-4" /></button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {n === 9 && (<div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Cargo</label><select value={bulkCargoInputs[id]||""} onChange={e => setBulkCargoInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]"><option value="">Select Cargo</option><option value="Navy">Navy</option><option value="By Air">By Air</option><option value="Neelkanth">Neelkanth</option><option value="Self">Self</option></select></div>)}
                      {n === 10 && (<div className="space-y-1"><label className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600 px-1">Received Qty</label><input type="text" value={bulkReceivedQtyInputs[id]||""} onChange={e => setBulkReceivedQtyInputs(p=>({...p,[id]:e.target.value}))} className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" placeholder="Enter qty..." /></div>)}
                      {![3,4,5,6,8,9,10].includes(n) && (<p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-700 italic">Standard status update only</p>)}</div>)}</div>
                      <div className="flex items-center gap-3 pr-2"><p className={`text-[13px] font-semibold   ${t ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#5B6472] dark:text-navy-800'}`}>{t ? 'INCLUDE' : 'SKIP'}</p><button onClick={() => setBulkToggles(p => ({...p, [id]: !t}))} className={`w-10 h-5 rounded-full relative p-0.5 transition-all shadow-inner ${t ? "bg-[#2563EB] dark:bg-[#60A5FA]" : "bg-slate-200 dark:bg-navy-700"}`}><div className={`w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow-md transition-all transform duration-300 ${t ? "translate-x-5" : "translate-x-0"}`} /></button></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472] dark:text-navy-600 hover:text-slate-800 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={handleBulkStepSave} className="flex items-center gap-2.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-[#1D4ED8] dark:border-navy-950"><SparklesIcon className="w-4 h-4" /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsConfigModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-4xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="px-5 md:px-10 pt-6 pb-3 bg-[#FFFFFF] dark:bg-navy-800 flex items-start justify-between relative shrink-0">
              <div><h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">System Configuration</h2><p className="text-[13px] font-semibold mt-1 text-[#5B6472] dark:text-navy-600">Define TAT and Operators</p></div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-all text-[#5B6472] hover:text-slate-900 dark:hover:text-white absolute top-5 right-8"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 space-y-3 custom-scrollbar">
              {stepConfigs.map((cfg, i) => (
                <div key={i} className="p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-700 shadow-sm hover:shadow-md transition-all group">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_350px] items-center gap-3 md:gap-8">
                    <div className="space-y-0.5"><p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600">Step {i+1}</p><h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white tracking-tight leading-tight">{cfg.step_name}</h3></div>
                    <div className="flex flex-col gap-1.5"><div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600"><ClockIcon className="w-3 h-3" /><p className="text-[13px] font-semibold">TAT</p></div><div className="flex items-center gap-2"><div className="bg-slate-100 dark:bg-navy-900 p-0.5 rounded-full flex items-center border border-slate-200 dark:border-navy-800"><button onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Days", "Hrs"); setStepConfigs(n); }} className={`px-3 py-1 rounded-full text-[12px] font-semibold  transition-all ${cfg.tat.includes("Hrs") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>HRS</button><button onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Hrs", "Days"); setStepConfigs(n); }} className={`px-3 py-1 rounded-full text-[12px] font-semibold  transition-all ${cfg.tat.includes("Days") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472]"}`}>Days</button></div><input type="text" value={parseFloat(cfg.tat)} onChange={e => { const n = [...stepConfigs]; const unit = cfg.tat.includes("Days") ? "Days" : "Hrs"; n[i].tat = `${e.target.value} ${unit}`; setStepConfigs(n); }} className="w-12 h-8 bg-slate-50 dark:bg-navy-800 border-none rounded-lg text-center font-semibold text-[14px] text-[#2563EB] dark:text-[#60A5FA] outline-none" /></div></div>
                    <div className="flex flex-col gap-1.5"><div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600"><UserIcon className="w-3 h-3" /><p className="text-[13px] font-semibold">Responsible Operator</p></div><UserMultiCombobox value={cfg.responsible_person} isSimple onChange={val => { const n = [...stepConfigs]; n[i].responsible_person = val; setStepConfigs(n); }} users={usersList} /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472] dark:text-navy-600 hover:text-slate-800 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={handleSaveConfig} className="flex items-center gap-2.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-[#1D4ED8] dark:border-navy-950"><Cog6ToothIcon className="w-4 h-4" /> Save Configuration</button>
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
                  {Array.from({ length: I2R_STEP_SHORT.length }, (_, i) => i + 1).map(s => (
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
                <p className="mt-2 text-[13px] font-bold text-[#5B6472] dark:text-navy-600 italic">
                  {I2R_STEP_SHORT[removeFollowUpStep-1]}
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
                  This action will clear "Actual" dates and extra details (Supplier, PO, etc) for selected steps. Planned time for Step {removeFollowUpStep} will be preserved.
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

      {/* Make PO Modal */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm" onClick={() => setIsPOModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Cream Header */}
            <div className="p-6 pb-4 bg-[#FFFFFF] dark:bg-navy-950 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2563EB] dark:text-white leading-none">Make PO / GRN Entry</h2>
                <p className="text-[14px] font-semibold text-blue-600 dark:text-[#60A5FA] mt-2 flex items-center gap-2">
                   <HashtagIcon className="w-3.5 h-3.5" />
                   INDT- {poFormData.indent_id}
                </p>
              </div>
              <button onClick={() => setIsPOModalOpen(false)} className="text-[#5B6472] dark:text-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"><XMarkIcon className="w-8 h-8" /></button>
            </div>
            
            {/* White Body */}
            <div className="p-6 pt-4 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white dark:bg-navy-900">
              <div className="col-span-2 space-y-6">
                {/* Section: Basic Info */}
                <div className="space-y-4">
                  <p className="text-[13px] font-semibold text-[#2563EB] mb-1">Source Information</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] rounded-full"></div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <CubeIcon className="w-3 h-3" />
                        Item Name
                      </label>
                      <input type="text" value={poFormData.Item_Name} onChange={e => setPoFormData({...poFormData, Item_Name: e.target.value})} placeholder="Enter Item Name" className="w-full px-4 py-2.5 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <TagIcon className="w-3 h-3" />
                        Category
                      </label>
                      <input type="text" value={poFormData.Category} readOnly className="w-full px-4 py-2.5 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-[14px] text-slate-500 cursor-not-allowed outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <UserIcon className="w-3 h-3" />
                        Filled By
                      </label>
                      <input type="text" value={poFormData.filled_by} readOnly className="w-full px-4 py-2.5 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-[14px] text-slate-500 cursor-not-allowed outline-none" />
                    </div>
                  </div>
                </div>

                {/* Section: PO Details */}
                <div className="space-y-4 pt-2">
                  <p className="text-[13px] font-semibold text-[#2563EB] mb-1">PO / GRN Details</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] rounded-full"></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <HashtagIcon className="w-3 h-3" />
                        PO Number <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input type="text" value={poFormData.PO_Number} onChange={e => setPoFormData({...poFormData, PO_Number: e.target.value})} placeholder="Enter PO Number" className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <QueueListIcon className="w-3 h-3" />
                        Quantity <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input type="text" value={poFormData.Qty} onChange={e => setPoFormData({...poFormData, Qty: e.target.value})} placeholder="Enter Quantity" className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <GlobeAltIcon className="w-3 h-3" />
                        Country
                      </label>
                      <select value={poFormData.Country} onChange={e => setPoFormData({...poFormData, Country: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm cursor-pointer">
                        <option value="">Select Country</option>
                        <option value="India">India</option>
                        <option value="China">China</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <CalendarIcon className="w-3 h-3" />
                        Payment Terms (Days)
                      </label>
                      <input type="text" value={poFormData.Payment_Terms_In_days} onChange={e => setPoFormData({...poFormData, Payment_Terms_In_days: e.target.value})} placeholder="Enter Days" className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <CheckBadgeIcon className="w-3 h-3" />
                        Payment Completed
                      </label>
                      <select value={poFormData.Payment_Completed} onChange={e => setPoFormData({...poFormData, Payment_Completed: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm cursor-pointer">
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                        <option value="Partial">Partial</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                        <ArchiveBoxIcon className="w-3 h-3" />
                        Packed / Unpacked
                      </label>
                      <select value={poFormData.Packed_Unpacked} onChange={e => setPoFormData({...poFormData, Packed_Unpacked: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] focus:bg-[#FFFFFF] dark:focus:bg-zinc-900 transition-all shadow-sm cursor-pointer">
                        <option value="">Select</option>
                        <option value="Packed">Packed</option>
                        <option value="Unpacked">Unpacked</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5">
                      <PaperClipIcon className="w-3 h-3" />
                      Attach Bill
                    </label>
                    <div className="relative group">
                      <input type="file" id="po-bill" hidden onChange={e => setPoFile(e.target.files?.[0] || null)} />
                      <label htmlFor="po-bill" className="flex items-center justify-between w-full px-4 py-3 bg-[#FFFFFF] dark:bg-zinc-900/50 border-2 border-dashed border-[#E5E7EB] dark:border-zinc-800 rounded-xl font-bold text-sm text-[#5B6472] cursor-pointer group-hover:border-[#2563EB] transition-all">
                        <span className="truncate max-w-[200px]">{poFile ? poFile.name : "Choose file..."}</span>
                        <PhotoIcon className="w-5 h-5 text-[#5B6472] group-hover:text-[#2563EB]" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cream Footer */}
            <div className="p-6 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
              <button onClick={() => setIsPOModalOpen(false)} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-xl font-semibold text-[14px] hover:bg-slate-50 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button onClick={handlePOSubmit} disabled={!poFormData.PO_Number || !poFormData.Qty} className="flex-1 py-3.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl font-semibold text-[14px] hover:bg-[#1D4ED8] dark:hover:bg-[#1D4ED8] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {isUploading ? "Uploading..." : "Submit PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => { setIsConfirmOpen(false); setPendingDeleteId(null); }} onConfirm={() => { setIsConfirmOpen(false); performDelete(); }} title="Confirm Deletion" message="This action cannot be undone." confirmLabel="Delete Record" type="danger" />
      <ConfirmModal isOpen={!!cancelTargetId} onClose={() => setCancelTargetId(null)} onConfirm={handleCancelConfirm} title="Cancel Process" message="Mark as inactive?" confirmLabel="Mark Inactive" type="danger" />
      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} />
      <IMSFormModal 
        isOpen={isIMSModalOpen} 
        onClose={() => setIsIMSModalOpen(false)} 
        onSuccess={(newItem) => {
          setFormData(prev => ({
            ...prev,
            item_name: newItem.item_name,
            category: newItem.category
          }));
        }}
        existingCategories={existingIMSCategories}
      />
    </div>
  );
}
