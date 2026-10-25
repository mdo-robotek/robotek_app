"use client";

import { useState, useEffect, useRef } from "react";
import { PartyManagement } from "@/types/party-management";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  TagIcon,
  UserIcon,
  BriefcaseIcon,
  Bars3BottomLeftIcon,
  IdentificationIcon,
  QueueListIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleBottomCenterTextIcon,
  EyeIcon
} from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useSSE } from "@/hooks/useSSE";
import { applyIncrementalUpdate } from "@/lib/utils/swr-sync";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

import PartyFormModal, {
  FIRST_ORDER_ITEMS_OPTIONS,
  DETAILS_INSTRUCTIONS_OPTIONS
} from "@/components/PartyFormModal";

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function PartyManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [parties, setParties] = useState<PartyManagement[]>([]);
  const [totalItems, setTotalItems] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: swrResponse, mutate: mutateParties } = useSWR(
    `/api/party-management?page=${currentPage}&limit=${itemsPerPage}&search=${debouncedSearch}`,
    fetcher,
    {
      refreshInterval: 0,        // No background polling — SSE handles change detection
      revalidateOnFocus: true,   // Refetch when user returns to the tab
      revalidateOnMount: true,   // Refetch on page load
    }
  );

  // SSE: instantly refetch when a new party is added or deleted
  // SSE: incrementally update local cache when a change is detected
  useSSE({ 
    modules: ['party-management'], 
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === 'party-management');
      if (updates) {
        mutateParties((current: PartyManagement[] | undefined) => applyIncrementalUpdate(current, updates.upserts, updates.currentIds), false);
      }
    } 
  });

  useEffect(() => {
    if (swrResponse) {
      setParties(swrResponse.data || []);
      setTotalItems(swrResponse.total || 0);
    }
  }, [swrResponse]);

  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyManagement | null>(null);
  // const [searchTerm, setSearchTerm] = useState(""); // Moved up
  const [sortConfig, setSortConfig] = useState<{ key: keyof PartyManagement; direction: "asc" | "desc" } | null>(null);
  // const [currentPage, setCurrentPage] = useState(1); // Moved up
  // const [itemsPerPage, setItemsPerPage] = useState(10); // Moved up

  const { data: session } = useSession();

  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // View Details Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewModalTitle, setViewModalTitle] = useState("");
  const [viewModalItems, setViewModalItems] = useState<string[]>([]);
  const [viewModalBaseOptions, setViewModalBaseOptions] = useState<string[]>([]);

  const handleViewItems = (title: string, itemsString: string, baseOptions: string[]) => {
    setViewModalTitle(title);
    setViewModalItems(itemsString ? itemsString.split(",").map(i => i.trim()).filter(Boolean) : []);
    setViewModalBaseOptions(baseOptions);
    setIsViewModalOpen(true);
  };

  useEffect(() => {
    if (!swrResponse && parties.length === 0) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [swrResponse, parties]);

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const openFormForNew = () => {
    setEditingParty(null);
    setIsModalOpen(true);
  };

  const openFormForEdit = (party: PartyManagement) => {
    setEditingParty(party);
    setIsModalOpen(true);
  };

  // ─── Data Fetching ────────────────────────────────────────────────────────────
  const fetchParties = async () => {
    mutateParties();
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    setActionStatus("loading");
    setActionMessage("Removing party from system...");
    setIsStatusModalOpen(true);
    try {
      const res = await fetch(`/api/party-management/${pendingDeleteId}`, { method: "DELETE" });
      if (res.ok) { setIsStatusModalOpen(false); mutateParties(); }
      else throw new Error("Delete failed");
    } catch {
      setIsStatusModalOpen(false);
      alert("Failed to delete party. Please try again.");
    } finally {
      setPendingDeleteId(null);
    }
  };

  // ─── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setActionStatus("loading");
      setActionMessage("Preparing export data...");
      setIsStatusModalOpen(true);

      // Fetch all filtered data
      const res = await fetch(`/api/party-management?limit=-1&search=${debouncedSearch}`);
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || "Failed to fetch data for export");
      
      const allData: PartyManagement[] = result.data || [];
      
      // Apply current sorting if any
      const exportData = [...allData].sort((a, b) => {
        if (!sortConfig) {
          const aN = parseInt(String(a.id));
          const bN = parseInt(String(b.id));
          if (!isNaN(aN) && !isNaN(bN)) return bN - aN;
          return 0;
        }
        
        const { key, direction } = sortConfig;
        let aV = a[key] || ""; let bV = b[key] || "";
        if (key === "id") { 
          const aN = parseInt(String(aV)); 
          const bN = parseInt(String(bV)); 
          if (!isNaN(aN) && !isNaN(bN)) return direction === "asc" ? aN - bN : bN - aN; 
        }
        if (aV < bV) return direction === "asc" ? -1 : 1;
        if (aV > bV) return direction === "asc" ? 1 : -1;
        return 0;
      });

      const headers = ["ID", "Timestamp", "Customer Type", "Party Name", "Date of Birth", "Anniversary", "Party Type", "Sales Funnel Unique Num", "Sale Person Name", "Add following items with First order :", "Details and Instructions :", "Remarks", "Filled By"];
      const rows = exportData.map((p) => [
        p.id, 
        p.timestamp ? new Date(p.timestamp).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "",
        p.customerType, 
        p.partyName, 
        p.dateOfBirth,
        p.anniversary,
        p.partyType, 
        p.salesFunnelUniqueNum, 
        p.salePersonName, 
        p.firstOrderItems, 
        p.detailsAndInstructions, 
        p.remarks, 
        p.filledBy
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `party_management_export_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      setActionStatus("error");
      setActionMessage("Failed to export data");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  // Client-side filtering is now minimized because search happens on server
  // But we still sort the current page's data
  const sortedParties = [...parties].sort((a, b) => {
    // Default to sorting by ID descending (latest first) if no active sort column
    if (!sortConfig) {
      const aN = parseInt(String(a.id));
      const bN = parseInt(String(b.id));
      if (!isNaN(aN) && !isNaN(bN)) return bN - aN;
      return 0;
    }
    
    const { key, direction } = sortConfig;
    let aV = a[key] || ""; let bV = b[key] || "";
    if (key === "id") { const aN = parseInt(String(aV)); const bN = parseInt(String(bV)); if (!isNaN(aN) && !isNaN(bN)) return direction === "asc" ? aN - bN : bN - aN; }
    if (aV < bV) return direction === "asc" ? -1 : 1;
    if (aV > bV) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof PartyManagement) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const SortIcon = ({ column }: { column: keyof PartyManagement }) => {
    if (sortConfig?.key !== column) return <div className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === "asc"
      ? <ChevronUpIcon className="w-3 h-3 ml-1 text-[#2563EB]" />
      : <ChevronDownIcon className="w-3 h-3 ml-1 text-[#2563EB]" />;
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedParties = sortedParties; // Already paginated from server

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4 mb-2">
        <div className="flex flex-col lg:flex-row items-center gap-4 px-1">
          <div className="w-full lg:w-1/3 text-center lg:text-left min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Party Management</h1>
            <p className="text-gray-500 dark:text-slate-300 font-bold text-[12px] md:text-[10px] tracking-wider">Customer &amp; Client Directory</p>
          </div>
          <div className="w-full lg:w-1/3 flex justify-center flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1 rounded-full border-2 border-b-4 border-[#2563EB] dark:border-[#60A5FA] bg-white dark:bg-navy-800 shadow-sm transition-all active:translate-y-[2px] active:border-b-2 p-1 overflow-x-auto no-scrollbar max-w-full">
              <button className="flex items-center gap-2 px-3 md:px-5 py-1.5 font-semibold text-[13px] md:text-[10px] transition-all rounded-full whitespace-nowrap bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black shadow-md" title="Party List">
                <UserGroupIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Party List</span>
                <span className="sm:hidden">Parties</span>
              </button>
              <button onClick={handleExport} className="flex items-center justify-center gap-2 text-[#2563EB] dark:text-[#60A5FA] px-3 md:px-5 py-1.5 font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-navy-700 text-[13px] md:text-[10px] rounded-full whitespace-nowrap" title="Export to CSV">
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button onClick={openFormForNew} className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 text-[#2563EB] dark:text-[#60A5FA] px-3 py-1.5 transition-colors rounded-full" title="Add Party">
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="hidden lg:block lg:w-1/3"></div>
        </div>
      </div>

      {/* Table Card */}
      <div style={{ borderColor: "var(--panel-border)" }} className="rounded-2xl border overflow-hidden shadow-sm transition-all duration-500">
        {/* Controls */}
        <div style={{ backgroundColor: "var(--panel-card)", borderBottom: "1px solid var(--panel-border)" }} className="px-3 md:px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative group flex-1 max-w-full lg:max-w-sm">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472] group-focus-within:text-[#2563EB] transition-colors" />
            <input type="text" placeholder="Search database..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-1.5 bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700/50 rounded-lg focus:border-[#2563EB] outline-none font-bold text-[13px] text-gray-700 dark:text-white transition-all shadow-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[13px] md:text-[10px] font-semibold text-[#5B6472] whitespace-nowrap">Page <span className="text-[#2563EB] dark:text-[#60A5FA]">{currentPage}</span> of {totalPages || 1}</p>
              <div className="flex gap-0.5">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-1.5 py-1 text-[13px] md:text-[10px] font-bold text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all whitespace-nowrap">First</button>
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="px-1.5 py-1 text-[13px] md:text-[10px] font-bold text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all whitespace-nowrap">Last</button>
              </div>
            </div>
            <div className="hidden xs:block h-4 w-[1px] bg-gray-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <label className="text-[13px] md:text-[10px] font-semibold text-[#5B6472]">Show</label>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border-none p-0 text-[13px] font-bold outline-none dark:text-white cursor-pointer">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ backgroundColor: "var(--panel-card)" }} className="overflow-x-auto transition-colors duration-500">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-[#2563EB] dark:bg-navy-950 text-white dark:text-slate-200">
                <th onClick={() => handleSort("id")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors w-16 md:w-20"><div className="flex items-center">ID <SortIcon column="id" /></div></th>
                <th onClick={() => handleSort("partyName")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"><div className="flex items-center">Party Name <SortIcon column="partyName" /></div></th>
                <th onClick={() => handleSort("dateOfBirth")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"><div className="flex items-center">Dob <SortIcon column="dateOfBirth" /></div></th>
                <th onClick={() => handleSort("anniversary")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"><div className="flex items-center">Anniv <SortIcon column="anniversary" /></div></th>
                <th onClick={() => handleSort("customerType")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell"><div className="flex items-center">Customer Type <SortIcon column="customerType" /></div></th>
                <th onClick={() => handleSort("partyType")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden md:table-cell"><div className="flex items-center">Party Type <SortIcon column="partyType" /></div></th>
                <th onClick={() => handleSort("salePersonName")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell"><div className="flex items-center">Sales Person <SortIcon column="salePersonName" /></div></th>
                <th onClick={() => handleSort("salesFunnelUniqueNum")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden xl:table-cell"><div className="flex items-center">SF Num <SortIcon column="salesFunnelUniqueNum" /></div></th>
                <th className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold hidden xl:table-cell">1st Order</th>
                <th className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold hidden 2xl:table-cell">Details</th>
                <th onClick={() => handleSort("filledBy")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden 2xl:table-cell"><div className="flex items-center">Filled By <SortIcon column="filledBy" /></div></th>
                <th onClick={() => handleSort("timestamp")} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell"><div className="flex items-center">Timestamp <SortIcon column="timestamp" /></div></th>
                <th className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><div className="w-6 h-6 border-2 border-gray-100 border-t-[#2563EB] rounded-full animate-spin mx-auto mb-2" /><p className="text-[#5B6472] font-bold text-[12px]">Syncing...</p></td></tr>
              ) : paginatedParties.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><p className="text-[14px] text-[#5B6472] font-bold">No entries found</p></td></tr>
              ) : (
                paginatedParties.map((party) => (
                  <tr key={party.id} className="hover:bg-[#F7F8FA] border-b-2 border-gray-200 dark:border-white/10 last:border-0 transition-colors group">
                    <td className="px-3 md:px-4 py-3">
                      <span className="font-semibold text-[14px] md:text-xs text-gray-900 dark:text-white leading-tight">{party.id}</span>
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] md:text-xs text-gray-900 dark:text-white leading-tight truncate">{party.partyName || "Unnamed Party"}</p>
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3 text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">
                      {(() => {
                        if (!party.dateOfBirth) return "—";
                        const d = new Date(party.dateOfBirth);
                        return isNaN(d.getTime()) ? party.dateOfBirth : d.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: '2-digit' });
                      })()}
                    </td>
                    <td className="px-3 md:px-4 py-3 text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">
                      {(() => {
                        if (!party.anniversary) return "—";
                        const d = new Date(party.anniversary);
                        return isNaN(d.getTime()) ? party.anniversary : d.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: '2-digit' });
                      })()}
                    </td>
                    <td className="px-3 md:px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 bg-[#F7F8FA] dark:bg-[#60A5FA]/10 text-[#DC2626] dark:text-[#60A5FA] text-[12px] md:text-[10px] font-semibold rounded-md border border-[#E5E7EB] dark:border-[#60A5FA]/20">{party.customerType || "—"}</span>
                    </td>
                    <td className="px-3 md:px-4 py-3 hidden md:table-cell"><p className="text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{party.partyType || "—"}</p></td>
                    <td className="px-3 md:px-4 py-3 hidden lg:table-cell"><p className="text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{party.salePersonName || "—"}</p></td>
                    <td className="px-3 md:px-4 py-3 hidden xl:table-cell"><span className="font-mono text-[14px] font-bold text-gray-500">{party.salesFunnelUniqueNum || "—"}</span></td>
                    <td className="px-3 md:px-4 py-3 hidden xl:table-cell">
                      <button onClick={() => handleViewItems("Add following items with First order :", party.firstOrderItems, FIRST_ORDER_ITEMS_OPTIONS)} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:text-[#2563EB] dark:hover:text-[#60A5FA] rounded-md transition-colors text-[13px] font-semibold">
                        <EyeIcon className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                    <td className="px-3 md:px-4 py-3 hidden 2xl:table-cell">
                      <button onClick={() => handleViewItems("Details and Instructions :", party.detailsAndInstructions, DETAILS_INSTRUCTIONS_OPTIONS)} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:text-[#2563EB] dark:hover:text-[#60A5FA] rounded-md transition-colors text-[13px] font-semibold">
                        <EyeIcon className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                    <td className="px-3 md:px-4 py-3 hidden 2xl:table-cell"><p className="text-[13px] font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 inline-block px-1.5 py-0.5 rounded">{party.filledBy || "—"}</p></td>
                    <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                      <span className="text-[13px] font-bold text-[#5B6472] dark:text-slate-500 whitespace-nowrap">
                        {party.timestamp ? new Date(party.timestamp).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openFormForEdit(party)} className="p-1.5 bg-[#2563EB]/10 text-white dark:bg-[#60A5FA]/10 dark:text-[#60A5FA] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#60A5FA] dark:hover:text-black rounded-lg transition-all" title="Edit Party"><PencilSquareIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteClick(party.id)} className="p-1.5 bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626] hover:text-white rounded-lg transition-all" title="Delete Party"><TrashIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Modal ──────────────────────────────────────────────────────────────── */}
      <PartyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          mutateParties();
        }}
        editingParty={editingParty}
        salePersonName={session?.user?.name || ""}
      />

      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} />
      <ConfirmModal isOpen={isConfirmOpen} title="Delete Party?" message="This action cannot be undone. The party data will be permanently removed from the system." confirmLabel="Delete Party" onClose={() => setIsConfirmOpen(false)} onConfirm={performDelete} />

      {/* ─── View Items Modal ─────────────────────────────────────────────────── */}
      {isViewModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-900 w-full max-w-md rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-4 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{viewModalTitle}</h2>
                <p className="text-[#5B6472] dark:text-slate-400 font-bold text-[12px] mt-1">Selected Items</p>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 text-[#5B6472] hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <ul className="space-y-2">
                {viewModalBaseOptions.map((item, i) => {
                  const submittedItem = viewModalItems.find(vi => vi === item || vi.startsWith(`${item} (Qty:`));
                  const isSubmitted = !!submittedItem;
                  return (
                    <li key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border shadow-sm text-[14px] font-bold transition-colors ${
                      isSubmitted 
                        ? "bg-[#FFFFFF] dark:bg-zinc-800 border-[#2563EB] text-gray-900 dark:text-white"
                        : "bg-gray-50 dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 text-[#5B6472] dark:text-zinc-500"
                    }`}>
                      <span className={`mt-0.5 w-3.5 h-3.5 rounded-sm flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSubmitted ? "bg-[#2563EB] text-black" : "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      }`}>
                        {isSubmitted && (
                          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </span>
                      <div className="flex-1">
                        {isSubmitted ? submittedItem : item}
                      </div>
                      {!isSubmitted && (
                        <span className="text-[13px] font-semibold text-[#5B6472] dark:text-zinc-600">Pending</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="p-4 border-t border-[#E5E7EB] dark:border-zinc-800">
              <button type="button" onClick={() => setIsViewModalOpen(false)} className="w-full bg-[#2563EB] dark:bg-[#60A5FA] hover:bg-[#1D4ED8] dark:hover:bg-[#E6C000] text-white dark:text-black px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95 text-[13px]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
