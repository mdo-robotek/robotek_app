"use client";

import React, { useState, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ArrowLeftIcon,
  EyeIcon,
  TableCellsIcon,
  ChartBarIcon,
  HashtagIcon,
  ClipboardDocumentCheckIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { FloorIMS } from "@/types/ims-floor";
import { isSfgVirtualGrnId } from "@/lib/grn-packed";
import { isSfgToFirstVirtualId } from "@/lib/ims-1st-to-g-transfer";
import TimeSeriesTable, { TimeBucket } from "@/components/TimeSeriesTable";
import DateFilterBar, { FilterPeriod } from "@/components/DateFilterBar";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import SearchableSelect from "@/components/SearchableSelect";
import { matchesCategoryItemFilters, matchesActiveFilter, ActiveStatusFilter } from "@/lib/ims-filters";
import { uniquifyByBaseId } from "@/lib/ims-datewise-key";
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

type FloorAggItem = FloorIMS & {
  sale_percent: number;
  avg_daily_con: number;
  lead_time: number;
  safety_factor: number;
  max_level: number;
  sku_code: string;
  active_status: string;
};

type SfgTransferStatus = "TRANSFERRED" | "PENDING" | "PARTIAL";
type TransferFilter = "ALL" | "PENDING" | "TRANSFERRED";

function firstFloorSourceLabel(item: FloorIMS): "SFG" | "1st Floor" {
  const src = String(item.source || "").trim().toUpperCase();
  if (isSfgToFirstVirtualId(item.id) || src === "SFG") return "SFG";
  return "1st Floor";
}

type FloorTxItem = FloorIMS & {
  running_stock?: number;
  transfer_status?: SfgTransferStatus;
  transfer_pending_qty?: number;
};

/** FIFO: allocate packed OUT qty against unpacked IN lots for the same item. */
function attachSfgTransferStatus<T extends FloorIMS>(
  chronoItems: T[]
): (T & { transfer_status: SfgTransferStatus; transfer_pending_qty: number })[] {
  const result = chronoItems.map((item) => {
    const inQty = parseFloat(item.in_qty) || 0;
    const outQty = parseFloat(item.out_qty) || 0;
    return {
      ...item,
      transfer_status: (outQty > 0 && inQty <= 0 ? "TRANSFERRED" : "PENDING") as SfgTransferStatus,
      transfer_pending_qty: inQty > 0 ? inQty : 0,
    };
  });

  const byName = new Map<string, number[]>();
  chronoItems.forEach((item, idx) => {
    const key = (item.item_name || "").toLowerCase().trim();
    if (!key) return;
    const list = byName.get(key);
    if (list) list.push(idx);
    else byName.set(key, [idx]);
  });

  byName.forEach((indices) => {
    let remainingOut = 0;
    for (const idx of indices) {
      remainingOut += parseFloat(chronoItems[idx].out_qty) || 0;
    }
    for (const idx of indices) {
      const inQty = parseFloat(chronoItems[idx].in_qty) || 0;
      const outQty = parseFloat(chronoItems[idx].out_qty) || 0;
      if (outQty > 0 && inQty <= 0) {
        result[idx].transfer_status = "TRANSFERRED";
        result[idx].transfer_pending_qty = 0;
        continue;
      }
      if (inQty <= 0) continue;
      const transferred = Math.min(inQty, remainingOut);
      remainingOut = Math.max(0, remainingOut - transferred);
      const pending = Math.round((inQty - transferred) * 100) / 100;
      result[idx].transfer_pending_qty = pending;
      if (pending <= 0) result[idx].transfer_status = "TRANSFERRED";
      else if (transferred <= 0) result[idx].transfer_status = "PENDING";
      else result[idx].transfer_status = "PARTIAL";
    }
  });

  return result;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
};

const roundQty = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

const formatQty = (value: number | string) => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return '-';
  const rounded = roundQty(n);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const computeAuditDiff = (physicalQty: number, liveStock: number) => {
  const diff = roundQty(physicalQty - liveStock);
  if (diff === 0) {
    return { diff_qty: 0, diff_type: 'NONE' as const };
  }
  return {
    diff_qty: Math.abs(diff),
    diff_type: diff > 0 ? ('IN' as const) : ('OUT' as const),
  };
};

const tableInputClass =
  "w-full px-2 py-1.5 text-[11px] font-bold text-gray-900 dark:text-white bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-md outline-none focus:ring-1 focus:ring-[#003875] dark:focus:ring-[#FFD500] uppercase";

const thClass =
  "py-2 px-2 text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest text-left whitespace-nowrap bg-gray-50 dark:bg-[#1f2937] border-b border-gray-200 dark:border-white/10";

const tdClass = "py-1.5 px-2 align-middle border-b border-gray-100 dark:border-white/5";

const isItemChecked = (item: { checked_status?: string }) =>
  String(item.checked_status || '').trim().toUpperCase() === 'CHECKED';

const FloatingInput = ({
  label, value, onChange, type = "text", step, disabled, name, list, icon: Icon
}: { label: string, value: any, onChange: (val: string) => void, type?: string, step?: string, disabled?: boolean, name?: string, list?: string, icon?: React.ElementType }) => (
  <div className="relative z-0 w-full mt-2">
    {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 z-10" />}
    <input
      type={type}
      step={step}
      name={name}
      id={name}
      list={list}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`block px-3 pb-2.5 pt-2.5 w-full text-[11px] font-bold text-gray-900 bg-transparent rounded-lg border-2 border-gray-200 appearance-none dark:text-white dark:border-white/10 dark:focus:border-[#FFD500] focus:outline-none focus:ring-0 focus:border-[#003875] uppercase disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/5 relative z-0 ${Icon ? 'pl-9' : ''}`}
      placeholder=" "
    />
    <label htmlFor={name} className="absolute text-[9px] font-black text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.02] px-1 start-3 uppercase tracking-widest top-[-6px] z-10 leading-none">
      {label}
    </label>
  </div>
);

interface BulkRow {
  id: string;
  item_name: string;
  category: string;
  type: 'IN' | 'OUT';
  qty: string;
  date?: string;
  packed_status?: string;
}

interface AuditRow {
  id: string;
  item_name: string;
  category: string;
  live_stock: number;
  physical_qty: string;
  diff_qty: number;
  diff_type: 'IN' | 'OUT' | 'NONE';
  fromPaste?: boolean;
}

export default function IMSFloor({ location, onBack }: { location: "1st" | "g" | "sfg", onBack: () => void }) {
  const showPacked = location === "1st" || location === "sfg";
  const allowManualIn = location !== "sfg";
  const isSfg = location === "sfg";
  const isFirst = location === "1st";
  const [sfgTransferMode, setSfgTransferMode] = useState(false);
  const isSfgTransfer = isSfg || sfgTransferMode;
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusType, setStatusType] = useState<'loading' | 'success' | 'error'>('loading');

  const [viewMode, setViewMode] = useState<'default' | 'timeseries' | 'datewise'>('default');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('ALL');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  const [packedFilter, setPackedFilter] = useState<'ALL' | 'PACKED' | 'UNPACKED'>('ALL');
  const [checkedFilter, setCheckedFilter] = useState<'ALL' | 'CHECKED' | 'UNCHECKED'>('ALL');
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('ALL');
  const [legendFilter, setLegendFilter] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveStatusFilter>("ALL");
  const [selectedVerifyIds, setSelectedVerifyIds] = useState<string[]>([]);

  const mappedTimeBucket: TimeBucket = useMemo(() => {
    if (filterPeriod === 'WEEK') return 'Weekly';
    if (filterPeriod === 'MONTH') return 'Monthly';
    if (filterPeriod === 'QUARTERLY' || filterPeriod === 'YEARLY') return 'Quarterly';
    return 'Daily';
  }, [filterPeriod]);

  const showStatus = (msg: string, type: 'loading' | 'success' | 'error' = 'loading') => {
    setStatusMessage(msg);
    setStatusType(type);
    setIsStatusModalOpen(true);
  };

  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [itemNameFilters, setItemNameFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Modals state
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  
  // Transaction Log Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedLogItem, setSelectedLogItem] = useState<string | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FloorIMS | null>(null);
  const [editForm, setEditForm] = useState<{ type: 'IN' | 'OUT'; qty: string; item_name: string; category: string }>({ type: 'IN', qty: '', item_name: '', category: '' });

  // Form states
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditPasteText, setAuditPasteText] = useState("");

  const { data: rawItems = [], mutate, isLoading } = useSWR<FloorIMS[]>(`/api/ims/floor?location=${location}`, fetcher);
  const { data: sfgFloorItems = [], isLoading: sfgItemsLoading } = useSWR<FloorIMS[]>(
    isFirst && sfgTransferMode ? "/api/ims/floor?location=sfg" : null,
    fetcher
  );
  const { data: masterItems = [] } = useSWR<any[]>("/api/ims", fetcher);
  const { data: masterCatalog = [] } = useSWR<IMSMasterItem[]>("/api/ims/master", fetcher);

  const masterItemOptions = useMemo(() => {
    const names = Array.from(
      new Set(masterItems.map((item: any) => item.item_name?.trim()).filter(Boolean))
    ) as string[];
    return names.sort((a, b) => a.localeCompare(b)).map((name) => ({ id: name, label: name }));
  }, [masterItems]);

  const sfgSourceItems = isSfg ? rawItems : sfgFloorItems;

  const sfgPendingItemOptions = useMemo(() => {
    const byKey = new Map<string, { name: string; stock: number }>();
    sfgSourceItems.forEach((item) => {
      const name = item.item_name?.trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      const delta = (parseFloat(item.in_qty) || 0) - (parseFloat(item.out_qty) || 0);
      if (!existing) {
        byKey.set(key, { name, stock: delta });
      } else {
        existing.stock += delta;
      }
    });
    return Array.from(byKey.values())
      .filter((item) => item.stock > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        id: item.name,
        label: `${item.name} (${formatQty(item.stock)})`,
      }));
  }, [sfgSourceItems]);

  const sfgStockMap = useMemo(() => {
    const map = new Map<string, number>();
    sfgSourceItems.forEach((item) => {
      const key = item.item_name?.toLowerCase().trim();
      if (!key) return;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      map.set(key, (map.get(key) || 0) + inVal - outVal);
    });
    return map;
  }, [sfgSourceItems]);

  const floorStockOptions = useMemo(() => {
    const byKey = new Map<string, { name: string; stock: number }>();
    rawItems.forEach((item) => {
      const name = item.item_name?.trim();
      if (!name) return;
      const key = name.toLowerCase();
      const delta = (parseFloat(item.in_qty) || 0) - (parseFloat(item.out_qty) || 0);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { name, stock: delta });
      } else {
        existing.stock += delta;
      }
    });
    return Array.from(byKey.values())
      .filter((item) => item.stock > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        id: item.name,
        label: `${item.name} (${formatQty(item.stock)})`,
      }));
  }, [rawItems]);

  const firstFloorInOptions = useMemo(() => {
    const byKey = new Map<string, { id: string; label: string }>();
    masterItemOptions.forEach((opt) => byKey.set(opt.id.toLowerCase(), opt));
    rawItems.forEach((item) => {
      const name = item.item_name?.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { id: name, label: name });
    });
    floorStockOptions.forEach((opt) => byKey.set(opt.id.toLowerCase(), opt));
    return Array.from(byKey.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [masterItemOptions, rawItems, floorStockOptions]);

  const getBulkItemOptions = (row: BulkRow) => {
    if (isSfgTransfer) return sfgPendingItemOptions;
    if (isFirst && row.type === "OUT") return floorStockOptions;
    if (isFirst) return firstFloorInOptions;
    return masterItemOptions;
  };

  const isValidMasterItemName = (name: string) => {
    const key = name.toLowerCase().trim();
    if (masterItemOptions.some((opt) => opt.id.toLowerCase() === key)) return true;
    if (floorStockOptions.some((opt) => opt.id.toLowerCase() === key)) return true;
    return rawItems.some((item) => (item.item_name || "").toLowerCase().trim() === key);
  };

  const editItemOptions = useMemo(() => {
    const names = new Set<string>();
    masterItemOptions.forEach((opt) => names.add(opt.id));
    (masterCatalog || []).forEach((item) => {
      const name = item.item_name?.trim();
      if (name) names.add(name);
    });
    rawItems.forEach((item) => {
      const name = item.item_name?.trim();
      if (name) names.add(name);
    });
    if (editForm.item_name.trim()) names.add(editForm.item_name.trim());
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, label: name }));
  }, [masterItemOptions, masterCatalog, rawItems, editForm.item_name]);

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

function parseDateStr(dStr: string) {
  if (!dStr) return 0;
  let ts = Date.parse(dStr);
  if (!isNaN(ts)) return ts;
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) {
      ts = Date.parse(`${y}-${m}-${d}`);
      if (!isNaN(ts)) return ts;
    }
  }
  return 0;
}

  const filteredRawItems = useMemo(() => {
    // First calculate running stock for all rawItems
    const sortedAll = [...rawItems].sort((a, b) => {
      const timeA = parseDateStr(a.date || a.updated_at || "");
      const timeB = parseDateStr(b.date || b.updated_at || "");
      return timeA - timeB;
    });
    const stockMap = new Map<string, number>();
    
    const itemsWithRunningStock = sortedAll.map(item => {
      const key = item.item_name.toLowerCase().trim();
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      const current = (stockMap.get(key) || 0) + (inVal - outVal);
      stockMap.set(key, current);
      return { ...item, running_stock: current };
    });

    const itemsWithTransfer = attachSfgTransferStatus(itemsWithRunningStock);

    // Reverse to show latest entry on top
    itemsWithTransfer.reverse();

    if (!dateRange) return itemsWithTransfer;
    return itemsWithTransfer.filter(item => {
      const ts = parseDateStr(item.date || item.updated_at || "");
      if (!ts) return false;
      const itemDate = new Date(ts);
      return isWithinInterval(itemDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [rawItems, dateRange]);

  const allTimeStockMap = useMemo(() => {
    const map = new Map<string, number>();
    rawItems.forEach(item => {
      const key = item.item_name?.toLowerCase().trim();
      if (!key) return;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      map.set(key, (map.get(key) || 0) + inVal - outVal);
    });
    return map;
  }, [rawItems]);

  // AGGREGATION LOGIC
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, FloorIMS>();
    filteredRawItems.forEach(item => {
      const key = item.item_name?.toLowerCase().trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          ...item,
          item_name: (item.item_name ?? "").trim(),
          category: (item.category ?? "").trim(),
          in_qty: "0",
          out_qty: "0",
          live_stock: allTimeStockMap.get(key) || 0,
        });
      }
      const agg = map.get(key)!;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      agg.in_qty = (parseFloat(agg.in_qty) + inVal).toString();
      agg.out_qty = (parseFloat(agg.out_qty) + outVal).toString();
      
      const ts = parseDateStr(item.updated_at || item.date || "");
      const aggTs = parseDateStr(agg.updated_at || agg.date || "");
      if (ts > aggTs) {
        agg.updated_at = item.updated_at;
        agg.date = item.date;
        agg.packed_status = item.packed_status || agg.packed_status;
        if (item.category) agg.category = item.category.trim();
      }
    });

    const gFloorByName = new Map<string, any>();
    masterItems.forEach((item: any) => {
      const key = (item.item_name || "").trim().toLowerCase();
      if (key && !gFloorByName.has(key)) gFloorByName.set(key, item);
    });
    const catalogByName = indexMasterByName(masterCatalog || []);

    return Array.from(map.values())
      .map((row): FloorAggItem => {
        const gFloor = gFloorByName.get(row.item_name.toLowerCase().trim());
        const overlaid = overlayFromMaster(row, catalogByName.get(masterItemKey(row.item_name)), {
          lead_time: row.lead_time || DEFAULT_LEAD,
          safety_factor: row.safety_factor || DEFAULT_SF,
        });
        const inQty = parseFloat(String(overlaid.in_qty)) || 0;
        const outQty = parseFloat(String(overlaid.out_qty)) || 0;
        const avg = parseFloat(String(gFloor?.avg_daily_con ?? 0)) || 0;
        const max_level = Number((avg * overlaid.lead_time * overlaid.safety_factor).toFixed(2));
        return {
          ...overlaid,
          sale_percent: inQty > 0 ? Number(((outQty / inQty) * 100).toFixed(1)) : 0,
          avg_daily_con: avg,
          max_level,
        };
      })
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [filteredRawItems, allTimeStockMap, masterItems, masterCatalog]);

  const uniqueCategories = useMemo(() => {
    return Array.from(
      new Set(aggregatedItems.map((i) => (i.category ?? "").trim()).filter(Boolean))
    ).sort();
  }, [aggregatedItems]);

  const categoryOptions = useMemo(
    () => uniqueCategories.map((cat) => ({ id: cat as string, label: cat as string })),
    [uniqueCategories]
  );

  const uniqueItemNames = useMemo(() => {
    const source =
      categoryFilters.length > 0
        ? aggregatedItems.filter((i) =>
            matchesCategoryItemFilters(i, categoryFilters, [])
          )
        : aggregatedItems;
    return Array.from(new Set(source.map((i) => i.item_name))).filter(Boolean).sort();
  }, [aggregatedItems, categoryFilters]);

  const itemNameOptions = useMemo(
    () => uniqueItemNames.map((name) => ({ id: name, label: name })),
    [uniqueItemNames]
  );

  const filteredItems = useMemo(() => {
    return aggregatedItems.filter(item => {
      const matchesPacked = packedFilter === 'ALL' || 
                            (packedFilter === 'PACKED' && item.packed_status === 'PACKED') ||
                            (packedFilter === 'UNPACKED' && item.packed_status === 'UNPACKED');
      if (!matchesPacked || !matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)) return false;
      if (!matchesActiveFilter(item.active_status, activeFilter)) return false;
      if (legendFilter !== null) {
        return getLegendBucket(item.live_stock || 0, item.max_level || 0) === legendFilter;
      }
      return true;
    });
  }, [aggregatedItems, packedFilter, categoryFilters, itemNameFilters, legendFilter, activeFilter]);

  const bucketCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    aggregatedItems.forEach((item) => {
      counts[getLegendBucket(item.live_stock || 0, item.max_level || 0) as keyof typeof counts]++;
    });
    return counts;
  }, [aggregatedItems]);

  const filteredDatewiseItems = useMemo(() => {
    return filteredRawItems.filter((item) => {
      if (!matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)) return false;
      if (!matchesActiveFilter(item.active_status, activeFilter)) return false;
      if (showPacked && packedFilter !== 'ALL') {
        if (packedFilter === 'PACKED' && item.packed_status !== 'PACKED') return false;
        if (packedFilter === 'UNPACKED' && item.packed_status !== 'UNPACKED') return false;
      }
      if (isSfg && transferFilter !== 'ALL') {
        const status = (item as FloorTxItem).transfer_status;
        if (transferFilter === 'TRANSFERRED') return status === 'TRANSFERRED';
        if (transferFilter === 'PENDING') return status === 'PENDING' || status === 'PARTIAL';
      }
      if (checkedFilter === 'CHECKED') return isItemChecked(item);
      if (checkedFilter === 'UNCHECKED') return !isItemChecked(item);
      return true;
    });
  }, [filteredRawItems, categoryFilters, itemNameFilters, checkedFilter, activeFilter, packedFilter, transferFilter, showPacked, isSfg]);

  const filteredTimeSeriesTransactions = useMemo(() => {
    return rawItems
      .filter((item) =>
        matchesCategoryItemFilters(item, categoryFilters, itemNameFilters) &&
        matchesActiveFilter(item.active_status, activeFilter)
      )
      .map(item => ({
        item_name: item.item_name,
        category: item.category,
        date: item.date || item.updated_at || '',
        in_qty: parseFloat(item.in_qty) || 0,
        out_qty: parseFloat(item.out_qty) || 0,
        source: firstFloorSourceLabel(item) === "SFG"
          ? "SFG" as const
          : location === "1st"
            ? "1stFloor" as const
            : location === "sfg"
              ? "SFG" as const
              : undefined,
      }));
  }, [rawItems, categoryFilters, itemNameFilters, activeFilter]);

  const masterCategories = useMemo(() => {
    return Array.from(new Set([
      ...masterItems.map((i: any) => i.category),
      ...(masterCatalog || []).map((i) => i.category),
    ])).filter(Boolean);
  }, [masterItems, masterCatalog]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const datewiseTotalPages = Math.ceil(filteredDatewiseItems.length / itemsPerPage);
  const datewiseItemsWithUid = useMemo(
    () => uniquifyByBaseId(filteredDatewiseItems, (item, index) => String(item.id ?? "").trim() || `noid-${index}`),
    [filteredDatewiseItems]
  );
  const paginatedDatewiseItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return datewiseItemsWithUid.slice(start, start + itemsPerPage);
  }, [datewiseItemsWithUid, currentPage]);

  const transactionLogs = useMemo(() => {
    if (!selectedLogItem) return [];
    return rawItems
      .filter(i => i.item_name?.toLowerCase().trim() === selectedLogItem.toLowerCase().trim())
      .reverse(); // latest first
  }, [rawItems, selectedLogItem]);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedVerifyIds([]);
  }, [packedFilter, categoryFilters, itemNameFilters, checkedFilter, transferFilter, viewMode, filterPeriod, filterDate, filterStartDate, filterEndDate, legendFilter, activeFilter]);

  React.useEffect(() => {
    setSelectedVerifyIds([]);
  }, [currentPage]);

  React.useEffect(() => {
    setItemNameFilters((prev) => {
      if (prev.length === 0) return prev;
      const valid = new Set(uniqueItemNames);
      const next = prev.filter((name) => valid.has(name));
      return next.length === prev.length ? prev : next;
    });
  }, [categoryFilters, uniqueItemNames]);

  const getHealthColors = (live: number) => {
    if (live < 0) return { color: "bg-gray-400", text: "text-gray-500", label: "Negative" };
    if (live === 0) return { color: "bg-rose-500", text: "text-rose-600", label: "Stockout" };
    return { color: "bg-emerald-500", text: "text-emerald-600", label: "In Stock" };
  };

  const handleBulkRowChange = (id: string, field: keyof BulkRow, value: string) => {
    setBulkRows(prev => prev.map(row => {
      if (row.id === id) {
        const newRow = { ...row, [field]: value };
        if (field === "item_name") {
          const floorItem = (isSfgTransfer ? sfgSourceItems : rawItems).find((i) => i.item_name?.toLowerCase().trim() === value.toLowerCase().trim());
          const masterItem = masterItems.find((i: any) => i.item_name?.toLowerCase() === value.toLowerCase());
          newRow.category = floorItem?.category || masterItem?.category || newRow.category;
          if (isSfgTransfer && value) {
            const stock = sfgStockMap.get(value.toLowerCase().trim()) || 0;
            if (!row.qty && stock > 0) newRow.qty = String(roundQty(stock));
          } else if (isFirst && (row.type === "OUT" || newRow.type === "OUT") && value) {
            const stock = allTimeStockMap.get(value.toLowerCase().trim()) || 0;
            if (!row.qty && stock > 0) newRow.qty = String(roundQty(stock));
          }
        }
        return newRow;
      }
      return row;
    }));
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, { id: Date.now().toString(), item_name: '', category: '', type: isSfgTransfer || !allowManualIn ? 'OUT' : 'IN', qty: '', date: '', packed_status: isSfgTransfer ? 'PACKED' : '' }]);
  };

  const removeBulkRow = (id: string) => {
    setBulkRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveItem = async () => {
    // Bulk Save Logic - Ledger Style Append Only
    for (const row of bulkRows) {
      if (!row.item_name || !row.qty || parseFloat(row.qty) <= 0) {
        showStatus("Please fill all fields and ensure qty > 0", "error");
        return;
      }
      if (!getBulkItemOptions(row).some((opt) => opt.id.toLowerCase() === row.item_name.toLowerCase().trim())) {
        showStatus(
          isSfgTransfer
            ? "Please select an item that still has stock pending transfer from SFG"
            : isFirst && row.type === "OUT"
            ? "Please select an item that still has stock on 1st Floor (including SFG In)"
            : "Please select a valid item from the master list",
          "error"
        );
        return;
      }
    }
    setSubmitting(true);
    showStatus("Processing entries...", "loading");

    try {
      const today = new Date().toISOString().split('T')[0];

      const items: Partial<FloorIMS>[] = bulkRows.map((row) => {
        const qty = parseFloat(row.qty) || 0;
        const type = isSfgTransfer ? "OUT" : row.type;
        return {
          item_name: row.item_name.trim(),
          category: row.category,
          in_qty: type === "IN" ? qty.toString() : "0",
          out_qty: type === "OUT" ? qty.toString() : "0",
          date: row.date || today,
          packed_status: isSfgTransfer ? (row.packed_status || "PACKED") : (row.packed_status || ""),
          updated_at: new Date().toISOString(),
        };
      });

      const postLocation = isSfgTransfer ? "sfg" : location;
      const res = await fetch(`/api/ims/floor?location=${postLocation}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Save failed");
      mutate();
      globalMutate("/api/ims/floor?location=sfg");
      globalMutate("/api/ims/floor?location=1st");
      globalMutate("/api/ims");
      globalMutate("/api/ims/summary");
      globalMutate("/api/ims/time-series");
      setItemModalOpen(false);
      setSfgTransferMode(false);
      setBulkRows([]);
      showStatus("Records Saved Successfully!", "success");
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } catch(e) {
      showStatus("Error saving records.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getItemLiveStockAndCategory = (itemName: string) => {
    let totalIn = 0;
    let totalOut = 0;
    let category = '';
    rawItems.forEach((i) => {
      if (i.item_name?.toLowerCase().trim() === itemName.toLowerCase().trim()) {
        totalIn += parseFloat(i.in_qty) || 0;
        totalOut += parseFloat(i.out_qty) || 0;
        category = i.category || category;
      }
    });
    if (!category) {
      const masterItem = masterItems.find(
        (i: any) => i.item_name?.toLowerCase().trim() === itemName.toLowerCase().trim()
      );
      category = masterItem?.category || '';
    }
    return { live_stock: roundQty(totalIn - totalOut), category };
  };

  const addAuditRow = () => {
    setAuditRows(prev => [...prev, { id: Date.now().toString(), item_name: '', category: '', live_stock: 0, physical_qty: '', diff_qty: 0, diff_type: 'NONE' }]);
  };

  const removeAuditRow = (id: string) => {
    setAuditRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAuditRowChange = (id: string, field: keyof AuditRow, value: string) => {
    setAuditRows(prev => prev.map(row => {
      if (row.id === id) {
        const newRow = { ...row, [field]: value };
        if (field === "item_name") {
          const { live_stock, category } = getItemLiveStockAndCategory(value);
          newRow.category = category;
          newRow.live_stock = live_stock;
          
          // Recalculate difference immediately
          if (newRow.physical_qty) {
            const phys = roundQty(parseFloat(newRow.physical_qty) || 0);
            const { diff_qty, diff_type } = computeAuditDiff(phys, newRow.live_stock);
            newRow.diff_qty = diff_qty;
            newRow.diff_type = diff_type;
          }
        }
        if (field === "physical_qty") {
          const phys = parseFloat(value);
          if (!isNaN(phys)) {
            const { diff_qty, diff_type } = computeAuditDiff(phys, row.live_stock);
            newRow.diff_qty = diff_qty;
            newRow.diff_type = diff_type;
          } else {
            newRow.diff_qty = 0;
            newRow.diff_type = 'NONE';
          }
        }
        return newRow;
      }
      return row;
    }));
  };

  const handleAuditPaste = () => {
    if (!auditPasteText.trim()) {
      showStatus("Paste your data first (Item Name and Physical Qty)", "error");
      return;
    }

    const lines = auditPasteText.split('\n').map((line) => line.trim()).filter(Boolean);
    const newRows: AuditRow[] = [];
    const errors: string[] = [];

    lines.forEach((line, idx) => {
      let parts = line.split('\t');
      if (parts.length < 2 && line.includes(',')) {
        parts = line.split(',').map((part) => part.trim());
      }

      if (parts.length < 2) {
        errors.push(`Line ${idx + 1}: need Item Name and Physical Qty`);
        return;
      }

      if (/item\s*name/i.test(parts[0]) && /qty|physical/i.test(parts[1])) return;

      const itemName = parts[0].trim();
      const physicalQtyRaw = parts[1].trim();
      const physicalQty = physicalQtyRaw === '' ? NaN : parseFloat(physicalQtyRaw);

      if (!itemName) return;

      if (!isValidMasterItemName(itemName)) {
        errors.push(`Line ${idx + 1}: "${itemName}" not in master list`);
        return;
      }

      if (isNaN(physicalQty)) {
        errors.push(`Line ${idx + 1}: invalid physical qty`);
        return;
      }

      const { live_stock, category } = getItemLiveStockAndCategory(itemName);
      const { diff_qty, diff_type } = computeAuditDiff(physicalQty, live_stock);
      if (diff_type === 'NONE') return;

      newRows.push({
        id: `${Date.now()}-${idx}`,
        item_name: itemName,
        category,
        live_stock,
        physical_qty: String(roundQty(physicalQty)),
        diff_qty,
        diff_type,
        fromPaste: true,
      });
    });

    if (newRows.length === 0) {
      showStatus(
        errors.length > 0
          ? errors.slice(0, 2).join(' · ')
          : "No valid rows found. Use: Item Name and Physical Qty",
        "error"
      );
      return;
    }

    setAuditRows((prev) => {
      const hasOnlyEmpty = prev.length === 1 && !prev[0].item_name && !prev[0].physical_qty && !prev[0].fromPaste;
      return hasOnlyEmpty ? newRows : [...prev, ...newRows];
    });
    setAuditPasteText("");

    if (errors.length > 0) {
      showStatus(`Loaded ${newRows.length} row(s). Skipped: ${errors.slice(0, 2).join(' · ')}`, "error");
    } else {
      showStatus(`Loaded ${newRows.length} adjustment row(s)`, "success");
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    }
  };

  const handleSaveAudit = async () => {
    const validRows = auditRows.filter(
      (r) =>
        r.item_name &&
        r.diff_type !== 'NONE' &&
        r.diff_qty > 0 &&
        (r.fromPaste || r.physical_qty)
    );

    if (validRows.some((row) => !isValidMasterItemName(row.item_name))) {
      showStatus("Please select a valid item from the master list", "error");
      return;
    }
    
    if (validRows.length === 0) {
      showStatus("No valid differences to apply. Add items with physical quantities that differ from live stock.", "error");
      return;
    }

    setSubmitting(true);
    showStatus("Processing stock adjustments...", "loading");

    try {
      const today = new Date().toISOString().split('T')[0];

      const items: Partial<FloorIMS>[] = validRows.map((row) => ({
        item_name: row.item_name.trim(),
        category: row.category,
        in_qty: row.diff_type === 'IN' ? String(roundQty(row.diff_qty)) : "0",
        out_qty: row.diff_type === 'OUT' ? String(roundQty(row.diff_qty)) : "0",
        date: today,
        updated_at: new Date().toISOString(),
      }));

      const res = await fetch(`/api/ims/floor?location=${location}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Save failed");
      mutate();
      setIsAuditModalOpen(false);
      setAuditRows([]);
      setAuditPasteText("");
      showStatus("Physical Stock Reconciled!", "success");
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } catch(e) {
      showStatus("Error saving adjustments.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isStoredFloorLog = (id: string | number) => !String(id).startsWith("outform-");
  const canEditDeleteLog = (id: string | number) =>
    isStoredFloorLog(id) && !isSfgVirtualGrnId(id) && !isSfgToFirstVirtualId(id);
  const canVerifyLog = (id: string | number) => isStoredFloorLog(id);

  const toggleVerifySelection = (id: string) => {
    setSelectedVerifyIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleMarkChecked = async () => {
    const ids = selectedVerifyIds
      .map((uid) => datewiseItemsWithUid.find((item) => item.row_uid === uid))
      .filter((item): item is (typeof datewiseItemsWithUid)[number] => {
        if (!item) return false;
        const id = String(item.id);
        return canVerifyLog(id) && !isItemChecked(item);
      })
      .map((item) => String(item.id));

    if (ids.length === 0) {
      showStatus("Select unchecked entries to mark as checked", "error");
      return;
    }

    setSubmitting(true);
    showStatus(`Marking ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} as checked...`, "loading");

    try {
      const res = await fetch(`/api/ims/floor?location=${location}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (res.ok) {
        mutate();
        setSelectedVerifyIds([]);
        showStatus("Marked as checked!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to mark checked");
      }
    } catch (e) {
      showStatus("Error marking entries as checked.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditLog = (log: FloorIMS) => {
    const inQty = parseFloat(log.in_qty) || 0;
    const outQty = parseFloat(log.out_qty) || 0;
    setEditingLog(log);
    setEditForm({
      type: outQty > 0 ? 'OUT' : 'IN',
      qty: (outQty > 0 ? outQty : inQty).toString(),
      item_name: log.item_name || "",
      category: log.category || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    const qty = parseFloat(editForm.qty);
    if (!editForm.item_name.trim()) {
      showStatus("Please select an item name", "error");
      return;
    }
    if (!editItemOptions.some((opt) => opt.id.toLowerCase() === editForm.item_name.trim().toLowerCase())) {
      showStatus("Please select a valid item from the list", "error");
      return;
    }
    if (!editForm.qty || isNaN(qty) || qty <= 0) {
      showStatus("Please enter a valid quantity greater than 0", "error");
      return;
    }

    setSubmitting(true);
    showStatus("Updating transaction...", "loading");

    try {
      const payload: FloorIMS = {
        ...editingLog,
        item_name: editForm.item_name.trim(),
        category: editForm.category || editingLog.category,
        in_qty: editForm.type === 'IN' ? qty.toString() : "0",
        out_qty: editForm.type === 'OUT' ? qty.toString() : "0",
        updated_at: new Date().toISOString(),
      };

      const res = await fetch(`/api/ims/floor?location=${location}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        mutate();
        setIsEditModalOpen(false);
        setEditingLog(null);
        showStatus("Transaction Updated Successfully!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to update");
      }
    } catch (e) {
      showStatus("Error updating transaction.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    setSubmitting(true);
    showStatus(`Deleting transaction...`, "loading");
    try {
      const res = await fetch(`/api/ims/floor?location=${location}&id=${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        mutate();
        showStatus("Transaction Deleted Successfully!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to delete");
      }
    } catch (e) {
      showStatus("Error deleting transaction.", "error");
    } finally {
      setSubmitting(false);
      setPendingDeleteId(null);
      setIsConfirmOpen(false);
    }
  };

  const handleExport = () => {
    let headers: string[];
    let rows: any[][];

    if (viewMode === 'datewise') {
      headers = ["Date", "Category", "Item Name", "In Qty", "Out Qty", "Live Stock"];
      if (showPacked) headers.push("Packed Status");
      if (isSfg) headers.push("Transfer Status");
      rows = filteredDatewiseItems.map(log => {
        const row: any[] = [
          formatDate(log.date || log.updated_at),
          log.category,
          log.item_name,
          log.in_qty !== "0" && log.in_qty !== "" ? `+${log.in_qty}` : "-",
          log.out_qty !== "0" && log.out_qty !== "" ? `-${log.out_qty}` : "-",
          (log as FloorTxItem).running_stock
        ];
        if (showPacked) row.push(log.packed_status || "—");
        if (isSfg) row.push((log as FloorTxItem).transfer_status || "—");
        return row;
      });
    } else {
      headers = ["SKU", "Category", "Item Name", "Active/Inactive", "Stock Health", "Max", "IN Qty", "OUT Qty", "Sale %", "Avg. Con", "Lead", "SF"];
      if (showPacked) headers.push("Status");
      rows = filteredItems.map((item) => {
        const row: any[] = [
          item.sku_code || "—",
          item.category,
          item.item_name,
          item.active_status || "—",
          item.live_stock,
          item.max_level,
          item.in_qty,
          item.out_qty,
          `${item.sale_percent}%`,
          item.avg_daily_con || "—",
          item.lead_time,
          item.safety_factor,
        ];
        if (showPacked) row.push(item.packed_status || "—");
        return row;
      });
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ims_${location}_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const title = location === "sfg" ? "SFG IMS" : location === "1st" ? "IMS - 1st Floor" : "IMS - G Floor";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex flex-col h-[calc(100vh-4rem)] p-2 gap-2">
      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={statusType}
        message={statusMessage}
        onClose={() => setIsStatusModalOpen(false)}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#1f2937] dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"
            title="Back to IMS Hub"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-lg ${location === '1st' ? 'bg-gradient-to-br from-purple-600 to-fuchsia-800 shadow-purple-900/20' : 'bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-900/20'}`}>
              <ClipboardDocumentListIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-black uppercase tracking-tight leading-none mb-1 ${location === '1st' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{title}</h1>
              <p className={`text-[10px] font-black uppercase tracking-widest ${location === '1st' ? 'text-purple-600/70 dark:text-purple-400/70' : 'text-emerald-600/70 dark:text-emerald-400/70'}`}>Inventory Management System</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl shrink-0 self-start lg:self-auto">
          <button
            onClick={() => setViewMode('default')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'default' 
                ? `bg-white dark:bg-[#111827] shadow-sm ${location === '1st' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <TableCellsIcon className="w-4 h-4" /> Default
          </button>
          <button
            onClick={() => setViewMode('timeseries')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'timeseries' 
                ? 'bg-white dark:bg-[#111827] text-[#003875] dark:text-[#FFD500] shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <ChartBarIcon className="w-4 h-4" /> Time Series
          </button>
          <button
            onClick={() => setViewMode('datewise')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'datewise' 
                ? `bg-white dark:bg-[#111827] shadow-sm ${location === '1st' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <CalendarIcon className="w-4 h-4" /> Date-Wise
          </button>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">

          <button onClick={handleExport} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border shadow-sm whitespace-nowrap ${
            location === '1st' 
              ? 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
              : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
          }`}>
            <ArrowDownTrayIcon className="w-4 h-4" /> Export
          </button>
          {!isSfg && (
          <button onClick={() => {
            setAuditRows([]);
            setAuditPasteText("");
            setIsAuditModalOpen(true);
            addAuditRow(); // start with one empty row
          }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm border ${
            location === '1st' 
              ? 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30' 
              : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
          }`}>
            <ClipboardDocumentCheckIcon className="w-4 h-4" /> Physical Check
          </button>
          )}
          {isFirst && (
          <button
            onClick={() => {
              setSfgTransferMode(true);
              setBulkRows([{ id: Date.now().toString(), item_name: '', category: '', type: 'OUT', qty: '', date: '', packed_status: 'PACKED' }]);
              setItemModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-[11px] font-black uppercase tracking-widest transition-all shadow-md hover:-translate-y-0.5 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700"
          >
            <PlusIcon className="w-4 h-4 stroke-2" /> SFG In
          </button>
          )}
          {!isSfg && (
          <button
            onClick={() => {
              setSfgTransferMode(false);
              setBulkRows([{ id: Date.now().toString(), item_name: '', category: '', type: allowManualIn ? 'IN' : 'OUT', qty: '', date: '', packed_status: '' }]);
              setItemModalOpen(true);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-[11px] font-black uppercase tracking-widest transition-all shadow-md hover:-translate-y-0.5 whitespace-nowrap ${
              location === '1st' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <PlusIcon className="w-4 h-4 stroke-2" /> Add Log
          </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-2 mb-2 shrink-0">
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
          theme={location === '1st' ? 'purple' : 'emerald'}
          className="shrink-0"
        />

        <div className={`flex flex-wrap items-end gap-2 flex-1 min-w-[280px] p-2 bg-white dark:bg-[#111827] border rounded-xl shadow-sm ${
          location === '1st' ? 'border-purple-200 dark:border-purple-500/20' : 'border-emerald-200 dark:border-emerald-500/20'
        }`}>
          <div className="flex-1 min-w-[130px]">
            <SearchableMultiSelect
              options={categoryOptions}
              value={categoryFilters}
              onChange={setCategoryFilters}
              placeholder="All Categories"
              className="bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 py-2 px-3 rounded-lg"
              accentClass={location === '1st' ? 'border-purple-500 ring-purple-500/20' : 'border-emerald-500 ring-emerald-500/20'}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <SearchableMultiSelect
              options={itemNameOptions}
              value={itemNameFilters}
              onChange={setItemNameFilters}
              placeholder="All Items"
              className="bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 py-2 px-3 rounded-lg"
              accentClass={location === '1st' ? 'border-purple-500 ring-purple-500/20' : 'border-emerald-500 ring-emerald-500/20'}
            />
          </div>
          {showPacked && (
            <select
              value={packedFilter}
              onChange={(e) => setPackedFilter(e.target.value as 'ALL' | 'PACKED' | 'UNPACKED')}
              className="px-3 py-2 bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg text-[11px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-purple-500 dark:text-white shadow-sm h-[42px] cursor-pointer shrink-0"
            >
              <option value="ALL">All Packed</option>
              <option value="PACKED">PACKED</option>
              <option value="UNPACKED">UNPACKED</option>
            </select>
          )}
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as ActiveStatusFilter)}
            className={`px-3 py-2 bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg text-[11px] font-black uppercase tracking-wider outline-none dark:text-white shadow-sm h-[42px] cursor-pointer shrink-0 ${
              location === '1st' ? 'focus:ring-2 focus:ring-purple-500' : 'focus:ring-2 focus:ring-emerald-500'
            }`}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {viewMode === 'datewise' && isSfg && (
            <select
              value={transferFilter}
              onChange={(e) => setTransferFilter(e.target.value as TransferFilter)}
              className="px-3 py-2 bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg text-[11px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-sm h-[42px] cursor-pointer shrink-0"
            >
              <option value="ALL">ALL TRANSFERS</option>
              <option value="PENDING">PENDING TRANSFER</option>
              <option value="TRANSFERRED">TRANSFERRED</option>
            </select>
          )}
          {viewMode === 'datewise' && (
            <select
              value={checkedFilter}
              onChange={(e) => setCheckedFilter(e.target.value as 'ALL' | 'CHECKED' | 'UNCHECKED')}
              className={`px-3 py-2 bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg text-[11px] font-black uppercase tracking-wider outline-none dark:text-white shadow-sm h-[42px] cursor-pointer shrink-0 ${
                location === '1st' ? 'focus:ring-2 focus:ring-purple-500' : 'focus:ring-2 focus:ring-emerald-500'
              }`}
            >
              <option value="ALL">ALL CHECKS</option>
              <option value="CHECKED">CHECKED</option>
              <option value="UNCHECKED">UNCHECKED</option>
            </select>
          )}
          {(categoryFilters.length > 0 || itemNameFilters.length > 0 || checkedFilter !== 'ALL' || activeFilter !== 'ALL' || transferFilter !== 'ALL') && (
            <button
              onClick={() => {
                setCategoryFilters([]);
                setItemNameFilters([]);
                setCheckedFilter('ALL');
                setActiveFilter('ALL');
                setTransferFilter('ALL');
              }}
              className={`mb-0.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 border ${
                location === '1st'
                  ? 'text-purple-700 dark:text-purple-400 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 border-purple-200 dark:border-purple-500/20'
                  : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/20'
              }`}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {viewMode === 'default' && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full bg-white dark:bg-[#111827] px-3 py-2 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <ExclamationTriangleIcon className={`w-4 h-4 ${location === '1st' ? 'text-purple-500' : 'text-emerald-500'}`} />
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
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0 mt-2">
          {filteredDatewiseItems.length > 0 && !isLoading && (
            <div className={`py-2 px-4 border-b flex items-center justify-between shrink-0 gap-3 flex-wrap ${location === '1st' ? 'border-purple-200/50 dark:border-purple-500/10 bg-purple-50/50 dark:bg-purple-500/5' : 'border-emerald-200/50 dark:border-emerald-500/10 bg-emerald-50/50 dark:bg-emerald-500/5'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <p className={`text-[10px] font-black uppercase tracking-widest ${location === '1st' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredDatewiseItems.length)} to {Math.min(currentPage * itemsPerPage, filteredDatewiseItems.length)} of {filteredDatewiseItems.length} transactions
                </p>
                {selectedVerifyIds.length > 0 && (
                  <button
                    onClick={handleMarkChecked}
                    disabled={submitting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-sm disabled:opacity-50 ${
                      location === '1st' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <CheckIcon className="w-4 h-4" />
                    Checked ({selectedVerifyIds.length})
                  </button>
                )}
              </div>
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
                <thead className={`sticky top-0 z-20 shadow-sm ${location === '1st' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                  <tr>
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-center w-10 ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}></th>
                    <th className={`py-2.5 px-4 text-[10px] font-black uppercase tracking-widest border-b ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Date</th>
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Category</th>
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Item Name</th>
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>In</th>
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Out</th>
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Live Stock</th>
                    {showPacked && (
                      <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-center ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Status</th>
                    )}
                    {isSfg && (
                      <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-center text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20">Transfer</th>
                    )}
                    {location === "1st" && (
                      <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-center text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20">Source</th>
                    )}
                    <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-center ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Checked</th>
                    <th className={`py-2.5 px-4 text-[10px] font-black uppercase tracking-widest border-b text-center w-24 ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Act</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${location === '1st' ? 'divide-purple-100 dark:divide-purple-500/10' : 'divide-emerald-100 dark:divide-emerald-500/10'}`}>
                  {paginatedDatewiseItems.map((log) => {
                    const checked = isItemChecked(log);
                    const canVerify = canVerifyLog(log.id);
                    const isSelected = selectedVerifyIds.includes(log.row_uid);
                    const transferStatus = (log as FloorTxItem).transfer_status;
                    return (
                    <tr
                      key={log.row_uid}
                      className={`transition-colors group ${
                        checked
                          ? location === '1st'
                            ? 'bg-purple-50/70 dark:bg-purple-500/10 hover:bg-purple-50 dark:hover:bg-purple-500/15'
                            : 'bg-emerald-50/70 dark:bg-emerald-500/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/15'
                          : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                      } ${isSelected ? (location === '1st' ? 'ring-1 ring-inset ring-purple-300 dark:ring-purple-500/40' : 'ring-1 ring-inset ring-emerald-300 dark:ring-emerald-500/40') : ''}`}
                    >
                      <td className="py-2 px-3 text-center">
                        {canVerify && !checked ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleVerifySelection(log.row_uid)}
                            className={`w-4 h-4 rounded border-gray-300 cursor-pointer ${
                              location === '1st' ? 'text-purple-600 focus:ring-purple-500' : 'text-emerald-600 focus:ring-emerald-500'
                            }`}
                          />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-[11px] font-bold text-gray-500">{formatDate(log.date || log.updated_at)}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-500 uppercase">{log.category}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase">{log.item_name}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-right">{log.in_qty !== "0" && log.in_qty !== "" ? `+${log.in_qty}` : "-"}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">{log.out_qty !== "0" && log.out_qty !== "" ? `-${log.out_qty}` : "-"}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-[#003875] dark:text-[#FFD500] text-right">{(log as any).running_stock}</td>
                      {showPacked && (
                        <td className="py-2 px-3 text-center">
                          {log.packed_status === 'PACKED' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-md text-[9px] font-black uppercase">Packed</span>
                          ) : log.packed_status === 'UNPACKED' ? (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-md text-[9px] font-black uppercase">Unpacked</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                      )}
                      {isSfg && (
                        <td className="py-2 px-3 text-center">
                          {transferStatus === 'TRANSFERRED' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-md text-[9px] font-black uppercase">Transferred</span>
                          ) : transferStatus === 'PARTIAL' ? (
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400 rounded-md text-[9px] font-black uppercase" title={`${formatQty((log as FloorTxItem).transfer_pending_qty || 0)} still pending`}>
                              Partial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 rounded-md text-[9px] font-black uppercase">Pending</span>
                          )}
                        </td>
                      )}
                      {location === "1st" && (
                        <td className="py-2 px-3 text-center">
                          {firstFloorSourceLabel(log) === "SFG" ? (
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 rounded-md text-[9px] font-black uppercase">SFG</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded-md text-[9px] font-black uppercase">1st Floor</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 px-3 text-center">
                        {checked ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            location === '1st'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          }`}>
                            <CheckIcon className="w-3 h-3" />
                            Checked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 rounded-md text-[9px] font-black uppercase">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {canEditDeleteLog(log.id) ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditLog(log)}
                              className={`transition-colors hover:scale-110 ${location === '1st' ? 'text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300' : 'text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300'}`}
                              title="Edit quantity"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(log.id.toString())}
                              className="text-rose-400 hover:text-rose-600 transition-colors hover:scale-110"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {filteredDatewiseItems.length === 0 && (
                    <tr>
                      <td colSpan={showPacked ? (isSfg || location === "1st" ? 11 : 10) : 9} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No items found</td>
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
            transactions={filteredTimeSeriesTransactions}
            bucket={mappedTimeBucket}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0 mt-2">
        {filteredItems.length > 0 && !isLoading && (
          <div className={`py-2 px-4 border-b flex items-center justify-between shrink-0 ${location === '1st' ? 'border-purple-200/50 dark:border-purple-500/10 bg-purple-50/50 dark:bg-purple-500/5' : 'border-emerald-200/50 dark:border-emerald-500/10 bg-emerald-50/50 dark:bg-emerald-500/5'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${location === '1st' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
              <thead className={`sticky top-0 z-20 shadow-sm ${location === '1st' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <tr>
                  <th className={`py-2.5 px-3 border-b text-center sticky left-0 z-30 w-12 ${location === '1st' ? 'border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-900/20 shadow-[1px_0_0_0_#e9d5ff] dark:shadow-[1px_0_0_0_rgba(168,85,247,0.2)]' : 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/20 shadow-[1px_0_0_0_#a7f3d0] dark:shadow-[1px_0_0_0_rgba(16,185,129,0.2)]'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${location === '1st' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>#</span>
                  </th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b whitespace-nowrap ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Category</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b min-w-[200px] ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Item Name</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b whitespace-nowrap ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>SKU</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-center whitespace-nowrap ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Active</th>
                  <th className={`py-2.5 px-4 text-[10px] font-black uppercase tracking-widest border-b text-left w-56 ${location === '1st' ? 'text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20 bg-purple-100/50 dark:bg-purple-500/10' : 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 bg-emerald-100/50 dark:bg-emerald-500/10'}`}>Stock Health</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Max</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>IN Qty</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>OUT Qty</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Sale %</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right whitespace-nowrap ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Avg. Con</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Lead</th>
                  <th className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest border-b text-right ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>SF</th>
                  {showPacked && (
                    <th className={`py-2.5 px-4 text-[10px] font-black uppercase tracking-widest border-b text-center w-24 ${location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>Status</th>
                  )}
                </tr>
              </thead>
              <tbody className={`divide-y ${location === '1st' ? 'divide-purple-100 dark:divide-purple-500/10' : 'divide-emerald-100 dark:divide-emerald-500/10'}`}>
                {paginatedItems.map((item) => {
                  const health = getHealth(item.live_stock || 0, item.max_level || 0);
                  const inQty = parseFloat(String(item.in_qty)) || 0;
                  const outQty = parseFloat(String(item.out_qty)) || 0;
                  return (
                    <tr
                      key={item.item_name}
                      className="hover:bg-gray-50/50 dark:hover:bg-white/[0.03] even:bg-gray-50/50 dark:even:bg-[#1f2937]/30 transition-colors group"
                    >
                      <td className={`py-1 px-2 text-center sticky left-0 z-10 transition-colors border-r bg-white dark:bg-[#111827] ${
                          location === '1st' 
                            ? 'shadow-[1px_0_0_0_#e9d5ff] dark:shadow-[1px_0_0_0_rgba(168,85,247,0.2)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1a2335] border-purple-100 dark:border-purple-500/10' 
                            : 'shadow-[1px_0_0_0_#a7f3d0] dark:shadow-[1px_0_0_0_rgba(16,185,129,0.2)] group-hover:bg-emerald-50/50 dark:group-hover:bg-[#1a2335] border-emerald-100 dark:border-emerald-500/10'
                        }`}>
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { 
                            setSelectedLogItem(item.item_name);
                            setIsLogModalOpen(true);
                          }} className="text-gray-400 hover:text-[#003875] dark:hover:text-[#FFD500] transition-colors" title="View Transactions">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase whitespace-normal break-words min-w-[200px] max-w-[320px] leading-snug">{item.item_name}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase whitespace-nowrap">{item.sku_code || "—"}</td>
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
                            <span className={`text-xs font-black ${health.text}`}>{(item.live_stock || 0).toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase">{health.label}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden flex">
                            <div className={`h-full ${health.color} transition-all duration-500`} style={{ width: `${health.pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-[11px] font-bold text-[#003875] dark:text-[#FFD500] text-right">{item.max_level || "—"}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-right">{inQty !== 0 ? inQty.toLocaleString() : "—"}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 text-right">{outQty !== 0 ? outQty.toLocaleString() : "—"}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 text-right">{item.sale_percent}%</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.avg_daily_con || "—"}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.lead_time}</td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.safety_factor}</td>
                      {showPacked && (
                        <td className="py-2 px-4 text-center">
                          {item.packed_status === 'PACKED' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-md text-[9px] font-black uppercase">Packed</span>
                          ) : item.packed_status === 'UNPACKED' ? (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-md text-[9px] font-black uppercase">Unpacked</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={showPacked ? 14 : 13} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No items found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      <datalist id="category-list">
        {masterCategories.map(cat => (
          <option key={cat} value={cat as string} />
        ))}
      </datalist>

      {/* Transaction Log Modal */}
      <AnimatePresence>
        {isLogModalOpen && selectedLogItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.2)] w-full max-w-4xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#1f2937]/50 shrink-0">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-900 dark:text-white">
                  <EyeIcon className="w-5 h-5 text-gray-400" />
                  Transaction Logs - {selectedLogItem}
                </h3>
                <button onClick={() => setIsLogModalOpen(false)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#111827]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 dark:bg-[#1f2937] sticky top-0 z-20">
                    <tr>
                      <th className="py-2.5 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">Date</th>
                      <th className="py-2.5 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-right">In Qty</th>
                      <th className="py-2.5 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-right">Out Qty</th>
                      <th className="py-2.5 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-center w-20">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {transactionLogs.map((log, index) => (
                      <tr key={`${log.id || "row"}-${index}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className="py-2 px-4 text-[11px] font-bold text-gray-500">{formatDate(log.date || log.updated_at)}</td>
                        <td className="py-2 px-4 text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-right">{log.in_qty !== "0" && log.in_qty !== "" ? `+${log.in_qty}` : "-"}</td>
                        <td className="py-2 px-4 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">{log.out_qty !== "0" && log.out_qty !== "" ? `-${log.out_qty}` : "-"}</td>
                        <td className="py-2 px-4 text-center">
                          {!String(log.id).startsWith("outform-") && (
                            <button onClick={() => confirmDelete(log.id.toString())} className="text-rose-400 hover:text-rose-600 transition-colors">
                              <TrashIcon className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {transactionLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No logs found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Entry Modal */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,56,117,0.3)] dark:shadow-[0_0_40px_rgba(255,213,0,0.1)] w-full max-w-5xl overflow-hidden border border-[#003875]/30 dark:border-[#FFD500]/20 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-blue-800/20 dark:border-white/5 bg-gradient-to-r from-[#003875] to-blue-800 dark:from-[#1f2937] dark:to-[#111827] text-white shrink-0">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-blue-200 dark:text-[#FFD500]" />
                  {isSfgTransfer ? "SFG In — Transfer Packed Stock from SFG" : `Add Multiple Items - ${title}`}
                </h3>
                <button onClick={() => { setItemModalOpen(false); setSfgTransferMode(false); }} className="p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 dark:bg-[#1f2937] rounded-lg shadow-sm transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar bg-white dark:bg-[#111827] flex-1 min-h-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <button 
                    onClick={addBulkRow}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#003875] dark:text-[#FFD500] hover:bg-blue-50 dark:hover:bg-[#FFD500]/10 rounded-lg transition-colors border border-dashed border-[#003875]/30 dark:border-[#FFD500]/30"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add Row
                  </button>
                  {isSfgTransfer && (
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {sfgItemsLoading
                        ? "Loading pending SFG stock..."
                        : sfgPendingItemOptions.length > 0
                        ? "Only items with pending SFG stock are listed. Remaining qty is shown in brackets. Saving books SFG OUT and 1st Floor IN."
                        : "No items are pending transfer from SFG."}
                    </p>
                  )}
                  {isFirst && !isSfgTransfer && (
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      OUT lists 1st Floor live stock, including items received via SFG In. Remaining qty is shown in brackets.
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
                  <table className="w-full text-left border-collapse min-w-[860px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Item Name *</th>
                        <th className={`${thClass} w-32`}>Category</th>
                        <th className={`${thClass} w-28 text-center`}>Type</th>
                        {showPacked && (
                          <th className={`${thClass} w-36 text-center`}>Packed</th>
                        )}
                        <th className={`${thClass} w-24 text-right`}>Qty *</th>
                        <th className={`${thClass} w-36`}>Date</th>
                        <th className={`${thClass} w-10 text-center`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className={tdClass}>
                            <SearchableSelect
                              label=""
                              options={getBulkItemOptions(row)}
                              value={row.item_name}
                              onChange={(val) => handleBulkRowChange(row.id, "item_name", val)}
                              placeholder={
                                isSfgTransfer
                                  ? "Select pending SFG item..."
                                  : isFirst && row.type === "OUT"
                                  ? "Select 1st Floor stock item..."
                                  : "Select item..."
                              }
                              className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-md text-[11px] min-h-[34px]"
                            />
                          </td>
                          <td className={tdClass}>
                            <input
                              type="text"
                              list="category-list"
                              value={row.category}
                              onChange={(e) => handleBulkRowChange(row.id, "category", e.target.value)}
                              className={tableInputClass}
                            />
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-md justify-center">
                              {allowManualIn && !isSfgTransfer && (
                              <button
                                onClick={() => handleBulkRowChange(row.id, "type", "IN")}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${row.type === "IN" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                              >
                                IN
                              </button>
                              )}
                              <button
                                onClick={() => handleBulkRowChange(row.id, "type", "OUT")}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${row.type === "OUT" || isSfgTransfer ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                              >
                                {isSfgTransfer ? "SFG IN" : "OUT"}
                              </button>
                            </div>
                          </td>
                          {showPacked && (
                            <td className={`${tdClass} text-center`}>
                              <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-md justify-center">
                                <button
                                  onClick={() => handleBulkRowChange(row.id, "packed_status", "PACKED")}
                                  className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${row.packed_status === "PACKED" ? "bg-purple-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                                >
                                  PACKED
                                </button>
                                <button
                                  onClick={() => handleBulkRowChange(row.id, "packed_status", "UNPACKED")}
                                  className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${row.packed_status === "UNPACKED" ? "bg-gray-500 text-white shadow-sm dark:bg-gray-600" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                                >
                                  UNPACKED
                                </button>
                              </div>
                            </td>
                          )}
                          <td className={tdClass}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.qty}
                              onChange={(e) => handleBulkRowChange(row.id, "qty", e.target.value)}
                              className={`${tableInputClass} text-right`}
                            />
                          </td>
                          <td className={tdClass}>
                            <input
                              type="date"
                              value={row.date || ""}
                              onChange={(e) => handleBulkRowChange(row.id, "date", e.target.value)}
                              className={tableInputClass}
                            />
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <button
                              onClick={() => removeBulkRow(row.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              title="Remove row"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50 shrink-0">
                <button onClick={() => { setItemModalOpen(false); setSfgTransferMode(false); }} className="px-5 py-2 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors">Cancel</button>
                <button 
                  onClick={handleSaveItem} 
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#003875] to-blue-600 dark:from-[#FFD500] dark:to-yellow-400 dark:text-[#003875] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-blue-500/20 dark:shadow-yellow-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Record(s)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Physical Stock Check (Audit) Modal */}
      <AnimatePresence>
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.3)] w-full max-w-5xl overflow-hidden border flex flex-col max-h-[90vh] ${
                location === '1st' ? 'border-purple-600/30 dark:border-purple-400/20' : 'border-emerald-600/30 dark:border-emerald-400/20'
              }`}
            >
              <div className={`flex items-center justify-between p-5 border-b bg-gradient-to-r text-white shrink-0 ${
                location === '1st' ? 'from-purple-600 to-fuchsia-800 border-purple-800/20' : 'from-emerald-600 to-teal-800 border-emerald-800/20'
              }`}>
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-5 h-5 text-white/90" />
                  Physical Stock Audit
                </h3>
                <button onClick={() => setIsAuditModalOpen(false)} className="p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 dark:bg-[#1f2937] rounded-lg shadow-sm transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar bg-white dark:bg-[#111827] flex-1 min-h-0 space-y-3">
                <div className={`p-3 rounded-lg border border-dashed ${
                  location === '1st'
                    ? 'border-purple-300 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5'
                    : 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5'
                }`}>
                  <div className="flex flex-wrap gap-2 items-start">
                    <textarea
                      value={auditPasteText}
                      onChange={(e) => setAuditPasteText(e.target.value)}
                      rows={3}
                      placeholder={"Item Name\tPhysical Qty\n10 LITE HONOR...\t10\nANS DC W\t25"}
                      className="flex-1 min-w-[200px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-3 py-2 text-[11px] font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#003875] dark:focus:border-[#FFD500] custom-scrollbar"
                    />
                    <button
                      onClick={handleAuditPaste}
                      className={`shrink-0 px-4 py-2 h-fit rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-sm ${
                        location === '1st' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      Load Paste
                    </button>
                  </div>
                </div>

                <button 
                  onClick={addAuditRow}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-dashed ${
                    location === '1st' ? 'text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10' : 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  }`}
                >
                  <PlusIcon className="w-3.5 h-3.5 inline mr-1" /> Add Row
                </button>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Item Name *</th>
                        <th className={`${thClass} w-24 text-right`}>Live Stock</th>
                        <th className={`${thClass} w-28 text-right`}>Physical Qty *</th>
                        <th className={`${thClass} w-32 text-center`}>Adjustment</th>
                        <th className={`${thClass} w-10 text-center`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className={tdClass}>
                            {row.fromPaste ? (
                              <div className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0f1c]">
                                <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase leading-snug break-words" title={row.item_name}>
                                  {row.item_name}
                                </p>
                                {row.category && (
                                  <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5 truncate" title={row.category}>
                                    {row.category}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <SearchableSelect
                                label=""
                                options={isFirst ? firstFloorInOptions : masterItemOptions}
                                value={row.item_name}
                                onChange={(val) => handleAuditRowChange(row.id, "item_name", val)}
                                placeholder="Select item..."
                                className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-md text-[11px] min-h-[34px]"
                              />
                            )}
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <span className={`text-[11px] font-black ${getHealthColors(row.live_stock).text}`}>
                              {formatQty(row.live_stock)}
                            </span>
                          </td>
                          <td className={tdClass}>
                            {row.fromPaste ? (
                              <span className="block text-right text-[11px] font-black text-gray-900 dark:text-white px-2">
                                {row.physical_qty ? formatQty(row.physical_qty) : "-"}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.physical_qty}
                                onChange={(e) => handleAuditRowChange(row.id, "physical_qty", e.target.value)}
                                className={`${tableInputClass} text-right`}
                              />
                            )}
                          </td>
                          <td className={`${tdClass} text-center`}>
                            {row.diff_type === "IN" && (
                              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                IN {formatQty(row.diff_qty)}
                              </span>
                            )}
                            {row.diff_type === "OUT" && (
                              <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">
                                OUT {formatQty(row.diff_qty)}
                              </span>
                            )}
                            {row.diff_type === "NONE" && row.physical_qty && row.item_name && (
                              <span className="text-[10px] font-black uppercase text-gray-500">Matched</span>
                            )}
                            {row.diff_type === "NONE" && (!row.physical_qty || !row.item_name) && (
                              <span className="text-[10px] font-bold text-gray-400">—</span>
                            )}
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <button
                              onClick={() => removeAuditRow(row.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              title="Remove row"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50 shrink-0">
                <button onClick={() => setIsAuditModalOpen(false)} className="px-5 py-2 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors">Cancel</button>
                <button 
                  onClick={handleSaveAudit} 
                  disabled={submitting || auditRows.filter(r => r.diff_type !== 'NONE').length === 0}
                  className={`px-6 py-2 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:brightness-110 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    location === '1st' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-purple-500/20' : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20'
                  }`}
                >
                  {submitting ? 'Applying...' : 'Apply Adjustments'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10"
            >
              <div className={`flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 shrink-0 ${location === '1st' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-900 dark:text-white">
                  <PencilSquareIcon className={`w-5 h-5 ${location === '1st' ? 'text-purple-500' : 'text-emerald-500'}`} />
                  Edit Transaction
                </h3>
                <button
                  onClick={() => { setIsEditModalOpen(false); setEditingLog(null); }}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 bg-white dark:bg-[#111827]">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Item Name</p>
                  <SearchableSelect
                    label=""
                    options={editItemOptions}
                    value={editForm.item_name}
                    onChange={(val) => {
                      const floorItem = rawItems.find((i) => i.item_name?.toLowerCase().trim() === val.toLowerCase().trim());
                      const masterItem = masterItems.find((i: any) => i.item_name?.toLowerCase().trim() === val.toLowerCase().trim());
                      const catalogItem = (masterCatalog || []).find((i) => i.item_name?.toLowerCase().trim() === val.toLowerCase().trim());
                      setEditForm((prev) => ({
                        ...prev,
                        item_name: val,
                        category: floorItem?.category || masterItem?.category || catalogItem?.category || prev.category,
                      }));
                    }}
                    placeholder="Select item..."
                    className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-2 px-3 rounded-lg text-[11px] min-h-[38px]"
                  />
                  <p className="text-[10px] font-bold text-gray-500 uppercase">{editForm.category || editingLog.category} · {formatDate(editingLog.date || editingLog.updated_at)}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                    {allowManualIn && (
                    <button
                      onClick={() => setEditForm(prev => ({ ...prev, type: 'IN' }))}
                      className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${editForm.type === 'IN' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      IN
                    </button>
                    )}
                    <button
                      onClick={() => setEditForm(prev => ({ ...prev, type: 'OUT' }))}
                      className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${editForm.type === 'OUT' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      {isSfg ? "To 1st Floor" : "OUT"}
                    </button>
                  </div>
                  <div className="flex-1">
                    <FloatingInput
                      label="Qty *"
                      name="edit_qty"
                      type="number"
                      step="0.01"
                      value={editForm.qty}
                      icon={HashtagIcon}
                      onChange={(val) => setEditForm(prev => ({ ...prev, qty: val }))}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button
                  onClick={() => { setIsEditModalOpen(false); setEditingLog(null); }}
                  className="px-5 py-2 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={submitting}
                  className={`px-6 py-2 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:brightness-110 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    location === '1st'
                      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-purple-500/20'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20'
                  }`}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
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
        title="Delete Transaction"
        message={`Are you sure you want to completely remove this transaction log from the system? This action cannot be undone.`}
        confirmLabel="Delete"
        type="danger"
      />
    </div>
  );
}
