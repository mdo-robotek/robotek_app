"use client";

import React, { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import CooReport from "@/components/CooReport";
import DrillDownModal, { DrillDownColumn } from "@/components/DrillDownModal";
import {
  ChartBarIcon,
  ShoppingBagIcon,
  TruckIcon,
  ClockIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ArchiveBoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  HandThumbUpIcon,
  CheckBadgeIcon,
  ShareIcon,
  DocumentTextIcon,
  ArrowPathRoundedSquareIcon,
  InboxArrowDownIcon,
  CurrencyDollarIcon,
  ClipboardIcon,
  ArrowLeftIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  SparklesIcon,
  DocumentArrowDownIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ComposedChart,
  Bar,
  BarChart,
  ReferenceLine,
} from "recharts";
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
const fetcher = (url: string) => fetch(url).then(res => res.json());

// --- Icons for Steps ---
const STEP_ICONS = [
  ClipboardIcon, MagnifyingGlassIcon, HandThumbUpIcon, CheckBadgeIcon, ArchiveBoxIcon,
  ShareIcon, DocumentTextIcon, ArrowPathRoundedSquareIcon, TruckIcon, InboxArrowDownIcon, CurrencyDollarIcon
];

// --- Metric Explanations ---
const METRIC_DESCRIPTIONS: Record<string, string> = {
  'Total PO Raised': 'Calculation: Count entries where `po_number_6` is present.\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Total PO Closed': 'Calculation: Count raised POs where `received_qty_10` >= `quantity`.\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Pending POs': 'Calculation: Count raised POs where `received_qty_10` < `quantity`.\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Delivery Overdue': 'Calculation: Count Pending POs where today > Expected Delivery (PO Date `actual_6` + `lead_time_acc_to_vendor_4`).\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Payment Overdue': 'Calculation: Count mapped GRNs where Actual Payment (`actual_9`) > Planned (`planned_9`), OR if pending and today > Planned.\nDate Filter: PO Date (`actual_6` in I2R) is within the selected range.',
  'Avg I2R time (IND)': 'Calculation: Avg days from PO Date (`actual_6`) to Full Receipt (`actual_9`) for closed POs mapped to IND GRNs.\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Avg I2R time (CHN)': 'Calculation: Avg days from PO Date (`actual_6`) to Full Receipt (`actual_9`) for closed POs mapped to CHN GRNs.\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Material Rejected': 'Calculation: Count all GRNs where Quality Check (`status_3`) = "Rejected".\nDate Filter: Quality Check Date (`actual_3` in GRN) is within the selected range.',
  'On Time Material Received': 'Calculation: Count Closed POs where Full Receipt (`actual_9`) <= Expected Delivery (`actual_6` + lead time).\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Bottleneck': 'Calculation: Stage with highest total aggregate delay (Actual Date - Planned Date).\nDate Filter: PO Date (`actual_6`) is within the selected range.',
  'Total Rep. Raised': 'Calculation: Count all replacement entries.\nDate Filter: Created Date is within the selected range.',
  'Total Rep. Closed': 'Calculation: Count fully resolved replacements.\nDate Filter: Created Date is within the selected range.',
  'Pending REPs': 'Calculation: Count ongoing replacement entries.\nDate Filter: Created Date is within the selected range.',
  'Avg Rep Process time': 'Calculation: Avg time to resolve replacements.\nDate Filter: Created Date is within the selected range.'
};

const METRIC_DESCRIPTIONS_PACKING: Record<string, string> = {
  'Total PO Raised': 'Calculation: Count entries where `po_num_4` is present.\nDate Filter: PO Generate Date (`actual_4`) is within the selected range.',
  'Total PO Closed': 'Calculation: Count Item Receive (PACKING) entries.\nDate Filter: Created Date is within the selected range.',
  'Pending POs': 'Calculation: Count raised POs where `status_4` is not COMPLETED.\nDate Filter: PO Generate Date (`actual_4`) is within the selected range.',
};

// --- Helper Components ---

const CompactTile = ({ label, value, icon: Icon, color, onClick, isClickable }: any) => (
  <div
    onClick={isClickable ? onClick : undefined}
    className={`bg-white dark:bg-navy-800 p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xl ring-1 ring-black/5 flex items-center gap-3 transition-all ${isClickable ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.02] hover:border-gray-300 dark:hover:border-white/10' : ''}`}
  >
    <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <h4 className="text-xl font-black text-gray-900 dark:text-white leading-none tracking-tight">{value}</h4>
    </div>
  </div>
);

const TrendTable = ({ title, data, type }: { title: string, data: any[], type: 'count' | 'amount' }) => (
  <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden h-full">
    <div className="p-4 border-b border-gray-50 dark:border-white/5">
      <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{title}</h3>
    </div>
    <div className="overflow-auto max-h-[300px] custom-scrollbar">
      <table className="w-full text-left">
        <thead className="bg-gray-50 dark:bg-white/5 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-2 text-[9px] font-black text-gray-400 uppercase">Month</th>
            <th className="px-4 py-2 text-[9px] font-black text-gray-400 uppercase text-right">{type === 'count' ? 'Orders' : 'Revenue'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <td className="px-4 py-2 text-[10px] font-bold text-gray-600 dark:text-gray-300">{row.month}</td>
              <td className="px-4 py-2 text-[10px] font-black text-gray-900 dark:text-white text-right">
                {type === 'count' ? row.count : `${(row.amount / 100000).toFixed(2)}L`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Main Page ---

export default function MetrixPage() {
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("overview");
  const [drillDownParty, setDrillDownParty] = useState<any>(null);
  const [drillDownCategory, setDrillDownCategory] = useState<any>(null);
  const [drillDownModal, setDrillDownModal] = useState<{ isOpen: boolean, title: string, columns: DrillDownColumn[], data: any[] }>({
    isOpen: false, title: "", columns: [], data: []
  });
  const [forecastType, setForecastType] = useState("category");
  const [forecastTarget, setForecastTarget] = useState("");
  const [granularity, setGranularity] = useState("all");
  const [dateOffset, setDateOffset] = useState(0);
  const [isManualDate, setIsManualDate] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const exportToPDF = async () => {
    setIsExportingPDF(true);
    try {
      const element = document.getElementById('department-performance-report');
      if (!element) return;
      
      const imgData = await htmlToImage.toPng(element, {
        pixelRatio: 2,
        backgroundColor: resolvedTheme === 'dark' ? '#0b1120' : '#f8fafc',
        filter: (node) => {
          if (node.hasAttribute && node.hasAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        }
      });
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Department_Performance_${format(new Date(), 'dd-MMM-yyyy')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Compute date range when granularity or offset changes
  useEffect(() => {
    if (isManualDate) return;

    if (granularity === "all") {
      setDateRange({ startDate: "", endDate: "" });
      return;
    }

    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (granularity === 'day') {
      start.setDate(start.getDate() + dateOffset);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (granularity === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1) + (dateOffset * 7);
      start = new Date(start.setDate(diff));
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (granularity === 'month') {
      start.setMonth(start.getMonth() + dateOffset, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (granularity === 'quarter') {
      const quarter = Math.floor(start.getMonth() / 3) + dateOffset;
      start.setMonth(quarter * 3, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999);
    } else if (granularity === 'year') {
      start.setFullYear(start.getFullYear() + dateOffset, 0, 1);
      end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setDateRange({ startDate: fmt(start), endDate: fmt(end) });
  }, [granularity, dateOffset, isManualDate]);

  const getGranularityLabel = () => {
    if (granularity === "all" && !isManualDate) return "All Time";
    if (isManualDate || !dateRange.startDate) return "Custom";
    const d = new Date(dateRange.startDate);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (granularity === 'day') return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    if (granularity === 'week') {
      const endD = dateRange.endDate ? new Date(dateRange.endDate) : d;
      return `${d.getDate()} ${months[d.getMonth()]} - ${endD.getDate()} ${months[endD.getMonth()]} ${endD.getFullYear()}`;
    }
    if (granularity === 'month') return `${months[d.getMonth()]} ${d.getFullYear()}`;
    if (granularity === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q} ${d.getFullYear()}`;
    }
    if (granularity === 'year') return `${d.getFullYear()}`;
    return "Custom";
  };

  const isDark = mounted && resolvedTheme === "dark";
  const chartTextColor = isDark ? "#ffffff" : "#9ca3af";
  const chartLabelColor = isDark ? "#ffffff" : "#003875";
  const chartGridColor = isDark ? "rgba(255, 255, 255, 0.2)" : "#f0f0f0";
  const chartLineColor = isDark ? "#ffffff" : "#003875";
  const revenueLineColor = isDark ? "#ffffff" : "#10B981";

  const { data, error, isLoading, isValidating } = useSWR(
    `/api/metrix?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&targetDate=${targetDate}&granularity=${granularity}`,
    fetcher,
    { keepPreviousData: true }
  );

  const { data: cooData, isLoading: cooLoading } = useSWR(
    activeTab === "forecast"
      ? `/api/metrix/coo?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&granularity=${granularity}`
      : null,
    fetcher,
    { keepPreviousData: true, refreshInterval: 300000 }
  );

  const { data: funnelData, isLoading: funnelLoading } = useSWR(
    activeTab === "sales-funnel"
      ? `/api/metrix/sales-funnel?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&granularity=${granularity}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const { data: deptData, isLoading: deptLoading } = useSWR(
    activeTab === "department"
      ? `/api/metrix/department?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&granularity=${granularity}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const [roadmapSearchQuery, setRoadmapSearchQuery] = useState("");
  const [extraRoadmapOrders, setExtraRoadmapOrders] = useState<any[]>([]);

  const colors = ["#003875", "#FFD500", "#CE2029", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];

  const forecastData = useMemo(() => {
    if (!data) return [];
    let history: any[] = [];
    if (forecastType === "category") {
      const cat = data.categories.all.find((c: any) => c.category === forecastTarget);
      history = cat?.history || [];
    } else if (forecastType === "party") {
      const p = data.parties.all.find((p: any) => p.party === forecastTarget);
      history = p?.history || [];
    }
    if (history.length < 2) return [];
    const dailyAvg = history.reduce((sum, h) => sum + h.amount, 0) / history.length;
    const lastDate = new Date(history[history.length - 1].date);
    const results = [...history.map(h => ({ ...h, isForecast: false }))];
    for (let i = 1; i <= 4; i++) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + (i * 7));
      results.push({
        date: nextDate.toISOString().split('T')[0],
        amount: Math.round(dailyAvg * (1 + (Math.random() * 0.2 - 0.1))),
        isForecast: true
      });
    }
    return results;
  }, [data, forecastType, forecastTarget]);

  if (error) return <div className="p-10 text-rose-500 font-black uppercase text-[10px] bg-white dark:bg-navy-800 rounded-3xl border border-rose-100 m-4 shadow-xl flex items-center gap-3">
    <ExclamationCircleIcon className="w-5 h-5" />
    <span>Critical Error: Failed to synchronize logistics engine.</span>
  </div>;

  if (!data && isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#fcfaf4] dark:bg-navy-950">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 border-4 border-gray-100 border-t-[#003875] dark:border-t-[#FFD500] rounded-full mb-6 shadow-sm"
      />
      <div className="text-center">
        <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] animate-pulse">Syncing Metrix Intelligence</p>
        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-2">Connecting to Logistics Core...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfaf4] dark:bg-navy-950 p-2 lg:p-3 custom-scrollbar">
      <div className="w-full space-y-3">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#003875] dark:bg-[#FFD500] rounded-xl relative">
              <ChartBarIcon className="w-5 h-5 text-white dark:text-[#003875]" />
              {isValidating && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">O2D <span className="text-[#003875] dark:text-[#FFD500] italic">ENGINE</span></h1>
              <p className="text-gray-400 font-bold text-[8px] uppercase tracking-widest mt-1">Analytics Control Center</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2 lg:items-end w-full lg:w-auto">
              {([
                { key: "overview", label: "Overview" },
                { key: "roadmap", label: "Roadmap" },
                { key: "parties", label: "Parties" },
                { key: "categories", label: "Categories" },
                { key: "sales-funnel", label: "Sales Funnel" },
                { key: "department", label: "Department Performance" },
                { key: "forecast", label: "⚡ COO Report" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key); setDrillDownParty(null); setDrillDownCategory(null); }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                    activeTab === key
                      ? key === "forecast"
                        ? 'bg-gradient-to-r from-[#003875] to-blue-800 text-white shadow-md shadow-blue-900/20 scale-105'
                        : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-900/20 scale-105'
                      : key === "forecast"
                        ? 'bg-blue-50 dark:bg-[#003875]/20 text-[#003875] dark:text-[#FFD500] hover:bg-blue-100 hover:scale-105'
                        : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-navy-700 hover:scale-105'
                  }`}
                >
                  {label}
                </button>
              ))}

            </div>

            <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={isManualDate ? "custom" : granularity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "custom") return;
                  setGranularity(value);
                  setDateOffset(0);
                  setIsManualDate(false);
                  if (value === "all") {
                    setDateRange({ startDate: "", endDate: "" });
                  }
                }}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white dark:bg-navy-800 text-[#003875] dark:text-[#FFD500] border border-gray-200 dark:border-white/10 shadow-sm outline-none focus:ring-2 focus:ring-[#003875]/30 dark:focus:ring-[#FFD500]/30 cursor-pointer min-w-[130px]"
              >
                <option value="all">All Time</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
                {isManualDate && <option value="custom">Custom Range</option>}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>

            {granularity !== "all" || isManualDate ? (
            <div className="flex items-center gap-1 bg-white dark:bg-navy-800 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-white/5">
              <button
                onClick={() => { setDateOffset(prev => prev - 1); setIsManualDate(false); }}
                disabled={granularity === "all"}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="px-3 text-[10px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest min-w-[140px] text-center">
                {getGranularityLabel()}
              </div>
              <button
                onClick={() => { setDateOffset(prev => prev + 1); setIsManualDate(false); }}
                disabled={granularity === "all"}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            ) : (
              <div className="flex items-center gap-1 bg-white dark:bg-navy-800 rounded-xl px-3 py-2 shadow-sm border border-gray-100 dark:border-white/5">
                <div className="text-[10px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest min-w-[140px] text-center">
                  All Time
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 bg-gray-50 dark:bg-navy-900 p-1.5 rounded-xl border border-gray-100 dark:border-white/5">
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => { setDateRange(prev => ({ ...prev, startDate: e.target.value })); setIsManualDate(true); }}
                className="bg-transparent border-none text-[9px] font-black text-gray-600 dark:text-gray-300 outline-none w-24"
              />
              <span className="text-gray-300 text-[9px] font-black">TO</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => { setDateRange(prev => ({ ...prev, endDate: e.target.value })); setIsManualDate(true); }}
                className="bg-transparent border-none text-[9px] font-black text-gray-600 dark:text-gray-300 outline-none w-24"
              />
              {(dateRange.startDate || dateRange.endDate) && (
                <button
                  onClick={() => {
                    setDateRange({ startDate: "", endDate: "" });
                    setGranularity("all");
                    setDateOffset(0);
                    setIsManualDate(false);
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full"
                >
                  <XMarkIcon className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Left Column (40% approx - lg:col-span-5) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  {/* Tiles */}
                  <div className="grid grid-cols-2 gap-3 h-fit">
                    <CompactTile label="Orders" value={data.stats.total} icon={ShoppingBagIcon} color="bg-blue-600"
                      isClickable onClick={() => setDrillDownModal({
                        isOpen: true, title: "Total Orders", data: data.stats.ordersList || [],
                        columns: [{ key: 'id', label: 'Order No' }, { key: 'party', label: 'Party' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', render: (item: any) => `₹${item.amount.toLocaleString()}` }]
                      })}
                    />
                    <CompactTile label="Revenue" value={`${(data.stats.totalAmount / 100000).toFixed(1)}L`} icon={CurrencyDollarIcon} color="bg-[#003875]" />
                    <CompactTile label="OTD Count" value={data.stats.otdCount} icon={CheckBadgeIcon} color="bg-emerald-600"
                      isClickable onClick={() => setDrillDownModal({
                        isOpen: true, title: "On-Time Delivered (OTD)", data: data.stats.otdList || [],
                        columns: [{ key: 'id', label: 'Order No' }, { key: 'party', label: 'Party' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', render: (item: any) => `₹${item.amount.toLocaleString()}` }]
                      })}
                    />
                    <CompactTile label="Delayed" value={data.stats.delayedCount} icon={ExclamationCircleIcon} color="bg-rose-600"
                      isClickable onClick={() => setDrillDownModal({
                        isOpen: true, title: "Delayed Orders", data: data.stats.delayedList || [],
                        columns: [{ key: 'id', label: 'Order No' }, { key: 'party', label: 'Party' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', render: (item: any) => `₹${item.amount.toLocaleString()}` }]
                      })}
                    />
                    <CompactTile label="Pending" value={data.stats.pending} icon={ArrowPathIcon} color="bg-amber-600"
                      isClickable onClick={() => setDrillDownModal({
                        isOpen: true, title: "Pending Orders", data: data.stats.pendingList || [],
                        columns: [{ key: 'id', label: 'Order No' }, { key: 'party', label: 'Party' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', render: (item: any) => `₹${item.amount.toLocaleString()}` }]
                      })}
                    />
                    <CompactTile label="OTD %" value={`${data.stats.otdRate}%`} icon={ChartBarIcon} color="bg-indigo-600" />
                  </div>

                  {/* Delivery Performance (OTD %) */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5 flex-1">
                    <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6">Delivery Performance (OTD %)</h3>
                    <div className="h-[230px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.trends} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                          <XAxis dataKey="month" axisLine={{ stroke: chartGridColor }} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} angle={-45} textAnchor="end" height={60} />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                          <Line type="monotone" dataKey="otdRate" stroke={chartLineColor} strokeWidth={3} dot={{ r: 3, fill: chartLineColor }}>
                            <LabelList dataKey="otdRate" position="top" offset={10} style={{ fontSize: 12, fontWeight: 900, fill: chartLabelColor }} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Right Column (60% approx - lg:col-span-7) */}
                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Party Distribution Analysis */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5 flex flex-col h-full min-h-[400px]">
                    <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-8 border-b pb-4 border-gray-50 dark:border-white/5">Party Distribution Analysis</h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                            <Pie
                              data={data.parties.top20.slice(0, 8)}
                              cx="50%" cy="50%"
                              innerRadius={35} outerRadius={60}
                              paddingAngle={5}
                              dataKey="count" nameKey="party"
                              label={({ party, percent }: any) => {
                                const safeName = String(party || "Unknown");
                                const truncated = safeName.length > 12 ? safeName.slice(0, 12) + '...' : safeName;
                                return `${truncated} (${(percent * 100).toFixed(0)}%)`;
                              }}
                              labelLine={true}
                            >
                              {data.parties.top20.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-6 space-y-2 w-full">
                        {data.parties.top20.slice(0, 5).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-transparent">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                              <p className="text-[11px] font-black uppercase text-gray-900 dark:text-white truncate">{p.party}</p>
                            </div>
                            <p className="text-[11px] font-black text-[#003875] dark:text-[#FFD500]">{p.count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Category Market Share */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5 flex flex-col h-full min-h-[400px]">
                    <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-8 border-b pb-4 border-gray-50 dark:border-white/5">Category Market Share</h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                            <Pie
                              data={data.categories.top20.slice(0, 8)}
                              cx="50%" cy="50%"
                              innerRadius={35} outerRadius={60}
                              paddingAngle={5}
                              dataKey="count" nameKey="category"
                              label={({ category, percent }: any) => {
                                const safeName = String(category || "Unknown");
                                const truncated = safeName.length > 12 ? safeName.slice(0, 12) + '...' : safeName;
                                return `${truncated} (${(percent * 100).toFixed(0)}%)`;
                              }}
                              labelLine={true}
                            >
                              {data.categories.top20.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-6 space-y-2 w-full">
                        {data.categories.top20.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-transparent">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                              <p className="text-[11px] font-black uppercase text-gray-900 dark:text-white truncate">{c.category}</p>
                            </div>
                            <p className="text-[11px] font-black text-[#003875] dark:text-[#FFD500]">{(c.amount / 1000).toFixed(0)}k</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Trend Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                {/* Monthly Revenue Flow */}
                <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                  <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-8 border-b pb-4 border-gray-50 dark:border-white/5">Monthly Revenue Flow (Lacs)</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trends} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                        <XAxis dataKey="month" axisLine={{ stroke: chartGridColor }} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} angle={-45} textAnchor="end" height={60} />
                        <YAxis axisLine={{ stroke: chartGridColor }} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} tickFormatter={(val) => `${(val / 100000).toFixed(1)}L`} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                        <Line type="monotone" dataKey="amount" stroke={revenueLineColor} strokeWidth={4} dot={{ r: 4, fill: revenueLineColor }}>
                          <LabelList dataKey="amount" position="top" offset={12} style={{ fontSize: 12, fontWeight: 900, fill: revenueLineColor }} formatter={(val: any) => `${(val / 100000).toFixed(1)}L`} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Monthly Order Velocity */}
                <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                  <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-8 border-b pb-4 border-gray-50 dark:border-white/5">Monthly Order Velocity</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trends} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                        <XAxis dataKey="month" axisLine={{ stroke: chartGridColor }} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} angle={-45} textAnchor="end" height={60} />
                        <YAxis axisLine={{ stroke: chartGridColor }} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                        <Line type="monotone" dataKey="count" stroke={chartLineColor} strokeWidth={4} dot={{ r: 4, fill: chartLineColor }}>
                          <LabelList dataKey="count" position="top" offset={12} style={{ fontSize: 12, fontWeight: 900, fill: chartLabelColor }} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "sales-funnel" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {!funnelData && funnelLoading ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-navy-800 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                  <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-[#003875] dark:border-t-[#FFD500] rounded-full animate-spin mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Analyzing Funnel...</p>
                </div>
              ) : funnelData ? (
                <>
                  {/* Top Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <CompactTile label="Total Leads" value={funnelData.summary.totalLeads} icon={UserGroupIcon} color="bg-blue-500" />
                    <CompactTile label="Pipeline Potential" value={`₹${(funnelData.summary.pipelineValue / 100000).toFixed(1)}L`} icon={CurrencyDollarIcon} color="bg-purple-500" />
                    <CompactTile label="Closed Won" value={`₹${(funnelData.summary.wonValue / 100000).toFixed(1)}L`} icon={CheckBadgeIcon} color="bg-emerald-500" />
                    <CompactTile label="Win Rate" value={`${funnelData.summary.winRate}%`} icon={ArrowTrendingUpIcon} color="bg-[#003875]" />
                  </div>

                  {/* Funnel & Velocity Chart Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    
                    {/* Funnel Visualization */}
                    <div className="lg:col-span-5 bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5 flex flex-col">
                      <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6 border-b pb-4 border-gray-50 dark:border-white/5">Conversion Funnel</h3>
                      <div className="flex-1 flex flex-col justify-center items-center w-full px-2 lg:px-8 py-4 min-h-[300px]">
                        <div style={{ filter: 'drop-shadow(0 15px 20px rgba(0,0,0,0.15))' }} className="w-full flex flex-col">
                          {funnelData.funnelStages.map((stage: any, i: number) => {
                            const numStages = funnelData.funnelStages.length;
                            const step = 70 / numStages; // 100 down to 30
                            const topWidth = 100 - (i * step);
                            const bottomWidth = 100 - ((i + 1) * step);
                            
                            const colors = [
                              "from-blue-500 to-cyan-400", 
                              "from-purple-500 to-fuchsia-400", 
                              "from-orange-500 to-amber-400", 
                              "from-emerald-500 to-teal-400"
                            ];
                            
                            return (
                              <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: -20 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ duration: 0.5, delay: i * 0.15, type: 'spring' }}
                                className={`relative flex flex-col items-center justify-center w-full h-24 mb-1 bg-gradient-to-r ${colors[i % colors.length]} hover:brightness-110 transition-all cursor-pointer group`}
                                style={{
                                  clipPath: `polygon(${(100 - topWidth)/2}% 0%, ${100 - (100 - topWidth)/2}% 0%, ${100 - (100 - bottomWidth)/2}% 100%, ${(100 - bottomWidth)/2}% 100%)`
                                }}
                              >
                                {/* Glass Overlay for 3D effect */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none mix-blend-overlay" />
                                
                                <div className="z-10 flex flex-col items-center justify-center text-white text-center transform group-hover:scale-110 transition-transform">
                                  <span className="text-[10px] lg:text-xs font-black uppercase tracking-widest drop-shadow-md">{stage.stage}</span>
                                  <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-xl lg:text-2xl font-black drop-shadow-lg leading-none">{stage.count}</span>
                                    <span className="text-[9px] font-bold opacity-80">₹{(stage.value / 100000).toFixed(1)}L</span>
                                  </div>
                                  <span className="text-[9px] font-bold mt-1 bg-black/20 px-2 py-0.5 rounded-full">{stage.conversionRate}% Conversion</span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Lead Velocity */}
                    <div className="lg:col-span-7 bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                      <div className="flex items-center justify-between mb-6 border-b pb-4 border-gray-50 dark:border-white/5">
                        <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Lead Velocity</h3>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/><span className="text-[8px] font-black uppercase text-gray-400">Generated</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[8px] font-black uppercase text-gray-400">Won</span></div>
                        </div>
                      </div>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={funnelData.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartTextColor }} angle={-45} textAnchor="end" height={50} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartTextColor }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                            <Area type="monotone" dataKey="generated" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorGen)" />
                            <Area type="monotone" dataKey="won" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWon)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Sources and Team Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Top Sources */}
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                      <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-4">Top Sources</h3>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[400px]">
                          <thead className="text-[9px] font-black uppercase text-gray-400 border-b border-gray-50 dark:border-white/5">
                            <tr><th className="py-3 px-2">Source</th><th className="py-3 px-2 text-right">Leads</th><th className="py-3 px-2 text-right">Won</th><th className="py-3 px-2 text-right">Win Rate</th><th className="py-3 px-2 text-right">Value</th></tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {funnelData.sourceStats.slice(0, 10).map((s: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="py-3 px-2 text-[10px] font-black text-gray-900 dark:text-white uppercase max-w-[150px] truncate" title={s.source}>{s.source}</td>
                                <td className="py-3 px-2 text-[10px] font-black text-[#003875] dark:text-[#FFD500] text-right">{s.count}</td>
                                <td className="py-3 px-2 text-[10px] font-black text-emerald-600 text-right">{s.wonCount}</td>
                                <td className="py-3 px-2 text-[10px] font-bold text-gray-500 text-right">{s.conversionRate}%</td>
                                <td className="py-3 px-2 text-[10px] font-bold text-gray-900 dark:text-white text-right">{(s.amount / 1000).toFixed(1)}k</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Team Performance */}
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                      <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-4">Team Performance</h3>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[400px]">
                          <thead className="text-[9px] font-black uppercase text-gray-400 border-b border-gray-50 dark:border-white/5">
                            <tr><th className="py-3 px-2">Sales Person</th><th className="py-3 px-2 text-right">Assigned</th><th className="py-3 px-2 text-right">Won</th><th className="py-3 px-2 text-right">Win Rate</th><th className="py-3 px-2 text-right">Pipeline</th></tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {funnelData.teamStats.map((t: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <td className="py-3 px-2 text-[10px] font-black text-gray-900 dark:text-white uppercase max-w-[150px] truncate" title={t.salesperson}>{t.salesperson}</td>
                                <td className="py-3 px-2 text-[10px] font-black text-[#003875] dark:text-[#FFD500] text-right">{t.count}</td>
                                <td className="py-3 px-2 text-[10px] font-black text-emerald-600 text-right">{t.wonCount}</td>
                                <td className="py-3 px-2 text-[10px] font-bold text-gray-500 text-right">{t.conversionRate}%</td>
                                <td className="py-3 px-2 text-[10px] font-bold text-gray-900 dark:text-white text-right">{(t.amount / 100000).toFixed(2)}L</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Deep Dive Analytics */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5 mt-4">
                    <div className="flex items-center gap-2 mb-6 border-b pb-4 border-gray-50 dark:border-white/5">
                      <MagnifyingGlassIcon className="w-5 h-5 text-[#003875] dark:text-[#FFD500]" />
                      <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Deep Dive Analytics</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                      
                      {/* Qualification */}
                      <div className="flex flex-col items-center">
                        <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2">Qualification</h4>
                        <div className="h-[150px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={funnelData.deepDive.qualification} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                                {funnelData.deepDive.qualification.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={["#10B981", "#EF4444", "#F59E0B", "#8B5CF6"][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                          {funnelData.deepDive.qualification.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#10B981", "#EF4444", "#F59E0B", "#8B5CF6"][index % 4] }}></div>
                              <span className="text-[9px] font-bold text-gray-600 dark:text-gray-300">{entry.name} ({entry.value})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="flex flex-col items-center">
                        <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2">Lead Priority</h4>
                        <div className="h-[150px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={funnelData.deepDive.priority} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                                {funnelData.deepDive.priority.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={["#EF4444", "#F59E0B", "#3B82F6", "#9CA3AF"][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                          {funnelData.deepDive.priority.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#9CA3AF"][index % 4] }}></div>
                              <span className="text-[9px] font-bold text-gray-600 dark:text-gray-300">{entry.name} ({entry.value})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Process Stage */}
                      <div className="flex flex-col items-center col-span-1 md:col-span-2 xl:col-span-1 border-t md:border-t-0 md:border-l border-gray-50 dark:border-white/5 pt-4 md:pt-0 md:pl-4">
                        <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2">Process Stages</h4>
                        <div className="h-[180px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funnelData.deepDive.process.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridColor} />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 900, fill: chartTextColor }} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                              <Bar dataKey="value" fill="#003875" radius={[0, 4, 4, 0]}>
                                {funnelData.deepDive.process.slice(0, 5).map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={isDark ? '#FFD500' : '#003875'} />
                                ))}
                                <LabelList dataKey="value" position="right" style={{ fontSize: 9, fontWeight: 'bold', fill: chartTextColor }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Follow Up Stats */}
                      <div className="flex flex-col items-center col-span-1 md:col-span-2 xl:col-span-1 border-t xl:border-t-0 xl:border-l border-gray-50 dark:border-white/5 pt-4 xl:pt-0 xl:pl-4">
                        <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2">Follow-Up Outcomes</h4>
                        <div className="h-[180px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funnelData.deepDive.followUp.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridColor} />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 900, fill: chartTextColor }} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                              <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="value" position="right" style={{ fontSize: 9, fontWeight: 'bold', fill: chartTextColor }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          )}

          {activeTab === "department" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {!deptData && deptLoading ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-navy-800 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl">
                  <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-[#003875] dark:border-t-[#FFD500] rounded-full animate-spin mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Analyzing Department Performance...</p>
                </div>
              ) : deptData ? (
                <div className="flex flex-col gap-6 w-full items-start" id="department-performance-report">
                  
                  {/* Export Header */}
                  <div className="flex items-center justify-between w-full bg-white dark:bg-navy-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Department Performance</h2>
                      <p className="text-gray-500 text-[10px] font-bold mt-1 uppercase tracking-widest">
                        {granularity === "all" ? "All Time" : granularity} Report • {dateRange.startDate && dateRange.endDate ? `${format(new Date(dateRange.startDate), 'dd MMM yyyy')} to ${format(new Date(dateRange.endDate), 'dd MMM yyyy')}` : "All Time"}
                      </p>
                    </div>
                    <button 
                      onClick={exportToPDF}
                      disabled={isExportingPDF}
                      data-html2canvas-ignore
                      className="flex items-center gap-2 bg-[#003875] dark:bg-[#FFD500] text-white dark:text-navy-900 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-md"
                    >
                      {isExportingPDF ? (
                        <>
                           <ArrowPathIcon className="w-4 h-4 animate-spin" />
                           Exporting...
                        </>
                      ) : (
                        <>
                           <DocumentArrowDownIcon className="w-4 h-4" />
                           Export PDF
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-8 w-full items-start">
                  {[
                    { 
                      key: 'i2r', 
                      title: 'I2R (Purchase)', 
                      icon: DocumentTextIcon, 
                      color: 'text-blue-500', 
                      bg: 'bg-blue-50 dark:bg-blue-500/10', 
                      cardBg: 'bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-navy-800 border-blue-100 dark:border-blue-900/30', 
                      rowBg: 'bg-white hover:bg-blue-50/50 dark:bg-navy-900 dark:hover:bg-navy-800 border-blue-100/50 dark:border-blue-900/30',
                      metrics: [
                        'Total PO Raised', 'Total PO Closed', 'Pending POs', 'Delivery Overdue', 
                        'Payment Overdue', 'Avg I2R time (IND)', 'Avg I2R time (CHN)', 
                        'Material Rejected', 'On Time Material Received', 'Bottleneck'
                      ]
                    },
                    { 
                      key: 'i2rPacking', 
                      title: 'I2R Packing', 
                      icon: ArchiveBoxIcon, 
                      color: 'text-emerald-500', 
                      bg: 'bg-emerald-50 dark:bg-emerald-500/10', 
                      cardBg: 'bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-900/20 dark:to-navy-800 border-emerald-100 dark:border-emerald-900/30', 
                      rowBg: 'bg-white hover:bg-emerald-50/50 dark:bg-navy-900 dark:hover:bg-navy-800 border-emerald-100/50 dark:border-emerald-900/30',
                      metrics: [
                        'Total PO Raised', 'Total PO Closed', 'Pending POs', 'Payment Overdue', 
                        'Avg I2R time (IND)', 'Material Rejected', 'On Time Material Received', 
                        'Bottleneck'
                      ]
                    },
                    { 
                      key: 'replace', 
                      title: 'Replacement', 
                      icon: ArrowPathRoundedSquareIcon, 
                      color: 'text-amber-500', 
                      bg: 'bg-amber-50 dark:bg-amber-500/10', 
                      cardBg: 'bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-900/20 dark:to-navy-800 border-amber-100 dark:border-amber-900/30', 
                      rowBg: 'bg-white hover:bg-amber-50/50 dark:bg-navy-900 dark:hover:bg-navy-800 border-amber-100/50 dark:border-amber-900/30',
                      metrics: [
                        'Total Rep. Raised', 'Total Rep. Closed', 'Pending REPs', 
                        'Avg Rep Process time', 'Bottleneck'
                      ]
                    }
                  ].map((module, mIdx) => {
                    const mData = deptData[module.key];
                    if (!mData) return null;
                    return (
                      <div key={module.key} className={`${module.cardBg} p-4 lg:p-5 rounded-3xl border shadow-2xl ring-1 ring-black/5 flex flex-col xl:flex-row gap-6 w-full items-start`}>
                        
                        {/* Header Column */}
                        <div className="flex flex-col gap-6 w-full xl:w-[260px] flex-shrink-0 border-b xl:border-b-0 xl:border-r border-gray-900/5 dark:border-white/5 pb-4 xl:pb-0 xl:pr-6">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`p-3 rounded-xl flex-shrink-0 ${module.bg}`}>
                              <module.icon className={`w-7 h-7 ${module.color}`} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight uppercase truncate" title={module.title}>{module.title}</h3>
                              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">FMS Dashboard</p>
                            </div>
                          </div>
                          <div className="flex flex-col bg-white/60 dark:bg-navy-900/60 p-4 rounded-2xl border border-gray-900/5 dark:border-white/5 shadow-sm">
                            <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Total Entries</span>
                            <span className="text-3xl font-black text-[#003875] dark:text-[#FFD500] leading-none mt-2">{mData.total}</span>
                          </div>
                        </div>

                        {/* Metrics and Stages */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 flex-1 w-full">
                          
                          {/* Middle Column: Metrics */}
                          <div className="flex flex-col gap-1 bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-gray-900/5 dark:border-white/5 shadow-inner">
                            
                            {/* Table Header */}
                            <div className="flex items-center px-2 pb-1 border-b border-gray-900/10 dark:border-white/10 mb-1">
                              <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest flex-1">Metric</span>
                              <span className="text-[9px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest w-11 text-center flex-shrink-0">Value</span>
                            </div>

                            {module.metrics.map((mLabel, idx) => {
                              const MetricIcon = STEP_ICONS[idx % STEP_ICONS.length];
                              const mColor = [
                                'text-blue-600 dark:text-blue-400',
                                'text-emerald-600 dark:text-emerald-400',
                                'text-purple-600 dark:text-purple-400',
                                'text-rose-600 dark:text-rose-400',
                                'text-amber-600 dark:text-amber-400',
                                'text-cyan-600 dark:text-cyan-400',
                                'text-indigo-600 dark:text-indigo-400'
                              ][idx % 7];
                              
                              const desc = module.key === 'i2rPacking' && METRIC_DESCRIPTIONS_PACKING[mLabel] 
                                ? METRIC_DESCRIPTIONS_PACKING[mLabel] 
                                : METRIC_DESCRIPTIONS[mLabel];

                              return (
                                <div key={idx} className={`flex items-center ${module.rowBg} py-1 px-2 rounded-lg shadow-sm hover:shadow-md transition-all border group`}>
                                  
                                  {/* Icon + Text */}
                                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-2 group/label">
                                    <div className={`p-1.5 rounded-lg flex-shrink-0 bg-gray-50 dark:bg-navy-800 text-gray-400 group-hover:text-[#003875] dark:group-hover:text-[#FFD500] group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors`}>
                                      <MetricIcon className={`w-4 h-4 ${mColor}`} />
                                    </div>
                                    <div className="min-w-0 flex-1 flex items-center gap-1.5 relative">
                                      <p className={`text-[11px] font-bold ${mColor} leading-snug uppercase tracking-wide truncate`} title={mLabel}>{mLabel}</p>
                                      {desc && (
                                        <div className="relative flex items-center z-10">
                                          <InformationCircleIcon className={`w-3.5 h-3.5 ${mColor} opacity-40 hover:opacity-100 cursor-help transition-opacity`} />
                                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/label:block w-72 p-3 bg-gray-900 dark:bg-black text-white text-[9px] font-medium leading-relaxed rounded-lg shadow-xl pointer-events-none normal-case whitespace-pre-wrap">
                                            {desc}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-black"></div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Value */}
                                  <div className={`flex-shrink-0 flex justify-end ${mLabel === 'Bottleneck' ? 'w-auto max-w-[65%]' : 'w-11 justify-center'}`}>
                                    {mLabel === 'Bottleneck' && typeof mData.metrics?.[mLabel] === 'string' && (mData.metrics?.[mLabel] as string).includes('|') ? (
                                      <div className="flex flex-col items-end gap-0.5 text-right w-full">
                                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-md leading-tight w-full text-right shadow-sm border border-rose-100 dark:border-rose-900/50">
                                          {(mData.metrics?.[mLabel] as string).split('|')[0]}
                                        </span>
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-1">
                                          {(mData.metrics?.[mLabel] as string).split('|')[1]}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className={`bg-gray-100/80 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 w-full py-1.5 rounded-lg text-xs font-black border border-gray-200/50 dark:border-gray-700/20 text-center shadow-sm ${mLabel === 'Bottleneck' ? 'px-3 text-[10px]' : ''}`}>
                                        {mData.metrics?.[mLabel] || 0}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Right Column: Stage Table */}
                          <div className="flex flex-col gap-1 bg-white/40 dark:bg-black/10 p-3 rounded-2xl border border-gray-900/5 dark:border-white/5 shadow-inner">
                          
                          {/* Table Header */}
                          <div className="flex items-center px-2 pb-1 border-b border-gray-900/10 dark:border-white/10 mb-1">
                            <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest flex-1">Stage</span>
                            <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest w-11 text-center flex-shrink-0">Pend</span>
                            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest w-11 text-center flex-shrink-0 ml-2">Comp</span>
                          </div>
                          
                          {/* Table Rows */}
                          {mData.steps.map((step: any, i: number) => {
                            const StepIcon = STEP_ICONS[i % STEP_ICONS.length];
                            const sColor = [
                              'text-blue-600 dark:text-blue-400',
                              'text-emerald-600 dark:text-emerald-400',
                              'text-purple-600 dark:text-purple-400',
                              'text-rose-600 dark:text-rose-400',
                              'text-amber-600 dark:text-amber-400',
                              'text-cyan-600 dark:text-cyan-400',
                              'text-indigo-600 dark:text-indigo-400'
                            ][i % 7];
                            
                            return (
                              <div key={i} className={`flex items-center ${module.rowBg} py-1 px-2 rounded-lg shadow-sm hover:shadow-md transition-all border group`}>
                                
                                {/* Icon + Text */}
                                <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                  <div className={`p-1.5 rounded-lg flex-shrink-0 bg-gray-50 dark:bg-navy-800 text-gray-400 group-hover:text-[#003875] dark:group-hover:text-[#FFD500] group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors`}>
                                    <StepIcon className={`w-4 h-4 ${sColor}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-[11px] font-bold ${sColor} leading-snug line-clamp-2 uppercase tracking-wide`} title={step.name}>{step.name}</p>
                                  </div>
                                </div>
                                
                                {/* Counts */}
                                <div className="flex-shrink-0 w-11 flex justify-center">
                                  <span className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 w-full py-1.5 rounded-lg text-xs font-black border border-amber-200/50 dark:border-amber-500/20 text-center shadow-sm">
                                    {step.pending}
                                  </span>
                                </div>
                                <div className="flex-shrink-0 w-11 flex justify-center ml-2">
                                  <span className="bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 w-full py-1.5 rounded-lg text-xs font-black border border-emerald-200/50 dark:border-emerald-500/20 text-center shadow-sm">
                                    {step.completed}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : null}
            </motion.div>
          )}

          {activeTab === "parties" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {!drillDownParty ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top 20 Parties */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
                      <h3 className="text-sm font-black text-emerald-600 uppercase tracking-tight flex items-center gap-2">
                        <ArrowUpCircleIcon className="w-5 h-5" /> Top 20 Performers
                      </h3>
                    </div>
                    <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.parties.top20.map((p: any, idx: number) => (
                        <button key={idx} onClick={() => setDrillDownParty(p)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors text-left group border border-transparent hover:border-emerald-200">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-300 group-hover:text-emerald-500 transition-colors">#{idx + 1}</span>
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase truncate max-w-[200px]">{p.party}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-emerald-600">{p.count} Orders</p>
                            <p className="text-[9px] font-bold text-gray-400">{(p.amount / 100000).toFixed(2)}L INR</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bottom 20 Parties */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
                      <h3 className="text-sm font-black text-rose-600 uppercase tracking-tight flex items-center gap-2">
                        <ArrowDownCircleIcon className="w-5 h-5" /> At Risk (Bottom 20)
                      </h3>
                    </div>
                    <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.parties.bottom20.map((p: any, idx: number) => (
                        <button key={idx} onClick={() => setDrillDownParty(p)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left group border border-transparent hover:border-rose-200">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-300 group-hover:text-rose-500 transition-colors">#{idx + 1}</span>
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase truncate max-w-[200px]">{p.party}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-rose-600">{p.count} Orders</p>
                            <p className="text-[9px] font-bold text-gray-400">{(p.amount / 1000).toFixed(1)}k INR</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                  <button onClick={() => setDrillDownParty(null)} className="flex items-center gap-2 text-[#003875] dark:text-[#FFD500] font-black uppercase text-[10px] mb-6 hover:translate-x-[-4px] transition-transform">
                    <ArrowLeftIcon className="w-4 h-4" /> Back to List
                  </button>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Stats & Charts */}
                    <div className="lg:col-span-4 space-y-3">
                      <div className="p-4 bg-[#FFD500] rounded-2xl text-[#003875] shadow-2xl ring-1 ring-black/5">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Party Analysis</h4>
                        <h2 className="text-xl font-black mt-1 leading-tight uppercase">{drillDownParty.party}</h2>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#003875]/10 pt-4">
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">Business</p><p className="text-lg font-black text-[#003875]">{(drillDownParty.amount / 100000).toFixed(2)}L</p></div>
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">Orders</p><p className="text-lg font-black text-[#003875]">{drillDownParty.count}</p></div>
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">OTD Success</p><p className="text-lg font-black text-emerald-600">{drillDownParty.otdRate}%</p></div>
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">Delayed</p><p className="text-lg font-black text-rose-600">{drillDownParty.delayedCount}</p></div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-white/5 p-3 rounded-2xl shadow-2xl ring-1 ring-black/5">
                        <h4 className="text-[9px] font-black uppercase mb-3 px-1">Category Mix (%)</h4>
                        <div className="h-[180px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={drillDownParty.categoryList.slice(0, 5)}
                                cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5}
                                dataKey="count" nameKey="category"
                                label={({ category, percent }: any) => `${category.slice(0, 8)} (${(percent * 100).toFixed(0)}%)`}
                                labelLine={false}
                              >
                                {drillDownParty.categoryList.slice(0, 5).map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-white/5 p-3 rounded-2xl shadow-2xl ring-1 ring-black/5">
                        <h4 className="text-[9px] font-black uppercase mb-3 px-1 text-rose-600 flex items-center gap-2"><SparklesIcon className="w-3 h-3" /> Pitch Opportunities</h4>
                        <div className="space-y-1">
                          {drillDownParty.untappedCategories.slice(0, 5).map((uc: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-100 dark:border-white/5">
                              <p className="text-[9px] font-black uppercase text-gray-900 dark:text-white truncate">{uc.category}</p>
                              <div className="text-right">
                                <p className="text-[7px] font-bold text-gray-400 uppercase">Avg Sale</p>
                                <p className="text-[8px] font-black text-rose-500">{(uc.marketAvg / 1000).toFixed(1)}k</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Trend Charts */}
                    <div className="lg:col-span-8 space-y-3">
                      <div className="bg-white dark:bg-white/5 p-4 rounded-3xl h-[350px] shadow-2xl ring-1 ring-black/5">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">Order & Revenue Velocity (Week Wise)</h4>
                          <div className="flex gap-3">
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#003875]" /><span className="text-[7px] font-black uppercase">Revenue</span></div>
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[7px] font-black uppercase">Orders</span></div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={drillDownParty.history} margin={{ top: 20, right: 30, left: 40, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                            <XAxis
                              dataKey="displayDate"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }}
                              dy={5}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis yAxisId="left" hide />
                            <YAxis yAxisId="right" orientation="right" hide />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                            <Line yAxisId="left" type="monotone" dataKey="amount" stroke={chartLineColor} strokeWidth={3} dot={{ r: 4, fill: chartLineColor }} activeDot={{ r: 6 }}>
                              <LabelList dataKey="amount" position="top" offset={10} formatter={(val: any) => `${(val / 100000).toFixed(1)}L`} style={{ fontSize: 12, fontWeight: 900, fill: chartLabelColor }} />
                            </Line>
                            <Line yAxisId="right" type="monotone" dataKey="count" stroke={revenueLineColor} strokeWidth={3} dot={{ r: 4, fill: revenueLineColor }} activeDot={{ r: 6 }}>
                              <LabelList dataKey="count" position="bottom" offset={10} style={{ fontSize: 12, fontWeight: 900, fill: revenueLineColor }} />
                            </Line>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-white dark:bg-white/5 p-4 rounded-3xl h-[250px] shadow-2xl ring-1 ring-black/5">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-4">OTD% Performance Trend</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={drillDownParty.history} margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} angle={-45} textAnchor="end" height={60} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                            <Line type="monotone" dataKey="otdRate" stroke={chartLineColor} strokeWidth={3} dot={{ r: 3, fill: chartLineColor }}>
                              <LabelList dataKey="otdRate" position="top" offset={10} style={{ fontSize: 12, fontWeight: 900, fill: chartLabelColor }} />
                            </Line>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-white dark:bg-navy-900/50 p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/5">
                        <h4 className="text-[10px] font-black uppercase mb-4 text-gray-400 tracking-widest">Active Category Performance</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="text-[9px] font-black uppercase text-gray-400 border-b border-gray-50 dark:border-white/5">
                              <tr><th className="py-3 px-2">Category</th><th className="py-3 px-2 text-right">Transactions</th><th className="py-3 px-2 text-right">Total Revenue</th><th className="py-3 px-2 text-right">Avg Order</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                              {drillDownParty.categoryList.map((c: any, i: number) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                  <td className="py-3 px-2 text-[10px] font-black text-gray-900 dark:text-white uppercase">{c.category}</td>
                                  <td className="py-3 px-2 text-[10px] font-black text-[#003875] dark:text-[#FFD500] text-right">{c.count}</td>
                                  <td className="py-3 px-2 text-[10px] font-black text-gray-900 dark:text-white text-right">{(c.amount / 1000).toFixed(1)}k</td>
                                  <td className="py-3 px-2 text-[10px] font-bold text-emerald-600 text-right">{(c.amount / (c.count || 1) / 1000).toFixed(1)}k</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "categories" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {!drillDownCategory ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top 20 Categories */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
                      <h3 className="text-sm font-black text-emerald-600 uppercase tracking-tight flex items-center gap-2">
                        <ArrowUpCircleIcon className="w-5 h-5" /> Top 20 Categories
                      </h3>
                    </div>
                    <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.categories.top20.map((c: any, idx: number) => (
                        <button key={idx} onClick={() => setDrillDownCategory(c)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors text-left group border border-transparent hover:border-emerald-200">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-300 group-hover:text-emerald-500 transition-colors">#{idx + 1}</span>
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase truncate">{c.category}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-emerald-600">{c.count} Items</p>
                            <p className="text-[9px] font-bold text-gray-400">{(c.amount / 100000).toFixed(2)}L INR</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bottom 20 Categories */}
                  <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
                      <h3 className="text-sm font-black text-rose-600 uppercase tracking-tight flex items-center gap-2">
                        <ArrowDownCircleIcon className="w-5 h-5" /> Bottom 20 Categories
                      </h3>
                    </div>
                    <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.categories.bottom20.map((c: any, idx: number) => (
                        <button key={idx} onClick={() => setDrillDownCategory(c)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left group border border-transparent hover:border-rose-200">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-300 group-hover:text-rose-500 transition-colors">#{idx + 1}</span>
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase truncate">{c.category}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-rose-600">{c.count} Items</p>
                            <p className="text-[9px] font-bold text-gray-400">{(c.amount / 1000).toFixed(1)}k INR</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-navy-800 p-4 lg:p-5 rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5">
                  <button onClick={() => setDrillDownCategory(null)} className="flex items-center gap-2 text-[#003875] dark:text-[#FFD500] font-black uppercase text-[10px] mb-6 hover:translate-x-[-4px] transition-transform">
                    <ArrowLeftIcon className="w-4 h-4" /> Back to List
                  </button>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Stats */}
                    <div className="lg:col-span-4 space-y-3">
                      <div className="p-4 bg-[#FFD500] rounded-2xl text-[#003875] shadow-2xl ring-1 ring-black/5">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Category Analysis</h4>
                        <h2 className="text-xl font-black mt-1 leading-tight uppercase">{drillDownCategory.category}</h2>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#003875]/10 pt-4">
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">Business</p><p className="text-lg font-black text-[#003875]">{(drillDownCategory.amount / 100000).toFixed(2)}L</p></div>
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">Quantity</p><p className="text-lg font-black text-[#003875]">{drillDownCategory.count}</p></div>
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">OTD Success</p><p className="text-lg font-black text-emerald-600">{drillDownCategory.otdRate}%</p></div>
                          <div><p className="text-[8px] font-bold opacity-60 uppercase">Delayed</p><p className="text-lg font-black text-rose-600">{drillDownCategory.delayedCount}</p></div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-white/5 p-4 rounded-2xl shadow-2xl ring-1 ring-black/5 h-[600px] flex flex-col">
                        <h4 className="text-[9px] font-black uppercase mb-4 text-gray-400">Item Performance (Top 30 / Bottom 30)</h4>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                          {/* Top 30 */}
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-emerald-500 uppercase mb-2 px-1">Top Selling Items</p>
                            {drillDownCategory.top30Items.map((item: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-navy-900 rounded-lg">
                                <p className="text-[9px] font-black uppercase text-gray-900 dark:text-white truncate max-w-[200px]">{item.name}</p>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-emerald-600">{item.count} qty</p>
                                  <p className="text-[8px] font-bold text-gray-400">{(item.amount / 1000).toFixed(1)}k</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Bottom 30 */}
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-rose-500 uppercase mb-2 px-1">Bottom Selling Items</p>
                            {drillDownCategory.bottom30Items.map((item: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-navy-900 rounded-lg">
                                <p className="text-[9px] font-black uppercase text-gray-900 dark:text-white truncate max-w-[200px]">{item.name}</p>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-rose-600">{item.count} qty</p>
                                  <p className="text-[8px] font-bold text-gray-400">{(item.amount / 1000).toFixed(1)}k</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Chart */}
                    <div className="lg:col-span-8 space-y-3">
                      <div className="bg-white dark:bg-white/5 p-4 rounded-[2rem] h-[300px] shadow-2xl ring-1 ring-black/5">
                        <div className="flex items-center justify-between mb-8">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">Monthly Segment Velocity (Qty vs Revenue)</h4>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#003875]" /><span className="text-[8px] font-black uppercase">Revenue</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] font-black uppercase">Quantity</span></div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={drillDownCategory.history} margin={{ top: 20, right: 30, left: 30, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} dy={10} angle={-45} textAnchor="end" height={60} />
                            <YAxis yAxisId="left" hide />
                            <YAxis yAxisId="right" orientation="right" hide />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                            <Line yAxisId="left" type="monotone" dataKey="amount" stroke={chartLineColor} strokeWidth={4} dot={{ r: 6, fill: chartLineColor }}>
                              <LabelList dataKey="amount" position="top" offset={15} formatter={(val: any) => `${(val / 1000).toFixed(1)}k`} style={{ fontSize: 12, fontWeight: 900, fill: chartLabelColor }} />
                            </Line>
                            <Line yAxisId="right" type="monotone" dataKey="count" stroke={revenueLineColor} strokeWidth={4} dot={{ r: 6, fill: revenueLineColor }}>
                              <LabelList dataKey="count" position="bottom" offset={15} style={{ fontSize: 12, fontWeight: 900, fill: revenueLineColor }} />
                            </Line>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-white dark:bg-white/5 p-4 rounded-[2rem] h-[250px] shadow-2xl ring-1 ring-black/5">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-4">OTD% Performance Trend</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={drillDownCategory.history} margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: chartTextColor }} angle={-45} textAnchor="end" height={60} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                            <Line type="monotone" dataKey="otdRate" stroke={revenueLineColor} strokeWidth={3} dot={{ r: 3, fill: revenueLineColor }}>
                              <LabelList dataKey="otdRate" position="top" offset={10} style={{ fontSize: 12, fontWeight: 900, fill: revenueLineColor }} />
                            </Line>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "forecast" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
              <CooReport data={cooData} loading={cooLoading} />
            </motion.div>
          )}

          {activeTab === "roadmap" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-navy-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl ring-1 ring-black/5 mt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-50 dark:border-white/5 pb-4">
                <div className="flex items-center gap-4">
                  <div><h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Execution Roadmap</h3><p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mt-0.5">Real-time Logistics Lifecycle</p></div>
                  <div className="h-10 w-px bg-gray-100 dark:bg-white/10 hidden md:block" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none">{targetDate === new Date().toISOString().split('T')[0] ? "Today's Orders" : "Filtered Orders"}</p>
                    <p className="text-xl font-black text-[#003875] dark:text-[#FFD500] leading-none mt-1">{data.todayCount || 0}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-navy-900 px-3 py-1.5 rounded-xl ring-1 ring-black/5">
                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                    <input
                      list="roadmap-orders"
                      type="text"
                      placeholder="FIND ANY ORDER..."
                      value={roadmapSearchQuery}
                      onChange={(e) => {
                        setRoadmapSearchQuery(e.target.value);
                        // Trigger API search for specific order if length > 2
                        if (e.target.value.length > 2) {
                          fetch(`/api/metrix?targetDate=${targetDate}&search=${e.target.value}`)
                            .then(res => res.json())
                            .then(newData => {
                              if (newData.roadmap && newData.roadmap.length > 0) {
                                const found = newData.roadmap[0];
                                setExtraRoadmapOrders((prev: any[]) => {
                                  if (prev.some(o => o.orderNo === found.orderNo)) return prev;
                                  return [found, ...prev];
                                });
                              }
                            });
                        }
                      }}
                      className="bg-transparent border-none text-[10px] font-black text-[#003875] dark:text-[#FFD500] outline-none w-[180px] placeholder:text-gray-300"
                    />
                    <datalist id="roadmap-orders">
                      {data.searchableOrders?.map((o: any) => (
                        <option key={o.orderNo} value={o.orderNo}>{o.party}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-navy-900 px-3 py-1.5 rounded-xl ring-1 ring-black/5">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" /><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-transparent border-none text-[9px] font-black text-[#003875] dark:text-[#FFD500] outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {[...extraRoadmapOrders, ...(data.roadmap || [])]
                  .filter((o, idx, self) => self.findIndex(t => t.orderNo === o.orderNo) === idx) // Unique
                  .filter(o =>
                    o.orderNo?.toString().toLowerCase().includes(roadmapSearchQuery.toLowerCase()) ||
                    o.party?.toLowerCase().includes(roadmapSearchQuery.toLowerCase())
                  )
                  .map((order: any, idx: number) => {
                    const orderColor = colors[idx % colors.length];
                    return (
                      <div key={idx} className="relative group border-b border-gray-50 dark:border-white/5 pb-4 last:border-0">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 rounded-[2rem] hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm ring-1 ring-black/5" style={{ borderLeft: `4px solid ${orderColor}` }}>

                          {/* Left Info & Items */}
                          <div className="lg:col-span-3 border-r border-gray-50 dark:border-white/5 pr-4">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md" style={{ backgroundColor: orderColor }}>{idx + 1}</div>
                              <div>
                                <h4 className="text-base font-black text-gray-900 dark:text-white uppercase">#{order.orderNo}</h4>
                                <p className="text-[11px] font-black text-gray-400 uppercase">{order.party}</p>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl border transition-colors bg-white dark:bg-white/10" style={{ borderColor: `${orderColor}20` }}>
                              <p className="text-[10px] font-black uppercase mb-3 tracking-widest" style={{ color: orderColor }}>Order Payload</p>
                              <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                                {order.items.map((it: any, iIdx: number) => (
                                  <div key={iIdx} className="flex justify-between items-center text-[11px] font-black text-gray-700 dark:text-gray-200">
                                    <span className="truncate max-w-[140px] uppercase">{it.name}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${orderColor}15`, color: orderColor }}>x{it.qty}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Right Roadmap Timeline */}
                          <div className="lg:col-span-9 flex flex-col justify-center min-h-[170px] overflow-x-auto custom-scrollbar pb-2">
                            <div className="relative flex items-center justify-between px-8 w-full min-w-[1000px]">
                              {/* Background Connector Line */}
                              <div className="absolute top-[45px] left-12 right-12 h-1 bg-gray-100 dark:bg-white/5 rounded-full" />

                              {/* Progressive Progress Line (Completed Steps) */}
                              <div
                                className="absolute top-[45px] left-12 h-1 rounded-full transition-all duration-1000"
                                style={{
                                  backgroundColor: orderColor,
                                  width: `${(order.steps.findIndex((s: any) => s.step === order.currentStep) / (order.steps.length - 1)) * 92}%`,
                                }}
                              />

                              {order.steps.map((step: any, sIdx: number) => {
                                const isCompleted = !!step.actual && step.status !== "No";
                                const isCurrent = order.currentStep === step.step;
                                const isPending = !isCompleted && !isCurrent;
                                const StepIcon = STEP_ICONS[sIdx];

                                return (
                                  <div key={sIdx} className="flex flex-col items-center relative z-10 min-w-[85px]">
                                    {/* Icon Stage Above */}
                                    <div className={`mb-4 transition-all duration-500 ${isCurrent ? 'scale-125' : isPending ? 'opacity-50' : 'opacity-100'}`}>
                                      <div className={`p-2.5 rounded-full ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-500/10' : isCurrent ? 'bg-white dark:bg-navy-900 shadow-xl ring-2' : 'bg-gray-50 dark:bg-white/5'}`} style={isCurrent ? { borderColor: orderColor } : {}}>
                                        <StepIcon className={`w-6 h-6 ${isCompleted ? 'text-emerald-500' : isCurrent ? '' : 'text-gray-400 dark:text-gray-500'}`} style={isCurrent ? { color: orderColor } : {}} />
                                      </div>
                                    </div>

                                    {/* Numbered Progress Circle */}
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-500 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : isCurrent ? 'text-white shadow-md' : 'bg-white dark:bg-navy-900 border-gray-200 text-gray-300'}`}
                                      style={isCurrent ? { backgroundColor: orderColor, borderColor: orderColor } : {}}
                                    >
                                      {sIdx + 1}
                                    </div>

                                    {/* Label & Time Below */}
                                    <div className="absolute -bottom-12 text-center w-28">
                                      <p className={`text-[9px] font-black uppercase leading-tight tracking-tighter ${isCompleted || isCurrent ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{step.name}</p>
                                      <p className={`text-[8px] font-bold mt-1 uppercase ${isCompleted ? 'text-emerald-500' : 'text-gray-400'}`}>{step.actual ? new Date(step.actual).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generic Drill Down Modal */}
        <DrillDownModal
          isOpen={drillDownModal.isOpen}
          onClose={() => setDrillDownModal(prev => ({ ...prev, isOpen: false }))}
          title={drillDownModal.title}
          columns={drillDownModal.columns}
          data={drillDownModal.data}
        />

        <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      </div>
    </div>
  );
}
