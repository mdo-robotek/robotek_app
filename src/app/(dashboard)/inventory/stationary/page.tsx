"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  TruckIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  ChartPieIcon,
  EyeIcon,
  ArrowLeftIcon
} from "@heroicons/react/24/outline";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend, LabelList, AreaChart, Area, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { StationaryItem, StationaryLog } from "@/types/stationary";

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Move FloatingInput outside the main component to prevent focus loss on re-render
const FloatingInput = ({
  label, value, onChange, type = "text", step, disabled, name, list
}: { label: string, value: any, onChange: (val: string) => void, type?: string, step?: string, disabled?: boolean, name?: string, list?: string }) => (
  <div className="relative z-0 w-full group">
    <input
      type={type}
      step={step}
      name={name}
      id={name}
      list={list}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block px-3 pb-2.5 pt-4 w-full text-sm font-bold text-gray-900 bg-transparent rounded-lg border-2 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-[#60A5FA] focus:outline-none focus:ring-0 focus:border-[#2563EB] peer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/5"
      placeholder=" "
    />
    <label htmlFor={name} className="absolute text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-[#111827] px-2 peer-focus:px-2 peer-focus:text-[#2563EB] peer-focus:dark:text-[#2563EB] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">{label}</label>
  </div>
);

export default function StationaryInventoryPage() {
  const { data: session } = useSession();
  const currentUser = (session?.user as any)?.username || session?.user?.name || session?.user?.email || "System";

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusType, setStatusType] = useState<'loading' | 'success' | 'error'>('loading');

  const showStatus = (msg: string, type: 'loading' | 'success' | 'error' = 'loading') => {
    setStatusMessage(msg);
    setStatusType(type);
    setIsStatusModalOpen(true);
  };

  const [activeTab, setActiveTab] = useState("master");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "IN_TRANSIT" | "LOW_STOCK">("ALL");
  const [legendFilter, setLegendFilter] = useState<number | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [detailsFilter, setDetailsFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const { resolvedTheme } = useTheme();

  // Modals state
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StationaryItem | null>(null);
  const [viewingSku, setViewingSku] = useState<string | null>(null); // Details View State

  const [isStockModalOpen, setStockModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [stockType, setStockType] = useState<"IN" | "OUT">("IN");
  const [selectedSku, setSelectedSku] = useState<string>("");

  // Form states
  const [itemForm, setItemForm] = useState<Partial<StationaryItem>>({});
  const [stockForm, setStockForm] = useState({ quantity: 1, remarks: "" });
  const [bulkStockForm, setBulkStockForm] = useState<{ [sku: string]: { quantity: number, remarks: string } }>({});

  const { data: masterData, mutate: mutateMaster, isLoading: masterLoading } = useSWR("/api/inventory/stationary", fetcher);
  const { data: logData, mutate: mutateLogs, isLoading: logsLoading } = useSWR("/api/inventory/stationary?action=logs", fetcher);

  const rawItems: StationaryItem[] = masterData?.items || [];
  const logs: StationaryLog[] = logData?.logs || [];

  // Dynamically calculate Avg Daily Consumption and Max Level
  const items = useMemo(() => {
    return rawItems.map(item => {
      const itemLogs = logs.filter(l => l.sku_code === item.sku_code && l.transaction_type === 'OUT');
      let calcDaily = 0.1;

      if (itemLogs.length > 0) {
        const totalOut = itemLogs.reduce((sum, l) => sum + (l.quantity || 0), 0);
        const dates = itemLogs.map(l => new Date(l.timestamp).getTime());
        const minDate = Math.min(...dates);
        const maxDate = new Date().getTime(); // current time

        const daysDiff = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
        calcDaily = Number((totalOut / daysDiff).toFixed(2));
      }

      if (calcDaily <= 0) calcDaily = 0.1;

      const maxLevel = calcDaily * (item.lead_time || 0) * (item.safety_factor || 0);

      return {
        ...item,
        avg_daily_consumption: calcDaily,
        max_level: Number(maxLevel.toFixed(1))
      };
    });
  }, [rawItems, logs]);

  const getLegendBucket = (total: number, max: number) => {
    if (total < 0) return 6;
    if (total === 0) return 5;
    if (max === 0) return total > 0 ? 1 : 5;
    const pct = (total / max) * 100;
    if (pct > 100) return 1;
    if (pct <= 100 && pct > 66) return 2;
    if (pct <= 66 && pct > 33) return 3;
    if (pct <= 33 && pct > 0) return 4;
    return 5;
  };

  const bucketCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    items.forEach(item => {
      counts[getLegendBucket(item.total_available, item.max_level) as keyof typeof counts]++;
    });
    return counts;
  }, [items]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items.filter(item =>
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filterType === "IN_TRANSIT") {
      result = result.filter(item => item.material_in_transit > 0);
    } else if (filterType === "LOW_STOCK") {
      result = result.filter(item => getLegendBucket(item.total_available, item.max_level) >= 4);
    }

    if (legendFilter !== null) {
      result = result.filter(item => getLegendBucket(item.total_available, item.max_level) === legendFilter);
    }

    return result;
  }, [items, searchQuery, filterType, legendFilter]);

  const filteredLogs = useMemo(() => {
    let result = logs.slice().reverse();
    if (ledgerFilter !== "ALL") {
      result = result.filter(log => log.transaction_type === ledgerFilter);
    }
    return result;
  }, [logs, ledgerFilter]);

  // KPIs
  const totalSkus = items.length;
  const totalStock = items.reduce((acc, curr) => acc + (curr.total_available || 0), 0);
  const totalInTransit = items.reduce((acc, curr) => acc + (curr.material_in_transit || 0), 0);
  const lowStockCount = items.filter(item => getLegendBucket(item.total_available, item.max_level) >= 4).length;

  const getHealth = (total: number, max: number) => {
    const bucket = getLegendBucket(total, max);
    if (bucket === 6) return { color: "bg-gray-400", text: "text-gray-500", label: "Negative", pct: 0 };
    if (bucket === 5) return { color: "bg-black dark:bg-gray-700", text: "text-gray-900 dark:text-gray-400", label: "Stockout", pct: 0 };

    const percentage = max > 0 ? (total / max) * 100 : 100;
    if (bucket === 1) return { color: "bg-purple-500", text: "text-purple-600", label: "Overstock", pct: Math.min(percentage, 100) };
    if (bucket === 2) return { color: "bg-emerald-500", text: "text-emerald-600", label: "Healthy", pct: percentage };
    if (bucket === 3) return { color: "bg-amber-400", text: "text-amber-600", label: "Warning", pct: percentage };
    if (bucket === 4) return { color: "bg-rose-500", text: "text-rose-600", label: "Critical", pct: percentage };

    return { color: "bg-gray-200", text: "text-gray-500", label: "Unknown", pct: 0 };
  };

  const handleSaveItem = async () => {
    setSubmitting(true);
    showStatus(editingItem ? "Updating Item Record..." : "Creating New SKU...", "loading");
    const isEdit = !!editingItem;
    const method = isEdit ? "PUT" : "POST";
    const payload = isEdit
      ? { sku_code: itemForm.sku_code, data: itemForm }
      : { action: "create_item", data: itemForm };

    try {
      const res = await fetch("/api/inventory/stationary", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        mutateMaster();
        setItemModalOpen(false);
        setItemForm({});
        setEditingItem(null);
        showStatus("Record Saved Successfully!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to save");
      }
    } catch (e) {
      showStatus("Error saving item record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (sku_code: string) => {
    setPendingDeleteId(sku_code);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    setSubmitting(true);
    showStatus(`Deleting ${pendingDeleteId}...`, "loading");
    try {
      const res = await fetch("/api/inventory/stationary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_code: pendingDeleteId })
      });
      if (res.ok) {
        mutateMaster();
        showStatus("SKU Deleted Successfully!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to delete");
      }
    } catch (e) {
       showStatus("Error deleting item.", "error");
    } finally {
       setSubmitting(false);
       setPendingDeleteId(null);
    }
  };

  const openStockModal = (type: "IN" | "OUT") => {
    setStockType(type);
    if (selectedSkus.length > 0) {
      const initialForm: any = {};
      selectedSkus.forEach(sku => initialForm[sku] = { quantity: 1, remarks: "" });
      setBulkStockForm(initialForm);
    } else {
      setBulkStockForm({});
      setSelectedSku("");
      setStockForm({ quantity: 1, remarks: "" });
    }
    setStockModalOpen(true);
  };

  const handleStockTransaction = async () => {
    setSubmitting(true);
    showStatus(`Processing Stock ${stockType}...`, "loading");
    let payloads = [];

    if (selectedSkus.length > 0) {
      payloads = selectedSkus.map(sku => {
        const item = items.find(i => i.sku_code === sku);
        return {
          action: "stock_transaction",
          data: {
            sku_code: sku,
            item_name: item?.item_name,
            transaction_type: stockType,
            quantity: bulkStockForm[sku]?.quantity || 1,
            remarks: bulkStockForm[sku]?.remarks || "",
            user: currentUser
          }
        };
      });
    } else {
      const item = items.find(i => i.sku_code === selectedSku);
      if (!item) {
        showStatus("Select an item first", "error");
        setSubmitting(false);
        return;
      }
      payloads = [{
        action: "stock_transaction",
        data: {
          sku_code: selectedSku,
          item_name: item.item_name,
          transaction_type: stockType,
          quantity: stockForm.quantity,
          remarks: stockForm.remarks,
          user: currentUser
        }
      }];
    }

    try {
      let successCount = 0;
      for (const payload of payloads) {
        const res = await fetch("/api/inventory/stationary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) successCount++;
      }

      if (successCount === payloads.length) {
        mutateMaster();
        mutateLogs();
        setStockModalOpen(false);
        setSelectedSkus([]);
        showStatus(`Transaction Completed (${successCount} items)`, "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        showStatus(`Warning: Only completed ${successCount} out of ${payloads.length} transactions.`, "error");
        mutateMaster();
        mutateLogs();
      }
    } catch(e) {
        showStatus("An error occurred during transaction processing.", "error");
    } finally {
        setSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSkus.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSkus([]);
    } else {
      setSelectedSkus(filteredItems.map(i => i.sku_code));
    }
  };

  const toggleSelectSku = (sku: string) => {
    if (selectedSkus.includes(sku)) {
      setSelectedSkus(selectedSkus.filter(s => s !== sku));
    } else {
      setSelectedSkus([...selectedSkus, sku]);
    }
  };

  const handleNewSkuClick = () => {
    setEditingItem(null);
    const maxSkuNum = items.reduce((max, item) => {
      if (item.sku_code && item.sku_code.toUpperCase().startsWith("SKU-")) {
        const num = parseInt(item.sku_code.replace(/[^0-9]/g, ""), 10);
        return !isNaN(num) && num > max ? num : max;
      }
      return max;
    }, 0);
    const nextSku = `SKU-${String(maxSkuNum + 1).padStart(3, '0')}`;

    setItemForm({ sku_code: nextSku });
    setItemModalOpen(true);
  };

  // Dashboard Data Prep
  const healthPieData = [
    { name: 'Overstock', value: bucketCounts[1], color: '#8b5cf6' },
    { name: 'Healthy', value: bucketCounts[2], color: '#10b981' },
    { name: 'Warning', value: bucketCounts[3], color: '#fbbf24' },
    { name: 'Critical', value: bucketCounts[4], color: '#f43f5e' },
    { name: 'Stockout', value: bucketCounts[5] + bucketCounts[6], color: '#111827' },
  ].filter(d => d.value > 0);

  const topConsumedData = useMemo(() => items
    .filter(i => i.avg_daily_consumption > 0)
    .sort((a, b) => b.avg_daily_consumption - a.avg_daily_consumption)
    .slice(0, 10)
    .map(i => ({
      name: i.item_name,
      consumption: i.avg_daily_consumption,
      sku: i.sku_code
    })), [items]);

  const lowestStockData = useMemo(() => items
    .filter(i => getLegendBucket(i.total_available, i.max_level) >= 4) // Only critical/stockout
    .sort((a, b) => a.total_available - b.total_available)
    .slice(0, 10)
    .map(i => ({
      name: i.item_name,
      stock: i.total_available,
      max: i.max_level,
      sku: i.sku_code
    })), [items]);

  const categoryRadarData = useMemo(() => {
    const catMap: Record<string, number> = {};
    items.forEach(i => {
      if (!i.category) return;
      catMap[i.category] = (catMap[i.category] || 0) + i.total_available;
    });
    return Object.entries(catMap).map(([cat, vol]) => ({ subject: cat, A: vol, fullMark: 1000 })).slice(0, 6);
  }, [items]);

  const deadStockItems = useMemo(() => {
    const activeSkus = new Set(logs.map(l => l.sku_code));
    return items.filter(i => !activeSkus.has(i.sku_code));
  }, [items, logs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex flex-col h-[calc(100vh-4rem)] p-2 gap-2">
      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={statusType}
        message={statusMessage}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {/* Top Header & Actions Row */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl p-3 shadow-sm gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2563EB] dark:bg-[#60A5FA] rounded-lg shadow-inner">
            <ClipboardDocumentListIcon className="w-5 h-5 text-white dark:text-[#60A5FA]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-none">Stationary Inventory</h1>
            <p className="text-[#5B6472] font-bold text-[13px] mt-1">ERP Master Module</p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          <div className="flex items-center bg-gray-100 dark:bg-[#0a0f1c] p-1 rounded-lg border border-gray-200 dark:border-white/5 gap-1">
            <button
              onClick={() => { setActiveTab("master"); setViewingSku(null); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-semibold   transition-all ${activeTab === "master" ? "bg-gradient-to-r from-[#2563EB] to-blue-600 dark:from-[#60A5FA] dark:to-yellow-500 text-white dark:text-[#60A5FA] shadow-md" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"}`}
            >
              <ClipboardDocumentListIcon className="w-4 h-4" /> Master View
            </button>
            <button
              onClick={() => { setActiveTab("logs"); setViewingSku(null); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-semibold   transition-all ${activeTab === "logs" ? "bg-gradient-to-r from-[#2563EB] to-blue-600 dark:from-[#60A5FA] dark:to-yellow-500 text-white dark:text-[#60A5FA] shadow-md" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"}`}
            >
              <DocumentTextIcon className="w-4 h-4" /> Ledger Logs
            </button>
            <button
              onClick={() => { setActiveTab("dashboard"); setViewingSku(null); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-semibold   transition-all ${activeTab === "dashboard" ? "bg-gradient-to-r from-[#2563EB] to-blue-600 dark:from-[#60A5FA] dark:to-yellow-500 text-white dark:text-[#60A5FA] shadow-md" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"}`}
            >
              <ChartPieIcon className="w-4 h-4" /> Dashboard
            </button>
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1"></div>

          <button onClick={() => openStockModal("IN")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-semibold  tracking-wider transition-all border ${selectedSkus.length > 0 ? "bg-emerald-500 text-white shadow-md border-emerald-600 animate-pulse" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border-emerald-500/20"}`}>
            <ArrowDownTrayIcon className="w-4 h-4" /> Stock In {selectedSkus.length > 0 && `(${selectedSkus.length})`}
          </button>
          <button onClick={() => openStockModal("OUT")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-semibold  tracking-wider transition-all border ${selectedSkus.length > 0 ? "bg-rose-500 text-white shadow-md border-rose-600 animate-pulse" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white border-rose-500/20"}`}>
            <ArrowUpTrayIcon className="w-4 h-4" /> Stock Out {selectedSkus.length > 0 && `(${selectedSkus.length})`}
          </button>
          <button onClick={handleNewSkuClick} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-[#60A5FA] hover:brightness-110 rounded-lg text-[14px] font-semibold tracking-wider transition-all shadow-sm">
            <PlusIcon className="w-4 h-4" /> New SKU
          </button>
        </div>
      </div>

      {/* Conditional Content Wrapper */}
      {activeTab === "dashboard" ? (
        <div className="flex-1 overflow-auto custom-scrollbar p-2 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">

          {/* Main KPI Overview Cards (Narrow height & Gradients) */}
          <div className="lg:col-span-12 grid grid-cols-4 gap-3 shrink-0">
            <div className="bg-gradient-to-br from-[#2563EB] to-blue-800 text-white border-transparent rounded-xl p-3 flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="z-10 relative">
                <p className="text-[13px] font-semibold text-white/70 mb-0.5">Total SKUs Tracked</p>
                <h2 className="text-2xl font-semibold leading-none">{totalSkus}</h2>
              </div>
              <ArchiveBoxIcon className="w-12 h-12 absolute -right-2 -bottom-2 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-transparent rounded-xl p-3 flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="z-10 relative">
                <p className="text-[13px] font-semibold text-white/70 mb-0.5">Overall Stock Volume</p>
                <h2 className="text-2xl font-semibold leading-none">{totalStock}</h2>
              </div>
              <ClipboardDocumentListIcon className="w-12 h-12 absolute -right-2 -bottom-2 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-red-700 text-white border-transparent rounded-xl p-3 flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="z-10 relative">
                <p className="text-[13px] font-semibold text-white/70 mb-0.5">Items at Critical Risk</p>
                <h2 className="text-2xl font-semibold leading-none">{lowStockCount}</h2>
              </div>
              <ExclamationTriangleIcon className="w-12 h-12 absolute -right-2 -bottom-2 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            </div>
            <div className="bg-gradient-to-br from-gray-700 to-gray-900 text-white border-transparent rounded-xl p-3 flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="z-10 relative">
                <p className="text-[13px] font-semibold text-white/70 mb-0.5">Dead Stock Items</p>
                <h2 className="text-2xl font-semibold leading-none">{deadStockItems.length}</h2>
              </div>
              <ChartPieIcon className="w-12 h-12 absolute -right-2 -bottom-2 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            </div>
          </div>

          {/* Deep Analysis Row 1 */}
          <div className="lg:col-span-8 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm p-4 flex flex-col min-h-[300px]">
            <h3 className="text-[14px] font-semibold text-gray-500 mb-2">Bottom Live Stock Items (Critical Zones)</h3>
            <div className="flex-1 w-full h-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lowestStockData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} width={120} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} />
                  <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="stock" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="stock" position="right" fill={resolvedTheme === 'dark' ? '#fff' : '#000'} fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm p-4 flex flex-col min-h-[300px]">
            <h3 className="text-[14px] font-semibold text-gray-500 mb-0">Stock Health Distribution</h3>
            <div className="flex-1 w-full h-full relative flex items-center justify-center min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {healthPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }} itemStyle={{ color: resolvedTheme === 'dark' ? '#fff' : '#000' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deep Analysis Row 2 */}
          <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm p-4 flex flex-col min-h-[300px]">
            <h3 className="text-[14px] font-semibold text-gray-500 mb-0">Category Volume Dispersion</h3>
            <div className="flex-1 w-full h-full relative flex items-center justify-center -ml-4 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={categoryRadarData}>
                  <PolarGrid stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#9ca3af' }} />
                  <Radar name="Volume" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <RechartsTooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm p-4 flex flex-col min-h-[300px]">
            <h3 className="text-[14px] font-semibold text-gray-500 mb-2">Highest Daily Consumption Area Trend</h3>
            <div className="flex-1 w-full h-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={topConsumedData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={resolvedTheme === 'dark' ? '#2563EB' : '#2563EB'} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={resolvedTheme === 'dark' ? '#2563EB' : '#2563EB'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} tickFormatter={(val) => val.length > 8 ? val.substring(0, 8) + '..' : val} />
                  <YAxis tick={{ fontSize: 9, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="consumption" stroke={resolvedTheme === 'dark' ? '#2563EB' : '#2563EB'} strokeWidth={3} fillOpacity={1} fill="url(#colorCons)">
                    <LabelList dataKey="consumption" position="top" fill={resolvedTheme === 'dark' ? '#fff' : '#000'} fontSize={10} fontWeight="bold" />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      ) : (
        <>
          {/* Filters & Search Row */}
          {activeTab === "master" && !viewingSku && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Color Logic Filter */}
              <div className="flex items-center gap-2 overflow-x-auto bg-white dark:bg-[#111827] p-2 rounded-xl border border-gray-200 dark:border-white/5 flex-1 min-w-0">
                <div className="flex items-center gap-1 px-2 shrink-0">
                  <InformationCircleIcon className="w-4 h-4 text-[#5B6472]" />
                  <span className="text-[13px] font-semibold text-gray-500 mr-2">Color Logic:</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[13px] font-semibold text-white text-center cursor-pointer">
                  <div onClick={() => setLegendFilter(legendFilter === 1 ? null : 1)} className={`px-4 py-1 rounded min-w-[80px] transition-transform hover:scale-105 ${legendFilter === 1 ? 'ring-2 ring-purple-600 ring-offset-1 bg-purple-600 shadow-md' : 'bg-purple-500'}`}> {'>'} 100% <sup className="font-bold opacity-80">{bucketCounts[1]}</sup></div>
                  <div onClick={() => setLegendFilter(legendFilter === 2 ? null : 2)} className={`px-4 py-1 rounded min-w-[120px] transition-transform hover:scale-105 ${legendFilter === 2 ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-500 shadow-md' : 'bg-emerald-400'}`}> {'<='} 100% AND {'>'} 66% <sup className="font-bold opacity-80">{bucketCounts[2]}</sup></div>
                  <div onClick={() => setLegendFilter(legendFilter === 3 ? null : 3)} className={`text-black px-4 py-1 rounded min-w-[120px] transition-transform hover:scale-105 ${legendFilter === 3 ? 'ring-2 ring-amber-400 ring-offset-1 bg-amber-400 shadow-md' : 'bg-amber-300'}`}> {'<='} 66% AND {'>'} 33% <sup className="font-bold opacity-80">{bucketCounts[3]}</sup></div>
                  <div onClick={() => setLegendFilter(legendFilter === 4 ? null : 4)} className={`px-4 py-1 rounded min-w-[120px] transition-transform hover:scale-105 ${legendFilter === 4 ? 'ring-2 ring-rose-500 ring-offset-1 bg-rose-500 shadow-md' : 'bg-rose-400'}`}> {'<='} 33% AND {'>'} 0% <sup className="font-bold opacity-80">{bucketCounts[4]}</sup></div>
                  <div onClick={() => setLegendFilter(legendFilter === 5 ? null : 5)} className={`px-4 py-1 rounded min-w-[80px] transition-transform hover:scale-105 ${legendFilter === 5 ? 'ring-2 ring-black dark:ring-gray-700 ring-offset-1 bg-black dark:bg-gray-800 shadow-md' : 'bg-gray-800 dark:bg-gray-700'}`}> 0.0 <sup className="font-bold opacity-80">{bucketCounts[5]}</sup></div>
                  <div onClick={() => setLegendFilter(legendFilter === 6 ? null : 6)} className={`px-4 py-1 rounded min-w-[80px] transition-transform hover:scale-105 ${legendFilter === 6 ? 'ring-2 ring-gray-400 ring-offset-1 bg-gray-400 shadow-md' : 'bg-gray-300'}`}> {'<'} 0 <sup className="font-bold opacity-80">{bucketCounts[6]}</sup></div>
                </div>
                {legendFilter !== null && (
                  <button onClick={() => setLegendFilter(null)} className="ml-2 px-2 py-1 bg-gray-100 dark:bg-white/10 text-gray-500 rounded text-[13px] font-semibold hover:bg-gray-200">Clear</button>
                )}
              </div>

              {/* Search Bar MOVED HERE */}
              <div className="relative shrink-0">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
                <input
                  type="text"
                  placeholder="SEARCH SKU / ITEM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2.5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 rounded-xl text-[14px] font-semibold tracking-wider outline-none focus:ring-2 focus:ring-[#2563EB] dark:text-white w-64 transition-all shadow-sm h-full"
                />
              </div>
            </div>
          )}

          {/* Ledger Filter Row - Logs Only */}
          {activeTab === "logs" && (
            <div className="flex items-center gap-2 overflow-x-auto shrink-0 bg-white dark:bg-[#111827] p-2 rounded-xl border border-gray-200 dark:border-white/5">
              <div className="flex items-center gap-1 px-2 shrink-0">
                <MagnifyingGlassIcon className="w-4 h-4 text-[#5B6472]" />
                <span className="text-[13px] font-semibold text-gray-500 mr-2">Filter Ledger:</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLedgerFilter("ALL")} className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${ledgerFilter === "ALL" ? "bg-gray-800 text-white shadow-md dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"}`}>All Transactions</button>
                <button onClick={() => setLedgerFilter("IN")} className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${ledgerFilter === "IN" ? "bg-emerald-500 text-white shadow-md" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"}`}><ArrowDownTrayIcon className="w-3 h-3" /> Stock In Only</button>
                <button onClick={() => setLedgerFilter("OUT")} className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${ledgerFilter === "OUT" ? "bg-rose-500 text-white shadow-md" : "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"}`}><ArrowUpTrayIcon className="w-3 h-3" /> Stock Out Only</button>
              </div>
            </div>
          )}

          {/* KPI Row (Gradient & Watermarks) - Master Only */}
          {activeTab === "master" && !viewingSku && (
            <div className="grid grid-cols-4 gap-2 shrink-0">
              <div
                onClick={() => setFilterType("ALL")}
                className={`relative overflow-hidden bg-gradient-to-br from-[#2563EB] to-blue-800 dark:from-blue-900 dark:to-blue-950 text-white border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${filterType === "ALL" ? "ring-2 ring-blue-500 shadow-lg" : "border-transparent shadow-sm"}`}
              >
                <div className="z-10 relative">
                  <p className="text-[13px] font-semibold text-white/70">Total SKUs</p>
                  <p className="text-2xl font-semibold leading-none mt-1">{totalSkus}</p>
                </div>
                <ArchiveBoxIcon className="w-16 h-16 absolute -right-2 -bottom-2 text-white/10 rotate-12 transition-transform group-hover:rotate-0" />
              </div>

              <div
                onClick={() => setFilterType("ALL")}
                className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-700 dark:to-emerald-900 text-white border border-transparent rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] shadow-sm"
              >
                <div className="z-10 relative">
                  <p className="text-[13px] font-semibold text-white/70">Total Items in Stock</p>
                  <p className="text-2xl font-semibold leading-none mt-1">{totalStock}</p>
                </div>
                <ClipboardDocumentListIcon className="w-16 h-16 absolute -right-2 -bottom-2 text-white/10 rotate-12" />
              </div>

              <div
                onClick={() => setFilterType("IN_TRANSIT")}
                className={`relative overflow-hidden bg-[#2563EB]  text-white border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${filterType === "IN_TRANSIT" ? "ring-2 ring-amber-500 shadow-lg" : "border-transparent shadow-sm"}`}
              >
                <div className="z-10 relative">
                  <p className="text-[13px] font-semibold text-white/80">Items in Transit</p>
                  <p className="text-2xl font-semibold leading-none mt-1">{totalInTransit}</p>
                </div>
                <TruckIcon className="w-16 h-16 absolute -right-2 -bottom-2 text-white/20 rotate-12" />
              </div>

              <div
                onClick={() => setFilterType("LOW_STOCK")}
                className={`relative overflow-hidden bg-gradient-to-br from-rose-500 to-red-700 dark:from-rose-700 dark:to-red-900 text-white border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${filterType === "LOW_STOCK" ? "ring-2 ring-rose-500 shadow-lg" : "border-transparent shadow-sm"}`}
              >
                <div className="z-10 relative">
                  <p className="text-[13px] font-semibold text-white/80">Critical / Stockout</p>
                  <p className="text-2xl font-semibold leading-none mt-1">{lowStockCount}</p>
                </div>
                <ExclamationTriangleIcon className="w-16 h-16 absolute -right-2 -bottom-2 text-white/20 rotate-12" />
              </div>
            </div>
          )}

          {/* Main Data Area (Fills remaining height) */}
          <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0">

            {activeTab === "master" && !viewingSku && (
              <div className="flex-1 overflow-auto custom-scrollbar relative">
                {masterLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <div key={i} className="animate-pulse flex items-center gap-4">
                        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 flex-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse relative">
                    <thead className="bg-gray-100 dark:bg-[#1f2937] sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="py-2.5 px-3 border-b border-gray-200 dark:border-white/10 text-center sticky left-0 bg-gray-100 dark:bg-[#1f2937] z-30 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] w-28">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                              checked={selectedSkus.length === filteredItems.length && filteredItems.length > 0}
                              onChange={toggleSelectAll}
                            />
                            <span className="text-[13px] font-semibold text-gray-500">Acts</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 whitespace-nowrap">SKU Code</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 whitespace-nowrap">Category</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 whitespace-nowrap">Item Name</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right">MOQ</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right">Daily Cons.</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right">In Transit</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10">Seller</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right" title="Lead Time (I2R)">L.T.</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right" title="Safety Factor">S.F.</th>
                        <th className="py-2.5 px-3 text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] border-b border-gray-200 dark:border-white/10 text-right bg-blue-50/50 dark:bg-yellow-500/5">Max Lvl</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10 text-left bg-gray-50 dark:bg-white/5 w-56">Stock Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredItems.map((item, idx) => {
                        const health = getHealth(item.total_available, item.max_level);
                        const isSelected = selectedSkus.includes(item.sku_code);
                        return (
                          <tr
                            key={idx}
                            onClick={() => toggleSelectSku(item.sku_code)}
                            className={`transition-colors group cursor-pointer ${isSelected ? "bg-blue-50/50 dark:bg-blue-900/20" : "hover:bg-blue-50/30 dark:hover:bg-white/[0.03] even:bg-gray-50/50 dark:even:bg-[#1f2937]/30"}`}
                          >
                            <td className={`py-1 px-2 text-center sticky left-0 z-20 transition-colors border-r shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] ${isSelected ? "bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-500/30" : "bg-white group-even:bg-gray-50/50 dark:bg-[#111827] dark:group-even:bg-[#182031] group-hover:bg-blue-50/30 dark:group-hover:bg-[#1a2335] border-gray-100 dark:border-white/5"}`}>
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => { e.stopPropagation(); toggleSelectSku(item.sku_code); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer mr-1"
                                />
                                <button onClick={(e) => { e.stopPropagation(); setViewingSku(item.sku_code); }} className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform" title="View Details">
                                  <EyeIcon className="w-4 h-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setItemForm(item); setItemModalOpen(true); }} className="text-[#2563EB] dark:text-[#60A5FA] hover:scale-110 transition-transform" title="Edit">
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); confirmDelete(item.sku_code); }} className="text-rose-500 hover:scale-110 transition-transform" title="Delete">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">{item.sku_code}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-500 whitespace-nowrap">{item.category}</td>
                            <td className="py-2 px-3 text-[14px] font-semibold text-gray-900 dark:text-white truncate max-w-[200px]" title={item.item_name}>{item.item_name}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.moq}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.avg_daily_consumption}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.material_in_transit}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-500 truncate max-w-[120px]" title={item.from_seller}>{item.from_seller}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.lead_time}</td>
                            <td className="py-2 px-3 text-[14px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.safety_factor}</td>
                            <td className="py-2 px-3 text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] text-right bg-blue-50/30 dark:bg-yellow-500/5">{item.max_level?.toFixed(1) || 0}</td>

                            {/* Compact Stock Health Bar Component */}
                            <td className="py-1 px-4 bg-gray-50/50 dark:bg-white/[0.02]">
                              <div className="flex flex-col gap-1 w-full max-w-[180px]">
                                <div className="flex justify-between items-baseline leading-none">
                                  <span className={`text-[14px] font-semibold ${health.text}`}>{item.total_available}</span>
                                  <span className="text-[13px] font-bold text-[#5B6472]">{health.label}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden flex">
                                  <div className={`h-full ${health.color} transition-all duration-500`} style={{ width: `${health.pct}%` }}></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={12} className="py-8 text-center text-[#5B6472] text-[14px] font-semibold">No inventory records found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Item Details View Inner Component */}
            {activeTab === "master" && viewingSku && (
              <div className="flex-1 flex flex-col relative bg-gray-50 dark:bg-[#0a0f1c] min-h-0">
                {(() => {
                  const item = items.find(i => i.sku_code === viewingSku);
                  if (!item) return <div>Item not found</div>;
                  const itemLogs = logs.filter(l => l.sku_code === viewingSku).slice().reverse();
                  const health = getHealth(item.total_available, item.max_level);

                  const totalIn = itemLogs.filter(l => l.transaction_type === 'IN').reduce((sum, l) => sum + (l.quantity || 0), 0);
                  const totalOut = itemLogs.filter(l => l.transaction_type === 'OUT').reduce((sum, l) => sum + (l.quantity || 0), 0);
                  
                  const filteredItemLogs = detailsFilter === "ALL" ? itemLogs : itemLogs.filter(l => l.transaction_type === detailsFilter);

                  return (
                    <>
                      <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#111827] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                          <button onClick={() => setViewingSku(null)} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors">
                            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          </button>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-none">{item.item_name}</h2>
                              <span className="px-2 py-0.5 bg-[#2563EB]/10 text-white dark:bg-[#60A5FA]/20 dark:text-[#60A5FA] border border-[#2563EB]/20 dark:border-[#60A5FA]/30 rounded text-[13px] font-semibold">{item.sku_code}</span>
                            </div>
                            <p className="text-[13px] font-bold text-gray-500">{item.category} • Supplier: {item.from_seller || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8 text-right">
                          <div className="text-center">
                            <p className="text-[13px] font-semibold text-gray-500 mb-1">Total IN</p>
                            <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{totalIn}</span>
                          </div>
                          <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                          <div className="text-center">
                            <p className="text-[13px] font-semibold text-gray-500 mb-1">Total OUT</p>
                            <span className="text-xl font-semibold text-rose-600 dark:text-rose-400">{totalOut}</span>
                          </div>
                          <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                          <div className="text-right">
                            <p className="text-[13px] font-semibold text-gray-500 mb-1">Current Stock / Max</p>
                            <div className="flex items-end justify-end gap-2">
                              <span className={`text-2xl font-semibold leading-none ${health.text}`}>{item.total_available}</span>
                              <span className="text-sm font-bold text-[#5B6472] mb-0.5">/ {item.max_level?.toFixed(1) || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-100 dark:bg-[#1f2937] border-b border-gray-200 dark:border-white/5 flex items-center justify-between shrink-0">
                        <h3 className="text-[14px] font-semibold text-gray-600 dark:text-gray-300 ml-1">Transaction History ({filteredItemLogs.length})</h3>
                        <div className="flex gap-2">
                          <button onClick={() => setDetailsFilter("ALL")} className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${detailsFilter === "ALL" ? "bg-gray-800 text-white shadow-md dark:bg-white dark:text-gray-900" : "bg-white text-gray-500 hover:bg-gray-200 dark:bg-[#111827] dark:text-gray-400 dark:hover:bg-white/10"}`}>All</button>
                          <button onClick={() => setDetailsFilter("IN")} className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${detailsFilter === "IN" ? "bg-emerald-500 text-white shadow-md" : "bg-white text-emerald-600 hover:bg-emerald-50 dark:bg-[#111827] dark:text-emerald-400 dark:hover:bg-emerald-500/10"}`}><ArrowDownTrayIcon className="w-3 h-3" /> IN</button>
                          <button onClick={() => setDetailsFilter("OUT")} className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-semibold   transition-all ${detailsFilter === "OUT" ? "bg-rose-500 text-white shadow-md" : "bg-white text-rose-600 hover:bg-rose-50 dark:bg-[#111827] dark:text-rose-400 dark:hover:bg-rose-500/10"}`}><ArrowUpTrayIcon className="w-3 h-3" /> OUT</button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#111827]">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-gray-50 dark:bg-[#182031] sticky top-0 shadow-sm z-10">
                            <tr>
                              <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-48">Date & Time</th>
                              <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-28">Type</th>
                              <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right w-28">Quantity</th>
                              <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10">Remarks</th>
                              <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-40">User</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono text-[14px]">
                            {filteredItemLogs.map((log, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                                <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2.5 px-4 whitespace-nowrap">
                                  <span className={`flex items-center gap-1 w-max px-2 py-0.5 rounded text-[13px] font-semibold  tracking-wider ${log.transaction_type === 'IN'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                    }`}>
                                    {log.transaction_type === 'IN' ? <ArrowDownTrayIcon className="w-3 h-3" /> : <ArrowUpTrayIcon className="w-3 h-3" />}
                                    {log.transaction_type}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-4 font-semibold text-right ${log.transaction_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {log.transaction_type === 'IN' ? '+' : '-'}{log.quantity}
                                </td>
                                <td className="py-2.5 px-4 text-gray-500 truncate max-w-[400px]" title={log.remarks}>{log.remarks || '-'}</td>
                                <td className="py-2.5 px-4 text-gray-500 truncate font-sans font-bold">{log.user}</td>
                              </tr>
                            ))}
                            {filteredItemLogs.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-[#5B6472] font-sans text-[14px] font-semibold">No transactions recorded for this item.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {activeTab === "logs" && (
              <div className="flex-1 overflow-auto custom-scrollbar relative">
                {logsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <div key={i} className="animate-pulse flex items-center gap-4">
                        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-6 flex-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse relative">
                    <thead className="bg-gray-100 dark:bg-[#1f2937] sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-48">Date & Time</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-28">Type</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-36">SKU Code</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10">Item Name</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 text-right w-28">Quantity</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10">Remarks</th>
                        <th className="py-2.5 px-4 text-[13px] font-semibold text-gray-500 border-b border-gray-200 dark:border-white/10 w-40">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono text-[14px]">
                      {filteredLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`flex items-center gap-1 w-max px-2 py-0.5 rounded text-[13px] font-semibold  tracking-wider ${log.transaction_type === 'IN'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                              }`}>
                              {log.transaction_type === 'IN' ? <ArrowDownTrayIcon className="w-3 h-3" /> : <ArrowUpTrayIcon className="w-3 h-3" />}
                              {log.transaction_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">{log.sku_code}</td>
                          <td className="py-2.5 px-4 text-gray-900 dark:text-white truncate max-w-[250px]" title={log.item_name}>{log.item_name}</td>
                          <td className={`py-2.5 px-4 font-semibold text-right ${log.transaction_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {log.transaction_type === 'IN' ? '+' : '-'}{log.quantity}
                          </td>
                          <td className="py-2.5 px-4 text-gray-500 truncate max-w-[250px]" title={log.remarks}>{log.remarks || '-'}</td>
                          <td className="py-2.5 px-4 text-gray-500 truncate font-sans font-bold">{log.user}</td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#5B6472] font-sans text-[14px] font-semibold">No transaction logs found for this filter</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <datalist id="category-list">
        {uniqueCategories.map(cat => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* Item Modal (Floating Labels & Colorful) */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,56,117,0.3)] dark:shadow-[0_0_40px_rgba(255,213,0,0.1)] w-full max-w-2xl overflow-hidden border border-[#2563EB]/30 dark:border-[#60A5FA]/20"
            >
              <div className="flex items-center justify-between p-5 border-b border-blue-800/20 dark:border-white/5 bg-gradient-to-r from-[#2563EB] to-blue-800 dark:from-[#1f2937] dark:to-[#111827] text-white">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-blue-200 dark:text-[#60A5FA]" />
                  {editingItem ? 'Edit Master Record' : 'Create Master Record'}
                </h3>
                <button onClick={() => setItemModalOpen(false)} className="p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 dark:bg-[#1f2937] rounded-lg shadow-sm transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#111827]">

                {/* SKU Code explicitly hidden as requested, but we still need Category which takes its spot in grid */}
                <FloatingInput label="Category" name="category" list="category-list" value={itemForm.category || ''} onChange={(val) => setItemForm({ ...itemForm, category: val })} />
                <div className="hidden md:block"></div> {/* Spacer to keep Item Name on full width properly if needed, but lets just let Category be first and Item Name span 2 */}

                <div className="md:col-span-2">
                  <FloatingInput label="Item Name" name="item_name" value={itemForm.item_name || ''} onChange={(val) => setItemForm({ ...itemForm, item_name: val })} />
                </div>

                <div className="md:col-span-2">
                  <FloatingInput label="Supplier / Seller" name="from_seller" value={itemForm.from_seller || ''} onChange={(val) => setItemForm({ ...itemForm, from_seller: val })} />
                </div>

                <FloatingInput label="MOQ" name="moq" type="number" value={itemForm.moq || ''} onChange={(val) => setItemForm({ ...itemForm, moq: parseFloat(val) || 0 })} />
                <FloatingInput label="In Transit" name="material_in_transit" type="number" value={itemForm.material_in_transit || ''} onChange={(val) => setItemForm({ ...itemForm, material_in_transit: parseFloat(val) || 0 })} />

                <FloatingInput label="Lead Time (Days)" name="lead_time" type="number" step="0.1" value={itemForm.lead_time || ''} onChange={(val) => setItemForm({ ...itemForm, lead_time: parseFloat(val) || 0 })} />
                <FloatingInput label="Safety Factor" name="safety_factor" type="number" step="0.1" value={itemForm.safety_factor || ''} onChange={(val) => setItemForm({ ...itemForm, safety_factor: parseFloat(val) || 0 })} />

                <div className="md:col-span-2">
                  <FloatingInput label="Initial Stock" name="total_available" type="number" disabled={!!editingItem} value={itemForm.total_available || ''} onChange={(val) => setItemForm({ ...itemForm, total_available: parseFloat(val) || 0 })} />
                </div>

              </div>
              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button onClick={() => setItemModalOpen(false)} className="px-5 py-2 rounded-xl text-[14px] font-semibold text-gray-500 hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors">Cancel</button>
                <button onClick={handleSaveItem} className="px-6 py-2 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#2563EB] to-blue-600 dark:from-[#60A5FA] dark:to-yellow-400 dark:text-[#60A5FA] hover:brightness-110 shadow-lg shadow-blue-500/20 dark:shadow-yellow-500/20 transition-all">Save Record</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Transaction Modal */}
      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`bg-white dark:bg-[#111827] rounded-2xl shadow-2xl w-full ${selectedSkus.length > 0 ? 'max-w-2xl' : 'max-w-md'} overflow-hidden border ${stockType === 'IN' ? 'border-emerald-500/30' : 'border-rose-500/30'}`}
            >
              <div className={`flex items-center gap-3 p-5 border-b border-gray-200 dark:border-white/10 ${stockType === 'IN' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white' : 'bg-gradient-to-r from-rose-500 to-rose-400 text-white'}`}>
                <div className="p-2 bg-white/20 rounded-lg">
                  {stockType === 'IN' ? <ArrowDownTrayIcon className="w-5 h-5" /> : <ArrowUpTrayIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-none">
                    Stock {stockType} Entry
                  </h3>
                  {selectedSkus.length > 0 && <p className="text-[13px] font-bold mt-1 text-white/80">Bulk Operation: {selectedSkus.length} Items</p>}
                </div>
                <button onClick={() => setStockModalOpen(false)} className="ml-auto p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white dark:bg-[#111827] max-h-[60vh] overflow-y-auto custom-scrollbar">

                {selectedSkus.length > 0 ? (
                  <div className="space-y-6">
                    {selectedSkus.map(sku => {
                      const item = items.find(i => i.sku_code === sku);
                      return (
                        <div key={sku} className="relative p-5 pt-6 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] mt-4">
                          <div className="absolute -top-3 left-4 bg-gray-50 dark:bg-[#111827] px-2 text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] border border-gray-200 dark:border-white/10 rounded">
                            {sku}
                          </div>
                          <p className="text-[14px] font-bold text-gray-500 truncate mb-5">{item?.item_name}</p>
                          <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-1">
                              <FloatingInput
                                label="Quantity"
                                type="number"
                                name={`qty-${sku}`}
                                value={bulkStockForm[sku]?.quantity || ''}
                                onChange={val => setBulkStockForm({ ...bulkStockForm, [sku]: { ...bulkStockForm[sku], quantity: parseInt(val) || 0 } })}
                              />
                            </div>
                            <div className="col-span-2">
                              <FloatingInput
                                label="Remarks (Optional)"
                                type="text"
                                name={`rem-${sku}`}
                                value={bulkStockForm[sku]?.remarks || ''}
                                onChange={val => setBulkStockForm({ ...bulkStockForm, [sku]: { ...bulkStockForm[sku], remarks: val } })}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-6 mt-2">
                    <div className="relative z-0 w-full group">
                      <select
                        id="select-sku"
                        value={selectedSku}
                        onChange={(e) => setSelectedSku(e.target.value)}
                        className="block px-3 pb-2.5 pt-4 w-full text-sm font-bold text-gray-900 bg-transparent rounded-lg border-2 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-[#60A5FA] focus:outline-none focus:ring-0 focus:border-[#2563EB] peer"
                      >
                        <option value="" className="dark:bg-gray-800">-- CHOOSE SKU --</option>
                        {items.map(i => (
                          <option key={i.sku_code} value={i.sku_code} className="dark:bg-gray-800">{i.sku_code} - {i.item_name}</option>
                        ))}
                      </select>
                      <label htmlFor="select-sku" className="absolute text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-[#111827] px-2 peer-focus:px-2 peer-focus:text-[#2563EB] peer-focus:dark:text-[#2563EB] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Target SKU</label>
                    </div>

                    <FloatingInput
                      label="Transaction Quantity"
                      type="number"
                      name="single-qty"
                      value={stockForm.quantity || ''}
                      onChange={val => setStockForm({ ...stockForm, quantity: parseInt(val) || 0 })}
                    />

                    <FloatingInput
                      label="Remarks (Optional)"
                      type="text"
                      name="single-rem"
                      value={stockForm.remarks || ''}
                      onChange={val => setStockForm({ ...stockForm, remarks: val })}
                    />
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button onClick={() => setStockModalOpen(false)} className="px-5 py-2 rounded-xl text-[14px] font-semibold text-gray-500 hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors disabled:opacity-50">Cancel</button>
                <button
                  onClick={handleStockTransaction}
                  disabled={(selectedSkus.length === 0 && (!selectedSku || stockForm.quantity <= 0))}
                  className={`flex items-center px-6 py-2 rounded-xl text-[14px] font-semibold text-white   shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${stockType === 'IN' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-110 shadow-emerald-500/20' : 'bg-gradient-to-r from-rose-500 to-rose-400 hover:brightness-110 shadow-rose-500/20'}`}
                >
                  Confirm {stockType}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setPendingDeleteId(null);
        }}
        onConfirm={performDelete}
        title="Delete SKU"
        message={`Are you sure you want to completely remove ${pendingDeleteId} from the system? This action cannot be undone.`}
        confirmLabel="Delete"
        type="danger"
      />

    </div>
  );
}
