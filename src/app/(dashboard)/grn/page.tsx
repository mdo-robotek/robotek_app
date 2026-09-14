"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { GRN, GRNStepConfig } from "@/types/grn";
import useSWR from "swr";
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
  ArrowTopRightOnSquareIcon,
  XCircleIcon,
  ArchiveBoxIcon
} from "@heroicons/react/24/outline";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const GRN_STEP_SHORT = [
  "Quantity check",
  "Inform Vendor & Confirm Qty",
  "Quality check",
  "Inform the Vendor",
  "Quality Check with vendor",
  "Debit Note issue to Vendor",
  "Update Purchase in Busy",
  "Update journal in Busy",
  "Settle Payment"
];

const GRN_STEP_ICONS = [
  QueueListIcon,
  UserIcon,
  CheckBadgeIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  TagIcon,
  CubeIcon,
  Cog6ToothIcon,
  SparklesIcon
];

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
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#003875] text-[#FFD500] rounded-md text-[10px] font-black"
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
          className="flex-1 min-w-[80px] bg-transparent outline-none text-[12px] font-bold text-gray-800 dark:text-white placeholder:text-gray-300 dark:placeholder:text-navy-600"
        />
        <ChevronDownIcon className="w-4 h-4 text-slate-300 ml-auto" />
      </div>

      {open && (
        <div className="absolute z-[1001] w-full mt-1 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto p-1.5">
          {listToShow.length === 0 ? (
            <p className="px-4 py-2 text-xs font-bold text-slate-400 italic">No users found</p>
          ) : (
            listToShow.map((u) => (
              <div
                key={u}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(u);
                }}
                className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-navy-800 text-[12px] font-black text-slate-700 dark:text-white rounded-lg cursor-pointer transition-all flex items-center justify-between group"
              >
                <span>{u}</span>
                <PlusIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function GRNDashboard() {
  const { data: session } = useSession();
  const currentUser = session?.user?.name || "User";
  const userRole: string = (session?.user as any)?.role || "User";
  const isAdmin = userRole.toUpperCase() === "ADMIN" || userRole.toUpperCase() === "EA";
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, error, mutate, isLoading } = useSWR("/api/grn", fetcher, { refreshInterval: 5000 });
  const items: GRN[] = data?.items || [];
  const stepConfig: GRNStepConfig[] = data?.stepConfig || [];
  const nextPO = data?.nextPO || "";

  const [layoutMode, setLayoutMode] = useState<"smart" | "standard">("smart");
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | "all" | "completed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GRN | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "cancel" | "restore" | null>(null);
  const [targetItem, setTargetItem] = useState<GRN | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<GRNStepConfig[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);

  const { data: usersData } = useSWR<{ username: string }[]>("/api/users", fetcher);
  const usersList: string[] = useMemo(() => (usersData || []).map((u) => u.username).filter(Boolean), [usersData]);

  useEffect(() => {
    if (isConfigModalOpen) {
      const merged = GRN_STEP_SHORT.map((step, idx) => {
        const found = stepConfig.find((c) => c.step_name === step) || stepConfig[idx];
        return { step_name: step, tat: found?.tat || "24 Hrs", responsible_person: found?.responsible_person || "" };
      });
      setStepConfigs(merged);
    }
  }, [isConfigModalOpen, stepConfig]);

  const [formData, setFormData] = useState<Partial<GRN>>({});
  const [bulkToggles, setBulkToggles] = useState<Record<string, boolean>>({});
  const [bulkData, setBulkData] = useState<Record<string, any>>({});
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [isRemoveFollowUpModalOpen, setIsRemoveFollowUpModalOpen] = useState(false);
  const [targetItemForRemoveFollowUp, setTargetItemForRemoveFollowUp] = useState<GRN | null>(null);
  const [removeFollowUpStep, setRemoveFollowUpStep] = useState(1);
  const [removeFollowUpType, setRemoveFollowUpType] = useState<'particular' | 'onwards'>('particular');

  const getActiveStep = (item: GRN) => {
    if (item.cancelled) return -1;
    for (let i = 1; i <= 9; i++) {
      if ((item as any)[`planned_${i}`] && !(item as any)[`actual_${i}`]) return i;
    }
    // Check if all planned are actualized
    let lastActual = 0;
    for (let i = 1; i <= 9; i++) {
      if ((item as any)[`actual_${i}`]) lastActual = i;
    }
    return lastActual === 9 || (lastActual > 0 && !(item as any)[`planned_${lastActual + 1}`]) ? 0 : 1;
  };

  const filteredItems = useMemo(() => {
    const filtered = items.filter(it => {
      const activeStep = getActiveStep(it);
      
      const matchesStep = selectedStepFilter === "all" ? true :
                         selectedStepFilter === "completed" ? activeStep === 0 :
                         activeStep === selectedStepFilter;
      
      const matchesView = viewMode === "active" ? !it.cancelled : !!it.cancelled;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = it.GRN_No.toLowerCase().includes(searchLower) ||
                           it.PO_Number.toLowerCase().includes(searchLower) ||
                           it.Item_Name.toLowerCase().includes(searchLower);
      
      // Date filter logic (simple implementation)
      let matchesDate = true;
      if (dateFilter) {
        const d = new Date(it.updated_at).toDateString();
        const filterD = new Date(dateFilter).toDateString();
        matchesDate = d === filterD;
      }

      return matchesStep && matchesView && matchesSearch && matchesDate;
    });
    return filtered.sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idB - idA;
    });
  }, [items, selectedStepFilter, viewMode, searchTerm, dateFilter]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const openConfigModal = () => {
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    setActionStatus("loading");
    setActionMessage("Saving system configuration...");
    setIsStatusModalOpen(true);
    try {
      const res = await fetch("/api/grn/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepConfigs),
      });
      if (res.ok) {
        setActionStatus("success");
        mutate();
        setTimeout(() => {
          setIsStatusModalOpen(false);
          setIsConfigModalOpen(false);
        }, 1500);
      } else throw new Error();
    } catch {
      setActionStatus("error");
      setActionMessage("Failed to save configuration");
    }
  };

  const openEditModal = (item: GRN) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setActionStatus("loading");
    setActionMessage("Updating GRN details...");
    setIsStatusModalOpen(true);

    let billUrl = formData.Attach_Bill || "";
    if (billFile) {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("file", billFile);
      try {
        const res = await fetch("/api/i2r/upload", { method: "POST", body: fd });
        const uploadData = await res.json();
        if (uploadData.fileId) billUrl = `https://drive.google.com/uc?id=${uploadData.fileId}`;
      } catch (err) {
        console.error("Upload failed", err);
      }
      setIsUploading(false);
    }

    try {
      const res = await fetch("/api/grn", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingItem?.id, ...formData, Attach_Bill: billUrl, notifyMdPaymentReview: true }),
      });

      if (res.ok) {
        setActionStatus("success");
        setActionMessage("GRN updated successfully");
        mutate();
        setTimeout(() => {
          setIsStatusModalOpen(false);
          setIsModalOpen(false);
        }, 1500);
      } else {
        throw new Error();
      }
    } catch {
      setActionStatus("error");
      setActionMessage("Failed to update GRN entry");
    }
  };

  const handleStepComplete = async (item: GRN, stepIdx: number) => {
    setActionStatus("loading");
    setActionMessage(`Completing Step ${stepIdx}...`);
    setIsStatusModalOpen(true);

    try {
      const updates: any = { id: item.id };
      updates[`actual_${stepIdx}`] = new Date().toISOString();
      updates[`status_${stepIdx}`] = "Completed";
      updates.updated_at = new Date().toISOString();

      const res = await fetch("/api/grn", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setActionStatus("success");
        setActionMessage(`Step ${stepIdx} completed!`);
        mutate();
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else throw new Error();
    } catch {
      setActionStatus("error");
      setActionMessage("Failed to update step");
    }
  };

  const confirmCancelRestore = (item: GRN) => {
    setTargetItem(item);
    setConfirmAction(item.cancelled ? "restore" : "cancel");
    setIsConfirmOpen(true);
  };

  const confirmDelete = (item: GRN) => {
    setTargetItem(item);
    setConfirmAction("delete");
    setIsConfirmOpen(true);
  };

  const executeConfirmAction = async () => {
    if (!targetItem || !confirmAction) return;
    setIsConfirmOpen(false);

    if (confirmAction === "delete") {
      setActionStatus("loading");
      setActionMessage("Deleting GRN entry...");
      setIsStatusModalOpen(true);
      try {
        const res = await fetch(`/api/grn?id=${targetItem.id}`, { method: "DELETE" });
        if (res.ok) {
          setActionStatus("success");
          setActionMessage("GRN deleted successfully");
          mutate();
        } else throw new Error();
      } catch {
        setActionStatus("error");
        setActionMessage("Failed to delete GRN entry");
      }
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } else {
      const isCancelled = confirmAction === "cancel";
      setActionStatus("loading");
      setActionMessage(isCancelled ? "Cancelling GRN..." : "Restoring GRN...");
      setIsStatusModalOpen(true);

      try {
        const res = await fetch("/api/grn", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: targetItem.id, cancelled: isCancelled ? new Date().toISOString() : "" }),
        });

        if (res.ok) {
          setActionStatus("success");
          setActionMessage(isCancelled ? "GRN cancelled successfully" : "GRN restored successfully");
          mutate();
        } else throw new Error();
      } catch {
        setActionStatus("error");
        setActionMessage(isCancelled ? "Failed to cancel GRN" : "Failed to restore GRN");
      }
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    }
  };

  const openBulkModal = () => {
    const initialToggles: Record<string, boolean> = {};
    const initialData: Record<string, any> = {};
    selectedIds.forEach(id => { 
      initialToggles[id] = true; 
      const item = items.find(it => it.id === id);
      if (item) {
        const step = getActiveStep(item);
        initialData[id] = {
          remarks: "",
          visitDate: new Date().toISOString().slice(0, 16),
          status: (step === 1 || step === 3 || step === 5) ? "Approved" : "Completed"
        };
      }
    });
    setBulkToggles(initialToggles);
    setBulkData(initialData);
    setIsBulkModalOpen(true);
  };

  const handleBulkProcess = async () => {
    const toProcess = Array.from(selectedIds).filter(id => bulkToggles[id]);
    if (toProcess.length === 0) return;

    setActionStatus("loading");
    setActionMessage(`Processing ${toProcess.length} entries...`);
    setIsStatusModalOpen(true);

    try {
      for (const id of toProcess) {
        const item = items.find(it => it.id === id);
        if (!item) continue;
        const stepIdx = getActiveStep(item);
        if (stepIdx <= 0 || stepIdx > 9) continue;

        const data = bulkData[id] || {};
        const updates: any = { id };
        updates[`actual_${stepIdx}`] = new Date().toISOString();
        updates[`status_${stepIdx}`] = data.status || "Completed";
        updates.updated_at = new Date().toISOString();

        if (stepIdx === 1) updates.remarks_1 = data.remarks;
        if (stepIdx === 3) updates.remarks_3 = data.remarks;
        if (stepIdx === 4) updates.vendor_visit_date_4 = data.visitDate;

        await fetch("/api/grn", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }

      setActionStatus("success");
      setActionMessage(`${toProcess.length} steps completed!`);
      mutate();
      setTimeout(() => {
        setIsStatusModalOpen(false);
        setIsBulkModalOpen(false);
        setSelectedIds(new Set());
      }, 1500);
    } catch {
      setActionStatus("error");
      setActionMessage("Bulk update failed");
    }
  };

  const openRemoveFollowUpModal = (item: GRN) => {
    setTargetItemForRemoveFollowUp(item);
    setRemoveFollowUpStep(getActiveStep(item) || 1);
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
      if (startStep === 1) upd.remarks_1 = "";
      if (startStep === 3) upd.remarks_3 = "";
      if (startStep === 4) upd.vendor_visit_date_4 = "";
    } else {
      for (let s = startStep; s <= 9; s++) {
        upd[`actual_${s}`] = "";
        upd[`status_${s}`] = "";
        if (s > startStep) upd[`planned_${s}`] = "";
        if (s === 1) upd.remarks_1 = "";
        if (s === 3) upd.remarks_3 = "";
        if (s === 4) upd.vendor_visit_date_4 = "";
      }
    }
    upd.updated_at = now;

    try {
      const res = await fetch("/api/grn", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
      if (res.ok) setActionStatus("success"); else setActionStatus("error");
    } catch { setActionStatus("error"); }
    setTimeout(() => { setIsStatusModalOpen(false); setIsRemoveFollowUpModalOpen(false); mutate(); }, 1500);
  };

  const fmtDt = (d?: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
  const fmtTm = (d?: string) => d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";

  const getDelay = (planned: string, actual: string | null) => {
    if (!planned) return null;
    const pl = new Date(planned);
    const ac = actual ? new Date(actual) : now;
    const diff = ac.getTime() - pl.getTime();
    if (diff <= 0) return null;
    
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#FEFBF0] dark:bg-navy-950 overflow-hidden">
      {/* ─── Header Section ─── */}
      <div className="px-2 py-0.5 bg-[#FEFBF0] dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800 shrink-0 relative">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-[#003875] dark:text-white tracking-tight uppercase leading-none">GRN Management</h1>
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest mt-1.5">Goods Receipt Note — Process Tracking</p>
          </div>
          
          {/* Central Pill Actions */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border-2 border-[#003875] dark:border-[#FFD500] bg-white dark:bg-navy-900 shadow-xl p-0.5">
            <button className="flex items-center gap-2 px-4 py-1.5 font-black uppercase tracking-widest text-[10px] text-[#003875] dark:text-[#FFD500] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> <span>EXPORT</span>
            </button>
            <button onClick={openConfigModal} className="flex items-center gap-2 px-4 py-1.5 font-black uppercase tracking-widest text-[10px] text-[#003875] dark:text-[#FFD500] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <Cog6ToothIcon className="w-3.5 h-3.5" /> <span>CONFIG</span>
            </button>
            <div className="w-[1px] h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
            <button onClick={() => setViewMode(viewMode === "active" ? "cancelled" : "active")} className={`flex items-center gap-2 px-4 py-1.5 font-black uppercase tracking-widest text-[10px] transition-all rounded-full ${viewMode === "cancelled" ? "bg-red-500 text-white shadow-md" : "text-[#003875] dark:text-[#FFD500] hover:bg-slate-50 dark:hover:bg-navy-800"}`}>
              <NoSymbolIcon className="w-3.5 h-3.5" /> <span>CANCELLED ({items.filter(i => i.cancelled).length})</span>
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-navy-900 rounded-full p-0.5 border border-slate-200 dark:border-navy-800 shadow-inner">
            <button onClick={() => setLayoutMode("standard")} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${layoutMode === "standard" ? "bg-white dark:bg-navy-800 text-[#003875] dark:text-[#FFD500] shadow-md" : "text-gray-400 dark:text-navy-600"}`}>STANDARD</button>
            <button onClick={() => setLayoutMode("smart")} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${layoutMode === "smart" ? "bg-white dark:bg-navy-800 text-[#003875] dark:text-[#FFD500] shadow-md" : "text-gray-400 dark:text-navy-600"}`}>SMART VIEW</button>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-60 flex flex-col shrink-0 h-full overflow-y-auto custom-scrollbar border-r border-slate-100 dark:border-navy-800 pr-3 py-0.5">
          <p className="text-[10px] font-black text-slate-400 dark:text-navy-500 uppercase tracking-[0.3em] mb-1.5 px-2">FILTERS</p>
          <div className="space-y-1.5 pb-10">
            <button
              onClick={() => setSelectedStepFilter("all")}
              className={`w-full flex items-center justify-between px-5 py-2.5 rounded-full transition-all border-b-4 ${
                selectedStepFilter === "all" ? "bg-[#e6dcc5] dark:bg-[#cbbca0]/20 border-[#cbbca0] text-[#003875] dark:text-[#FFD500] shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-500 dark:text-navy-400 hover:bg-slate-50 dark:hover:bg-navy-800"
              }`}
            >
              <span className="font-black text-[11px] uppercase tracking-widest">ALL GRN ENTRIES</span>
            </button>
            
            <div className="space-y-1 mt-3">
              {GRN_STEP_SHORT.map((name, i) => {
                const n = i + 1;
                const active = selectedStepFilter === n;
                const Icon = GRN_STEP_ICONS[i];
                const count = items.filter(it => getActiveStep(it) === n).length;
                return (
                  <div key={n} className="px-1">
                    <button
                      onClick={() => setSelectedStepFilter(n)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all border border-slate-50 dark:border-navy-800 bg-white dark:bg-navy-900 hover:border-[#003875]/20 dark:hover:border-[#FFD500]/20 ${
                        active ? "bg-[#e6dcc5] dark:bg-[#cbbca0]/20 border-[#cbbca0] shadow-md z-10" : "text-slate-500 dark:text-navy-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? "text-[#003875] dark:text-[#FFD500]" : "text-[#003875] dark:text-blue-400"}`} />
                        <span className={`text-[10px] font-black uppercase tracking-tight text-left ${active ? "text-[#003875] dark:text-[#FFD500]" : "text-slate-600 dark:text-navy-300"}`}>Step {n} — {name}</span>
                      </div>
                      {count > 0 && (
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black transition-all ${active ? "bg-[#003875] text-[#FFD500]" : "bg-blue-500 text-white shadow-sm"}`}>{count}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedStepFilter("completed")}
              className={`w-full flex items-center justify-between px-5 py-2.5 rounded-full mt-3 transition-all border-b-4 ${
                selectedStepFilter === "completed" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-md" : "bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-400 dark:text-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircleIcon className={`w-4 h-4 ${selectedStepFilter === "completed" ? "text-emerald-500" : "text-emerald-600 dark:text-emerald-400"}`} />
                <span className={`font-black text-[11px] uppercase tracking-widest ${selectedStepFilter === "completed" ? "text-emerald-700 dark:text-emerald-400" : "text-emerald-600 dark:text-emerald-500"}`}>COMPLETED</span>
              </div>
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black transition-all ${selectedStepFilter === "completed" ? "bg-emerald-500 text-white" : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"}`}>{items.filter(it => getActiveStep(it) === 0).length}</span>
            </button>
          </div>
        </div>

        {/* Display Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-2 py-0.5">
          {/* Toolbar / Filters Row */}
          <div className="flex items-center gap-3 mb-3 shrink-0 px-1">
            <div className="relative group flex-1 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-[#003875] transition-colors" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-xl text-[12px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all shadow-sm" />
            </div>
            
            <div className="flex items-center gap-1.5">
              {[
                { label: "YESTERDAY", val: new Date(Date.now() - 86400000).toISOString().split('T')[0], count: items.filter(i => new Date(i.updated_at).toDateString() === new Date(Date.now() - 86400000).toDateString()).length, theme: "blue" },
                { label: "TODAY", val: new Date().toISOString().split('T')[0], count: items.filter(i => new Date(i.updated_at).toDateString() === new Date().toDateString()).length, theme: "orange" },
                { label: "TOMORROW", val: new Date(Date.now() + 86400000).toISOString().split('T')[0], count: 0, theme: "blue" }
              ].map(f => (
                <button 
                  key={f.label} 
                  onClick={() => setDateFilter(dateFilter === f.val ? null : f.val)}
                  className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all ${
                    dateFilter === f.val 
                      ? (f.theme === "orange" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/50 shadow-sm" : "bg-[#003875] dark:bg-[#FFD500] text-white dark:text-navy-950 border-[#003875] dark:border-[#FFD500] shadow-md")
                      : "bg-white dark:bg-navy-900 border-blue-50 dark:border-navy-800 text-blue-400 dark:text-blue-600 hover:border-blue-200 dark:hover:border-blue-800"
                  }`}
                >
                  {f.label} <span className="ml-1 opacity-50">{f.count}</span>
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <p className="text-[10px] font-black text-slate-400 dark:text-navy-500 uppercase tracking-widest whitespace-nowrap">PAGE <span className="text-[#003875] dark:text-[#FFD500]">{currentPage}</span> OF {totalPages || 1}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} className="p-1 text-slate-300 dark:text-navy-700 hover:text-slate-800 dark:hover:text-white transition-colors"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} className="p-1 text-slate-300 dark:text-navy-700 hover:text-slate-800 dark:hover:text-white transition-colors"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-1 ml-1">
                <p className="text-[10px] font-black text-slate-300 dark:text-navy-700 uppercase">SHOW</p>
                <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="bg-transparent border-none text-[10px] font-black text-[#003875] dark:text-[#FFD500] outline-none cursor-pointer">
                  {[10, 20, 50].map(v => <option key={v} value={v} className="dark:bg-navy-900">{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-20">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-20 animate-pulse text-slate-200"><ArrowPathIcon className="w-12 h-12 animate-spin mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">SYNCHRONIZING...</p></div>
            ) : paginatedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-slate-100"><MagnifyingGlassIcon className="w-16 h-16 mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">NO DATA FOUND</p></div>
            ) : layoutMode === "smart" ? (
              paginatedItems.map((item: GRN) => {
                const sel = selectedIds.has(item.id); const step = getActiveStep(item); const exp = expandedTiles[item.id];
                return (
                  <div key={item.id} className="px-1">
                    <div onClick={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className={`bg-white dark:bg-navy-800 rounded-2xl border transition-all cursor-pointer overflow-hidden ${sel ? "border-[#003875] border-2 shadow-lg scale-[1.002]" : "border-slate-100 dark:border-navy-700 shadow-sm hover:border-slate-200"}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-4">
                            <input type="checkbox" checked={sel} readOnly className="w-4 h-4 mt-1.5 rounded border-slate-300 text-[#003875] focus:ring-[#003875]" />
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-[#003875] dark:text-blue-400 rounded text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/50">{item.GRN_No}</span>
                                <h3 className="text-[15px] font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none">{item.Item_Name}</h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-5 mt-2">
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase"><CubeIcon className="w-3.5 h-3.5" /> Qty: {item.Qty}</span>
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-purple-500 uppercase"><TagIcon className="w-3.5 h-3.5" /> {item.Category}</span>
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase"><UserIcon className="w-3.5 h-3.5" /> {item.filled_by}</span>
                                {item.Packed_Unpacked && (
                                  <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${item.Packed_Unpacked.toLowerCase() === "packed" ? "text-emerald-600" : "text-slate-500"}`}>
                                    <ArchiveBoxIcon className="w-3.5 h-3.5" /> {item.Packed_Unpacked}
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase"><CalendarIcon className="w-3.5 h-3.5" /> {fmtDt(item.updated_at)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {item.cancelled ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                                <NoSymbolIcon className="w-4 h-4 text-red-500 stroke-[3]" /> CANCELLED
                                <span className="ml-1 opacity-70 text-[9px] uppercase tracking-widest font-bold">{fmtDt(item.cancelled)} {fmtTm(item.cancelled)}</span>
                              </div>
                            ) : (
                              <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 border border-[#FFD500] text-[#003875] dark:text-[#FFD500] rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                                <ClockIcon className="w-4 h-4 text-[#FFD500] stroke-[3]" />
                                {step === 0 ? "DONE" : (
                                  <span className="flex items-center gap-2">
                                    <span>STEP {step} PENDING</span>
                                    {(item as any)[`planned_${step}`] && (
                                      <span className="flex items-center gap-1.5 ml-1 pl-2 border-l border-[#003875]/20 dark:border-[#FFD500]/20 animate-pulse">
                                        <span className="text-[8px] text-orange-500 dark:text-orange-400 uppercase tracking-widest font-bold">DUE</span>
                                        <span className="text-[10px] font-black text-orange-600 dark:text-orange-300">
                                          {fmtDt((item as any)[`planned_${step}`])} {fmtTm((item as any)[`planned_${step}`])}
                                        </span>
                                      </span>
                                    )}
                                  </span>
                                )}
                              </button>
                            )}
                            <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-navy-800 rounded-full border border-slate-100 dark:border-navy-700 shadow-lg ring-1 ring-slate-50">
                              <button 
                                onClick={e => { e.stopPropagation(); setExpandedTiles(p => ({ ...p, [item.id]: !exp })); }} 
                                className={`p-2 rounded-full transition-all active:scale-90 ${exp ? "text-[#003875] dark:text-[#FFD500] bg-slate-50 dark:bg-navy-700" : "text-slate-400 hover:bg-slate-50"}`}
                                title={exp ? "Hide Pipeline" : "Show Pipeline"}
                              >
                                {exp ? <ChevronUpIcon className="w-4 h-4 stroke-[3]" /> : <ChevronDownIcon className="w-4 h-4 stroke-[3]" />}
                              </button>
                              {(isAdmin || step > 0) && (
                                <>
                                  <div className="w-[1px] h-4 bg-slate-100 dark:bg-navy-700 mx-0.5" />
                                  <button onClick={e => { e.stopPropagation(); openEditModal(item); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all active:scale-90"><PencilSquareIcon className="w-4 h-4" /></button>
                                  <button onClick={e => { e.stopPropagation(); openRemoveFollowUpModal(item); }} className="p-2 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full transition-all active:scale-90" title="Remove Follow Up"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                                  {item.cancelled ? (
                                    <button onClick={e => { e.stopPropagation(); confirmCancelRestore(item); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-full transition-all active:scale-90" title="Restore"><ArrowUturnLeftIcon className="w-4 h-4 stroke-[3]" /></button>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); confirmCancelRestore(item); }} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90" title="Cancel GRN"><XCircleIcon className="w-4 h-4 stroke-[3]" /></button>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); confirmDelete(item); }} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom Grid */}
                        <div className="grid grid-cols-4 gap-4 py-3 border-t border-slate-50 dark:border-navy-700 mt-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-emerald-500"><BuildingOfficeIcon className="w-3.5 h-3.5" /><p className="text-[9px] font-black uppercase tracking-widest">COUNTRY</p></div>
                            <p className="text-[12px] font-black text-slate-800 dark:text-white ml-5 truncate">{item.Country || "—"}</p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-orange-400"><ClockIcon className="w-3.5 h-3.5" /><p className="text-[9px] font-black uppercase tracking-widest">PO NUMBER</p></div>
                            <p className="text-[12px] font-black text-slate-800 dark:text-white ml-5 truncate">{item.PO_Number || "—"}</p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-blue-400"><PhotoIcon className="w-3.5 h-3.5" /><p className="text-[9px] font-black uppercase tracking-widest">BILL ATTACH</p></div>
                            {item.Attach_Bill ? (
                              <a href={item.Attach_Bill} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] font-black text-blue-600 dark:text-blue-400 ml-5 hover:underline flex items-center gap-1">
                                View Bill <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                              </a>
                            ) : (
                              <p className="text-[12px] font-black text-slate-300 dark:text-navy-600 ml-5">Pending</p>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-rose-500"><DocumentTextIcon className="w-3.5 h-3.5" /><p className="text-[9px] font-black uppercase tracking-widest">PAYMENT</p></div>
                            <p className="text-[12px] font-black text-slate-800 dark:text-white ml-5 truncate">{item.Payment_Completed || "No"}</p>
                          </div>
                        </div>
                        
                        {/* Empty space filler when collapsed to maintain card aesthetics if needed, or just removed as requested */}

                        {exp && (
                          <div className="mt-2 grid grid-cols-5 gap-2 animate-in slide-in-from-top-2 duration-300">
                             {Array.from({ length: 9 }, (_, i) => {
                               const n = i + 1; const act = (item as any)[`actual_${n}`]; const pl = (item as any)[`planned_${n}`]; 
                               const done = !!act; const isPending = !done && n === getActiveStep(item);
                               const delay = getDelay(pl, act);
                               
                               let statusClasses = "bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-navy-800 text-slate-400";
                               if (done) statusClasses = "bg-emerald-50 border-emerald-100 text-emerald-700 shadow-sm";
                               else if (isPending) statusClasses = "bg-orange-50 border-orange-200 text-orange-700 shadow-sm ring-2 ring-orange-100";

                               return (
                                 <div key={n} className={`p-1 rounded-xl border transition-all ${statusClasses}`}>
                                   <div className="flex items-center justify-between mb-0.5">
                                     <p className={`text-[9px] font-black uppercase tracking-widest ${done ? "text-emerald-500" : isPending ? "text-orange-500" : "text-slate-300"}`}>ST {n}</p>
                                     <div className="flex items-center gap-1">
                                       {delay && <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-1 rounded">-{delay}</span>}
                                       {done && <CheckCircleIcon className="w-3 h-3 text-emerald-500" />}
                                       {isPending && <ClockIcon className="w-3 h-3 text-orange-500 animate-pulse" />}
                                     </div>
                                   </div>
                                   <p className={`text-[10px] font-black leading-tight min-h-[1.2rem] line-clamp-2 ${done ? "text-emerald-900" : isPending ? "text-orange-900" : "text-slate-500"}`}>{GRN_STEP_SHORT[i]}</p>
                                   
                                   <div className={`mt-0.5 space-y-0 pt-0.5 border-t ${done ? "border-emerald-100" : "border-slate-100 dark:border-navy-800"}`}>
                                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                                       <span className="opacity-40 text-slate-400 text-[7px]">PLANNED</span>
                                       <span className="text-slate-600 dark:text-white/70">{fmtDt(pl)} {fmtTm(pl)}</span>
                                     </div>
                                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                                       <span className="opacity-40 text-slate-400 text-[7px]">ACTUAL</span>
                                       <span className={done ? "text-emerald-700" : "opacity-30"}>{act ? `${fmtDt(act)} ${fmtTm(act)}` : "—"}</span>
                                     </div>
                                     {n === 1 && item.remarks_1 && (
                                       <div className="mt-1 p-1 bg-slate-50 dark:bg-navy-950 rounded text-[10px] font-bold text-slate-500 border border-slate-100 dark:border-navy-800 italic">
                                         "{item.remarks_1}"
                                       </div>
                                     )}
                                     {n === 3 && item.remarks_3 && (
                                       <div className="mt-1 p-1 bg-slate-50 dark:bg-navy-950 rounded text-[10px] font-bold text-slate-500 border border-slate-100 dark:border-navy-800 italic">
                                         "{item.remarks_3}"
                                       </div>
                                     )}
                                     {n === 4 && item.vendor_visit_date_4 && (
                                       <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-tighter text-blue-500">
                                         <span className="opacity-40 text-[8px]">VISIT DATE</span>
                                         <span>{fmtDt(item.vendor_visit_date_4)} {fmtTm(item.vendor_visit_date_4)}</span>
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
              <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#003875] dark:bg-navy-950 text-white text-[10px] font-black uppercase tracking-widest">
                      <th className="p-4 w-10 text-center sticky left-0 z-10 bg-[#003875] dark:bg-navy-950"><input type="checkbox" checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0} onChange={() => { if (selectedIds.size === paginatedItems.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginatedItems.map((i: GRN) => i.id))); }} className="rounded border-white/20 bg-transparent text-[#FFD500] focus:ring-[#FFD500]" /></th>
                      <th className="p-4 whitespace-nowrap sticky left-10 z-10 bg-[#003875] dark:bg-navy-950">ACTIONS</th>
                      <th className="p-4 whitespace-nowrap sticky left-24 z-10 bg-[#003875] dark:bg-navy-950">GRN NO.</th>
                      <th className="p-4 whitespace-nowrap">ITEM NAME</th>
                      <th className="p-4 whitespace-nowrap">QUANTITY</th>
                      <th className="p-4 whitespace-nowrap">PO NUMBER</th>
                      <th className="p-4 whitespace-nowrap">COUNTRY</th>
                      <th className="p-4 whitespace-nowrap">PACKED / UNPACKED</th>
                      <th className="p-4 whitespace-nowrap">FILLED BY</th>
                      <th className="p-4 whitespace-nowrap">UPDATED AT</th>
                      {GRN_STEP_SHORT.map((s, i) => <th key={i} className="p-4 whitespace-nowrap border-l border-white/10 min-w-[200px]">STEP {i+1} — {s.toUpperCase()}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                    {paginatedItems.map((it: GRN) => (
                      <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-900/30 transition-all text-[11px] group">
                        <td className="p-4 text-center sticky left-0 z-10 bg-white dark:bg-navy-900 group-hover:bg-slate-50 transition-all"><input type="checkbox" checked={selectedIds.has(it.id)} onChange={() => { const n = new Set(selectedIds); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); setSelectedIds(n); }} className="rounded border-slate-300 text-[#003875] focus:ring-[#003875]" /></td>
                        <td className="p-4 sticky left-10 z-10 bg-white dark:bg-navy-900 group-hover:bg-slate-50 transition-all">
                          {(isAdmin || getActiveStep(it) > 0) ? (
                            <div className="flex items-center gap-2">
                               <button onClick={() => openEditModal(it)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-md transition-all"><PencilSquareIcon className="w-4 h-4" /></button>
                               <button onClick={() => openRemoveFollowUpModal(it)} className="p-2 text-purple-500 hover:bg-purple-50 rounded-md transition-all" title="Remove Follow Up"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                              {it.cancelled ? (
                                <button onClick={() => confirmCancelRestore(it)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-md transition-all" title="Restore"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                              ) : (
                                <button onClick={() => confirmCancelRestore(it)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-all" title="Cancel GRN"><XCircleIcon className="w-4 h-4" /></button>
                              )}
                               <button onClick={() => confirmDelete(it)} className="p-2 text-red-400 hover:bg-red-50 rounded-md transition-all"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <span className="text-[9px] font-black text-slate-300 dark:text-navy-600 uppercase">View only</span>
                          )}
                        </td>
                        <td className="p-4 sticky left-24 z-10 bg-white dark:bg-navy-900 group-hover:bg-slate-50 transition-all font-black text-[#003875] dark:text-blue-400">{it.GRN_No}</td>
                        <td className="p-4 font-black text-slate-800 dark:text-white uppercase max-w-[200px] truncate">{it.Item_Name}</td>
                        <td className="p-4 font-bold text-slate-500">{it.Qty}</td>
                        <td className="p-4 font-black text-orange-600">{it.PO_Number}</td>
                        <td className="p-4 font-bold text-slate-400 uppercase">{it.Country}</td>
                        <td className="p-4 font-black uppercase">{it.Packed_Unpacked || "—"}</td>
                        <td className="p-4 font-bold text-slate-500">{it.filled_by}</td>
                        <td className="p-4 whitespace-nowrap text-slate-400">{fmtDt(it.updated_at)}</td>
                        {Array.from({ length: 9 }).map((_, i) => {
                          const n = i+1; const act = (it as any)[`actual_${n}`]; const pl = (it as any)[`planned_${n}`];
                          const done = !!act; const isPending = !done && n === getActiveStep(it);
                          return (
                            <td key={i} className={`p-4 border-l border-slate-50 dark:border-navy-800 ${isPending ? 'bg-orange-50/30' : ''}`}>
                              {pl ? (
                                <div className="space-y-1">
                                  <div className="flex justify-between gap-4 text-[9px] uppercase whitespace-nowrap"><span className="text-slate-400 font-bold">PLANNED</span><span className="font-black text-slate-600 dark:text-white/70">{fmtDt(pl)}</span></div>
                                  <div className="flex justify-between gap-4 text-[9px] uppercase whitespace-nowrap"><span className="text-slate-400 font-bold">ACTUAL</span><span className={`font-black ${done ? 'text-emerald-500' : isPending ? 'text-orange-500' : 'text-slate-300'}`}>{act ? fmtDt(act) : isPending ? 'Pending >' : '—'}</span></div>
                                  
                                  {n === 1 && it.remarks_1 && <div className="text-[10px] text-slate-400 italic max-w-[150px] truncate">"{it.remarks_1}"</div>}
                                  {n === 3 && it.remarks_3 && <div className="text-[10px] text-slate-400 italic max-w-[150px] truncate">"{it.remarks_3}"</div>}
                                  {n === 4 && it.vendor_visit_date_4 && <div className="text-[10px] text-blue-500 font-black">VISIT: {fmtDt(it.vendor_visit_date_4)}</div>}
                                </div>
                              ) : <span className="text-slate-100">—</span>}
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

      {/* ─── Floating Bulk Bar ─── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#FEFBF0] dark:bg-navy-800 px-1.5 py-1.5 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.15)] flex items-center gap-4 border border-[#e6dcc5] dark:border-navy-700 z-[100] animate-in slide-in-from-bottom-12 duration-500 ring-4 ring-[#FEFBF0] dark:ring-navy-950">
          <div className="flex items-center gap-2.5 pl-3">
            <div className="w-8 h-8 bg-[#FFD500] text-[#003875] rounded-full flex items-center justify-center font-black text-sm shadow-sm">{selectedIds.size}</div>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#003875] dark:text-[#FFD500]">SELECTED</p>
          </div>
          <button onClick={openBulkModal} className="flex items-center gap-2 bg-[#FFD500] text-[#003875] px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-[0.1em] hover:scale-[1.03] active:scale-95 transition-all shadow-md border-b-2 border-[#ccaa00]">
            <SparklesIcon className="w-3.5 h-3.5 stroke-[2.5]" /> BULK PROCESS
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="pr-5 text-slate-400 dark:text-navy-500 hover:text-[#003875] dark:hover:text-[#FFD500] text-[9px] font-black uppercase tracking-[0.1em] transition-colors">CLEAR</button>
        </div>
      )}

      {/* Bulk Processor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#001a33]/60 backdrop-blur-md" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-[#FEFBF0] dark:bg-navy-800 w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="px-10 pt-6 pb-3 bg-[#FEFBF0] dark:bg-navy-800 flex items-start justify-between relative shrink-0 border-b border-slate-100 dark:border-navy-700">
              <div><h2 className="text-[26px] font-black italic uppercase tracking-tighter text-[#003875] dark:text-white leading-none">Bulk Processor</h2><p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1 text-slate-400">Processing {Array.from(selectedIds).length} selected GRN entries</p></div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white absolute top-5 right-8"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-10 pb-24 pt-4 space-y-3 custom-scrollbar">
              {Array.from(selectedIds).map(id => {
                const it = items.find(r => r.id === id); if (!it) return null; 
                const n = getActiveStep(it); 
                const t = bulkToggles[id] ?? true;
                const data = bulkData[id] || {};
                const isCheckStep = n === 1 || n === 3 || n === 5;
                
                return (
                  <div key={id} className={`p-5 bg-white dark:bg-navy-900 rounded-3xl border transition-all ${t ? "border-[#003875]/20 dark:border-[#FFD500]/20 shadow-sm" : "border-slate-100 dark:border-navy-800 opacity-40 shadow-none grayscale"}`}>
                    <div className="grid grid-cols-[1fr_1.5fr_1.5fr] items-center gap-6">
                       <div className="flex items-center gap-4">
                          <button onClick={() => setBulkToggles({...bulkToggles, [id]: !t})} className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${t ? "bg-[#003875] border-[#003875] text-white" : "border-slate-100 text-transparent"}`}><CheckCircleIcon className="w-5 h-5" /></button>
                          <div className="min-w-0"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{it.GRN_No}</p><p className="text-[13px] font-black text-[#003875] dark:text-white uppercase truncate">{it.Item_Name}</p></div>
                       </div>

                       <div className="flex items-center gap-4">
                          <div className="flex-1 px-4 py-2 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-navy-700 min-w-0">
                             <p className="text-[8px] font-black text-slate-400 uppercase">CURRENT STEP</p>
                             <p className="text-[10px] font-black text-slate-700 dark:text-white uppercase truncate">{n <= 9 && n > 0 ? GRN_STEP_SHORT[n-1] : "COMPLETED"}</p>
                          </div>
                          {n <= 9 && n > 0 && <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />}
                          {n <= 9 && n > 0 && (
                            <div className="flex-1 px-4 py-2 bg-[#FFFBF0] dark:bg-[#FFD500]/10 rounded-xl border border-[#FFD500]/30 min-w-0">
                               <p className="text-[8px] font-black text-slate-400 uppercase">ACTION</p>
                               <p className="text-[10px] font-black text-[#003875] dark:text-[#FFD500] uppercase truncate">Complete Step {n}</p>
                            </div>
                          )}
                       </div>

                       <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                             {isCheckStep ? (
                               <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-xl w-full border border-slate-200 dark:border-navy-800 shadow-inner">
                                  <button 
                                    onClick={() => setBulkData({...bulkData, [id]: {...data, status: "Approved"}})}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${data.status === "Approved" ? "bg-emerald-500 text-white shadow-md" : "text-slate-400"}`}
                                  >
                                    Approved
                                  </button>
                                  <button 
                                    onClick={() => setBulkData({...bulkData, [id]: {...data, status: "Rejected"}})}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${data.status === "Rejected" ? "bg-rose-500 text-white shadow-md" : "text-slate-400"}`}
                                  >
                                    Rejected
                                  </button>
                               </div>
                             ) : (
                               <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-xl w-full border border-slate-200 dark:border-navy-800 shadow-inner">
                                  <button 
                                    className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#003875] dark:bg-[#FFD500] text-[#FFD500] dark:text-navy-950 shadow-md"
                                  >
                                    Done
                                  </button>
                               </div>
                             )}
                          </div>

                          {(n === 1 || n === 3) && (
                            <input 
                              type="text" 
                              placeholder="Add Remarks..."
                              value={data.remarks || ""}
                              onChange={e => setBulkData({...bulkData, [id]: {...data, remarks: e.target.value}})}
                              className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-[10px] font-bold outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all"
                            />
                          )}

                          {n === 4 && (
                            <div className="space-y-1">
                               <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">VENDOR VISIT DATE</p>
                               <input 
                                 type="datetime-local" 
                                 value={data.visitDate || ""}
                                 onChange={e => setBulkData({...bulkData, [id]: {...data, visitDate: e.target.value}})}
                                 className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-[10px] font-bold outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all"
                               />
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-10 bg-[#FEFBF0] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
               <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-3 text-[11px] font-black uppercase text-slate-400 dark:text-navy-700 hover:text-slate-800 dark:hover:text-white transition-all">Cancel</button>
               <button onClick={handleBulkProcess} className="flex items-center gap-2.5 bg-[#003875] dark:bg-[#FFD500] text-[#FFD500] dark:text-navy-950 px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.1em] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-[#001a33] dark:border-navy-950"><SparklesIcon className="w-4 h-4" /> Execute Bulk Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#001a33]/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-white/10">
            {/* Cream Header */}
            <div className="px-8 pt-8 pb-6 bg-[#FEFBF0] dark:bg-navy-950 border-b border-orange-100/50 dark:border-navy-800 flex items-start justify-between">
              <div>
                <h2 className="text-[26px] font-black italic uppercase tracking-tighter text-[#003875] dark:text-white leading-none">Update Details</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2 text-slate-400">Refining procurement information</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-orange-50 dark:hover:bg-navy-800 rounded-full transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-navy-900">
               {/* Read Only Header Info */}
               <div className="flex gap-3 mb-4">
                  <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-[#003875] dark:text-blue-400 rounded text-[9px] font-black uppercase border border-blue-100 dark:border-blue-900/50">GRN- {editingItem?.GRN_No}</div>
                  <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded text-[9px] font-black uppercase border border-orange-100 dark:border-orange-900/50">PO- {editingItem?.PO_Number}</div>
               </div>

               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><CubeIcon className="w-3 h-3 text-[#FFD500]" /> Item Name</label>
                        <input type="text" value={formData.Item_Name || ""} onChange={e => setFormData({...formData, Item_Name: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-800 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><QueueListIcon className="w-3 h-3 text-[#FFD500]" /> Quantity</label>
                        <input type="text" value={formData.Qty || ""} onChange={e => setFormData({...formData, Qty: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-800 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all shadow-sm" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><TagIcon className="w-3 h-3 text-[#FFD500]" /> Category</label>
                        <input type="text" value={formData.Category || ""} onChange={e => setFormData({...formData, Category: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-800 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><GlobeAltIcon className="w-3 h-3 text-[#FFD500]" /> Country</label>
                        <select value={formData.Country || ""} onChange={e => setFormData({...formData, Country: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-900 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all cursor-pointer shadow-sm">
                           <option value="India">India</option>
                           <option value="China">China</option>
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarIcon className="w-3 h-3 text-[#FFD500]" /> Payment Terms (Days)</label>
                        <input type="text" value={formData.Payment_Terms_In_days || ""} onChange={e => setFormData({...formData, Payment_Terms_In_days: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-800 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><CheckBadgeIcon className="w-3 h-3 text-[#FFD500]" /> Payment Status</label>
                        <select value={formData.Payment_Completed || "No"} onChange={e => setFormData({...formData, Payment_Completed: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-900 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all cursor-pointer shadow-sm">
                           <option value="No">No</option>
                           <option value="Yes">Yes</option>
                           <option value="Partial">Partial</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><ArchiveBoxIcon className="w-3 h-3 text-[#FFD500]" /> Packed / Unpacked</label>
                     <select value={formData.Packed_Unpacked || ""} onChange={e => setFormData({...formData, Packed_Unpacked: e.target.value})} className="w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-900 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all cursor-pointer shadow-sm">
                        <option value="">Select</option>
                        <option value="Packed">Packed</option>
                        <option value="Unpacked">Unpacked</option>
                     </select>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><PaperClipIcon className="w-3 h-3 text-[#FFD500]" /> Attach Bill</label>
                     <div className="relative group">
                        <input type="file" id="grn-bill" hidden onChange={e => setBillFile(e.target.files?.[0] || null)} />
                        <label htmlFor="grn-bill" className="flex items-center justify-between w-full px-4 py-4 bg-[#FFFBF0] dark:bg-navy-950 border-2 border-dashed border-orange-100/50 dark:border-navy-800 rounded-2xl font-bold text-sm text-slate-400 cursor-pointer group-hover:border-[#FFD500] transition-all shadow-inner">
                           <div className="flex items-center gap-3">
                              <PhotoIcon className="w-5 h-5 text-[#FFD500]" />
                              <span className="truncate max-w-[300px]">{billFile ? billFile.name : formData.Attach_Bill ? "Change existing bill..." : "Choose file..."}</span>
                           </div>
                           <SparklesIcon className="w-4 h-4 text-slate-200 group-hover:text-[#FFD500]" />
                        </label>
                     </div>
                  </div>
               </div>
            </div>

            {/* Cream Footer */}
            <div className="p-8 py-6 bg-[#FEFBF0] dark:bg-navy-950 border-t border-orange-100/50 dark:border-zinc-800 flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={isUploading} className="flex-1 py-4 bg-[#003875] dark:bg-[#FFD500] text-white dark:text-navy-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#002855] dark:hover:bg-[#FFE600] transition-all shadow-lg active:scale-95 border-b-4 border-[#001a33] dark:border-navy-950 disabled:opacity-50">
                {isUploading ? "Uploading..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} />

      {/* ─── Config Modal ─── */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#001a33]/60 backdrop-blur-md" onClick={() => setIsConfigModalOpen(false)} />
          <div className="relative bg-[#FEFBF0] dark:bg-navy-800 w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="px-10 pt-6 pb-3 bg-[#FEFBF0] dark:bg-navy-800 flex items-start justify-between relative shrink-0">
              <div>
                <h2 className="text-[26px] font-black italic uppercase tracking-tighter text-[#003875] dark:text-white leading-none">System Configuration</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1 text-slate-400 dark:text-navy-600">Define TAT and Operators</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white absolute top-5 right-8">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pb-24 space-y-3 custom-scrollbar">
              {stepConfigs.map((cfg, i) => (
                <div key={i} className="p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-700 shadow-sm hover:shadow-md transition-all group">
                  <div className="grid grid-cols-[1fr_200px_350px] items-center gap-8">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase text-slate-400 dark:text-navy-600 tracking-widest">Step {i+1}</p>
                      <h3 className="text-[13px] font-black uppercase text-[#003875] dark:text-white tracking-tight leading-tight">{cfg.step_name}</h3>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-navy-600">
                        <ClockIcon className="w-3 h-3" />
                        <p className="text-[9px] font-black uppercase tracking-widest">TAT</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 dark:bg-navy-900 p-0.5 rounded-full flex items-center border border-slate-200 dark:border-navy-800">
                          <button onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Days", "Hrs"); setStepConfigs(n); }} className={`px-3 py-1 rounded-full text-[8px] font-black uppercase transition-all ${cfg.tat.includes("Hrs") ? "bg-[#FFD500] text-[#003875] shadow-md" : "text-slate-400 dark:text-navy-600"}`}>HRS</button>
                          <button onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Hrs", "Days"); setStepConfigs(n); }} className={`px-3 py-1 rounded-full text-[8px] font-black uppercase transition-all ${cfg.tat.includes("Days") ? "bg-[#FFD500] text-[#003875] shadow-md" : "text-slate-400"}`}>DAYS</button>
                        </div>
                        <input type="text" value={parseFloat(cfg.tat)} onChange={e => { const n = [...stepConfigs]; const unit = cfg.tat.includes("Days") ? "Days" : "Hrs"; n[i].tat = `${e.target.value} ${unit}`; setStepConfigs(n); }} className="w-12 h-8 bg-slate-50 dark:bg-navy-800 border-none rounded-lg text-center font-black text-xs text-[#003875] dark:text-[#FFD500] outline-none" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-navy-600">
                        <UserIcon className="w-3 h-3" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Responsible Operator</p>
                      </div>
                      <UserMultiCombobox value={cfg.responsible_person} isSimple onChange={val => { const n = [...stepConfigs]; n[i].responsible_person = val; setStepConfigs(n); }} users={usersList} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-10 bg-[#FEFBF0] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-3 text-[11px] font-black uppercase text-slate-400 dark:text-navy-600 hover:text-slate-800 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={handleSaveConfig} className="flex items-center gap-2.5 bg-[#003875] dark:bg-[#FFD500] text-[#FFD500] dark:text-navy-950 px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.1em] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-[#001a33] dark:border-navy-950">
                <Cog6ToothIcon className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Remove Follow Up Modal ─── */}
      {isRemoveFollowUpModalOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#001a33]/60 backdrop-blur-md" onClick={() => setIsRemoveFollowUpModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-[#003875] dark:text-white uppercase leading-none">Remove Follow Up</h2>
                <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 mt-2 uppercase">GRN: {targetItemForRemoveFollowUp?.GRN_No} — {targetItemForRemoveFollowUp?.Item_Name}</p>
              </div>
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="text-slate-300 dark:text-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[11px] font-black text-slate-800 dark:text-white/80 uppercase block mb-3">Select Step to Reset</label>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 9 }, (_, i) => i + 1).map(s => (
                    <button
                      key={s}
                      onClick={() => setRemoveFollowUpStep(s)}
                      className={`py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                        removeFollowUpStep === s
                          ? "bg-purple-500 border-purple-500 text-white shadow-lg scale-110 z-10"
                          : "bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-navy-700 text-slate-400 dark:text-navy-600 hover:border-purple-200 dark:hover:border-purple-900"
                      }`}
                    >
                      ST {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-bold text-slate-400 dark:text-navy-600 italic">
                  {GRN_STEP_SHORT[removeFollowUpStep - 1]}
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-800 dark:text-white/80 uppercase block">Removal Logic</label>
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
                      <span className={`text-[11px] font-black uppercase ${removeFollowUpType === 'particular' ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-navy-400"}`}>Particular Step</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-navy-600 leading-tight">Only reset the selected step. Keeps planned time.</p>
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
                      <span className={`text-[11px] font-black uppercase ${removeFollowUpType === 'onwards' ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-navy-400"}`}>Step Onwards</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-navy-600 leading-tight">Reset selected step & remove all future steps.</p>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20 flex gap-3">
                <ExclamationCircleIcon className="w-5 h-5 text-orange-500 shrink-0" />
                <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 leading-relaxed">
                  This will clear "Actual" dates and step-specific data (Remarks, Visit Dates) for the selected steps. Planned time for Step {removeFollowUpStep} will be preserved.
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setIsRemoveFollowUpModalOpen(false)} className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button onClick={handleRemoveFollowUp} className="flex-1 py-3.5 bg-purple-600 dark:bg-purple-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 dark:hover:bg-purple-400 transition-all shadow-lg active:scale-95">Reset Step</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Modal ─── */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title={confirmAction === "delete" ? "Delete GRN Entry" : confirmAction === "cancel" ? "Cancel GRN Entry" : "Restore GRN Entry"}
        message={confirmAction === "delete" ? "Are you sure you want to permanently delete this GRN entry? This action cannot be undone." : confirmAction === "cancel" ? "Are you sure you want to cancel this GRN entry? It will be moved to the cancelled tab." : "Are you sure you want to restore this GRN entry to the active tracking view?"}
        confirmLabel={confirmAction === "delete" ? "Delete" : confirmAction === "cancel" ? "Cancel Entry" : "Restore Entry"}
        onConfirm={executeConfirmAction}
        onClose={() => setIsConfirmOpen(false)}
        type={confirmAction === "delete" || confirmAction === "cancel" ? "danger" : "info"}
      />
    </div>
  );
}
