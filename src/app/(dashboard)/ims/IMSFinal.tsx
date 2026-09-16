"use client";

import React, { useState, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import TimeSeriesTable, { TimeBucket, Transaction } from "@/components/TimeSeriesTable";
import DateFilterBar, { FilterPeriod } from "@/components/DateFilterBar";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import ActionStatusModal from "@/components/ActionStatusModal";
import { matchesCategoryItemFilters, matchesOptionSearch, normalizeFilterKey, matchesActiveFilter, ActiveStatusFilter } from "@/lib/ims-filters";
import { indexMasterByName, masterItemKey, overlayFromMaster } from "@/lib/ims-master-overlay";
import { IMSMasterItem } from "@/types/ims-master";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";

const fetcher = (url: string) => fetch(url).then(res => res.json());

const DEFAULT_LEAD = 30;
const DEFAULT_SF = 1;

const getLegendBucket = (live: number, maxLevel: number) => {
  if (live < 0) return 6;
  if (live === 0) return 5;
  const pct = maxLevel > 0 ? (live / maxLevel) * 100 : 100;
  if (pct <= 20) return 4;
  if (pct <= 50) return 3;
  if (pct <= 100) return 2;
  return 1;
};

const getHealth = (live: number, max_level: number) => {
  const bucket = getLegendBucket(live, max_level);
  const max = max_level > 0 ? max_level : Math.max(100, live);
  if (bucket === 6) return { color: "bg-gray-400", text: "text-gray-500", label: "Negative", pct: 0 };
  if (bucket === 5) return { color: "bg-black dark:bg-gray-700", text: "text-gray-900 dark:text-gray-400", label: "Stockout", pct: 0 };

  const percentage = max > 0 ? (live / max) * 100 : 100;
  if (bucket === 1) return { color: "bg-purple-500", text: "text-purple-600", label: "Overstock", pct: Math.min(percentage, 100) };
  if (bucket === 2) return { color: "bg-emerald-500", text: "text-emerald-600", label: "Healthy", pct: percentage };
  if (bucket === 3) return { color: "bg-amber-400", text: "text-amber-600", label: "Warning", pct: percentage };
  if (bucket === 4) return { color: "bg-rose-500", text: "text-rose-600", label: "Critical", pct: percentage };

  return { color: "bg-gray-200", text: "text-gray-500", label: "Unknown", pct: 0 };
};

type FinalIMSRow = {
  item_name: string;
  category: string;
  sku_code: string;
  active_status: string;
  in_master: boolean;
  in_qty: number;
  out_qty: number;
  g_floor_stock: number;
  sfg_stock: number;
  first_floor_stock: number;
  live_stock: number;
  sale_percent: number;
  avg_daily_con: number;
  lead_time: number;
  safety_factor: number;
  max_level: number;
};

export default function IMSFinal({ onBack }: { onBack: () => void }) {
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [itemNameFilters, setItemNameFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [legendFilter, setLegendFilter] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveStatusFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [editingItem, setEditingItem] = useState<FinalIMSRow | null>(null);
  const [masterForm, setMasterForm] = useState({
    sku_code: "",
    category: "",
    active_status: "Active",
    lead_time: String(DEFAULT_LEAD),
    safety_factor: String(DEFAULT_SF),
  });
  const [savingMaster, setSavingMaster] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");

  const [viewMode, setViewMode] = useState<'default' | 'timeseries' | 'datewise'>('default');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('ALL');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  const mappedTimeBucket: TimeBucket = useMemo(() => {
    if (filterPeriod === 'WEEK') return 'Weekly';
    if (filterPeriod === 'MONTH') return 'Monthly';
    if (filterPeriod === 'QUARTERLY' || filterPeriod === 'YEARLY') return 'Quarterly';
    return 'Daily';
  }, [filterPeriod]);

  const { data: masterItems = [], isLoading: isLoadingMaster } = useSWR("/api/ims", fetcher);
  const { data: firstItems = [], isLoading: isLoadingFirst } = useSWR("/api/ims/floor?location=1st", fetcher);
  const { data: sfgItems = [], isLoading: isLoadingSfg } = useSWR("/api/ims/floor?location=sfg", fetcher);
  const { data: masterCatalog = [], mutate: mutateMasterCatalog } = useSWR<IMSMasterItem[]>("/api/ims/master", fetcher);

  const { data: timeSeriesData = [], isValidating: isTimeSeriesLoading } = useSWR<Transaction[]>(
    viewMode === 'timeseries' ? '/api/ims/time-series' : null,
    fetcher
  );

  const isLoading = isLoadingMaster || isLoadingFirst || isLoadingSfg;

  /** One row per item: combined IN/OUT + G Floor + 1st Floor stock + health metrics */
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, FinalIMSRow>();

    const ensure = (rawName: string, category?: string) => {
      const name = (rawName ?? "").trim();
      const key = name.toLowerCase();
      if (!key) return null;
      if (!map.has(key)) {
        map.set(key, {
          item_name: name,
          category: (category || "Uncategorized").trim() || "Uncategorized",
          sku_code: "",
          active_status: "",
          in_master: false,
          in_qty: 0,
          out_qty: 0,
          g_floor_stock: 0,
          sfg_stock: 0,
          first_floor_stock: 0,
          live_stock: 0,
          sale_percent: 0,
          avg_daily_con: 0,
          lead_time: DEFAULT_LEAD,
          safety_factor: DEFAULT_SF,
          max_level: 0,
        });
      }
      const row = map.get(key)!;
      if (row.category === "Uncategorized" && category?.trim()) {
        row.category = category.trim();
      }
      return row;
    };

    (masterItems || []).forEach((item: any) => {
      const row = ensure(item.item_name, item.category);
      if (!row) return;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      const live = parseFloat(item.live_stock) || inVal - outVal;
      row.in_qty += inVal;
      row.out_qty += outVal;
      row.g_floor_stock += live;
      if (item.avg_daily_con != null) row.avg_daily_con = Math.max(row.avg_daily_con, parseFloat(item.avg_daily_con) || 0);
      if (item.lead_time != null) row.lead_time = parseFloat(item.lead_time) || DEFAULT_LEAD;
      if (item.safety_factor != null) row.safety_factor = parseFloat(item.safety_factor) || DEFAULT_SF;
    });

    (sfgItems || []).forEach((item: any) => {
      const row = ensure(item.item_name, item.category);
      if (!row) return;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      const live = parseFloat(item.live_stock) || inVal - outVal;
      row.in_qty += inVal;
      row.out_qty += outVal;
      row.sfg_stock += live;
    });

    (firstItems || []).forEach((item: any) => {
      const row = ensure(item.item_name, item.category);
      if (!row) return;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      const live = parseFloat(item.live_stock) || inVal - outVal;
      row.in_qty += inVal;
      row.out_qty += outVal;
      row.first_floor_stock += live;
    });

    const masterByName = indexMasterByName(masterCatalog || []);

    return Array.from(map.values())
      .map((row) => {
        const overlaid = overlayFromMaster(row, masterByName.get(masterItemKey(row.item_name)), {
          lead_time: row.lead_time,
          safety_factor: row.safety_factor,
        });
        const live_stock = overlaid.g_floor_stock + overlaid.sfg_stock + overlaid.first_floor_stock;
        const sale_percent = overlaid.in_qty > 0 ? Number(((overlaid.out_qty / overlaid.in_qty) * 100).toFixed(1)) : 0;
        const max_level = Number((overlaid.avg_daily_con * overlaid.lead_time * overlaid.safety_factor).toFixed(2));
        return { ...overlaid, live_stock, sale_percent, max_level };
      })
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [masterItems, sfgItems, firstItems, masterCatalog]);

  const bucketCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    aggregatedItems.forEach((item) => {
      counts[getLegendBucket(item.live_stock, item.max_level) as keyof typeof counts]++;
    });
    return counts;
  }, [aggregatedItems]);

  const uniqueCategories = useMemo(() => {
    return Array.from(
      new Set(aggregatedItems.map((i) => (i.category ?? "").trim()).filter(Boolean))
    ).sort();
  }, [aggregatedItems]);

  const categoryOptions = useMemo(
    () => uniqueCategories.map((cat) => ({ id: cat, label: cat })),
    [uniqueCategories]
  );

  const uniqueItemNames = useMemo(() => {
    const byKey = new Map<string, string>();
    const source =
      categoryFilters.length > 0
        ? aggregatedItems.filter((i) => matchesCategoryItemFilters(i, categoryFilters, []))
        : aggregatedItems;
    source.forEach((i) => {
      const trimmed = (i.item_name ?? "").trim();
      if (!trimmed) return;
      const key = normalizeFilterKey(trimmed);
      if (!key || byKey.has(key)) return;
      byKey.set(key, trimmed);
    });
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [aggregatedItems, categoryFilters]);

  const itemNameOptions = useMemo(
    () => uniqueItemNames.map((name) => ({ id: name, label: name })),
    [uniqueItemNames]
  );

  const filteredItems = useMemo(() => {
    let result = aggregatedItems.filter((item) => {
      if (searchQuery && !matchesOptionSearch(item.item_name || "", searchQuery)) return false;
      if (!matchesActiveFilter(item.active_status, activeFilter)) return false;
      return matchesCategoryItemFilters(item, categoryFilters, itemNameFilters);
    });
    if (legendFilter !== null) {
      result = result.filter(
        (item) => getLegendBucket(item.live_stock, item.max_level) === legendFilter
      );
    }
    return result;
  }, [aggregatedItems, categoryFilters, itemNameFilters, searchQuery, legendFilter, activeFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const handleExport = () => {
    if (viewMode === 'datewise') {
      const exportData = filteredDatewiseTransactions.map((log: any) => ({
        "Date": new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
        "Source": log.source,
        "Category": log.category,
        "Item Name": log.item_name,
        "In Qty": log.in_qty > 0 ? `+${log.in_qty}` : "-",
        "Out Qty": log.out_qty > 0 ? `-${log.out_qty}` : "-",
        "Live Stock": log.running_stock
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Final_IMS_Datewise");
      XLSX.writeFile(wb, `Final_IMS_Datewise_${new Date().toISOString().split("T")[0]}.xlsx`);
    } else {
      const exportData = filteredItems.map(item => ({
        "SKU Code": item.sku_code,
        Category: item.category,
        "Item Name": item.item_name,
        "Active/Inactive": item.active_status || "—",
        "Stock Health": item.live_stock,
        Max: item.max_level,
        "IN Qty": item.in_qty,
        "OUT Qty": item.out_qty,
        "Sale %": item.sale_percent,
        "Avg. Consumption": item.avg_daily_con,
        "Lead Time": item.lead_time,
        "G Floor Stock": item.g_floor_stock,
        "SFG Stock": item.sfg_stock,
        "1st Floor Stock": item.first_floor_stock,
        SF: item.safety_factor,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Final_IMS");
      XLSX.writeFile(wb, `Final_IMS_${new Date().toISOString().split("T")[0]}.xlsx`);
    }
  };

  const showStatus = (message: string, type: "loading" | "success" | "error") => {
    setStatusMessage(message);
    setStatusType(type);
    setStatusOpen(true);
  };

  const openMasterEdit = (item: FinalIMSRow) => {
    const master = (masterCatalog || []).find(
      (row) => masterItemKey(row.item_name) === masterItemKey(item.item_name)
    );
    setEditingItem(item);
    setMasterForm({
      sku_code: master?.sku_code || item.sku_code || "",
      category: master?.category || (item.category !== "Uncategorized" ? item.category : "") || "",
      active_status: master?.active_status || item.active_status || "Active",
      lead_time: String(master?.lead_time || item.lead_time || DEFAULT_LEAD),
      safety_factor: String(master?.safety_factor || item.safety_factor || DEFAULT_SF),
    });
  };

  const handleSaveMaster = async () => {
    if (!editingItem) return;
    setSavingMaster(true);
    showStatus("Saving to Master...", "loading");
    try {
      const res = await fetch("/api/ims/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: editingItem.item_name,
          sku_code: masterForm.sku_code,
          category: masterForm.category,
          active_status: masterForm.active_status,
          lead_time: masterForm.lead_time,
          safety_factor: masterForm.safety_factor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Master item");
      await Promise.all([
        mutateMasterCatalog(),
        globalMutate("/api/ims"),
        globalMutate("/api/ims/floor?location=g"),
        globalMutate("/api/ims/floor?location=1st"),
        globalMutate("/api/ims/floor?location=sfg"),
        globalMutate("/api/ims/time-series"),
        globalMutate("/api/ims/summary"),
      ]);
      setEditingItem(null);
      showStatus(data.added ? "Added to Master" : "Master updated", "success");
      setTimeout(() => setStatusOpen(false), 1500);
    } catch (e) {
      showStatus(e instanceof Error ? e.message : "Failed to save Master item", "error");
    } finally {
      setSavingMaster(false);
    }
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilters, itemNameFilters, viewMode, filterPeriod, filterDate, filterStartDate, filterEndDate, searchQuery, legendFilter, activeFilter]);

  React.useEffect(() => {
    setItemNameFilters((prev) => {
      if (prev.length === 0) return prev;
      const valid = new Set(uniqueItemNames);
      const next = prev.filter((name) => valid.has(name));
      return next.length === prev.length ? prev : next;
    });
  }, [categoryFilters, uniqueItemNames]);

  const combinedTransactions = useMemo(() => {
    const catalogByName = indexMasterByName(masterCatalog || []);
    const categoryFor = (name: string, fallback?: string) =>
      catalogByName.get(masterItemKey(name))?.category || fallback || "Uncategorized";

    const masterTxs = (timeSeriesData || []).map((item: any) => ({
      ...item,
      category: categoryFor(item.item_name, item.category),
      source: 'IMS - G Floor'
    }));
    
    const floorMapper = (sourceName: string) => (item: any): Transaction & { source: string } => ({
      item_name: item.item_name || '',
      category: categoryFor(item.item_name, item.category),
      date: item.date || item.updated_at || '',
      in_qty: parseFloat(item.in_qty) || 0,
      out_qty: parseFloat(item.out_qty) || 0,
      source: sourceName
    });

    const firstTxs = (firstItems || []).map(floorMapper('1st Floor IMS'));
    const sfgTxs = (sfgItems || []).map(floorMapper('SFG IMS'));

    return [...masterTxs, ...sfgTxs, ...firstTxs];
  }, [timeSeriesData, firstItems, sfgItems, masterCatalog]);

  const dateRange = useMemo(() => {
    let start, end;
    if (filterPeriod === 'CUSTOM') {
      if (!filterStartDate || !filterEndDate) return null;
      start = startOfDay(filterStartDate);
      end = endOfDay(filterEndDate);
    } else {
      switch (filterPeriod) {
        case 'ALL':
          return null;
        case 'DAY':
          start = startOfDay(filterDate);
          end = endOfDay(filterDate);
          break;
        case 'WEEK':
          start = startOfWeek(filterDate, { weekStartsOn: 1 });
          end = endOfWeek(filterDate, { weekStartsOn: 1 });
          break;
        case 'MONTH':
          start = startOfMonth(filterDate);
          end = endOfMonth(filterDate);
          break;
        case 'QUARTERLY':
          start = startOfQuarter(filterDate);
          end = endOfQuarter(filterDate);
          break;
        case 'YEARLY':
          start = startOfYear(filterDate);
          end = endOfYear(filterDate);
          break;
      }
    }
    return { start, end };
  }, [filterPeriod, filterDate, filterStartDate, filterEndDate]);

  const datewiseTransactions = useMemo(() => {
    const sortedAll = [...combinedTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const stockMap = new Map<string, number>();
    
    const itemsWithRunningStock = sortedAll.map(item => {
      const key = item.item_name.toLowerCase().trim();
      const inVal = item.in_qty || 0;
      const outVal = item.out_qty || 0;
      const current = (stockMap.get(key) || 0) + (inVal - outVal);
      stockMap.set(key, current);
      return { ...item, running_stock: current };
    });

    itemsWithRunningStock.reverse();

    if (!dateRange) return itemsWithRunningStock;
    return itemsWithRunningStock.filter(item => {
      const itemDate = new Date(item.date);
      return isWithinInterval(itemDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [combinedTransactions, dateRange]);

  const activeByName = useMemo(() => {
    const map = new Map<string, string>();
    aggregatedItems.forEach((item) => {
      const key = (item.item_name || "").trim().toLowerCase();
      if (key) map.set(key, item.active_status || "");
    });
    return map;
  }, [aggregatedItems]);

  const filteredDatewiseTransactions = useMemo(() => {
    return datewiseTransactions.filter((item) => {
      if (!matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)) return false;
      return matchesActiveFilter(
        activeByName.get((item.item_name || "").trim().toLowerCase()),
        activeFilter
      );
    });
  }, [datewiseTransactions, categoryFilters, itemNameFilters, activeByName, activeFilter]);

  const datewiseTotalPages = Math.ceil(filteredDatewiseTransactions.length / itemsPerPage);
  const paginatedDatewiseTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDatewiseTransactions.slice(start, start + itemsPerPage);
  }, [filteredDatewiseTransactions, currentPage]);

  const filteredCombinedTransactions = useMemo(() => {
    return combinedTransactions.filter((item) => {
      if (!matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)) return false;
      return matchesActiveFilter(
        activeByName.get((item.item_name || "").trim().toLowerCase()),
        activeFilter
      );
    });
  }, [combinedTransactions, categoryFilters, itemNameFilters, activeByName, activeFilter]);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-2">
      <ActionStatusModal
        isOpen={statusOpen}
        status={statusType}
        message={statusMessage}
        onClose={() => setStatusOpen(false)}
      />
      {/* Row 1: Title · tabs + export */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-700 rounded-lg shadow-md shadow-orange-900/20">
              <ClipboardDocumentListIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-orange-600 dark:text-orange-500 uppercase tracking-tight leading-none">Final IMS</h1>
              <p className="text-[9px] font-black text-orange-600/70 dark:text-orange-500/70 uppercase tracking-widest mt-0.5">Total Storage Overview</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('default')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'default'
                  ? 'bg-white dark:bg-[#111827] text-orange-600 dark:text-[#FFD500] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <TableCellsIcon className="w-3.5 h-3.5" /> Default
            </button>
            <button
              onClick={() => setViewMode('timeseries')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'timeseries'
                  ? 'bg-white dark:bg-[#111827] text-orange-600 dark:text-[#FFD500] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ChartBarIcon className="w-3.5 h-3.5" /> Time Series
            </button>
            <button
              onClick={() => setViewMode('datewise')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'datewise'
                  ? 'bg-white dark:bg-[#111827] text-orange-600 dark:text-[#FFD500] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Date-Wise
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-orange-200 dark:border-orange-500/20 shadow-sm h-[34px]"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Row 2: Search + Categories / Items + date */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0 w-full">
        <div className="relative w-[180px] shrink-0">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH ITEM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition-all shadow-sm h-[34px]"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <SearchableMultiSelect
            options={categoryOptions}
            value={categoryFilters}
            onChange={setCategoryFilters}
            placeholder="Categories"
            className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-lg text-[10px] h-[34px]"
            accentClass="border-orange-500 ring-orange-500/20"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <SearchableMultiSelect
            options={itemNameOptions}
            value={itemNameFilters}
            onChange={setItemNameFilters}
            placeholder="Items"
            className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-lg text-[10px] h-[34px]"
            accentClass="border-orange-500 ring-orange-500/20"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveStatusFilter)}
          className="px-2.5 py-1.5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-orange-500 dark:text-white shadow-sm h-[34px] cursor-pointer shrink-0"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {(categoryFilters.length > 0 || itemNameFilters.length > 0 || searchQuery || activeFilter !== "ALL") && (
          <button
            onClick={() => {
              setCategoryFilters([]);
              setItemNameFilters([]);
              setSearchQuery("");
              setActiveFilter("ALL");
            }}
            className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 border border-orange-200 dark:border-orange-500/20 transition-colors shrink-0 h-[34px]"
          >
            Clear
          </button>
        )}

        <DateFilterBar
          variant="dropdown"
          period={filterPeriod}
          setPeriod={setFilterPeriod}
          currentDate={filterDate}
          setCurrentDate={setFilterDate}
          startDate={filterStartDate}
          setStartDate={setFilterStartDate}
          endDate={filterEndDate}
          setEndDate={setFilterEndDate}
          theme="orange"
          className="shrink-0"
        />
      </div>

      {/* Row 3: Color Logic — taller, clearer counts */}
      {viewMode === 'default' && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full bg-white dark:bg-[#111827] px-3 py-2 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">Color Logic</span>
          </div>
          <div className="flex flex-1 flex-wrap items-stretch gap-1.5 min-w-0">
            {([
              { id: 1, label: '> 100%', count: bucketCounts[1], fill: 'bg-gradient-to-b from-purple-400 to-purple-600', ring: 'ring-2 ring-purple-700 ring-offset-1 shadow-lg shadow-purple-500/40', text: 'text-white' },
              { id: 2, label: '51-100%', count: bucketCounts[2], fill: 'bg-gradient-to-b from-emerald-400 to-emerald-600', ring: 'ring-2 ring-emerald-600 ring-offset-1 shadow-lg shadow-emerald-500/40', text: 'text-white' },
              { id: 3, label: '21-50%', count: bucketCounts[3], fill: 'bg-gradient-to-b from-amber-300 to-amber-500', ring: 'ring-2 ring-amber-500 ring-offset-1 shadow-lg shadow-amber-400/40', text: 'text-amber-950' },
              { id: 4, label: '1-20%', count: bucketCounts[4], fill: 'bg-gradient-to-b from-rose-400 to-rose-600', ring: 'ring-2 ring-rose-600 ring-offset-1 shadow-lg shadow-rose-500/40', text: 'text-white' },
              { id: 5, label: '0%', count: bucketCounts[5], fill: 'bg-gradient-to-b from-gray-700 to-gray-900', ring: 'ring-2 ring-gray-900 dark:ring-gray-500 ring-offset-1 shadow-lg', text: 'text-white' },
              { id: 6, label: '< 0%', count: bucketCounts[6], fill: 'bg-gradient-to-b from-gray-200 to-gray-400', ring: 'ring-2 ring-gray-500 ring-offset-1 shadow-lg', text: 'text-gray-800' },
            ] as const).map((chip) => {
              const selected = legendFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setLegendFilter(selected ? null : chip.id)}
                  className={`flex-1 min-w-[88px] h-11 px-2.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md ${chip.text} ${chip.fill} ${selected ? `${chip.ring} scale-[1.02]` : 'hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-wide whitespace-nowrap">{chip.label}</span>
                  <span className={`min-w-[1.6rem] h-6 px-1.5 rounded-md text-[12px] font-black tabular-nums flex items-center justify-center ${
                    chip.id === 3 || chip.id === 6
                      ? 'bg-black/15 text-inherit'
                      : 'bg-white/25 text-white'
                  }`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
          {legendFilter !== null && (
            <button
              type="button"
              onClick={() => setLegendFilter(null)}
              className="h-11 px-3 rounded-xl text-[10px] uppercase font-black tracking-wider text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 border border-gray-200 dark:border-white/10 shrink-0 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {viewMode === 'datewise' ? (
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0">
          {filteredDatewiseTransactions.length > 0 && !isLoading && (
            <div className="py-2 px-4 border-b border-orange-200/50 dark:border-orange-500/10 flex items-center justify-between bg-orange-50/50 dark:bg-orange-500/5 shrink-0">
              <p className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredDatewiseTransactions.length)} to {Math.min(currentPage * itemsPerPage, filteredDatewiseTransactions.length)} of {filteredDatewiseTransactions.length} transactions
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, datewiseTotalPages))}
                  disabled={currentPage === datewiseTotalPages || datewiseTotalPages === 0}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse relative">
                <thead className="bg-orange-50 dark:bg-orange-900/20 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-4 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Date</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Source</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Category</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Item Name</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">In</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Out</th>
                    <th className="py-2.5 px-4 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Live Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100 dark:divide-orange-500/10">
                  {paginatedDatewiseTransactions.map((log, index) => (
                    <tr key={index} className="hover:bg-orange-50/50 dark:hover:bg-orange-500/[0.03] even:bg-orange-50/30 dark:even:bg-orange-900/10 transition-colors group">
                      <td className="py-2 px-4 text-[11px] font-bold text-gray-500">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-[11px] font-black uppercase">
        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${
                          log.source === 'IMS - G Floor' ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          log.source === 'SFG IMS' ? 'border-teal-200 dark:border-teal-500/20 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' :
                          'border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}>
                          {log.source}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-500 uppercase">{log.category}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase">{log.item_name}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-right">{log.in_qty > 0 ? `+${log.in_qty}` : "-"}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">{log.out_qty > 0 ? `-${log.out_qty}` : "-"}</td>
                      <td className="py-2 px-4 text-[11px] font-black text-orange-600 dark:text-[#FFD500] text-right">{(log as any).running_stock}</td>
                    </tr>
                  ))}
                  {filteredDatewiseTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : viewMode === 'timeseries' ? (
        <div className="flex flex-col gap-2 shrink-0 mb-2">
          <TimeSeriesTable 
            transactions={filteredCombinedTransactions}
            bucket={mappedTimeBucket}
            isLoading={isTimeSeriesLoading || isLoading}
          />
        </div>
      ) : (
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0">
          {filteredItems.length > 0 && !isLoading && (
            <div className="py-2 px-4 border-b border-orange-200/50 dark:border-orange-500/10 flex items-center justify-between bg-orange-50/50 dark:bg-orange-500/5 shrink-0">
              <p className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredItems.length)} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} unique items
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            {isLoading ? (
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
              <table className="w-full text-left border-collapse relative min-w-[1100px]">
                <thead className="bg-orange-50 dark:bg-orange-900/20 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-center w-12">Acts</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 whitespace-nowrap">SKU</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 whitespace-nowrap">Category</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 min-w-[200px]">Item Name</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-center whitespace-nowrap">Active</th>
                    <th className="py-2.5 px-4 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-left bg-orange-100/50 dark:bg-orange-500/10 w-56">Stock Health</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Max</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">IN Qty</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">OUT Qty</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Sale %</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right whitespace-nowrap">Avg. Con</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Lead</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right whitespace-nowrap">G Floor</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right whitespace-nowrap">SFG</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right whitespace-nowrap">1st Floor</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">SF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100 dark:divide-orange-500/10">
                  {paginatedItems.map((item) => {
                    const health = getHealth(item.live_stock, item.max_level || 0);
                    return (
                      <tr
                        key={item.item_name}
                        className="hover:bg-orange-50/30 dark:hover:bg-white/[0.03] even:bg-gray-50/50 dark:even:bg-[#1f2937]/30 transition-colors group"
                      >
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => openMasterEdit(item)}
                            className={`hover:scale-110 transition-transform ${
                              item.in_master
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-amber-500 dark:text-amber-400"
                            }`}
                            title={item.in_master ? "Edit Master item" : "Add to Master — fill SKU, Category, Active, Lead Time, Safety Factor"}
                          >
                            <PencilSquareIcon className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                        <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase whitespace-nowrap">{item.sku_code || "—"}</td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase whitespace-normal break-words min-w-[200px] max-w-[320px] leading-snug">
                          {item.item_name}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.active_status ? (
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              item.active_status.toLowerCase() === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                                : "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                            }`}>
                              {item.active_status}
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Not set</span>
                          )}
                        </td>
                        <td className="py-1 px-4 bg-gray-50/50 dark:bg-white/[0.02]">
                          <div className="flex flex-col gap-1 w-full max-w-[180px]">
                            <div className="flex justify-between items-baseline leading-none">
                              <span className={`text-xs font-black ${health.text}`}>{item.live_stock.toLocaleString()}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase">{health.label}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden flex">
                              <div className={`h-full ${health.color} transition-all duration-500`} style={{ width: `${health.pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-[11px] font-bold text-[#003875] dark:text-[#FFD500] text-right">{item.max_level || "—"}</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-right">
                          {item.in_qty !== 0 ? item.in_qty.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 text-right">
                          {item.out_qty !== 0 ? item.out_qty.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 text-right">{item.sale_percent}%</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.avg_daily_con || "—"}</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.lead_time}</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-blue-600 dark:text-blue-400 text-right">{item.g_floor_stock.toLocaleString()}</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-teal-600 dark:text-teal-400 text-right">{item.sfg_stock.toLocaleString()}</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-purple-600 dark:text-purple-400 text-right">{item.first_floor_stock.toLocaleString()}</td>
                        <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.safety_factor}</td>
                      </tr>
                    );
                  })}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-gray-400 text-[11px] font-black uppercase tracking-widest">
                        {categoryFilters.length > 0 || itemNameFilters.length > 0 || searchQuery || legendFilter !== null || activeFilter !== "ALL"
                          ? "No items found matching filters"
                          : "No items available"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-orange-50 dark:bg-orange-900/20">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-900 dark:text-white">
                  <PencilSquareIcon className="w-5 h-5 text-orange-600" />
                  {editingItem.in_master ? "Edit Master Item" : "Add to Master"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4 bg-white dark:bg-[#111827]">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Item Name</p>
                  <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase mt-1">{editingItem.item_name}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">SKU Code</label>
                  <input
                    value={masterForm.sku_code}
                    onChange={(e) => setMasterForm((prev) => ({ ...prev, sku_code: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Category</label>
                  <input
                    list="final-ims-master-categories"
                    value={masterForm.category}
                    onChange={(e) => setMasterForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <datalist id="final-ims-master-categories">
                    {uniqueCategories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Active / Inactive</label>
                  <select
                    value={masterForm.active_status}
                    onChange={(e) => setMasterForm((prev) => ({ ...prev, active_status: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Lead Time</label>
                    <input
                      type="number"
                      min="0"
                      value={masterForm.lead_time}
                      onChange={(e) => setMasterForm((prev) => ({ ...prev, lead_time: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Safety Factor</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={masterForm.safety_factor}
                      onChange={(e) => setMasterForm((prev) => ({ ...prev, safety_factor: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMaster}
                  disabled={savingMaster}
                  className="px-6 py-2 rounded-xl text-xs font-black text-white bg-orange-600 hover:bg-orange-700 uppercase tracking-widest shadow-lg disabled:opacity-50"
                >
                  Save Master
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
