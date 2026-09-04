"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { GRN } from "@/types/grn";
import { PaymentVendorRecord } from "../../../types/payment-vendor";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  BellIcon,
  UserIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ArrowRightIcon,
  ClockIcon,
  DevicePhoneMobileIcon
} from "@heroicons/react/24/outline";

import { FilterPeriod } from "@/components/DateFilterBar";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, add, sub } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatDate(dateString: string) {
  if (!dateString || dateString === "—") return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

function getGrnStepCheckState(actual?: string, status?: string) {
  const rejected = String(status || "").toLowerCase() === "rejected";
  const filled = Boolean(actual && String(actual).trim());
  if (rejected) return "rejected" as const;
  if (filled) return "done" as const;
  return "pending" as const;
}

function GrnCheckBadge({ actual, status }: { actual?: string; status?: string }) {
  const state = getGrnStepCheckState(actual, status);
  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
          <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" /> Done
        </span>
        {actual && (
          <span className="text-[9px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">
            {formatDate(actual)}
          </span>
        )}
      </div>
    );
  }
  if (state === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
        <XCircleIcon className="w-3.5 h-3.5 shrink-0" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
      <ClockIcon className="w-3.5 h-3.5 shrink-0" /> Pending
    </span>
  );
}

function getPaymentStatusLabel(status: string) {
  if (status === "Payed") return "Paid";
  if (status === "Approved") return "Awaiting Payment";
  if (status === "Rejected") return "Rejected";
  return "Pending Approval";
}

function PaymentStatusPill({ status }: { status: string }) {
  const label = getPaymentStatusLabel(status || "");
  const styles =
    label === "Paid"
      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-sm shadow-emerald-500/20"
      : label === "Awaiting Payment"
        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-400 shadow-sm shadow-blue-500/20"
        : label === "Rejected"
          ? "bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-400 shadow-sm shadow-rose-500/20"
          : "bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-400 shadow-sm shadow-amber-500/20";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap ${styles}`}>
      {label}
    </span>
  );
}

function getPlannedPeriodLabel(period: FilterPeriod, currentDate: Date) {
  switch (period) {
    case "ALL": return "All Time";
    case "DAY": return format(currentDate, "dd MMM yyyy");
    case "WEEK": {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "dd MMM")} – ${format(end, "dd MMM yyyy")}`;
    }
    case "MONTH": return format(currentDate, "MMM yyyy");
    case "QUARTERLY": return `Q${format(currentDate, "q")} ${format(currentDate, "yyyy")}`;
    case "YEARLY": return format(currentDate, "yyyy");
    case "CUSTOM": return "Custom Range";
    default: return "";
  }
}

export default function PaymentVendorApprovalPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'USER';
  const isAdmin = userRole === 'ADMIN';
  const isUser = userRole === 'USER';

  const { data: grnData, isLoading: grnLoading } = useSWR("/api/grn", fetcher, { refreshInterval: 5000 });
  const { data: vendorData, mutate: mutateVendorData, isLoading: vendorLoading } = useSWR("/api/payment-vendor", fetcher, { refreshInterval: 5000 });
  const { data: i2rData } = useSWR("/api/i2r", fetcher, { refreshInterval: 60000 });

  const grnItems: GRN[] = grnData?.items ? [...grnData.items].reverse() : [];
  const vendorItems: PaymentVendorRecord[] = vendorData?.items || [];
  const i2rItems: any[] = Array.isArray(i2rData) ? i2rData : [];

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("All");
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('ALL');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [modalGrnNo, setModalGrnNo] = useState("");
  const [modalActionType, setModalActionType] = useState("");
  const [modalRemarks, setModalRemarks] = useState("");
  const [highlightGrn, setHighlightGrn] = useState<string | null>(null);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const grn = new URLSearchParams(window.location.search).get("grn");
    if (!grn) return;
    setSearchTerm(grn);
    setStatusFilter("All");
    setFilterPeriod("ALL");
    setStartDate(null);
    setEndDate(null);
    setHighlightGrn(grn);
  }, []);

  const mergedItems = useMemo(() => {
    return grnItems.map(grn => {
      const vendorRecord = vendorItems.find(v => v.grn_no === grn.GRN_No) || {
        grn_no: grn.GRN_No,
        status: "",
        remarks: ""
      };
      const i2rItem = i2rItems.find(it => it.id === grn.indent_id);
      const rawCreatedAt = i2rItem?.actual_6;
      const vendorName = i2rItem?.supplier_name_3 || grn.filled_by || "—";
      const grnDate = formatDate(grn.updated_at || grn.actual_1 || "—");

      let calculatedPlannedDate = "—";
      let rawPlannedDate: Date | null = null;
      if (rawCreatedAt && rawCreatedAt !== "—" && grn.Payment_Terms_In_days) {
        const days = parseInt(grn.Payment_Terms_In_days, 10);
        if (!isNaN(days)) {
          const d = new Date(rawCreatedAt);
          d.setDate(d.getDate() + days);
          rawPlannedDate = d;
          calculatedPlannedDate = formatDate(d.toISOString());
        }
      }

      return {
        ...grn,
        vendorRecord,
        vendorName,
        grnDate,
        rawCreatedAt: rawCreatedAt && rawCreatedAt !== "—" ? rawCreatedAt : null,
        createdAt: formatDate(rawCreatedAt || "—"),
        rawPlannedDate,
        calculatedPlannedDate
      };
    });
  }, [grnItems, vendorItems, i2rItems]);

  const statusCounts = useMemo(() => {
    const counts = {
      All: mergedItems.length,
      "Pending Approval": 0,
      "Pending Payment": 0,
      Payed: 0,
      Rejected: 0,
    };
    mergedItems.forEach((item) => {
      const s = item.vendorRecord.status;
      if (s === "Payed") counts.Payed += 1;
      else if (s === "Rejected") counts.Rejected += 1;
      else if (s === "Approved") counts["Pending Payment"] += 1;
      else counts["Pending Approval"] += 1;
    });
    return counts;
  }, [mergedItems]);

  const filteredItems = useMemo(() => {
    let effectiveStart: Date | null = startDate;
    let effectiveEnd: Date | null = endDate;

    if (filterPeriod !== 'ALL' && filterPeriod !== 'CUSTOM') {
      switch (filterPeriod) {
        case 'DAY':
          effectiveStart = startOfDay(currentDate);
          effectiveEnd = endOfDay(currentDate);
          break;
        case 'WEEK':
          effectiveStart = startOfWeek(currentDate, { weekStartsOn: 1 });
          effectiveEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
          break;
        case 'MONTH':
          effectiveStart = startOfMonth(currentDate);
          effectiveEnd = endOfMonth(currentDate);
          break;
        case 'QUARTERLY':
          effectiveStart = startOfQuarter(currentDate);
          effectiveEnd = endOfQuarter(currentDate);
          break;
        case 'YEARLY':
          effectiveStart = startOfYear(currentDate);
          effectiveEnd = endOfYear(currentDate);
          break;
      }
    }

    return mergedItems.filter((item) => {
      // 1. Search Filter
      const matchesSearch = Object.values(item).some(val =>
        val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchesSearch) return false;

      // 2. Status Filter
      const status = item.vendorRecord.status;
      if (statusFilter === "Pending Approval") {
        if (status === "Approved" || status === "Rejected" || status === "Payed") return false;
      } else if (statusFilter === "Pending Payment") {
        if (status !== "Approved") return false;
      } else if (statusFilter === "Payed") {
        if (status !== "Payed") return false;
      } else if (statusFilter === "Rejected") {
        if (status !== "Rejected") return false;
      }

      // 3. Date Filter (Planned Date)
      if (filterPeriod !== 'ALL') {
        if (!item.rawPlannedDate) return false;
        if (effectiveStart && item.rawPlannedDate < effectiveStart) return false;
        if (effectiveEnd && item.rawPlannedDate > effectiveEnd) return false;
      }

      return true;
    });
  }, [mergedItems, searchTerm, statusFilter, filterPeriod, currentDate, startDate, endDate]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (!highlightGrn || grnLoading || vendorLoading) return;

    const idx = filteredItems.findIndex(
      (item) => item.GRN_No.toLowerCase() === highlightGrn.toLowerCase()
    );
    if (idx === -1) return;

    const page = Math.floor(idx / itemsPerPage) + 1;
    if (page !== currentPage) {
      setCurrentPage(page);
      return;
    }

    const timer = window.setTimeout(() => {
      highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [highlightGrn, filteredItems, grnLoading, vendorLoading, itemsPerPage, currentPage]);

  const openActionModal = (grn_no: string, actionType: string) => {
    setModalGrnNo(grn_no);
    setModalActionType(actionType);
    setModalRemarks("");
    setIsModalOpen(true);
  };

  const confirmAction = async () => {
    if (!modalGrnNo || !modalActionType) return;

    const existingRecord = vendorItems.find(v => v.grn_no === modalGrnNo);
    const currentStatus = existingRecord?.status || "";

    if (modalActionType === "Payed" && currentStatus !== "Approved") {
      alert("This GRN must be approved by MD before it can be marked as Payed.");
      return;
    }

    if (modalActionType === "Approved" && (currentStatus === "Approved" || currentStatus === "Rejected" || currentStatus === "Payed")) {
      alert("This GRN has already been processed.");
      return;
    }

    setIsModalOpen(false);
    setActionLoading(modalGrnNo);

    try {
      let newRemarks = existingRecord?.remarks || "";
      if (modalRemarks.trim()) {
        const prefix = modalActionType === "Payed" ? "User: " : "Admin: ";
        newRemarks = newRemarks ? `${newRemarks} | ${prefix}${modalRemarks.trim()}` : `${prefix}${modalRemarks.trim()}`;
      }

      const res = await fetch("/api/payment-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grn_no: modalGrnNo, status: modalActionType, remarks: newRemarks })
      });

      if (res.ok) {
        mutateVendorData();
      } else {
        alert("Failed to update status.");
      }
    } catch (error) {
      console.error(error);
      alert("Error updating status.");
    } finally {
      setActionLoading(null);
    }
  };

  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      alert("No data to export.");
      return;
    }

    const headers = [
      "GRN_No", "PO_Number", "GRN Date", "I2R Created At", "Vendor", "Item_Name", "Category",
      "Qty", "Country", "Payment Terms (Days)", "Planned Date",
      "Quantity Checked", "Quality Checked",
      "Status", "User Remarks", "Admin Remarks"
    ];

    const rows = filteredItems.map(item => {
      const status = item.vendorRecord.status || "Pending";
      const remarks = item.vendorRecord.remarks || "";
      const userRemarks = remarks.split('|').find((r: string) => r.includes('User:'))?.replace('User:', '').trim() || "";
      const adminRemarks = remarks.split('|').find((r: string) => r.includes('Admin:'))?.replace('Admin:', '').trim() || "";
      const qtyState = getGrnStepCheckState(item.actual_1, item.status_1);
      const qualityState = getGrnStepCheckState(item.actual_3, item.status_3);

      return [
        item.GRN_No || "",
        item.PO_Number || "",
        item.grnDate || "",
        item.createdAt || "",
        `"${(item.vendorName || "").toString().replace(/"/g, '""')}"`,
        `"${(item.Item_Name || "").toString().replace(/"/g, '""')}"`,
        item.Category || "",
        item.Qty || "",
        item.Country || "",
        item.Payment_Terms_In_days || "",
        item.calculatedPlannedDate || "",
        qtyState === "done" ? "Done" : qtyState === "rejected" ? "Rejected" : "Pending",
        qualityState === "done" ? "Done" : qualityState === "rejected" ? "Rejected" : "Pending",
        getPaymentStatusLabel(status),
        `"${userRemarks.replace(/"/g, '""')}"`,
        `"${adminRemarks.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payment_Vendor_Approval_${formatDate(new Date().toISOString())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePeriodChange = (p: FilterPeriod) => {
    setFilterPeriod(p);
    setCurrentPage(1);
    if (p !== "CUSTOM") {
      setStartDate(null);
      setEndDate(null);
    }
  };

  const handlePeriodPrev = () => {
    switch (filterPeriod) {
      case "DAY": setCurrentDate(sub(currentDate, { days: 1 })); break;
      case "WEEK": setCurrentDate(sub(currentDate, { weeks: 1 })); break;
      case "MONTH": setCurrentDate(sub(currentDate, { months: 1 })); break;
      case "QUARTERLY": setCurrentDate(sub(currentDate, { months: 3 })); break;
      case "YEARLY": setCurrentDate(sub(currentDate, { years: 1 })); break;
    }
    setCurrentPage(1);
  };

  const handlePeriodNext = () => {
    switch (filterPeriod) {
      case "DAY": setCurrentDate(add(currentDate, { days: 1 })); break;
      case "WEEK": setCurrentDate(add(currentDate, { weeks: 1 })); break;
      case "MONTH": setCurrentDate(add(currentDate, { months: 1 })); break;
      case "QUARTERLY": setCurrentDate(add(currentDate, { months: 3 })); break;
      case "YEARLY": setCurrentDate(add(currentDate, { years: 1 })); break;
    }
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full gap-4 pb-2 -m-1 md:-m-2 p-1 md:p-2 min-h-full bg-white dark:bg-[#0B1120] overflow-auto">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Vendor Payment Tracker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track vendor payments from GRN creation through MD approval to final payment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25">
            <DevicePhoneMobileIcon className="w-4 h-4" />
            WhatsApp Alerts On
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/25">
            <ArrowPathIcon className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} />
            Auto Refresh · 5s
          </span>
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="p-2 rounded-xl border-2 border-indigo-100 dark:border-indigo-500/30 bg-white dark:bg-slate-950 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="How this page works"
          >
            <InformationCircleIcon className="w-5 h-5 text-indigo-500" />
          </button>
        </div>
      </div>

      {/* Workflow step cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white p-4 shadow-lg shadow-blue-500/30 ring-1 ring-white/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <DocumentTextIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Step 1</p>
              <p className="text-sm font-black mt-0.5">GRN Created / Edited</p>
              <p className="text-[11px] text-blue-100/90 mt-1">WhatsApp alert sent to MD Sir</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white p-4 shadow-lg shadow-violet-500/30 ring-1 ring-white/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-100">Step 2</p>
              <p className="text-sm font-black mt-0.5">MD / Admin Approval</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-lg bg-rose-500/40 text-[9px] font-black uppercase">Rejected</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/50 text-[9px] font-black uppercase">Approved</span>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 shadow-lg shadow-emerald-500/30 ring-1 ring-white/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BanknotesIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Step 3</p>
              <p className="text-sm font-black mt-0.5">User Marks Paid</p>
              <p className="text-[11px] text-emerald-100/90 mt-1">After MD approval only</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div className="rounded-2xl border border-blue-200/50 dark:border-blue-500/20 bg-white dark:bg-slate-900 shadow-lg shadow-blue-500/5 overflow-hidden flex flex-col min-h-[520px] flex-1">
          {/* Status tabs with counts */}
          <div className="px-3 md:px-4 pt-3 pb-2 border-b border-blue-100/80 dark:border-white/5 bg-gradient-to-r from-slate-50 via-blue-50/40 to-violet-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-violet-950/10 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 min-w-max">
              {([
                { id: "All", color: "from-slate-600 to-slate-800", ring: "ring-slate-300/50" },
                { id: "Pending Approval", color: "from-amber-500 to-orange-500", ring: "ring-amber-300/50" },
                { id: "Pending Payment", color: "from-blue-500 to-indigo-600", ring: "ring-blue-300/50" },
                { id: "Payed", color: "from-emerald-500 to-teal-600", ring: "ring-emerald-300/50" },
                { id: "Rejected", color: "from-rose-500 to-red-600", ring: "ring-rose-300/50" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                    statusFilter === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg ring-2 ${tab.ring}`
                      : "bg-white dark:bg-slate-950/50 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10"
                  }`}
                >
                  {tab.id === "Payed" ? "Paid" : tab.id}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === tab.id ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                    {statusCounts[tab.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter bar */}
          <div className="px-3 md:px-4 py-3 border-b border-blue-50 dark:border-white/5 bg-gradient-to-r from-white via-sky-50/40 to-white dark:from-slate-900 dark:via-sky-950/10 dark:to-slate-900">
            <div className="flex flex-col xl:flex-row xl:items-end gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-500" />
                <input
                  type="text"
                  placeholder="Search GRN, PO, item, vendor..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-sky-100 dark:border-sky-500/20 bg-white dark:bg-slate-950 text-sm font-semibold outline-none focus:border-sky-400"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Planned Date</label>
                  <select
                    value={filterPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value as FilterPeriod)}
                    className="px-3 py-2.5 rounded-xl border-2 border-indigo-100 dark:border-indigo-500/30 bg-white dark:bg-slate-950 text-sm font-semibold focus:border-indigo-400 outline-none min-w-[140px]"
                  >
                    <option value="ALL">All Time</option>
                    <option value="DAY">Day</option>
                    <option value="WEEK">Week</option>
                    <option value="MONTH">Month</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="CUSTOM">Custom Range</option>
                  </select>
                </div>

                {filterPeriod !== "ALL" && filterPeriod !== "CUSTOM" && (
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border-2 border-blue-100 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
                    <button type="button" onClick={handlePeriodPrev} className="p-1 rounded-lg hover:bg-white/70 dark:hover:bg-white/10 text-blue-600">
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-black text-blue-700 dark:text-blue-300 px-2 whitespace-nowrap min-w-[120px] text-center">
                      {getPlannedPeriodLabel(filterPeriod, currentDate)}
                    </span>
                    <button type="button" onClick={handlePeriodNext} className="p-1 rounded-lg hover:bg-white/70 dark:hover:bg-white/10 text-blue-600">
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {filterPeriod === "CUSTOM" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-violet-100 dark:border-violet-500/30 bg-violet-50/40 dark:bg-violet-950/20">
                    <CalendarIcon className="w-4 h-4 text-violet-500 shrink-0" />
                    <input
                      type="date"
                      value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => { if (e.target.value) { setStartDate(new Date(e.target.value)); setCurrentPage(1); } }}
                      className="bg-transparent text-xs font-bold outline-none dark:text-white"
                    />
                    <span className="text-[10px] font-black text-slate-400">to</span>
                    <input
                      type="date"
                      value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => { if (e.target.value) { setEndDate(new Date(e.target.value)); setCurrentPage(1); } }}
                      className="bg-transparent text-xs font-bold outline-none dark:text-white"
                    />
                    {(startDate || endDate) && (
                      <button type="button" onClick={() => handlePeriodChange("ALL")} className="p-1 text-slate-400 hover:text-rose-500">
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setCurrentPage(1)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wide shadow-md shadow-blue-500/25 hover:brightness-105"
                >
                  Apply
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black uppercase tracking-wide shadow-md shadow-orange-500/25 hover:brightness-105 flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {grnLoading || vendorLoading ? (
            <div className="flex flex-col items-center justify-center py-24 flex-1">
              <div className="w-10 h-10 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading payments...</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse min-w-[1240px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-[#003875] via-blue-600 to-indigo-600 text-white">
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider w-10">#</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider">GRN No. / PO No.</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider">Dates</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider">Vendor</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider">Item</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-right">Qty</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider">Terms</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-center">Qty Check</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-center">Quality Check</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-center">Status</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider">Remarks</th>
                    <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paginatedItems.map((item, idx) => {
                    const status = item.vendorRecord.status;
                    const remarks = item.vendorRecord.remarks || "";
                    const userRemarks = remarks.split("|").find((r: string) => r.includes("User:"))?.replace("User:", "").trim() || "";
                    const adminRemarks = remarks.split("|").find((r: string) => r.includes("Admin:"))?.replace("Admin:", "").trim() || "";
                    const combinedRemarks = [adminRemarks && `Admin: ${adminRemarks}`, userRemarks && `User: ${userRemarks}`].filter(Boolean).join(" · ") || "—";

                    const isPayed = status === "Payed";
                    const isApproved = status === "Approved";
                    const isRejected = status === "Rejected";
                    const isHighlighted = highlightGrn && item.GRN_No.toLowerCase() === highlightGrn.toLowerCase();
                    const rowNum = (currentPage - 1) * itemsPerPage + idx + 1;

                    return (
                      <tr
                        key={item.id}
                        ref={isHighlighted ? highlightRowRef : undefined}
                        className={`transition-colors ${isHighlighted ? "bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-400 ring-inset" : "hover:bg-slate-50/80 dark:hover:bg-white/5"}`}
                      >
                        <td className="px-3 py-3 text-xs font-bold text-slate-400">{rowNum}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">{item.GRN_No}</span>
                            <span className="text-[10px] font-bold text-slate-500">{item.PO_Number || "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            <p><span className="text-slate-400">GRN:</span> {item.grnDate}</p>
                            <p><span className="text-slate-400">I2R:</span> {item.createdAt}</p>
                            <p><span className="text-emerald-600 font-bold">Plan:</span> {item.calculatedPlannedDate}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-bold text-slate-800 dark:text-white max-w-[120px] truncate" title={item.vendorName}>{item.vendorName}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="max-w-[140px]">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={item.Item_Name}>{item.Item_Name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.Category} · {item.Country || "—"}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-xs font-black text-slate-800 dark:text-white tabular-nums">
                            {item.Qty != null && String(item.Qty).trim() !== "" ? item.Qty : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {item.Payment_Terms_In_days ? `${item.Payment_Terms_In_days} Days` : "—"}
                        </td>
                        <td className="px-3 py-3 text-center"><GrnCheckBadge actual={item.actual_1} status={item.status_1} /></td>
                        <td className="px-3 py-3 text-center"><GrnCheckBadge actual={item.actual_3} status={item.status_3} /></td>
                        <td className="px-3 py-3 text-center"><PaymentStatusPill status={status || ""} /></td>
                        <td className="px-3 py-3">
                          <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 line-clamp-2 max-w-[140px]" title={combinedRemarks}>{combinedRemarks}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                            {isPayed ? (
                              <span className="text-[10px] font-black uppercase text-emerald-600">Completed</span>
                            ) : isRejected ? (
                              <span className="text-[10px] font-black uppercase text-rose-600">Blocked</span>
                            ) : isApproved && isUser ? (
                              <button
                                onClick={() => openActionModal(item.GRN_No, "Payed")}
                                disabled={actionLoading === item.GRN_No}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-black uppercase shadow-sm disabled:opacity-50"
                              >
                                {actionLoading === item.GRN_No ? "..." : "Mark Paid"}
                              </button>
                            ) : isApproved ? (
                              <span className="text-[10px] font-bold text-blue-600 uppercase">Ready</span>
                            ) : isAdmin ? (
                              <div className="flex flex-col gap-1 w-full">
                                <button
                                  onClick={() => openActionModal(item.GRN_No, "Approved")}
                                  disabled={actionLoading === item.GRN_No}
                                  className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-black uppercase shadow-sm disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openActionModal(item.GRN_No, "Rejected")}
                                  disabled={actionLoading === item.GRN_No}
                                  className="px-2 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-black uppercase shadow-sm disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Awaiting MD</span>
                            )}
                            {item.Attach_Bill && (
                              <a href={item.Attach_Bill} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline">
                                View Bill
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                        No records match your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–{Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-30">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Page {currentPage} / {totalPages || 1}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-30">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="ml-2 px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold bg-white dark:bg-slate-950"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer info panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-blue-200/60 dark:border-blue-500/20 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/20 p-4 shadow-md shadow-blue-500/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">Approval Workflow</h3>
            <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> GRN created → WhatsApp to MD</li>
              <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> MD approves or rejects payment</li>
              <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> User marks paid after approval</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 p-4 shadow-md shadow-emerald-500/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">WhatsApp Notifications</h3>
            <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
              <li>• New / edited GRN → MD Sir (9899444530)</li>
              <li>• MD approval → Himanshi (8766272040)</li>
              <li>• Includes GRN Qty, quantity & quality check status</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-violet-200/60 dark:border-violet-500/20 bg-gradient-to-br from-violet-50/80 via-white to-purple-50/60 dark:from-violet-950/30 dark:via-slate-900 dark:to-purple-950/20 p-4 shadow-md shadow-violet-500/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-violet-600 mb-3">Notes</h3>
            <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
              <li>• Planned date = I2R Created At + Payment Terms</li>
              <li>• Qty check = GRN Step 1 · Quality = Step 3</li>
              <li>• Rejected payments cannot be marked paid</li>
            </ul>
          </div>
        </div>

      {/* ─── Custom Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131C2E] w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">
                Confirm Action
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs font-bold text-gray-600 dark:text-slate-300">
                You are about to mark GRN <span className="font-mono bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-[#003875] dark:text-[#FFD500]">{modalGrnNo}</span> as <span className="font-black text-gray-900 dark:text-white uppercase">{modalActionType}</span>.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Remarks (Optional)
                </label>
                <textarea
                  autoFocus
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  placeholder="Enter any remarks..."
                  className="w-full bg-gray-50 dark:bg-navy-900/50 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-sm font-bold text-gray-800 dark:text-white focus:border-[#FFD500] focus:ring-1 focus:ring-[#FFD500] outline-none transition-all resize-none h-24"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50/50 dark:bg-[#0B101E]/50 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-6 py-2 text-xs font-black uppercase tracking-widest text-white rounded-lg shadow-md transition-all
                  ${modalActionType === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700'
                    : modalActionType === 'Rejected' ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#003875] hover:bg-[#002855] dark:bg-[#FFD500] dark:hover:bg-[#E6C000] dark:text-black'}
                `}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page Guide Modal ─── */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0B101E] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-white/10 flex flex-col">
            {/* Header */}
            <div className="relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-[#003875] via-[#0056b3] to-[#0077cc]" />
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_#FFD500_0%,_transparent_50%)]" />
              <div className="relative flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/15 backdrop-blur rounded-xl border border-white/20">
                    <InformationCircleIcon className="w-6 h-6 text-[#FFD500]" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white uppercase tracking-widest">
                      Payment Vendor Approval
                    </h2>
                    <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mt-0.5">
                      Visual guide · workflow · filters
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Purpose banner */}
              <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-4">
                <p className="text-xs leading-relaxed text-gray-700 dark:text-slate-300">
                  Track vendor payments for GRN entries. Each row merges GRN data with approval status and calculates the <strong className="text-[#003875] dark:text-[#FFD500]">Planned Payment Date</strong> from I2R creation date + payment terms.
                </p>
              </div>

              {/* Workflow Diagram */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-[#FFD500] rounded-full" />
                  Approval Workflow Diagram
                </h3>
                <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-navy-900/40 p-4 md:p-5">
                  <div className="flex flex-col items-stretch gap-2 max-w-xl mx-auto">
                    {/* Step 1 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20">
                      <div className="p-2 bg-white/20 rounded-lg shrink-0">
                        <DocumentTextIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Step 1</p>
                        <p className="text-xs font-black">GRN Created / Edited</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className="flex flex-col items-center text-emerald-600 dark:text-emerald-400">
                        <ArrowRightIcon className="w-4 h-4 rotate-90" />
                        <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                          <BellIcon className="w-3 h-3" /> WhatsApp → MD Sir
                        </span>
                        <span className="text-[9px] font-bold opacity-70">9899444530</span>
                      </div>
                    </div>
                    {/* Step 2 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#003875] to-[#0056b3] text-white shadow-lg shadow-blue-900/20">
                      <div className="p-2 bg-white/20 rounded-lg shrink-0">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Step 2 · MD / Admin</p>
                        <p className="text-xs font-black">Approve or Reject on this page</p>
                      </div>
                    </div>
                    {/* Branch */}
                    <div className="grid grid-cols-2 gap-2 pl-2 pr-2">
                      <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                        <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-400">Rejected</span>
                        <span className="text-[8px] text-center text-red-500/80">Payment blocked</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                        <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Approved</span>
                        <span className="text-[8px] text-center text-emerald-600/80 flex items-center gap-0.5">
                          <BellIcon className="w-2.5 h-2.5" /> WhatsApp Himanshi
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className="flex flex-col items-center text-emerald-600 dark:text-emerald-400">
                        <ArrowRightIcon className="w-4 h-4 rotate-90" />
                        <span className="text-[9px] font-black uppercase tracking-wider">8766272040</span>
                      </div>
                    </div>
                    {/* Step 3 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD500] text-[#003875] shadow-lg shadow-amber-400/20">
                      <div className="p-2 bg-[#003875]/10 rounded-lg shrink-0">
                        <BanknotesIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Step 3 · User</p>
                        <p className="text-xs font-black">Mark Payed (after MD approval only)</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRightIcon className="w-4 h-4 rotate-90 text-gray-400" />
                    </div>
                    {/* Step 4 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                      <div className="p-2 bg-white/20 rounded-lg shrink-0">
                        <ClipboardDocumentCheckIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Complete</p>
                        <p className="text-xs font-black">Status = Payed · Payment recorded</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Status Filter Cards */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-[#FFD500] rounded-full" />
                  Status Filter Tabs
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { label: "All", desc: "Every record", color: "from-slate-500 to-slate-600" },
                    { label: "Pending Approval", desc: "Awaiting MD", color: "from-orange-400 to-amber-500" },
                    { label: "Pending Payment", desc: "MD approved", color: "from-blue-500 to-indigo-600" },
                    { label: "Payed", desc: "Completed", color: "from-emerald-500 to-green-600" },
                    { label: "Rejected", desc: "MD declined", color: "from-red-500 to-rose-600" },
                  ].map((tab) => (
                    <div key={tab.label} className={`rounded-xl p-3 bg-gradient-to-br ${tab.color} text-white shadow-md`}>
                      <p className="text-[9px] font-black uppercase tracking-wide leading-tight">{tab.label}</p>
                      <p className="text-[8px] font-bold opacity-80 mt-1">{tab.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Data & Notifications */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-[#FFD500] rounded-full" />
                  Data & Notifications
                </h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-gray-100 dark:border-white/10 p-3 bg-white dark:bg-navy-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" style={{ animationDuration: "3s" }} />
                      <span className="text-[10px] font-black uppercase text-[#003875] dark:text-[#FFD500]">Auto Refresh</span>
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-slate-400 leading-relaxed">GRN + payment status reload every <strong>5 sec</strong></p>
                  </div>
                  <div className="rounded-xl border border-gray-100 dark:border-white/10 p-3 bg-white dark:bg-navy-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <DevicePhoneMobileIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-black uppercase text-emerald-600">WhatsApp Alerts</span>
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-slate-400 leading-relaxed">New/edit GRN → MD · Approve → Himanshi · Includes ERP link + due date</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 dark:border-white/10 p-3 bg-white dark:bg-navy-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <ClockIcon className="w-4 h-4 text-violet-500" />
                      <span className="text-[10px] font-black uppercase text-violet-600">Planned Date</span>
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-slate-400 leading-relaxed">I2R Created At + Payment Terms (days)</p>
                  </div>
                </div>
              </section>

              {/* Roles */}
              <section className="grid md:grid-cols-2 gap-3">
                <div className="rounded-2xl border-2 border-[#003875]/20 dark:border-[#FFD500]/20 p-4 bg-gradient-to-br from-blue-50/80 to-white dark:from-navy-900/60 dark:to-navy-950/40">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#003875] dark:text-[#FFD500] mb-2 flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> MD / Admin
                  </h4>
                  <ul className="text-[10px] space-y-1.5 text-gray-600 dark:text-slate-400">
                    <li>• <strong>Approve / Reject</strong> on pending entries</li>
                    <li>• Remarks saved with <strong>Admin:</strong> prefix</li>
                    <li>• Reject blocks user from marking Payed</li>
                  </ul>
                </div>
                <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/40 p-4 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/20 dark:to-navy-950/40">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <BanknotesIcon className="w-4 h-4" /> User
                  </h4>
                  <ul className="text-[10px] space-y-1.5 text-gray-600 dark:text-slate-400">
                    <li>• <strong>Mark Payed</strong> only when MD approved</li>
                    <li>• Shows <strong>Awaiting MD</strong> until then</li>
                    <li>• Remarks saved with <strong>User:</strong> prefix</li>
                  </ul>
                </div>
              </section>

              {/* Tools row */}
              <section className="grid md:grid-cols-3 gap-2">
                <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 dark:bg-navy-900/40 border border-gray-100 dark:border-white/5">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-700 dark:text-slate-300">Search</p>
                    <p className="text-[9px] text-gray-500 dark:text-slate-500 mt-0.5">GRN, PO, item, category, country…</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 dark:bg-navy-900/40 border border-gray-100 dark:border-white/5">
                  <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-700 dark:text-slate-300">Date Filters</p>
                    <p className="text-[9px] text-gray-500 dark:text-slate-500 mt-0.5">Day / Week / Month / Custom range on Planned Date</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 dark:bg-navy-900/40 border border-gray-100 dark:border-white/5">
                  <ArrowDownTrayIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-700 dark:text-slate-300">Export CSV</p>
                    <p className="text-[9px] text-gray-500 dark:text-slate-500 mt-0.5">Download filtered list with remarks</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-[#0B101E] dark:to-navy-900/50 border-t border-gray-100 dark:border-white/5 flex justify-end shrink-0">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-8 py-2.5 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-[#003875] to-[#0056b3] hover:from-[#002855] hover:to-[#003875] dark:from-[#FFD500] dark:to-amber-400 dark:hover:from-[#E6C000] dark:hover:to-[#FFD500] dark:text-[#003875] text-white rounded-xl shadow-lg transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
