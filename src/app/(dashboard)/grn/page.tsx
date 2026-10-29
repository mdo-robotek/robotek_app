"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFindFromLink } from "@/hooks/useFindFromLink";
import { useIsPhone } from "@/hooks/useIsPhone";
import PhoneStepSelect from "@/components/PhoneStepSelect";
import { useSession } from "next-auth/react";
import { GRN, GRNStepConfig } from "@/types/grn";
import useSWR from "swr";
import ItemNamePicker from "@/components/ItemNamePicker";
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
import ModuleStrip from "@/components/ModuleStrip";
import ProcessScreen from "@/components/process/ProcessScreen";
import { autoDetails, autoFacts, type ProcessConfig } from "@/components/process/process-view";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const GRN_STEP_SHORT = [
  "Quantity check",
  "Inform Vendor & Confirm Qty",
  "Quality check",
  "Inform the Vendor",
  "Quality Check with vendor",
  "Debit Note issue to Vendor",
  "Update Purchase in Busy (Shubham)",
  "Update Purchase in Busy (Vishal)",
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

      {open && (
        <div className="absolute z-[1001] w-full mt-1 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto p-1.5">
          {listToShow.length === 0 ? (
            <p className="px-4 py-2 text-[14px] font-bold text-[#5B6472] italic">No users found</p>
          ) : (
            listToShow.map((u) => (
              <div
                key={u}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(u);
                }}
                className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-navy-800 text-[14px] font-semibold text-slate-700 dark:text-white rounded-lg cursor-pointer transition-all flex items-center justify-between group"
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
  const isPhone = useIsPhone();
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | "all" | "completed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  // "Open" in the work-list window lands here with ?find=GRN-xxx
  useFindFromLink((t) => { setSelectedStepFilter("all"); setDateFilter(null); setViewMode("active"); setSearchTerm(t); setCurrentPage(1); });
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

  const openBulkModal = (only?: string[]) => {
    const ids = only ? new Set(only) : selectedIds;
    if (only) setSelectedIds(ids);
    const initialToggles: Record<string, boolean> = {};
    const initialData: Record<string, any> = {};
    ids.forEach(id => { 
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

  // One list + window, same as O2D (Sahil, 2026-10-29). Non-admins see only
  // the work at their step (and finished ones) — same rule as before.
  const screenItems: GRN[] = isAdmin ? items : items.filter((it) => {
    if (String((it as any).cancelled || "").trim()) return false;
    const st = getActiveStep(it);
    if (st === 0) return true;
    return !!stepConfig[st - 1]?.responsible_person?.split(",").map((x: string) => x.trim()).includes(currentUser);
  });
  const procCfg: ProcessConfig<GRN> = {
    unit: "GRNs",
    steps: GRN_STEP_SHORT,
    doers: GRN_STEP_SHORT.map((_: unknown, i: number) => stepConfig[i]?.responsible_person || ""),
    id: (r) => String(r.id),
    ref: (r) => String(r.GRN_No || ""),
    title: (r) => String(r.Item_Name || ""),
    sub: (r) => String([r.PO_Number && `PO ${r.PO_Number}`, r.Category].filter(Boolean).join(" · ") || ""),
    amount: (r) => { const v = Number(String(r.Qty || "").replace(/[^\d.]/g, "")); return v ? `${v.toLocaleString("en-IN")} pcs` : ""; },
    step: (r) => getActiveStep(r),
    planned: (r, n) => (r as any)[`planned_${n}`] || "",
    actual: (r, n) => (r as any)[`actual_${n}`] || "",
    isCancelled: (r) => !!String((r as any).cancelled || "").trim(),
    search: (r) => Object.values(r as any).filter((v) => typeof v === "string").join(" "),
    created: (r) => String(((r as any).created_at || r.updated_at) || ""),
    stepFacts: (r, n) => autoFacts(r, n),
    details: (r) => autoDetails(r, ["GRN_No","Item_Name","PO_Number","Category","Qty"]),
  };

  return (
    <div className="flex flex-col h-screen bg-[#FFFFFF] dark:bg-navy-950 overflow-hidden">
      {/* ─── Header Section ─── */}
      <div className="px-2 py-0.5 bg-[#FFFFFF] dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800 shrink-0 relative">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white">GRN</h1>
            <p className="text-[14px] text-[#5B6472]">Goods received — check, update in Busy, pay</p>
          </div>
          
          {/* Central Pill Actions */}
          <div className="self-start md:absolute md:left-1/2 md:-translate-x-1/2 flex flex-wrap items-center gap-1 rounded-xl border border-[#E5E7EB] dark:border-navy-700 bg-white dark:bg-navy-900 p-0.5">
            <button className="flex items-center gap-2 px-4 py-1.5 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> <span>Export</span>
            </button>
            <button onClick={openConfigModal} className="flex items-center gap-2 px-4 py-1.5 font-semibold text-[13px] text-[#2563EB] dark:text-[#60A5FA] hover:bg-slate-50 dark:hover:bg-navy-800 transition-all rounded-full">
              <Cog6ToothIcon className="w-3.5 h-3.5" /> <span>Config</span>
            </button>
            <div className="hidden md:block w-[1px] h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
          </div>
        </div>
      </div>
      {/* Key figures — same numbers as the Goods In tile on the CEO home */}
      <div className="pt-2"><ModuleStrip module="grn" onFigure={(f) => { if (f.step !== undefined && f.step !== "tbd") setSelectedStepFilter(f.step); }} /></div>

      {/* One list + window, same as O2D (Sahil, 2026-10-29) */}
      <div className="flex-1 flex overflow-hidden mt-2 px-1 min-w-0">
        <ProcessScreen
          cfg={procCfg}
          items={screenItems}
          loading={isLoading}
          initialSearch={searchTerm}
          primary={[{ label: "Update step", onClick: (r) => openBulkModal([String(r.id)]) }]}
          footer={[{ label: "Edit", onClick: (r) => openEditModal(r), show: (r) => isAdmin || getActiveStep(r) > 0 }, { label: "Remove follow-up", onClick: (r) => openRemoveFollowUpModal(r), show: (r) => isAdmin && !String((r as any).cancelled || "").trim() }]}
          menu={[{ label: "Cancel GRN", tone: "danger", onClick: (r) => confirmCancelRestore(r), show: (r) => !String((r as any).cancelled || "").trim() && (isAdmin || getActiveStep(r) > 0) }, { label: "Restore", onClick: (r) => confirmCancelRestore(r), show: (r) => !!String((r as any).cancelled || "").trim() }, { label: "Delete", tone: "danger", onClick: (r) => confirmDelete(r), show: () => isAdmin }]}
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

      {/* Bulk Processor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-5xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="px-5 md:px-10 pt-6 pb-3 bg-[#FFFFFF] dark:bg-navy-800 flex items-start justify-between relative shrink-0 border-b border-slate-100 dark:border-navy-700">
              <div><h2 className="text-[22px] font-semibold text-[#1A1D21] dark:text-white leading-none">Update step</h2><p className="text-[13px] font-semibold mt-1 text-[#5B6472]">Processing {Array.from(selectedIds).length} selected GRN entries</p></div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-full transition-all text-[#5B6472] hover:text-slate-900 dark:hover:text-white absolute top-5 right-8"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 pt-4 space-y-3 custom-scrollbar">
              {Array.from(selectedIds).map(id => {
                const it = items.find(r => r.id === id); if (!it) return null; 
                const n = getActiveStep(it); 
                const t = bulkToggles[id] ?? true;
                const data = bulkData[id] || {};
                const isCheckStep = n === 1 || n === 3 || n === 5;
                
                return (
                  <div key={id} className={`p-4 md:p-5 bg-white dark:bg-navy-900 rounded-3xl border transition-all ${t ? "border-[#2563EB]/20 dark:border-[#60A5FA]/20 shadow-sm" : "border-slate-100 dark:border-navy-800 opacity-40 shadow-none grayscale"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1.5fr] items-center gap-3 md:gap-6">
                       <div className="flex items-center gap-4">
                          <button onClick={() => setBulkToggles({...bulkToggles, [id]: !t})} className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${t ? "bg-[#2563EB] border-[#2563EB] text-white" : "border-slate-100 text-transparent"}`}><CheckCircleIcon className="w-5 h-5" /></button>
                          <div className="min-w-0"><p className="text-[13px] font-semibold text-[#5B6472] truncate">{it.GRN_No}</p><p className="text-[13px] font-semibold text-[#2563EB] dark:text-white truncate">{it.Item_Name}</p></div>
                       </div>

                       <div className="flex items-center gap-4">
                          <div className="flex-1 px-4 py-2 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-navy-700 min-w-0">
                             <p className="text-[14px] font-semibold text-[#5B6472]">Current Step</p>
                             <p className="text-[13px] font-semibold text-slate-700 dark:text-white break-words md:truncate">{n <= 9 && n > 0 ? GRN_STEP_SHORT[n-1] : "COMPLETED"}</p>
                          </div>
                          {n <= 9 && n > 0 && <ChevronRightIcon className="w-4 h-4 text-[#5B6472] shrink-0" />}
                          {n <= 9 && n > 0 && (
                            <div className="flex-1 px-4 py-2 bg-[#FFFFFF] dark:bg-[#60A5FA]/10 rounded-xl border border-[#2563EB]/30 min-w-0">
                               <p className="text-[14px] font-semibold text-[#5B6472]">Action</p>
                               <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] break-words md:truncate">Complete Step {n}</p>
                            </div>
                          )}
                       </div>

                       <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                             {isCheckStep ? (
                               <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-xl w-full border border-slate-200 dark:border-navy-800 shadow-inner">
                                  <button 
                                    onClick={() => setBulkData({...bulkData, [id]: {...data, status: "Approved"}})}
                                    className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${data.status === "Approved" ? "bg-emerald-500 text-white shadow-md" : "text-[#5B6472]"}`}
                                  >
                                    Approved
                                  </button>
                                  <button 
                                    onClick={() => setBulkData({...bulkData, [id]: {...data, status: "Rejected"}})}
                                    className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${data.status === "Rejected" ? "bg-rose-500 text-white shadow-md" : "text-[#5B6472]"}`}
                                  >
                                    Rejected
                                  </button>
                               </div>
                             ) : (
                               <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-xl w-full border border-slate-200 dark:border-navy-800 shadow-inner">
                                  <button 
                                    className="flex-1 py-1.5 rounded-lg text-[13px] font-semibold bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 shadow-md"
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
                              className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-[13px] font-bold outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all"
                            />
                          )}

                          {n === 4 && (
                            <div className="space-y-1">
                               <p className="text-[14px] font-semibold text-[#5B6472] ml-1">Vendor Visit Date</p>
                               <input 
                                 type="datetime-local" 
                                 value={data.visitDate || ""}
                                 onChange={e => setBulkData({...bulkData, [id]: {...data, visitDate: e.target.value}})}
                                 className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-[13px] font-bold outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all"
                               />
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
               <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472] dark:text-navy-700 hover:text-slate-800 dark:hover:text-white transition-all">Cancel</button>
               <button onClick={handleBulkProcess} className="flex items-center gap-2.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-[#1D4ED8] dark:border-navy-950"><SparklesIcon className="w-4 h-4" /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-white/10">
            {/* Cream Header */}
            <div className="px-8 pt-8 pb-6 bg-[#FFFFFF] dark:bg-navy-950 border-b border-[#E5E7EB] dark:border-navy-800 flex items-start justify-between">
              <div>
                <h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">Update Details</h2>
                <p className="text-[13px] font-semibold mt-2 text-[#5B6472]">Refining procurement information</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#F7F8FA] dark:hover:bg-navy-800 rounded-full transition-all text-[#5B6472] hover:text-slate-900 dark:hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-navy-900">
               {/* Read Only Header Info */}
               <div className="flex gap-3 mb-4">
                  <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 rounded text-[13px] font-semibold border border-blue-100 dark:border-blue-900/50">GRN- {editingItem?.GRN_No}</div>
                  <div className="px-3 py-1.5 bg-[#F7F8FA] dark:bg-[#FEF3C7] text-[#D97706] dark:text-[#D97706] rounded text-[13px] font-semibold border border-[#E5E7EB] dark:border-[#E5E7EB]">PO- {editingItem?.PO_Number}</div>
               </div>

               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><CubeIcon className="w-3 h-3 text-[#2563EB]" /> Item Name</label>
                        <ItemNamePicker value={formData.Item_Name || ""} onChange={v => setFormData({...formData, Item_Name: v})} isAdmin={isAdmin} listId="grn-item-names" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><QueueListIcon className="w-3 h-3 text-[#2563EB]" /> Quantity</label>
                        <input type="text" value={formData.Qty || ""} onChange={e => setFormData({...formData, Qty: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-800 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><TagIcon className="w-3 h-3 text-[#2563EB]" /> Category</label>
                        <input type="text" value={formData.Category || ""} onChange={e => setFormData({...formData, Category: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-800 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><GlobeAltIcon className="w-3 h-3 text-[#2563EB]" /> Country</label>
                        <select value={formData.Country || ""} onChange={e => setFormData({...formData, Country: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all cursor-pointer shadow-sm">
                           <option value="India">India</option>
                           <option value="China">China</option>
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><CalendarIcon className="w-3 h-3 text-[#2563EB]" /> Payment Terms (Days)</label>
                        <input type="text" value={formData.Payment_Terms_In_days || ""} onChange={e => setFormData({...formData, Payment_Terms_In_days: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-800 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><CheckBadgeIcon className="w-3 h-3 text-[#2563EB]" /> Payment Status</label>
                        <select value={formData.Payment_Completed || "No"} onChange={e => setFormData({...formData, Payment_Completed: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all cursor-pointer shadow-sm">
                           <option value="No">No</option>
                           <option value="Yes">Yes</option>
                           <option value="Partial">Partial</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><ArchiveBoxIcon className="w-3 h-3 text-[#2563EB]" /> Packed / Unpacked</label>
                     <select value={formData.Packed_Unpacked || ""} onChange={e => setFormData({...formData, Packed_Unpacked: e.target.value})} className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all cursor-pointer shadow-sm">
                        <option value="">Select</option>
                        <option value="Packed">Packed</option>
                        <option value="Unpacked">Unpacked</option>
                     </select>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1.5"><PaperClipIcon className="w-3 h-3 text-[#2563EB]" /> Attach Bill</label>
                     <div className="relative group">
                        <input type="file" id="grn-bill" hidden onChange={e => setBillFile(e.target.files?.[0] || null)} />
                        <label htmlFor="grn-bill" className="flex items-center justify-between w-full px-4 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-2 border-dashed border-[#E5E7EB] dark:border-navy-800 rounded-2xl font-bold text-sm text-[#5B6472] cursor-pointer group-hover:border-[#2563EB] transition-all shadow-inner">
                           <div className="flex items-center gap-3">
                              <PhotoIcon className="w-5 h-5 text-[#2563EB]" />
                              <span className="truncate max-w-[300px]">{billFile ? billFile.name : formData.Attach_Bill ? "Change existing bill..." : "Choose file..."}</span>
                           </div>
                           <SparklesIcon className="w-4 h-4 text-slate-200 group-hover:text-[#2563EB]" />
                        </label>
                     </div>
                  </div>
               </div>
            </div>

            {/* Cream Footer */}
            <div className="p-8 py-6 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-2xl font-semibold text-[14px] hover:bg-slate-50 dark:hover:bg-navy-700 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={isUploading} className="flex-1 py-4 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-2xl font-semibold text-[14px] hover:bg-[#1D4ED8] dark:hover:bg-[#1D4ED8] transition-all shadow-lg active:scale-95 border-b-4 border-[#1D4ED8] dark:border-navy-950 disabled:opacity-50">
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
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsConfigModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-800 w-full max-w-4xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="px-5 md:px-10 pt-6 pb-3 bg-[#FFFFFF] dark:bg-navy-800 flex items-start justify-between relative shrink-0">
              <div>
                <h2 className="text-[26px] font-semibold italic tracking-tighter text-[#2563EB] dark:text-white leading-none">System Configuration</h2>
                <p className="text-[13px] font-semibold mt-1 text-[#5B6472] dark:text-navy-600">Define TAT and Operators</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full transition-all text-[#5B6472] hover:text-slate-900 dark:hover:text-white absolute top-5 right-8">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 md:px-10 pb-24 space-y-3 custom-scrollbar">
              {stepConfigs.map((cfg, i) => (
                <div key={i} className="p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-100 dark:border-navy-700 shadow-sm hover:shadow-md transition-all group">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_350px] items-center gap-3 md:gap-8">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-semibold text-[#5B6472] dark:text-navy-600">Step {i+1}</p>
                      <h3 className="text-[13px] font-semibold text-[#2563EB] dark:text-white tracking-tight leading-tight">{cfg.step_name}</h3>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#5B6472] dark:text-navy-600">
                        <ClockIcon className="w-3 h-3" />
                        <p className="text-[13px] font-semibold">TAT</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 dark:bg-navy-900 p-0.5 rounded-full flex items-center border border-slate-200 dark:border-navy-800">
                          <button onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Days", "Hrs"); setStepConfigs(n); }} className={`px-3 py-1 rounded-full text-[14px] font-semibold  transition-all ${cfg.tat.includes("Hrs") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472] dark:text-navy-600"}`}>HRS</button>
                          <button onClick={() => { const n = [...stepConfigs]; n[i].tat = n[i].tat.replace("Hrs", "Days"); setStepConfigs(n); }} className={`px-3 py-1 rounded-full text-[14px] font-semibold  transition-all ${cfg.tat.includes("Days") ? "bg-[#2563EB] text-white shadow-md" : "text-[#5B6472]"}`}>Days</button>
                        </div>
                        <input type="text" value={parseFloat(cfg.tat)} onChange={e => { const n = [...stepConfigs]; const unit = cfg.tat.includes("Days") ? "Days" : "Hrs"; n[i].tat = `${e.target.value} ${unit}`; setStepConfigs(n); }} className="w-12 h-8 bg-slate-50 dark:bg-navy-800 border-none rounded-lg text-center font-semibold text-[14px] text-[#2563EB] dark:text-[#60A5FA] outline-none" />
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

            <div className="absolute bottom-0 left-0 right-0 py-3.5 px-4 md:px-10 bg-[#FFFFFF] dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-3 text-[14px] font-semibold text-[#5B6472] dark:text-navy-600 hover:text-slate-800 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={handleSaveConfig} className="flex items-center gap-2.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 px-10 py-3.5 rounded-2xl font-semibold text-[14px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-[#1D4ED8] dark:border-navy-950">
                <Cog6ToothIcon className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Remove Follow Up Modal ─── */}
      {isRemoveFollowUpModalOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={() => setIsRemoveFollowUpModalOpen(false)} />
          <div className="relative bg-white dark:bg-navy-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[#2563EB] dark:text-white leading-none">Remove Follow Up</h2>
                <p className="text-[13px] font-semibold text-purple-600 dark:text-purple-400 mt-2">GRN: {targetItemForRemoveFollowUp?.GRN_No} — {targetItemForRemoveFollowUp?.Item_Name}</p>
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
                <p className="mt-2 text-[13px] font-bold text-[#5B6472] dark:text-navy-600 italic">
                  {GRN_STEP_SHORT[removeFollowUpStep - 1]}
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
                  This will clear "Actual" dates and step-specific data (Remarks, Visit Dates) for the selected steps. Planned time for Step {removeFollowUpStep} will be preserved.
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
