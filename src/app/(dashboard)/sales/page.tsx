"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { SalesLead } from "@/types/sales";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  ViewColumnsIcon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TruckIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  UserPlusIcon,
  DocumentMagnifyingGlassIcon,
  XCircleIcon,
  CalendarDaysIcon,
  VideoCameraIcon,
  ArrowRightOnRectangleIcon,
  ReceiptRefundIcon,
  HandThumbDownIcon,
  MapPinIcon,
  StarIcon,
  NoSymbolIcon,
  InboxIcon,
  PencilSquareIcon
} from "@heroicons/react/24/outline";

import CreateLeadModal from "@/components/sales/CreateLeadModal";
import LeadDetailView from "@/components/sales/LeadDetailView";
import SalesCalendar from "@/components/sales/SalesCalendar";
import EventTimeline from "@/components/sales/EventTimeline";
import { FollowUp } from "@/types/sales";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const getStageConfig = (stage: string) => {
  switch (stage.toLowerCase()) {
    case 'lead generated': return { icon: <UserPlusIcon className="w-4 h-4" />, borderColor: 'border-blue-500', textColor: 'text-blue-600 dark:text-blue-400' };
    case 'transferring process': return { icon: <TruckIcon className="w-4 h-4" />, borderColor: 'border-indigo-500', textColor: 'text-indigo-600 dark:text-indigo-400' };
    case 'qualifying process': return { icon: <DocumentMagnifyingGlassIcon className="w-4 h-4" />, borderColor: 'border-purple-500', textColor: 'text-purple-600 dark:text-purple-400' };
    case 'qualified': return { icon: <ShieldCheckIcon className="w-4 h-4" />, borderColor: 'border-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' };
    case 'lost': return { icon: <XCircleIcon className="w-4 h-4" />, borderColor: 'border-red-500', textColor: 'text-red-600 dark:text-red-400' };
    case 'arrange meeting': return { icon: <CalendarDaysIcon className="w-4 h-4" />, borderColor: 'border-cyan-500', textColor: 'text-cyan-600 dark:text-cyan-400' };
    case 'demonstration': return { icon: <VideoCameraIcon className="w-4 h-4" />, borderColor: 'border-fuchsia-500', textColor: 'text-fuchsia-600 dark:text-fuchsia-400' };
    case 'transferred to ss': return { icon: <ArrowRightOnRectangleIcon className="w-4 h-4" />, borderColor: 'border-teal-500', textColor: 'text-teal-600 dark:text-teal-400' };
    case 'negotiation': return { icon: <CurrencyDollarIcon className="w-4 h-4" />, borderColor: 'border-amber-500', textColor: 'text-amber-600 dark:text-amber-400' };
    case '1st billing':
    case '2nd billing':
    case '3rd billing': return { icon: <ReceiptRefundIcon className="w-4 h-4" />, borderColor: 'border-green-500', textColor: 'text-green-600 dark:text-green-400' };
    case 'potential lead but not interesting': return { icon: <HandThumbDownIcon className="w-4 h-4" />, borderColor: 'border-orange-500', textColor: 'text-orange-600 dark:text-orange-400' };
    case 'deal in reserved area': return { icon: <MapPinIcon className="w-4 h-4" />, borderColor: 'border-rose-500', textColor: 'text-rose-600 dark:text-rose-400' };
    case 'existing customer': return { icon: <StarIcon className="w-4 h-4" />, borderColor: 'border-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' };
    case 'not qualified lead': return { icon: <NoSymbolIcon className="w-4 h-4" />, borderColor: 'border-stone-500', textColor: 'text-stone-600 dark:text-stone-400' };
    default: return { icon: <InboxIcon className="w-4 h-4" />, borderColor: 'border-gray-500', textColor: 'text-gray-600 dark:text-gray-400' };
  }
};



export default function SalesPage() {

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof SalesLead; direction: "asc" | "desc" } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<SalesLead | null>(null);
  const [activeLeadAction, setActiveLeadAction] = useState<{ lead: SalesLead, action: 'transfer' | 'qualify' | 'global' | 'followup' } | null>(null);
  const [activePipelineTab, setActivePipelineTab] = useState<'All' | 'Transfer' | 'Qualify' | 'Follow Up'>('All');
  
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCardExpansion = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Calendar State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Priority Filter
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  const { data: session } = useSession();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: leads = [], mutate, isValidating } = useSWR<SalesLead[]>(
    "/api/sales",
    fetcher,
    { revalidateOnFocus: true }
  );

  // Fetch all follow ups for global calendar
  const { data: allFollowUps = [] } = useSWR<FollowUp[]>(
    "/api/sales/follow-up",
    fetcher,
    { revalidateOnFocus: true }
  );



  const transferCount = leads.filter(l => !l.qualified_status && (!l.status || l.status === 'Lead Generated')).length;
  const qualifyCount = leads.filter(l => (!l.qualified_status || l.qualified_status === 'Not Qualified') && l.status && l.status !== 'Lead Generated').length;
  const followUpCount = leads.filter(l => l.qualified_status === 'Qualified').length;

  // Filter Leads
  const filteredLeads = useMemo(() => {
    let baseLeads = leads;
    if (activePipelineTab === 'Transfer') {
      baseLeads = leads.filter(l => !l.qualified_status && (!l.status || l.status === 'Lead Generated'));
    } else if (activePipelineTab === 'Qualify') {
      baseLeads = leads.filter(l => (!l.qualified_status || l.qualified_status === 'Not Qualified') && l.status && l.status !== 'Lead Generated');
    } else if (activePipelineTab === 'Follow Up') {
      baseLeads = leads.filter(l => l.qualified_status === 'Qualified');
      if (selectedDate) {
        baseLeads = baseLeads.filter(l => {
          const latestFollowUp = [...allFollowUps].filter(f => f.lead_id === l.id).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];
          if (!latestFollowUp || !latestFollowUp.next_follow_up_date) return false;
          const nextDate = new Date(latestFollowUp.next_follow_up_date);
          return nextDate.getFullYear() === selectedDate.getFullYear() &&
                 nextDate.getMonth() === selectedDate.getMonth() &&
                 nextDate.getDate() === selectedDate.getDate();
        });
      }
    }

    if (priorityFilter !== 'All') {
      baseLeads = baseLeads.filter(l =>
        (l.lead_priority_type || '').toLowerCase() === priorityFilter.toLowerCase()
      );
    }

    if (!debouncedSearch) return baseLeads;
    const s = debouncedSearch.toLowerCase();
    return baseLeads.filter(lead => (
      (lead.id || "").toLowerCase().includes(s) ||
      (lead.name || "").toLowerCase().includes(s) ||
      (lead.company_name || "").toLowerCase().includes(s) ||
      (lead.phone_number || "").toLowerCase().includes(s) ||
      (lead.status || "").toLowerCase().includes(s)
    ));
  }, [leads, debouncedSearch, activePipelineTab, priorityFilter, selectedDate, allFollowUps]);

  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      if (!sortConfig) {
        const aN = parseInt(String(a.id).replace(/\D/g, ""));
        const bN = parseInt(String(b.id).replace(/\D/g, ""));
        if (!isNaN(aN) && !isNaN(bN)) return bN - aN;
        return 0;
      }
      const { key, direction } = sortConfig;
      let aV = a[key] || "";
      let bV = b[key] || "";
      if (key === "id") {
        const aN = parseInt(String(aV).replace(/\D/g, ""));
        const bN = parseInt(String(bV).replace(/\D/g, ""));
        if (!isNaN(aN) && !isNaN(bN)) return direction === "asc" ? aN - bN : bN - aN;
      }
      if (aV < bV) return direction === "asc" ? -1 : 1;
      if (aV > bV) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  // Pagination for Table View
  const totalItems = sortedLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = sortedLeads.slice(startIndex, startIndex + itemsPerPage);



  // Actions
  const openTransferModal = (lead: SalesLead) => {
    setActiveLeadAction({ lead, action: 'transfer' });
  };

  const openQualifyModal = (lead: SalesLead) => {
    setActiveLeadAction({ lead, action: 'qualify' });
  };

  const openGlobalModal = (lead: SalesLead) => {
    setActiveLeadAction({ lead, action: 'global' });
  };

  const openFollowUpModal = (lead: SalesLead) => {
    setActiveLeadAction({ lead, action: 'followup' });
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-center gap-4 px-1 shrink-0">
        <div className="w-full lg:w-1/2 text-center lg:text-left min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Sales Pipeline</h1>
          <p className="text-gray-500 dark:text-slate-300 font-bold text-[12px] md:text-[10px] tracking-wider">Manage Leads &amp; Deals</p>
        </div>
        <div className="w-full lg:w-1/2 flex justify-end flex-shrink-0 min-w-0">
          <div className="flex items-center gap-1 rounded-full border-2 border-b-4 border-[#2563EB] dark:border-[#60A5FA] bg-white dark:bg-navy-800 shadow-sm transition-all active:translate-y-[2px] active:border-b-2 p-1 overflow-x-auto no-scrollbar max-w-full">
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 text-[#2563EB] dark:text-[#60A5FA] px-6 py-1.5 transition-colors rounded-full" title="Create Lead">
              <PlusIcon className="w-5 h-5 mr-2" />
              <span className="font-semibold text-[13px] md:text-[10px]">Create Lead</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4">
        {/* Main Pipeline Column */}
        <div className="w-full lg:w-[75%] flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-2 pt-2 pb-0 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                <button
                  onClick={() => { setActivePipelineTab('All'); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold   transition-all whitespace-nowrap ${activePipelineTab === 'All'
                    ? 'bg-gray-800 dark:bg-white text-white dark:text-black shadow-md'
                    : 'bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-800'
                    }`}
                >
                  <ListBulletIcon className="w-4 h-4" /> All Leads
                  <span className={`px-1.5 py-0.5 rounded-md text-[13px] ${activePipelineTab === 'All' ? 'bg-white/20 dark:bg-black/10' : 'bg-gray-100 dark:bg-navy-800'}`}>{leads.length}</span>
                </button>
                <button
                  onClick={() => { setActivePipelineTab('Transfer'); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold   transition-all whitespace-nowrap ${activePipelineTab === 'Transfer'
                    ? 'bg-[#2563EB] text-white shadow-md'
                    : 'bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-800'
                    }`}
                >
                  <TruckIcon className="w-4 h-4" /> Transfer
                  <span className={`px-1.5 py-0.5 rounded-md text-[13px] ${activePipelineTab === 'Transfer' ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800'}`}>{transferCount}</span>
                </button>
                <button
                  onClick={() => { setActivePipelineTab('Qualify'); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold   transition-all whitespace-nowrap ${activePipelineTab === 'Qualify'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-800'
                    }`}
                >
                  <ShieldCheckIcon className="w-4 h-4" /> Qualify
                  <span className={`px-1.5 py-0.5 rounded-md text-[13px] ${activePipelineTab === 'Qualify' ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800'}`}>{qualifyCount}</span>
                </button>
                <button
                  onClick={() => { setActivePipelineTab('Follow Up'); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold   transition-all whitespace-nowrap ${activePipelineTab === 'Follow Up'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-800'
                    }`}
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" /> Follow Up
                  <span className={`px-1.5 py-0.5 rounded-md text-[13px] ${activePipelineTab === 'Follow Up' ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800'}`}>{followUpCount}</span>
                </button>
              </div>

              <div className="px-2 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[13px] md:text-[10px] font-semibold text-gray-500 hidden sm:block">Sort By</label>
                    <select
                      value={sortConfig ? `${sortConfig.key}-${sortConfig.direction}` : ""}
                      onChange={(e) => {
                        if (!e.target.value) {
                          setSortConfig(null);
                        } else {
                          const [key, direction] = e.target.value.split('-');
                          setSortConfig({ key: key as keyof SalesLead, direction: direction as "asc" | "desc" });
                        }
                      }}
                      className="bg-transparent border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-[13px] font-bold outline-none dark:text-white cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                    >
                      <option value="">Default (Newest First)</option>
                      <option value="id-asc">Lead ID (Asc)</option>
                      <option value="id-desc">Lead ID (Desc)</option>
                      <option value="name-asc">Name (A-Z)</option>
                      <option value="name-desc">Name (Z-A)</option>
                      <option value="company_name-asc">Company (A-Z)</option>
                      <option value="company_name-desc">Company (Z-A)</option>
                      <option value="status-asc">Status (A-Z)</option>
                      <option value="status-desc">Status (Z-A)</option>
                    </select>
                  </div>

                  <div className="relative group w-full max-w-[200px] sm:w-64">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" placeholder="Search leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-navy-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:border-blue-500 outline-none font-bold text-[14px] text-gray-700 dark:text-white transition-all" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 ml-auto">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] md:text-[10px] font-semibold text-gray-500 whitespace-nowrap">Page <span className="text-[#2563EB] dark:text-[#60A5FA]">{currentPage}</span> of {totalPages || 1}</p>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 text-[13px] md:text-[10px] font-bold text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all whitespace-nowrap">First</button>
                      <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="px-2 py-1 text-[13px] md:text-[10px] font-bold text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all whitespace-nowrap">Last</button>
                    </div>
                  </div>
                  <div className="hidden xs:block h-4 w-[1px] bg-gray-300 dark:bg-white/10" />
                  <div className="flex items-center gap-2">
                    <label className="text-[13px] md:text-[10px] font-semibold text-gray-500">Show</label>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border-none p-0 text-[13px] font-bold outline-none dark:text-white cursor-pointer">
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-hidden overflow-y-auto flex-1 px-1 pb-4 custom-scrollbar">
                {isValidating && !leads.length ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-[#2563EB] rounded-full animate-spin mb-4" />
                    <p className="text-gray-400 font-bold text-[13px]">Loading Leads...</p>
                  </div>
                ) : paginatedLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-navy-900 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-gray-300 dark:border-white/10">
                      <InboxIcon className="w-8 h-8 text-gray-400 dark:text-slate-600" />
                    </div>
                    <p className="text-sm text-gray-500 font-bold">No leads found</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {paginatedLeads.map((lead) => {
                      const stageConfig = getStageConfig(lead.status || "Lead Generated");
                      const latestFollowUp = [...allFollowUps].filter(f => f.lead_id === lead.id).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];
                      const nextFollowUpDate = latestFollowUp?.next_follow_up_date;
                      let isOverdue = false;
                      let delayText = "";

                      if (nextFollowUpDate) {
                        const nextDate = new Date(nextFollowUpDate);
                        const now = new Date();
                        if (nextDate < now) {
                          isOverdue = true;
                          const diffMs = now.getTime() - nextDate.getTime();
                          const diffMins = Math.floor(diffMs / (1000 * 60));
                          const diffHours = Math.floor(diffMins / 60);
                          const diffDays = Math.floor(diffHours / 24);
                          
                          if (diffDays > 0) {
                            delayText = `${diffDays}d ${diffHours % 24}h overdue`;
                          } else if (diffHours > 0) {
                            delayText = `${diffHours}h ${diffMins % 60}m overdue`;
                          } else {
                            delayText = `${diffMins}m overdue`;
                          }
                        }
                      }

                      return (
                        <div key={lead.id} className={`group flex flex-col rounded-xl p-4 shadow-sm border-2 ${stageConfig.borderColor} bg-white dark:bg-navy-900 transition-all hover:shadow-md hover:-translate-y-0.5`}>
                          {/* Top Header: Name and Actions */}
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 w-full">
                            <div className="flex items-center gap-3">
                              <span className={`text-[14px] font-semibold   ${stageConfig.textColor} bg-slate-50 dark:bg-navy-800 px-2 py-1 rounded-md`}>
                                {lead.id}
                              </span>
                              <h4 className="font-semibold text-lg text-gray-900 dark:text-white leading-tight tracking-wide">
                                {lead.name || "Unnamed"}
                              </h4>
                            </div>

                            {/* Right side: Actions and Status */}
                            <div className="flex flex-col lg:flex-row items-end lg:items-center gap-3 shrink-0">
                              
                              {/* Lead Type (Priority) Pill */}
                              <span className={`text-[13px] font-semibold   px-3 py-1.5 rounded-full shadow-sm border ${!lead.lead_priority_type ? 'bg-gray-50 text-gray-500 border-gray-200' : lead.lead_priority_type.toLowerCase() === 'high' ? 'bg-red-50 text-red-600 border-red-200' :
                                lead.lead_priority_type.toLowerCase() === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                  'bg-green-50 text-green-600 border-green-200'
                                }`}>
                                {lead.lead_priority_type ? `${lead.lead_priority_type} Priority` : 'No Priority'}
                              </span>

                              {/* Follow Up Date or Qualification Status */}
                              {activePipelineTab === 'Follow Up' ? (
                                nextFollowUpDate ? (
                                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isOverdue ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                                    <CalendarDaysIcon className="w-3.5 h-3.5" />
                                    <span className="text-[13px] font-semibold">
                                      Next: {new Date(nextFollowUpDate).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                    {isOverdue && (
                                      <span className="text-[13px] font-semibold text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm ml-1">
                                        {delayText}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500">
                                    <CalendarDaysIcon className="w-3.5 h-3.5" />
                                    <span className="text-[13px] font-semibold">No Follow Up</span>
                                  </div>
                                )
                              ) : (
                                <div className={`flex items-center px-3 py-1.5 rounded-full border ${lead.qualified_status === 'Qualified' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  lead.qualified_status === 'Not Qualified' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  }`}>
                                  <span className="text-[13px] font-semibold">
                                    {lead.qualified_status || 'New'}
                                  </span>
                                </div>
                              )}

                              {/* Status Pill */}
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${stageConfig.borderColor} bg-black/5 dark:bg-white/5`}>
                                <div className={`w-3 h-3 rounded-full flex items-center justify-center bg-current ${stageConfig.textColor}`}>
                                  <div className="text-white dark:text-black scale-75">
                                    {stageConfig.icon}
                                  </div>
                                </div>
                                <span className={`text-[13px] font-semibold   ${stageConfig.textColor}`}>
                                  {lead.status || "Lead Generated"}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1 bg-white dark:bg-navy-900 rounded-full p-1 shadow-inner border border-gray-200 dark:border-white/10 shrink-0">
                                <button onClick={() => toggleCardExpansion(lead.id)} className={`p-1.5 rounded-full transition-all ${expandedCards.has(lead.id) ? 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`} title="Toggle Details">
                                  {expandedCards.has(lead.id) ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setEditingLead(lead)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all" title="Edit Lead"><PencilSquareIcon className="w-4 h-4" /></button>
                                {(!lead.qualified_status && (!lead.status || lead.status === 'Lead Generated')) && (
                                  <button onClick={() => openTransferModal(lead)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-full transition-all" title="Transfer Process"><TruckIcon className="w-4 h-4" /></button>
                                )}
                                {((!lead.qualified_status || lead.qualified_status === 'Not Qualified') && lead.status && lead.status !== 'Lead Generated') && (
                                  <button onClick={() => openQualifyModal(lead)} className="p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 rounded-full transition-all" title="Qualify Process"><ShieldCheckIcon className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => openGlobalModal(lead)} className="p-1.5 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/30 rounded-full transition-all" title="Global Fields"><GlobeAltIcon className="w-4 h-4" /></button>
                                {(lead.qualified_status === 'Qualified') && (
                                  <button onClick={() => openFollowUpModal(lead)} className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 rounded-full transition-all" title="Manage Follow Ups"><ChatBubbleLeftRightIcon className="w-4 h-4" /></button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Details row */}
                          <div className="flex flex-wrap xl:flex-nowrap items-start gap-x-3 gap-y-3 mt-4 pt-3 border-t border-gray-50 dark:border-white/5 min-w-0 w-full">
                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-blue-500 flex items-center gap-1 truncate">
                                <StarIcon className="w-3 h-3 shrink-0" /> Company
                              </span>
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={lead.company_name}>{lead.company_name || "—"}</span>
                            </div>

                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-green-500 flex items-center gap-1 truncate">
                                <MapPinIcon className="w-3 h-3 shrink-0" /> Phone
                              </span>
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={lead.phone_number}>{lead.phone_number || "—"}</span>
                            </div>

                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-teal-500 flex items-center gap-1 truncate">
                                <GlobeAltIcon className="w-3 h-3 shrink-0" /> State/UT
                              </span>
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={lead.state_and_ut}>{lead.state_and_ut || "—"}</span>
                            </div>

                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-pink-500 flex items-center gap-1 truncate">
                                <MagnifyingGlassIcon className="w-3 h-3 shrink-0" /> Source
                              </span>
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={lead.sources_of_customer}>{lead.sources_of_customer || "—"}</span>
                            </div>

                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-purple-500 flex items-center gap-1 truncate">
                                <ListBulletIcon className="w-3 h-3 shrink-0" /> Products
                              </span>
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={lead.enquiry_products}>{lead.enquiry_products || "—"}</span>
                            </div>

                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-emerald-500 flex items-center gap-1 truncate">
                                <CurrencyDollarIcon className="w-3 h-3 shrink-0" /> Investment
                              </span>
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5 truncate" title={lead.investment_amount}>{lead.investment_amount ? `₹${lead.investment_amount}` : "—"}</span>
                            </div>

                            <div className="flex flex-col flex-1 min-w-[100px] xl:min-w-0">
                              <span className="text-[13px] font-semibold text-indigo-500 flex items-center gap-1 truncate">
                                <UserPlusIcon className="w-3 h-3 shrink-0" /> Assigned To
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                <div className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                                  <span className="text-[12px] font-semibold text-white">
                                    {(lead.sales_person_assigned || "U").substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-[14px] font-bold text-gray-900 dark:text-white truncate" title={lead.sales_person_assigned}>{lead.sales_person_assigned || "Unassigned"}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded Details */}
                            {expandedCards.has(lead.id) && (
                              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {[
                                  { label: "Created At", value: lead.created_at ? new Date(lead.created_at).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "—", icon: <CalendarDaysIcon className="w-3 h-3 shrink-0" />, color: "text-blue-500" },
                                  { label: "Filled By", value: lead.filled_by || "—", icon: <UserPlusIcon className="w-3 h-3 shrink-0" />, color: "text-indigo-500" },
                                  { label: "Area", value: lead.area || "—", icon: <MapPinIcon className="w-3 h-3 shrink-0" />, color: "text-emerald-500" },
                                  { label: "Country", value: lead.country || "India", icon: <GlobeAltIcon className="w-3 h-3 shrink-0" />, color: "text-teal-500" },
                                  { label: "Enquiry For", value: lead.enquiry_for || "—", icon: <MagnifyingGlassIcon className="w-3 h-3 shrink-0" />, color: "text-pink-500" },
                                  { label: "Monthly Turnover", value: lead.current_monthly_turnover || "—", icon: <CurrencyDollarIcon className="w-3 h-3 shrink-0" />, color: "text-green-500" },
                                  { label: "Existing Products", value: lead.existing_products || "—", icon: <ListBulletIcon className="w-3 h-3 shrink-0" />, color: "text-purple-500" },
                                  { label: "SC Remark", value: lead.sc_remark || "—", icon: <ChatBubbleLeftRightIcon className="w-3 h-3 shrink-0" />, color: "text-orange-500" },
                                  { label: "SS Remark", value: lead.ss_remark || "—", icon: <ChatBubbleLeftRightIcon className="w-3 h-3 shrink-0" />, color: "text-orange-500" },
                                  { label: "Party Remark", value: lead.party_remark || "—", icon: <ChatBubbleLeftRightIcon className="w-3 h-3 shrink-0" />, color: "text-orange-500" },
                                  { label: "Remark", value: lead.remark || "—", icon: <ChatBubbleLeftRightIcon className="w-3 h-3 shrink-0" />, color: "text-orange-500" },
                                ].map((detail, idx) => (
                                  <div key={idx} className="flex flex-col min-w-0">
                                    <span className={`text-[13px] font-semibold   flex items-center gap-1 truncate ${detail.color}`}>
                                      {detail.icon} {detail.label}
                                    </span>
                                    <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate" title={detail.value}>{detail.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Global Roadmap Sidebar */}
        <div className="w-full lg:w-[25%] flex flex-col gap-4 overflow-y-auto custom-scrollbar">

            {/* Priority Filter */}
            <div className="flex bg-gray-100 dark:bg-navy-800 rounded-full p-1.5 shadow-inner shrink-0">
              {['All', 'High', 'Medium', 'Low'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p as any)}
                  className={`flex-1 py-2 text-[13px] font-semibold   rounded-full transition-all duration-300 ${priorityFilter === p
                    ? p === 'High' ? 'bg-red-500 text-white shadow-md'
                      : p === 'Medium' ? 'bg-orange-500 text-white shadow-md'
                        : p === 'Low' ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white text-gray-800 dark:bg-navy-700 dark:text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <SalesCalendar
              followUps={allFollowUps}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />


          </div>
      </div>

      {activeLeadAction && (
        <LeadDetailView
          lead={activeLeadAction.lead}
          initialTab={activeLeadAction.action}
          onClose={() => setActiveLeadAction(null)}
          onUpdate={() => mutate()}
        />
      )}

      <CreateLeadModal
        isOpen={isCreateModalOpen || !!editingLead}
        onClose={() => { setIsCreateModalOpen(false); setEditingLead(null); }}
        onSuccess={() => { setIsCreateModalOpen(false); setEditingLead(null); mutate(); }}
        leadToEdit={editingLead}
      />
    </div>
  );
}
