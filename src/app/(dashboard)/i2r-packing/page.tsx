"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { I2RPacking, I2RPackingStepConfig, I2R_PACKING_STEPS } from "@/types/i2r-packing";
import { ItemReceivePacking } from "@/types/item-receive-packing";
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

const EMPTY_FORM: Partial<I2RPacking> = {
  id: "", ppf_num: "", packing_design: "", total_qty: "", last_suppliar: "",
  item_name: "", required_by: "",
  created_at: "", updated_at: "", cancelled: "",
  planned_1: "", actual_1: "", status_1: "",
  planned_2: "", actual_2: "", status_2: "",
  planned_3: "", actual_3: "", status_3: "", vendor_name_3: "", lead_time_3: "", pi_3: "",
  planned_4: "", actual_4: "", status_4: "", po_num_4: "",
  planned_5: "", actual_5: "", status_5: "",
  planned_6: "", actual_6: "", status_6: "",
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

export default function I2RPackingPage() {
  const { data: session } = useSession();
  const userRole: string = (session?.user as any)?.role || "User";
  const isAdmin = userRole.toUpperCase() === "ADMIN" || userRole.toUpperCase() === "EA";
  const currentUser: string = (session?.user?.name || session?.user?.email || "") as string;

  const [items, setItems] = useState<I2RPacking[]>([]);
  const [now, setNow] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<I2RPacking | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveFormData, setReceiveFormData] = useState({
    item_name: "",
    supplier_name: "",
    po_no: "",
    qty: "",
    payment_terms_in_days: "",
    payment_completed: "No"
  });
  const [receiveBillFile, setReceiveBillFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof I2RPacking;
    direction: "asc" | "desc";
  } | null>({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | "all" | "completed">("all");
  const [formData, setFormData] = useState<Partial<I2RPacking>>({ ...EMPTY_FORM });
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [piFile, setPiFile] = useState<File | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<I2RPackingStepConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<I2RPackingStepConfig[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");
  const [layoutMode, setLayoutMode] = useState<"smart" | "standard">("smart");
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  // Bulk specific states
  const [bulkToggles, setBulkToggles] = useState<Record<string, boolean>>({});
  const [bulkStepFiles, setBulkStepFiles] = useState<Record<string, File>>({});
  const [bulkVendorInputs, setBulkVendorInputs] = useState<Record<string, string>>({});
  const [bulkLeadTimeInputs, setBulkLeadTimeInputs] = useState<Record<string, string>>({});
  const [bulkPOInputs, setBulkPOInputs] = useState<Record<string, string>>({});
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);

  const [isRemoveFollowUpModalOpen, setIsRemoveFollowUpModalOpen] = useState(false);
  const [targetItemForRemoveFollowUp, setTargetItemForRemoveFollowUp] = useState<I2RPacking | null>(null);
  const [removeFollowUpStep, setRemoveFollowUpStep] = useState(1);
  const [removeFollowUpType, setRemoveFollowUpType] = useState<'particular' | 'onwards'>('particular');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: swrItems, mutate: mutateItems } = useSWR<I2RPacking[]>("/api/i2r-packing", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: true,
    revalidateOnMount: true,
  });

  const { data: receiveItemsData, mutate: mutateReceiveItems } = useSWR<ItemReceivePacking[]>("/api/item-receive-packing", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: true,
    revalidateOnMount: true,
  });

  useSSE({
    modules: ['i2r-packing', 'item-receive-packing'],
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === 'i2r-packing');
      if (updates) {
        mutateItems((current) => applyIncrementalUpdate(current, updates.upserts, updates.currentIds), false);
      }
      const recvUpdates = incremental.find(m => m.module === 'item-receive-packing');
      if (recvUpdates) {
        mutateReceiveItems((current) => applyIncrementalUpdate(current, recvUpdates.upserts, recvUpdates.currentIds), false);
      }
    }
  });

  // Helper to calculate total received and balance for a PO number
  const getPOStats = (poNum: string, totalQtyStr: string) => {
    if (!poNum || poNum.trim() === "" || poNum === "—") {
      return { totalReceived: 0, balance: 0, hasPO: false, totalQty: 0 };
    }
    const normalizedPo = poNum.trim().toLowerCase();
    let totalReceived = 0;
    if (receiveItemsData && Array.isArray(receiveItemsData)) {
      receiveItemsData.forEach(it => {
        if (!it.cancelled && it.po_no && it.po_no.trim().toLowerCase() === normalizedPo) {
          const qtyVal = parseFloat(it.qty) || 0;
          totalReceived += qtyVal;
        }
      });
    }
    const cleanedTotalQtyStr = totalQtyStr ? totalQtyStr.replace(/[^\d.]/g, "") : "";
    const totalQty = parseFloat(cleanedTotalQtyStr) || 0;
    const balance = totalQty - totalReceived;
    return { totalReceived, balance, hasPO: true, totalQty };
  };

  const { data: usersData } = useSWR<{ username: string }[]>("/api/users", fetcher);
  const usersList: string[] = useMemo(() => (usersData || []).map((u) => u.username).filter(Boolean), [usersData]);

  const { data: imsData } = useSWR<{ item_name: string }[]>("/api/ims", fetcher);
  const imsItemsList: string[] = useMemo(() => {
    const names = (imsData || []).map((i) => i.item_name).filter(Boolean);
    return Array.from(new Set(names));
  }, [imsData]);

  useEffect(() => {
    fetch("/api/i2r-packing/config")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const merged = I2R_PACKING_STEPS.map((step, idx) => {
            const found = data.find((c: I2RPackingStepConfig) => c.step_name === step) || data[idx];
            return { step_name: step, tat: found?.tat || "24 Hrs", responsible_person: found?.responsible_person || "" };
          });
          setGlobalConfigs(merged);
          setStepConfigs(merged);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (swrItems) { setItems(swrItems); setIsLoading(false); }
  }, [swrItems]);

  const getActiveStep = (item: I2RPacking): number => {
    if (item.cancelled) return -1;
    for (let i = 1; i <= 6; i++) {
      const act = (item as any)[`actual_${i}`];
      const pl = (item as any)[`planned_${i}`];
      if ((!act || act.trim() === "") && (pl && pl.trim() !== "")) return i;
    }
    for (let i = 1; i <= 6; i++) {
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
      list = list.filter(it => (it.ppf_num || "").toLowerCase().includes(q) || (it.item_name || "").toLowerCase().includes(q) || (it.packing_design || "").toLowerCase().includes(q));
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
      const today = new Date(); today.setHours(0, 0, 0, 0);
      list = list.filter(item => {
        const d = item.created_at ? new Date(item.created_at) : null;
        if (!d) return false; d.setHours(0, 0, 0, 0);
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
        return (dateFilter === 'Yesterday' && diff === -1) || (dateFilter === 'Today' && diff === 0) || (dateFilter === 'Tomorrow' && diff === 1);
      });
    }
    return list;
  }, [items, searchTerm, viewMode, selectedStepFilter, isAdmin, currentUser, globalConfigs, dateFilter]);

  const stepCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, completed: 0 };
    for (let i = 1; i <= 6; i++) counts[i] = 0;
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
    
    let uploadedPIUrl = formData.pi_3 || "";
    if (piFile) {
      const fd = new FormData(); fd.append("file", piFile);
      try {
        const res = await fetch("/api/i2r-packing/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.fileId) uploadedPIUrl = `https://drive.google.com/uc?id=${data.fileId}`;
      } catch (err) {
        console.error("PI Upload Error:", err);
      }
    }

    const now = new Date().toISOString();
    const payload = { ...formData, pi_3: uploadedPIUrl, updated_at: now };
    if (!editingItem) { 
      payload.created_at = now; 
      payload.planned_1 = calculatePlannedDate(now, globalConfigs[0].tat); 
    }
    try {
      const res = await fetch("/api/i2r-packing", { method: editingItem ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsModalOpen(false); setPiFile(null); mutateItems(); }, 1500);
  };

  const openEditModal = (item: I2RPacking) => {
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
      const res = await fetch("/api/i2r-packing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: now, updated_at: now }) });
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
      const res = await fetch("/api/i2r-packing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, cancelled: "", updated_at: now }) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
  };

  const openRemoveFollowUpModal = (item: I2RPacking) => {
    setTargetItemForRemoveFollowUp(item);
    setRemoveFollowUpStep(getActiveStep(item) || 6);
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
      if (startStep === 3) { upd.vendor_name_3 = ""; upd.lead_time_3 = ""; upd.pi_3 = ""; }
      if (startStep === 4) upd.po_num_4 = "";
    } else {
      for (let s = startStep; s <= 6; s++) {
        upd[`actual_${s}`] = "";
        upd[`status_${s}`] = "";
        if (s > startStep) upd[`planned_${s}`] = "";
        if (s === 3) { upd.vendor_name_3 = ""; upd.lead_time_3 = ""; upd.pi_3 = ""; }
        if (s === 4) upd.po_num_4 = "";
      }
    }
    upd.updated_at = now;

    try {
      const res = await fetch("/api/i2r-packing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsRemoveFollowUpModalOpen(false); mutateItems(); }, 1500);
  };

  const openReceiveModal = (item: I2RPacking) => {
    const itemName = item.item_name || "";
    const supplierName = item.vendor_name_3 || item.last_suppliar || "";
    const poNo = item.po_num_4 || "";

    setReceiveFormData({
      item_name: itemName,
      supplier_name: supplierName,
      po_no: poNo,
      qty: "",
      payment_terms_in_days: "",
      payment_completed: "No"
    });
    setReceiveBillFile(null);
    setIsReceiveModalOpen(true);
  };

  const handleSaveReceive = async () => {
    setActionStatus("loading"); setActionMessage("Saving Inward..."); setIsStatusModalOpen(true);

    let billUrl = "";
    if (receiveBillFile) {
      setActionMessage("Uploading bill attachment...");
      const fd = new FormData();
      fd.append("file", receiveBillFile);
      try {
        const res = await fetch("/api/item-receive-packing/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.fileId) billUrl = `https://drive.google.com/uc?id=${data.fileId}`;
      } catch (err) {
        console.error("Upload failed", err);
      }
    }

    setActionMessage("Saving inward record...");
    const now = new Date().toISOString();
    const payload = {
      item_name: receiveFormData.item_name,
      supplier_name: receiveFormData.supplier_name,
      po_no: receiveFormData.po_no,
      qty: receiveFormData.qty,
      attach_bill: billUrl,
      payment_completed: receiveFormData.payment_completed,
      payment_terms_in_days: receiveFormData.payment_terms_in_days,
      created_at: now,
      updated_at: now
    };

    try {
      const res = await fetch("/api/item-receive-packing", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
      });
      if (res.ok) {
        setActionStatus("success");
        setActionMessage("Inward record successfully created!");
      } else {
        setActionStatus("error");
        setActionMessage("Failed to save inward record.");
      }
    } catch { 
      setActionStatus("error"); 
      setActionMessage("Network error occurred.");
    }
    setTimeout(() => { 
      setIsStatusModalOpen(false); 
      setIsReceiveModalOpen(false); 
      setReceiveBillFile(null); 
    }, 1500);
  };

  const handleExport = () => {
    const headers = [
      "ID", "PPF Num", "Packing Design", "Total Qty", "Last Suppliar", "Item Name", "Required By", "Created At", "Updated At",
      "Vendor (ST3)", "Lead Time (ST3)", "PI (ST3)", "PO Num (ST4)",
      ...I2R_PACKING_STEPS.flatMap((s, i) => [`ST${i + 1} Planned`, `ST${i + 1} Actual`, `ST${i + 1} Status`]),
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
        i.id, i.ppf_num, i.packing_design, i.total_qty, i.last_suppliar, i.item_name, i.required_by, fmtCsvDt(i.created_at), fmtCsvDt(i.updated_at),
        i.vendor_name_3, i.lead_time_3, i.pi_3, i.po_num_4,
        ...Array.from({ length: 6 }, (_, idx) => {
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
    link.download = `i2r_packing_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const openBulkModal = () => {
    const ts: Record<string, boolean> = {};
    const v3: Record<string, string> = {};
    const lt3: Record<string, string> = {};
    const p4: Record<string, string> = {};
    selectedIds.forEach(id => {
      const it = items.find(r => r.id === id); if (!it) return;
      ts[id] = true;
      v3[id] = it.vendor_name_3 || "";
      lt3[id] = it.lead_time_3 || "";
      p4[id] = it.po_num_4 || "";
    });
    setBulkToggles(ts); setBulkVendorInputs(v3); setBulkLeadTimeInputs(lt3); setBulkPOInputs(p4); setBulkStepFiles({});
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
          const res = await fetch("/api/i2r-packing/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (data.fileId) uploadedUrls[id] = `https://drive.google.com/uc?id=${data.fileId}`;
        } catch { errors++; }
      }
    }

    for (const id of toProc) {
      const it = items.find(r => r.id === id); if (!it) continue;
      const n = getActiveStep(it); if (n <= 0) continue;
      const upd = { ...it } as any; upd[`actual_${n}`] = now; upd[`status_${n}`] = "Done"; upd.updated_at = now;

      if (n === 3) {
        upd.vendor_name_3 = bulkVendorInputs[id];
        upd.lead_time_3 = bulkLeadTimeInputs[id];
        upd.pi_3 = uploadedUrls[id] || it.pi_3;
      }
      if (n === 4) {
        upd.po_num_4 = bulkPOInputs[id];
        // Generate Step 6 planned time based on Actual_4 (now) + Lead_Time_3
        const ltStr = (upd.lead_time_3 || "").trim();
        const leadTimeTat = ltStr ? (/^\d+(\.\d+)?$/.test(ltStr) ? `${ltStr} Days` : ltStr) : "24 Hrs";
        upd.planned_6 = calculatePlannedDate(now, leadTimeTat);
      }

      if (n < 6) {
        if (n !== 5) {
          upd[`planned_${n + 1}`] = calculatePlannedDate(now, globalConfigs[n].tat || "24 Hrs");
        }
      }

      try { await fetch("/api/i2r-packing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) }); } catch { errors++; }
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
      <div className="flex items-center justify-between px-2 py-0.5 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#2563EB] dark:text-white tracking-tight">I2R Packing Management</h1>
          <p className="text-[13px] font-bold text-[#5B6472] dark:text-slate-400">PACKING WORKFLOW — DESIGN TO RECEIVE</p>
        </div>

        <div className="flex items-center gap-1 rounded-full border-2 border-[#2563EB] dark:border-[#60A5FA] bg-white dark:bg-navy-900 shadow-xl p-0.5">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> <span>Export</span>
          </button>
          <button onClick={() => setIsConfigModalOpen(true)} className="flex items-center gap-2 px-4 py-1 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <Cog6ToothIcon className="w-3.5 h-3.5" /> <span>Config</span>
          </button>
          <button onClick={() => { setEditingItem(null); setFormData({ ...EMPTY_FORM }); setIsModalOpen(true); }} className="px-3 py-1 text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div className="w-[1px] h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
          <button onClick={() => setViewMode(viewMode === 'cancelled' ? 'active' : 'cancelled')} className={`flex items-center gap-2 px-4 py-1 font-semibold   text-[13px] transition-all rounded-full ${viewMode === 'cancelled' ? 'bg-red-500 text-white shadow-md' : 'text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800'}`}>
            <NoSymbolIcon className="w-3.5 h-3.5" /> <span>CANCELLED ({items.filter(i => !!(i.cancelled || "").trim()).length})</span>
          </button>
        </div>

        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-navy-900 rounded-full p-0.5 border border-slate-200 dark:border-navy-800 shadow-inner">
          <button onClick={() => setLayoutMode("standard")} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${layoutMode === "standard" ? "bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>Standard</button>
          <button onClick={() => setLayoutMode("smart")} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${layoutMode === "smart" ? "bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>Smart View</button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden mt-1 px-1">
        {/* Sidebar */}
        <div className="w-60 flex flex-col shrink-0 h-full overflow-y-auto custom-scrollbar border-r border-slate-100 dark:border-navy-800 pr-3 py-0.5">
          <p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-500 mb-1.5 px-2">Filters</p>
          <div className="space-y-1.5 pb-10">
            <button onClick={() => setSelectedStepFilter("all")} className={`w-full flex items-center justify-start gap-3 px-5 py-2.5 rounded-full transition-all border-b-4 ${selectedStepFilter === "all" ? "bg-[#EFF4FF] dark:bg-[#D1D5DB]/20 border-[#D1D5DB] text-[#2563EB] dark:text-[#60A5FA] shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400"}`}>
              <span className="font-semibold text-[14px] text-left">All Packing</span>
            </button>
            <button onClick={() => setSelectedStepFilter("completed")} className={`w-full flex items-center justify-start gap-3 px-5 py-2.5 rounded-full transition-all border-b-4 ${selectedStepFilter === "completed" ? "bg-emerald-500 border-emerald-700 text-white shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400"}`}>
              <span className="font-semibold text-[14px] text-left">Completed</span>
              {stepCounts.completed > 0 && <span className="w-5 h-5 ml-auto flex items-center justify-center rounded-full text-[13px] font-semibold bg-white text-emerald-500">{stepCounts.completed}</span>}
            </button>
            {I2R_PACKING_STEPS.map((name, i) => (
              <button key={i} onClick={() => setSelectedStepFilter(i + 1)} className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl transition-all border border-slate-50 dark:border-navy-800 bg-white dark:bg-navy-900 ${selectedStepFilter === i + 1 ? "bg-[#EFF4FF] dark:bg-[#D1D5DB]/20 border-[#D1D5DB] shadow-md" : "text-slate-500 dark:text-navy-400"}`}>
                <span className="text-[13px] font-semibold tracking-tight text-left">Step {i + 1} — {name}</span>
                {stepCounts[i + 1] > 0 && <span className="w-5 h-5 ml-auto shrink-0 flex items-center justify-center rounded-full text-[13px] font-semibold bg-blue-500 text-white">{stepCounts[i + 1]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full py-0.5">
          <div className="flex items-center gap-3 mb-3 shrink-0 px-1">
            <div className="relative group flex-1 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5B6472] dark:text-navy-600" />
              <input type="text" placeholder="Search PPF, Item, Design..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-xl text-[14px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" />
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
            ) : layoutMode === "smart" ? (
              paginatedItems.map(item => {
                const sel = selectedIds.has(item.id); const step = getActiveStep(item); const exp = expandedTiles[item.id];
                return (
                  <div key={item.id} className="px-1">
                    <div onClick={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className={`bg-white dark:bg-navy-800 rounded-2xl border transition-all cursor-pointer overflow-hidden ${sel ? "border-[#2563EB] dark:border-[#60A5FA] border-2 shadow-lg" : "border-slate-100 dark:border-navy-700 shadow-sm"}`}>
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={sel} readOnly className="w-4 h-4 mt-1 rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA]" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold border border-blue-100 dark:border-blue-900/50">{item.ppf_num}</span>
                                <h3 className="text-base font-semibold text-slate-800 dark:text-white tracking-tight leading-none">{item.item_name}</h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-1.5">
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-500"><TagIcon className="w-3.5 h-3.5" /> {item.packing_design}</span>
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-purple-500"><CubeIcon className="w-3.5 h-3.5" /> Qty: {item.total_qty}</span>
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472]"><CalendarIcon className="w-3.5 h-3.5" /> {fmtDt(item.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
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
                                  <button onClick={e => { e.stopPropagation(); openReceiveModal(item); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-full transition-all" title="Inward Item Receive"><PlusIcon className="w-3.5 h-3.5 stroke-[3.5]" /></button>
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

                        {(() => {
                          const stats = getPOStats(item.po_num_4, item.total_qty);
                          return (
                            <div className="mt-3 border-t border-slate-50 dark:border-navy-700 pt-3">
                              <div className={`grid gap-3 items-start ${stats.hasPO ? "grid-cols-9" : "grid-cols-6"}`}>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-semibold text-emerald-500">Last Suppliar</p>
                                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.last_suppliar || "—"}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-semibold text-[#D97706]">Required By</p>
                                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.required_by || "—"}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-semibold text-blue-500">VENDOR (ST3)</p>
                                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.vendor_name_3 || "—"}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-semibold text-purple-500">LEAD TIME (ST3)</p>
                                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.lead_time_3 || "—"}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-semibold text-indigo-500">PI (ST3)</p>
                                  {item.pi_3 ? (
                                    <a href={item.pi_3} target="_blank" className="text-[14px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"><PhotoIcon className="w-3 h-3" /> VIEW PI</a>
                                  ) : <p className="text-[14px] font-semibold text-[#5B6472] tracking-tighter">—</p>}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-semibold text-rose-500">PO NUM (ST4)</p>
                                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">{item.po_num_4 || "—"}</p>
                                </div>
                                {stats.hasPO && (
                                  <>
                                    <div className="space-y-0.5">
                                      <p className="text-[13px] font-semibold text-purple-500">QTY Required</p>
                                      <p className="text-[14px] font-semibold text-purple-600 dark:text-purple-400 truncate">{item.total_qty || "0"}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-[13px] font-semibold text-emerald-500">Total Received</p>
                                      <p className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">{stats.totalReceived}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-[13px] font-semibold text-amber-500">Balance QTY</p>
                                      <p className={`text-[14px] font-semibold truncate ${stats.balance <= 0 ? "text-blue-500" : "text-amber-500"}`}>{stats.balance}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {exp && (
                          <div className="mt-3 grid grid-cols-6 gap-2 animate-in slide-in-from-top-2 duration-300">
                            {Array.from({ length: 6 }, (_, i) => {
                              const n = i + 1; const act = (item as any)[`actual_${n}`]; const pl = (item as any)[`planned_${n}`];
                              const done = !!act; const isPending = !done && n === getActiveStep(item);
                              const SHORT_NAMES = ["Brief", "Design", "Vendor", "PO Gen", "KLD Appr", "Receive"];
                              let statusClasses = "bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-[#5B6472]";
                              if (done) statusClasses = "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm";
                              else if (isPending) statusClasses = "bg-[#F7F8FA] dark:bg-[#FEF3C7] border-[#E5E7EB] text-[#D97706] dark:text-[#D97706] shadow-sm";
                              return (
                                <div key={n} className={`p-2 rounded-xl border transition-all ${statusClasses}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <p className={`text-[13px] font-semibold   ${done ? "text-emerald-600" : isPending ? "text-[#D97706]" : "text-[#5B6472]"}`}>ST {n}</p>
                                    {done ? <CheckCircleIcon className="w-3 h-3 text-emerald-600" /> : isPending ? <ClockIcon className="w-3 h-3 text-[#D97706] animate-pulse" /> : null}
                                  </div>
                                  <p className={`text-[13px] font-semibold leading-tight truncate ${done ? "text-emerald-900 dark:text-emerald-200" : isPending ? "text-[#D97706] dark:text-[#D97706]" : "text-slate-600"}`}>{SHORT_NAMES[i]}</p>
                                  <div className={`mt-1 space-y-0.5 pt-1 border-t ${done ? "border-emerald-100 dark:border-emerald-900/50" : "border-slate-100 dark:border-navy-700"}`}>
                                    <div className="flex justify-between items-center text-[13px] font-semibold"><span className="opacity-50">Pl</span><span>{fmtDt(pl)}</span></div>
                                    <div className="flex justify-between items-center text-[13px] font-semibold"><span className="opacity-50">Ac</span><span className={done ? "text-emerald-700 dark:text-emerald-400" : "opacity-30"}>{act ? fmtDt(act) : "—"}</span></div>
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
              /* Standard Table View */
              <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-xl overflow-hidden custom-scrollbar">
                <table className="w-full text-left border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-[#2563EB] dark:bg-navy-950 text-white font-semibold">
                      <th className="p-4 sticky left-0 z-20 bg-[#2563EB] w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0} 
                          onChange={() => { if (selectedIds.size === paginatedItems.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginatedItems.map(i => i.id))); }} 
                          className="w-5 h-5 rounded border-white/20 bg-transparent text-[#2563EB] focus:ring-0 cursor-pointer transition-all" 
                        />
                      </th>
                      <th className="p-4 whitespace-nowrap sticky left-10 z-20 bg-[#2563EB]">Actions</th>
                      <th className="p-4 whitespace-nowrap sticky left-[120px] z-20 bg-[#2563EB]">Ppf Num</th>
                      <th className="p-4 whitespace-nowrap min-w-[200px]">Item Name</th>
                      <th className="p-4 whitespace-nowrap min-w-[150px]">Design</th>
                      <th className="p-4 whitespace-nowrap">QTY</th>
                      <th className="p-4 whitespace-nowrap text-emerald-300">Received QTY</th>
                      <th className="p-4 whitespace-nowrap text-amber-300">Balance QTY</th>
                      <th className="p-4 whitespace-nowrap min-w-[150px]">Last Suppliar</th>
                      <th className="p-4 whitespace-nowrap min-w-[120px]">Required By</th>
                      <th className="p-4 whitespace-nowrap min-w-[150px] text-blue-300">VENDOR (ST3)</th>
                      <th className="p-4 whitespace-nowrap min-w-[120px] text-purple-300">LEAD TIME (ST3)</th>
                      <th className="p-4 whitespace-nowrap min-w-[100px] text-indigo-300">PI (ST3)</th>
                      <th className="p-4 whitespace-nowrap min-w-[120px] text-rose-300">PO NUM (ST4)</th>
                      <th className="p-4 whitespace-nowrap min-w-[120px]">Created At</th>
                      {I2R_PACKING_STEPS.map((s, i) => (
                        <th key={i} className="p-4 whitespace-nowrap border-l border-white/10 min-w-[220px]">STEP {i+1} — {s.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-navy-800">
                    {paginatedItems.map(item => {
                      const step = getActiveStep(item);
                      const isCancelled = !!item.cancelled;
                      return (
                        <tr key={item.id} className="hover:bg-[#FFFFFF]/50 dark:hover:bg-navy-800/50 transition-all group font-bold">
                          <td className="p-4 sticky left-0 z-10 bg-white dark:bg-navy-900 group-hover:bg-[#FFFFFF] dark:group-hover:bg-navy-800 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.has(item.id)} 
                              onChange={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} 
                              className="w-5 h-5 rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA] focus:ring-0 cursor-pointer transition-all" 
                            />
                          </td>
                          <td className="p-4 sticky left-10 z-10 bg-white dark:bg-navy-900 group-hover:bg-[#FFFFFF] dark:group-hover:bg-navy-800 transition-colors">
                            {(isAdmin || step > 0) ? (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => openReceiveModal(item)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 rounded-lg transition-all" title="Inward Item Receive"><PlusIcon className="w-4 h-4 stroke-[3]" /></button>
                                <button onClick={() => openEditModal(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-all" title="Edit"><PencilSquareIcon className="w-4 h-4" /></button>
                                <button onClick={() => openRemoveFollowUpModal(item)} className="p-1.5 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/40 rounded-lg transition-all" title="Remove Follow Up"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                                {item.cancelled ? (
                                  <button onClick={() => setRestoreTargetId(item.id)} className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 rounded-lg transition-all" title="Restore"><ArrowPathIcon className="w-4 h-4" /></button>
                                ) : (
                                  <button onClick={() => setCancelTargetId(item.id)} className="p-1.5 text-[#D97706] hover:bg-[#F7F8FA] dark:hover:bg-[#FEF3C7] rounded-lg transition-all" title="Cancel"><NoSymbolIcon className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => handleDeleteClick(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <span className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600">View only</span>
                            )}
                          </td>
                          <td className="p-4 sticky left-[120px] z-10 bg-white dark:bg-navy-900 group-hover:bg-[#FFFFFF] dark:group-hover:bg-navy-800 transition-colors">
                            <div className="flex flex-col">
                              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900/50 text-[13px] font-semibold italic tracking-tighter">{item.ppf_num}</span>
                              {isCancelled && <span className="text-[14px] font-semibold text-red-500 mt-1 ml-1">Cancelled</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <CubeIcon className="w-3.5 h-3.5 text-blue-500" />
                              </div>
                              <span className="text-slate-800 dark:text-white truncate">{item.item_name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-navy-300 truncate">{item.packing_design || "—"}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg font-semibold text-[14px] text-center w-max">{item.total_qty || "0"}</span>
                          </td>
                          <td className="p-4">
                            {(() => {
                              const stats = getPOStats(item.po_num_4, item.total_qty);
                              return (
                                <span className={`px-2.5 py-1 rounded-lg font-semibold text-[14px] whitespace-nowrap ${stats.hasPO ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "text-[#5B6472] dark:text-slate-700"}`}>
                                  {stats.hasPO ? stats.totalReceived : "—"}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-4">
                            {(() => {
                              const stats = getPOStats(item.po_num_4, item.total_qty);
                              return (
                                <span className={`px-2.5 py-1 rounded-lg font-semibold text-[14px] whitespace-nowrap ${
                                  stats.hasPO 
                                    ? stats.balance <= 0 
                                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" 
                                    : "text-[#5B6472] dark:text-slate-700"
                                }`}>
                                  {stats.hasPO ? stats.balance : "—"}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-4 text-emerald-600 dark:text-emerald-400 truncate">{item.last_suppliar || "—"}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-navy-400">
                              <UserIcon className="w-3.5 h-3.5 opacity-50" />
                              <span className="">{item.required_by || "Admin"}</span>
                            </div>
                          </td>
                          <td className="p-4 text-blue-600 font-bold truncate">{item.vendor_name_3 || "—"}</td>
                          <td className="p-4 text-purple-600 font-bold truncate">{item.lead_time_3 || "—"}</td>
                          <td className="p-4">
                            {item.pi_3 ? (
                              <a href={item.pi_3} target="_blank" className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"><PhotoIcon className="w-3.5 h-3.5" /> PI</a>
                            ) : "—"}
                          </td>
                          <td className="p-4 text-rose-600 font-bold truncate">{item.po_num_4 || "—"}</td>
                          <td className="p-4 text-[#5B6472] font-bold whitespace-nowrap">{fmtDt(item.created_at)}</td>
                          {Array.from({length: 6}, (_, idx) => {
                            const n = idx + 1;
                            const act = (item as any)[`actual_${n}`];
                            const pl = (item as any)[`planned_${n}`];
                            const done = !!act;
                            const isPending = !done && n === step;
                            return (
                              <td key={idx} className={`p-4 border-l border-slate-50 dark:border-navy-800/50 ${isPending ? 'bg-[#F7F8FA] dark:bg-[#FEF3C7]' : ''}`}>
                                {pl ? (
                                  <div className="space-y-1.5 min-w-[150px]">
                                    <div className="flex justify-between items-center gap-4 text-[13px] tracking-tighter">
                                      <span className="text-[#5B6472] font-bold">Planned</span>
                                      <span className="font-semibold text-slate-600 dark:text-white/70">{fmtDt(pl)}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4 text-[13px] tracking-tighter">
                                      <span className="text-[#5B6472] font-bold">Actual</span>
                                      <span className={`font-semibold ${done ? 'text-emerald-500' : isPending ? 'text-[#D97706] animate-pulse' : 'text-[#5B6472]'}`}>
                                        {act ? fmtDt(act) : isPending ? 'Pending' : '—'}
                                      </span>
                                    </div>
                                  </div>
                                ) : "—"}
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
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#FFFFFF] dark:bg-navy-800 px-1.5 py-1.5 rounded-full shadow-2xl flex items-center gap-4 border border-[#EFF4FF] dark:border-navy-700 z-[100] animate-in slide-in-from-bottom-12">
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

      {/* 1. Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-white/10">
            <div className="p-6 pb-4 bg-[#FFFFFF] dark:bg-navy-950 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2563EB] dark:text-white leading-none">{editingItem ? "Edit Packing Record" : "New Packing Record"}</h2>
                <p className="text-[14px] font-semibold text-blue-600 dark:text-[#60A5FA] mt-2 flex items-center gap-2"><HashtagIcon className="w-3.5 h-3.5" /> {editingItem?.ppf_num || "NEW_ENTRY"}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#5B6472] hover:text-slate-900 transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="p-6 pt-6 space-y-4 bg-white dark:bg-navy-900 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 flex items-center gap-2 px-1">
                    <CubeIcon className="w-3.5 h-3.5 text-blue-500" /> Item Name *
                  </label>
                  <UserSingleCombobox
                    value={formData.item_name || ""}
                    onChange={val => setFormData({ ...formData, item_name: val })}
                    users={imsItemsList}
                    placeholder="Search or type new item name..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 flex items-center gap-2 px-1">
                    <TagIcon className="w-3.5 h-3.5 text-purple-500" /> Packing Design
                  </label>
                  <div className="relative group">
                    <input type="text" value={formData.packing_design} onChange={e => setFormData({ ...formData, packing_design: e.target.value })} className="w-full px-5 py-3.5 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-2xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" placeholder="Enter design details..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 flex items-center gap-2 px-1">
                    <QueueListIcon className="w-3.5 h-3.5 text-emerald-500" /> Total Qty
                  </label>
                  <input type="text" value={formData.total_qty} onChange={e => setFormData({ ...formData, total_qty: e.target.value })} className="w-full px-5 py-3.5 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-2xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" placeholder="Ex: 500 Pcs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 flex items-center gap-2 px-1">
                    <BuildingOfficeIcon className="w-3.5 h-3.5 text-[#D97706]" /> Last Suppliar
                  </label>
                  <input type="text" value={formData.last_suppliar} onChange={e => setFormData({ ...formData, last_suppliar: e.target.value })} className="w-full px-5 py-3.5 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-2xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" placeholder="Previous vendor..." />
                </div>
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 flex items-center gap-2 px-1">
                    <UserIcon className="w-3.5 h-3.5 text-blue-600" /> Required By
                  </label>
                  <UserSingleCombobox
                    value={formData.required_by || ""}
                    onChange={val => setFormData({ ...formData, required_by: val })}
                    users={usersList}
                    placeholder="Search or select user..."
                  />
                </div>
              </div>
            </div>

            <div className="p-6 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 rounded-xl font-semibold text-[14px]">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl font-semibold text-[14px] shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                {editingItem ? "Update Packing" : "Create Packing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Receive Inward Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm" onClick={() => setIsReceiveModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
            <div className="p-6 pb-4 bg-[#FFFFFF] dark:bg-navy-955 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2563EB] dark:text-white leading-none">Inward Item Receive</h2>
                <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-2">
                  <PlusIcon className="w-3.5 h-3.5" /> Submit to Inward Workflow
                </p>
              </div>
              <button onClick={() => setIsReceiveModalOpen(false)} className="text-[#5B6472] hover:text-slate-900 transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 pt-6 space-y-4 bg-white dark:bg-navy-900 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Item Name (Read Only)</label>
                  <input 
                    type="text" 
                    value={receiveFormData.item_name} 
                    readOnly 
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none" 
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Supplier Name (Read Only)</label>
                  <input 
                    type="text" 
                    value={receiveFormData.supplier_name} 
                    readOnly 
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none" 
                  />
                </div>
                
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">
                    {receiveFormData.po_no ? "PO No. (Read Only)" : "PO No. *"}
                  </label>
                  <input 
                    type="text" 
                    value={receiveFormData.po_no} 
                    onChange={e => setReceiveFormData({ ...receiveFormData, po_no: e.target.value })} 
                    readOnly={!!receiveFormData.po_no}
                    className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none transition-all ${
                      receiveFormData.po_no 
                        ? "bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-slate-500 dark:text-slate-400 cursor-not-allowed" 
                        : "bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 focus:border-[#2563EB] dark:focus:border-[#60A5FA]"
                    }`}
                  />
                </div>
                
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Qty *</label>
                  <input 
                    type="text" 
                    value={receiveFormData.qty} 
                    onChange={e => setReceiveFormData({ ...receiveFormData, qty: e.target.value })} 
                    className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" 
                    placeholder="Enter manual quantity..."
                  />
                </div>
                
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Attach Bill</label>
                  <input 
                    type="file" 
                    onChange={e => setReceiveBillFile(e.target.files?.[0] || null)} 
                    className="w-full px-4 py-2 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-[13px] outline-none" 
                  />
                </div>
                
                <div>
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Payment Terms (In Days)</label>
                  <input 
                    type="text" 
                    value={receiveFormData.payment_terms_in_days} 
                    onChange={e => setReceiveFormData({ ...receiveFormData, payment_terms_in_days: e.target.value })} 
                    className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA]" 
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-[14px] font-semibold text-[#5B6472] mb-1.5 block">Payment Completed</label>
                  <div className="flex items-center gap-2 bg-[#FFFFFF] dark:bg-navy-900 p-1.5 border border-[#E5E7EB] dark:border-navy-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setReceiveFormData({ ...receiveFormData, payment_completed: "Yes" })}
                      className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold  transition-all ${receiveFormData.payment_completed === "Yes" ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472] hover:bg-slate-50"}`}
                    >Yes</button>
                    <button
                      type="button"
                      onClick={() => setReceiveFormData({ ...receiveFormData, payment_completed: "No" })}
                      className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold  transition-all ${receiveFormData.payment_completed === "No" ? "bg-red-500 text-white shadow-md" : "text-[#5B6472] hover:bg-red-50"}`}
                    >No</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
              <button onClick={() => setIsReceiveModalOpen(false)} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 rounded-xl font-semibold text-[14px]">Cancel</button>
              <button onClick={handleSaveReceive} className="flex-1 py-3.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl font-semibold text-[14px] shadow-lg transition-all active:scale-95">
                Submit Inward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Bulk Processor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="px-10 pt-6 pb-3 flex items-start justify-between border-b border-[#E5E7EB] dark:border-navy-700">
              <div>
                <h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Bulk Workflow Processor</h2>
                <p className="text-[13px] font-semibold text-[#5B6472] mt-1 opacity-80">Processing {Array.from(selectedIds).filter(id => bulkToggles[id]).length} active records</p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full text-[#5B6472] transition-all"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pt-4 pb-32 custom-scrollbar">
              <div className="space-y-4">
                {Array.from(selectedIds).map(id => {
                  const it = items.find(r => r.id === id); if (!it) return null;
                  const step = getActiveStep(it);
                  return (
                    <div key={id} className={`flex flex-col p-4 rounded-2xl border transition-all ${bulkToggles[id] ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" : "bg-slate-50 dark:bg-navy-800 border-slate-100 dark:border-navy-700 opacity-60"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <input type="checkbox" checked={bulkToggles[id]} onChange={e => setBulkToggles(p => ({ ...p, [id]: e.target.checked }))} className="w-5 h-5 rounded border-slate-300 text-[#2563EB] dark:text-[#60A5FA]" />
                          <div>
                            <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] leading-none mb-1">{it.ppf_num}</p>
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-white truncate max-w-[200px]">{it.item_name}</h4>
                          </div>
                        </div>
                        {bulkToggles[id] && (
                          <div className="flex-1 mx-8 grid grid-cols-2 gap-4">
                            {step === 3 && (
                              <>
                                <input type="text" value={bulkVendorInputs[id]} onChange={e => setBulkVendorInputs(p => ({ ...p, [id]: e.target.value }))} placeholder="Vendor Name..." className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-[14px] font-bold outline-none focus:border-[#2563EB]" />
                                <input type="text" value={bulkLeadTimeInputs[id]} onChange={e => setBulkLeadTimeInputs(p => ({ ...p, [id]: e.target.value }))} placeholder="Lead Time..." className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-[14px] font-bold outline-none focus:border-[#2563EB]" />
                              </>
                            )}
                            {step === 4 && (
                              <input type="text" value={bulkPOInputs[id]} onChange={e => setBulkPOInputs(p => ({ ...p, [id]: e.target.value }))} placeholder="PO Num..." className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-[14px] font-bold outline-none focus:border-[#2563EB]" />
                            )}
                            {(step === 3) && (
                              <div className="relative group">
                                <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkStepFiles(p => ({ ...p, [id]: f })); }} className="hidden" id={`bulk-file-${id}`} />
                                <label htmlFor={`bulk-file-${id}`} className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold  cursor-pointer transition-all border-2 border-dashed ${bulkStepFiles[id] ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-[#5B6472] border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB]"}`}>
                                  {bulkStepFiles[id] ? <CheckCircleIcon className="w-4 h-4" /> : <PhotoIcon className="w-4 h-4" />}
                                  {bulkStepFiles[id] ? "Attachment Ready" : step === 3 ? "Upload PI" : "Upload Image"}
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-col items-end">
                          <span className="px-3 py-1 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-700 rounded-full text-[13px] font-semibold text-[#5B6472] whitespace-nowrap">Step {step}: {I2R_PACKING_STEPS[step - 1]}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-[#E5E7EB] dark:border-navy-700 flex items-center justify-between shadow-2xl">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-8 py-3 text-[14px] font-semibold text-[#5B6472] hover:text-slate-600 transition-all">Cancel</button>
              <button onClick={handleBulkStepSave} className="bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-12 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Execute Bulk Update</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Step Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsConfigModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-10 pt-6 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-navy-700">
              <div>
                <h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Step Configuration</h2>
                <p className="text-[13px] font-semibold mt-1 text-[#5B6472]">Define TAT and Operators for I2R Packing Workflow</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-[#5B6472]"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-10 pb-24 pt-4 space-y-3 custom-scrollbar">
              {stepConfigs.map((cfg, i) => (
                <div key={i} className="p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-700 shadow-sm transition-all group">
                  <div className="grid grid-cols-[1fr_200px_350px] items-center gap-8">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-semibold text-[#5B6472]">Step {i + 1}</p>
                      <h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white leading-tight">{cfg.step_name}</h3>
                    </div>
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

            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472]">Cancel</button>
              <button
                onClick={async () => {
                  setActionStatus("loading"); setActionMessage("Saving Config..."); setIsStatusModalOpen(true);
                  await fetch("/api/i2r-packing/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stepConfigs) });
                  setIsStatusModalOpen(false); setIsConfigModalOpen(false);
                }}
                className="bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >Save Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Action Status Modal */}
      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} />

      {/* 5. Confirmation Modal */}
      <ConfirmModal isOpen={isConfirmOpen} title="Delete Record" message="Are you sure you want to delete this packing record? This action cannot be undone." onConfirm={async () => {
        if (!pendingDeleteId) return;
        setIsConfirmOpen(false); setActionStatus("loading"); setActionMessage("Deleting..."); setIsStatusModalOpen(true);
        try {
          const res = await fetch(`/api/i2r-packing?id=${pendingDeleteId}`, { method: "DELETE" });
          if (res.ok) setActionStatus("success"); else setActionStatus("error");
        } catch { setActionStatus("error"); }
        setTimeout(() => { setIsStatusModalOpen(false); mutateItems(); }, 1500);
      }} onClose={() => setIsConfirmOpen(false)} />

      <ConfirmModal isOpen={!!cancelTargetId} title="Cancel Process" message="Are you sure you want to cancel this packing process?" onConfirm={handleCancelConfirm} onClose={() => setCancelTargetId(null)} />
      <ConfirmModal isOpen={!!restoreTargetId} title="Restore Process" message="Are you sure you want to restore this cancelled packing process?" onConfirm={handleRestoreConfirm} onClose={() => setRestoreTargetId(null)} />

      {/* 6. Remove Follow Up Modal */}
      {isRemoveFollowUpModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-purple-600 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold italic tracking-tighter">Remove Follow Up</h2>
                <p className="text-[13px] font-semibold opacity-60">Reset workflow steps</p>
              </div>
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#5B6472] ml-1">Target Step to Reset</label>
                <select value={removeFollowUpStep} onChange={e => setRemoveFollowUpStep(parseInt(e.target.value))} className="w-full px-5 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl text-[14px] font-bold text-slate-700 dark:text-white outline-none focus:border-purple-500 transition-all">
                  {I2R_PACKING_STEPS.map((s, i) => <option key={i} value={i + 1}>Step {i + 1}: {s}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <p className="text-[13px] font-semibold text-[#5B6472] ml-1">Reset Type</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setRemoveFollowUpType('particular')} className={`px-4 py-3 rounded-2xl text-[13px] font-semibold   border-2 transition-all ${removeFollowUpType === 'particular' ? 'bg-purple-50 border-purple-500 text-purple-600 shadow-md' : 'bg-white border-slate-100 text-[#5B6472]'}`}>This Step Only</button>
                  <button onClick={() => setRemoveFollowUpType('onwards')} className={`px-4 py-3 rounded-2xl text-[13px] font-semibold   border-2 transition-all ${removeFollowUpType === 'onwards' ? 'bg-purple-50 border-purple-500 text-purple-600 shadow-md' : 'bg-white border-slate-100 text-[#5B6472]'}`}>Onwards Steps</button>
                </div>
              </div>
            </div>
            <div className="px-8 py-6 bg-slate-50 dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex justify-end gap-3">
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="px-8 py-3 text-[14px] font-semibold text-[#5B6472] hover:text-slate-600">Cancel</button>
              <button onClick={handleRemoveFollowUp} className="px-10 py-3 bg-purple-600 text-white rounded-2xl text-[14px] font-semibold shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all">Reset Steps</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
