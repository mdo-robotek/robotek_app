"use client";

import React, { useState, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
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
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  ChartPieIcon,
  CurrencyRupeeIcon,
  EyeIcon,
  ArrowUpTrayIcon,
  ArrowLeftIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckIcon
} from "@heroicons/react/24/outline";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, Legend, LabelList, AreaChart, Area, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts";
import { IMS } from "@/types/ims";
import * as XLSX from "xlsx";
import TimeSeriesTable, { TimeBucket, Transaction } from "@/components/TimeSeriesTable";
import DateFilterBar, { FilterPeriod } from "@/components/DateFilterBar";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { matchesCategoryItemFilters, matchesOptionSearch, normalizeFilterKey } from "@/lib/ims-filters";
import { getDatewiseTxKey, getTxSortTime } from "@/lib/ims-datewise-key";
import { firstFloorOutRowsToGFloorInTxs } from "@/lib/ims-1st-to-g-transfer";
import GFloorLedgerModals from "@/app/(dashboard)/ims/GFloorLedgerModals";
import { FloorIMS } from "@/types/ims-floor";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

const fetcher = (url: string) => fetch(url).then(res => res.json());

const timeSeriesSwrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 120_000,
  keepPreviousData: true,
} as const;

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = date.getDate().toString().padStart(2, '0');
  const m = months[date.getMonth()];
  const y = date.getFullYear().toString().slice(-2);
  return `${d} ${m} ${y}`;
};

const formatTxSourceLabel = (source?: string) => {
  if (source === "GFloor") return "G Floor";
  if (source === "1stFloor") return "1st OUT";
  if (source === "GRN") return "GRN";
  return "O2D";
};

const getTxSourceBadgeClass = (source?: string) => {
  if (source === "GFloor") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (source === "1stFloor") {
    return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300";
  }
  if (source === "GRN") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
  }
  return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
};

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
      className="block px-3 pb-2.5 pt-4 w-full text-sm font-bold text-gray-900 bg-transparent rounded-lg border-2 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-[#FFD500] focus:outline-none focus:ring-0 focus:border-[#003875] peer uppercase disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/5"
      placeholder=" "
    />
    <label htmlFor={name} className="absolute text-[10px] font-black text-gray-400 dark:text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-[#111827] px-2 peer-focus:px-2 peer-focus:text-[#003875] peer-focus:dark:text-[#FFD500] peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1 uppercase tracking-widest">{label}</label>
  </div>
);

type EnrichedIMS = Omit<IMS, "live_stock" | "in_qty" | "out_qty" | "max_level" | "sale_percent" | "avg_daily_con" | "lead_time" | "safety_factor"> & {
  live_stock: number;
  in_qty: number;
  out_qty: number;
  max_level: number;
  sale_percent: number;
  avg_daily_con: number;
  lead_time: number;
  safety_factor: number;
  final_amount_num: number;
  is_pending?: boolean;
  source?: IMS["source"];
};

const isPendingItem = (item: { id?: string; is_pending?: boolean }) =>
  item.is_pending || String(item.id || "").startsWith("pending-");

const sourceBadgeClass = (source?: string) => {
  switch (source) {
    case "Details":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    case "GRN":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "O2D":
      return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
    case "GRN, O2D":
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300";
  }
};

type OutFormImportGroup = {
  Date: string;
  VchNo: string;
  Particulars: string;
  Items: { Description: string; Qty: number }[];
};

type OutFormColumnMap = {
  date: number;
  vch: number;
  particulars: number;
  item: number;
  qty: number;
};

const cellText = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return "";
  return String(val).trim();
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

const excelSerialToYMD = (serial: number): string => {
  const parsed = (XLSX.SSF as any)?.parse_date_code?.(serial);
  if (!parsed?.y) return "";
  return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
};

const formatOutFormDate = (val: any): string => {
  if (val === null || val === undefined || val === "") return "";

  // Excel serials are calendar days, not timezones. Never convert them through JS Date.
  if (typeof val === "number" && Number.isFinite(val)) {
    if (val > 20000 && val < 90000) return excelSerialToYMD(val);
    return "";
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getUTCFullYear()}-${pad2(val.getUTCMonth() + 1)}-${pad2(val.getUTCDate())}`;
  }

  const s = String(val).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-");
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${pad2(dmy[2])}-${pad2(dmy[1])}`;
  }

  return s;
};

const parseQtyValue = (val: any): number => {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const s = String(val ?? "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const findOutFormHeaderIndex = (jsonData: any[][]): number => {
  const max = Math.min(jsonData.length, 20);
  for (let i = 0; i < max; i++) {
    const cells = (jsonData[i] || []).map((c) => cellText(c).toLowerCase());
    const hasVch = cells.some((c) => c.includes("vch") || c.includes("bill"));
    const hasItem = cells.some((c) => c.includes("item") || c.includes("description"));
    const hasQty = cells.some((c) => c.includes("qty") || c.includes("quantity"));
    if (hasVch && (hasItem || hasQty)) return i;
  }
  return 0;
};

const mapOutFormColumns = (headerRow: any[]): OutFormColumnMap => {
  const fallback: OutFormColumnMap = { date: 0, vch: 1, particulars: 2, item: 3, qty: 4 };
  const cols: OutFormColumnMap = { date: -1, vch: -1, particulars: -1, item: -1, qty: -1 };

  (headerRow || []).forEach((cell, idx) => {
    const t = cellText(cell).toLowerCase();
    if (t.includes("date") && cols.date < 0) cols.date = idx;
    if ((t.includes("vch") || t.includes("bill")) && cols.vch < 0) cols.vch = idx;
    if (t.includes("particular") && !t.includes("item") && cols.particulars < 0) cols.particulars = idx;
    if ((t.includes("item") || t.includes("description") || t.includes("details")) && cols.item < 0) cols.item = idx;
    if ((t.includes("qty") || t.includes("quantity")) && !t.includes("unit") && cols.qty < 0) cols.qty = idx;
  });

  return {
    date: cols.date >= 0 ? cols.date : fallback.date,
    vch: cols.vch >= 0 ? cols.vch : fallback.vch,
    particulars: cols.particulars >= 0 ? cols.particulars : fallback.particulars,
    item: cols.item >= 0 ? cols.item : fallback.item,
    qty: cols.qty >= 0 ? cols.qty : fallback.qty,
  };
};

const isOutFormHeaderLike = (val: any): boolean => {
  const t = cellText(val).toLowerCase();
  return ["date", "vch/bill no", "vch no", "particulars", "item details", "qty", "qty.", "unit"].includes(t);
};

type OutFormImportPreview = {
  groups: OutFormImportGroup[];
  voucherCount: number;
  itemCount: number;
};

export default function IMSMaster({ onBack }: { onBack: () => void }) {
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusType, setStatusType] = useState<'loading' | 'success' | 'error'>('loading');

  const showStatus = (msg: string, type: 'loading' | 'success' | 'error' = 'loading') => {
    setStatusMessage(msg);
    setStatusType(type);
    setIsStatusModalOpen(true);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [itemNameFilters, setItemNameFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [legendFilter, setLegendFilter] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importLogRef = React.useRef<HTMLDivElement>(null);

  const [importPreview, setImportPreview] = useState<OutFormImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importPhase, setImportPhase] = useState<"preview" | "scanning" | "uploading" | "done">("preview");

  React.useEffect(() => {
    if (importLogRef.current) {
      importLogRef.current.scrollTop = importLogRef.current.scrollHeight;
    }
  }, [importLogs]);

  const parseOutFormFile = (jsonData: any[][]): OutFormImportGroup[] => {
    let headerIndex = findOutFormHeaderIndex(jsonData);
    const headerRow = jsonData[headerIndex] || [];
    const headerLooksLikeHeader =
      cellText(headerRow[0]).toLowerCase().includes("date") ||
      cellText(headerRow[1]).toLowerCase().includes("vch") ||
      cellText(headerRow[1]).toLowerCase().includes("bill") ||
      cellText(headerRow[3]).toLowerCase().includes("item");

    const cols = headerLooksLikeHeader
      ? mapOutFormColumns(headerRow)
      : { date: 0, vch: 1, particulars: 2, item: 3, qty: 4 };
    if (!headerLooksLikeHeader) headerIndex = -1;

    const groupedData: OutFormImportGroup[] = [];
    let currentGroup: OutFormImportGroup | null = null;

    for (let i = headerIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || [];
      const date = formatOutFormDate(row[cols.date]);
      const vchNo = cellText(row[cols.vch]);
      const particulars = cellText(row[cols.particulars]);
      const description = cellText(row[cols.item]);
      const qty = parseQtyValue(row[cols.qty]);

      if (!vchNo && !description) continue;
      if (isOutFormHeaderLike(vchNo) || isOutFormHeaderLike(description)) continue;

      if (vchNo && (!currentGroup || String(currentGroup.VchNo) !== vchNo)) {
        currentGroup = {
          Date: date,
          VchNo: vchNo,
          Particulars: particulars,
          Items: [],
        };
        groupedData.push(currentGroup);
      }

      if (currentGroup && description) {
        currentGroup.Items.push({
          Description: description,
          Qty: qty,
        });
      }
    }

    return groupedData.filter((group) => group.Items.length > 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[][]>(worksheet, { header: 1, defval: "", raw: true });

      if (jsonData.length <= 1) {
        throw new Error("File is empty or contains only headers.");
      }

      const groupedData = parseOutFormFile(jsonData);
      if (groupedData.length === 0) {
        throw new Error("No valid data found in the file.");
      }

      const itemCount = groupedData.reduce((sum, g) => sum + g.Items.length, 0);
      setImportFileName(file.name);
      setImportPreview({
        groups: groupedData,
        voucherCount: groupedData.length,
        itemCount,
      });
      setImportProgress(0);
      setImportLogs([]);
      setImportPhase("preview");
    } catch (error: any) {
      console.error(error);
      showStatus(error.message || "Error processing file", "error");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetImportModal = () => {
    if (isImporting) return;
    setImportPreview(null);
    setImportFileName("");
    setImportProgress(0);
    setImportLogs([]);
    setImportPhase("preview");
  };

  const handleConfirmOutFormImport = async () => {
    if (!importPreview || importPreview.groups.length === 0) return;

    const groups = importPreview.groups;
    const totalGroups = groups.length;

    setIsImporting(true);
    setSubmitting(true);
    setImportProgress(0);
    setImportLogs([]);
    setImportPhase("scanning");

    const pushLog = (message: string) => {
      setImportLogs((prev) => [...prev.slice(-79), message]);
    };
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    pushLog(`[INIT] Loading ${importFileName}`);
    pushLog(`[INFO] Detected ${importPreview.voucherCount} voucher(s) with ${importPreview.itemCount} line item(s)`);
    await wait(350);

    pushLog("[SCAN] Reading Out Form workbook structure...");
    await wait(300);

    const scanSteps = Math.min(totalGroups, 48);
    const stepSize = Math.max(1, Math.ceil(totalGroups / scanSteps));

    for (let index = 0; index < totalGroups; index += stepSize) {
      const batchEnd = Math.min(index + stepSize, totalGroups);
      for (let i = index; i < batchEnd; i++) {
        const group = groups[i];
        const qtyTotal = group.Items.reduce((s, it) => s + (Number(it.Qty) || 0), 0);
        pushLog(
          `[SCAN] ${group.VchNo || "—"} | ${group.Date || "—"} | ${group.Particulars || "—"} | ${group.Items.length} item(s) | Qty ${qtyTotal}`
        );
        if (group.Items.length > 0) {
          const sample = group.Items.slice(0, 2);
          sample.forEach((it) => {
            pushLog(`       ↳ ${it.Description} × ${it.Qty}`);
          });
          if (group.Items.length > 2) {
            pushLog(`       ↳ ... +${group.Items.length - 2} more line(s)`);
          }
        }
      }

      const scanPercent = Math.min(78, Math.round((batchEnd / totalGroups) * 78));
      setImportProgress(scanPercent);
      await wait(70);
    }

    pushLog("[SCAN] Row validation complete");
    pushLog("[MATCH] Preparing voucher groups for Out Form sheet...");
    setImportProgress(82);
    await wait(450);

    setImportPhase("uploading");
    pushLog("[UPLOAD] Writing records to Google Sheet Out Form...");
    setImportProgress(88);

    try {
      const res = await fetch("/api/ims/import-out-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groups),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to import");
      }

      setImportProgress(96);
      pushLog(`[SAVE] ${totalGroups} voucher row(s) appended to Out Form`);
      pushLog(`[SAVE] ${importPreview.itemCount} line item(s) packed as JSON`);

      await globalMutate("/api/ims");
      await globalMutate("/api/ims/summary");
      setImportProgress(100);
      setImportPhase("done");
      pushLog("[DONE] Out Form import completed successfully");
      await wait(900);

      setImportPreview(null);
      setImportFileName("");
      setImportProgress(0);
      setImportLogs([]);
      setImportPhase("preview");
      showStatus(`Successfully imported ${totalGroups} records!`, "success");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    } catch (error: any) {
      pushLog(`[ERROR] ${error.message || "Import failed"}`);
      setImportPhase("preview");
      showStatus(error.message || "Error processing file", "error");
    } finally {
      setIsImporting(false);
      setSubmitting(false);
    }
  };

  // Modals state
  const [isLogsModalOpen, setLogsModalOpen] = useState(false);
  const [logsItem, setLogsItem] = useState<EnrichedIMS | null>(null);
  const { data: logsData = [], isValidating: logsLoading } = useSWR<any[]>(
    isLogsModalOpen && logsItem ? `/api/ims/logs?item=${encodeURIComponent(logsItem.item_name)}` : null,
    fetcher
  );

  // Modals state
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IMS | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Form states
  const [itemForm, setItemForm] = useState<Partial<IMS>>({});

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

  const {
    data: timeSeriesData = [],
    isLoading: isTimeSeriesInitialLoading,
  } = useSWR<Transaction[]>(
    "/api/ims/time-series",
    fetcher,
    timeSeriesSwrOptions
  );

  const { data: gFloorLedger = [] } = useSWR<FloorIMS[]>(
    viewMode === "datewise" ? "/api/ims/floor?location=g&ledgerOnly=1" : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    }
  );

  const { data: firstFloorLedger = [] } = useSWR<FloorIMS[]>(
    viewMode === "datewise" ? "/api/ims/floor?location=1st&ledgerOnly=1" : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    }
  );

  const mergedTimeSeriesData = useMemo(() => {
    const txMap = new Map<string, Transaction>();

    for (const tx of timeSeriesData) {
      txMap.set(getDatewiseTxKey(tx), tx);
    }

    for (const row of gFloorLedger) {
      const inQty = parseFloat(row.in_qty || "") || 0;
      const outQty = parseFloat(row.out_qty || "") || 0;
      if (inQty <= 0 && outQty <= 0) continue;

      const tx: Transaction = {
        item_name: (row.item_name || "").trim(),
        category: row.category || "",
        date: row.date || row.updated_at || "",
        in_qty: inQty,
        out_qty: outQty,
        source: "GFloor",
      };
      // Ledger rows win over time-series so manual G Floor entries stay current
      txMap.set(getDatewiseTxKey(tx), tx);
    }

    for (const tx of firstFloorOutRowsToGFloorInTxs(firstFloorLedger)) {
      const existing = txMap.get(getDatewiseTxKey(tx));
      if (!existing || existing.source !== "GFloor") {
        txMap.set(getDatewiseTxKey(tx), tx);
      }
    }

    return Array.from(txMap.values());
  }, [timeSeriesData, gFloorLedger, firstFloorLedger]);

  const showTimeSeriesLoading = isTimeSeriesInitialLoading && timeSeriesData.length === 0;

  const { data: approvalData, mutate: mutateApprovals } = useSWR<{ keys: string[] }>(
    viewMode === "datewise" ? "/api/ims/gfloor-approval" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    }
  );

  const approvedTxKeys = useMemo(
    () => new Set(approvalData?.keys || []),
    [approvalData]
  );

  const [selectedTxKeys, setSelectedTxKeys] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);

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
    const sortedAll = [...mergedTimeSeriesData].sort(
      (a, b) => getTxSortTime(a.date) - getTxSortTime(b.date)
    );
    const stockMap = new Map<string, number>();
    
    const itemsWithRunningStock = sortedAll.map(item => {
      const key = item.item_name.toLowerCase().trim();
      const inVal = item.in_qty || 0;
      const outVal = item.out_qty || 0;
      const current = (stockMap.get(key) || 0) + (inVal - outVal);
      stockMap.set(key, current);
      return { ...item, running_stock: current };
    });

    const filteredByDate = !dateRange
      ? itemsWithRunningStock
      : itemsWithRunningStock.filter(item => {
          const itemTime = getTxSortTime(item.date);
          if (!itemTime) return false;
          return itemTime >= dateRange.start.getTime() && itemTime <= dateRange.end.getTime();
        });

    return filteredByDate.sort((a, b) => {
      const dateDiff = getTxSortTime(b.date) - getTxSortTime(a.date);
      if (dateDiff !== 0) return dateDiff;

      const aPending = !approvedTxKeys.has(getDatewiseTxKey(a));
      const bPending = !approvedTxKeys.has(getDatewiseTxKey(b));
      if (aPending !== bPending) return aPending ? -1 : 1;

      return (a.item_name || "").localeCompare(b.item_name || "");
    });
  }, [mergedTimeSeriesData, dateRange, approvedTxKeys]);

  const filteredDatewiseTransactions = useMemo(() => {
    return datewiseTransactions.filter((item) =>
      matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)
    );
  }, [datewiseTransactions, categoryFilters, itemNameFilters]);

  const filteredTimeSeriesData = useMemo(() => {
    return timeSeriesData.filter((item) =>
      matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)
    );
  }, [timeSeriesData, categoryFilters, itemNameFilters]);

  const { data: rawItems = [], mutate: mutateMaster, isLoading: masterLoading } = useSWR<IMS[]>("/api/ims", fetcher);

  const items = useMemo(() => {
    return rawItems.map(item => ({
      ...item,
      item_name: (item.item_name ?? "").trim(),
      category: (item.category ?? "").trim(),
      in_qty: item.in_qty || 0,
      out_qty: item.out_qty || 0,
      live_stock: item.live_stock || 0,
      max_level: item.max_level || 0,
      sale_percent: item.sale_percent || 0,
      avg_daily_con: item.avg_daily_con || 0,
      lead_time: item.lead_time || 30,
      safety_factor: item.safety_factor || 1,
      final_amount_num: parseFloat(item.final_amount) || 0,
      is_pending: isPendingItem(item),
      source: item.source || (isPendingItem(item) ? undefined : "Details"),
    })) as EnrichedIMS[];
  }, [rawItems]);

  const getLegendBucket = (live: number, maxLevel: number) => {
    if (live < 0) return 6;
    if (live === 0) return 5;
    const pct = maxLevel > 0 ? (live / maxLevel) * 100 : 100;
    if (pct <= 20) return 4;
    if (pct <= 50) return 3;
    if (pct <= 100) return 2;
    return 1;
  };

  const bucketCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    items.forEach(item => {
      counts[getLegendBucket(item.live_stock, item.max_level) as keyof typeof counts]++;
    });
    return counts;
  }, [items]);

  const uniqueCategories = useMemo(() => {
    const cats = [
      ...items.map((i) => (i.category ?? "").trim()),
      ...timeSeriesData.map((i) => (i.category ?? "").trim()),
    ].filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [items, timeSeriesData]);

  const categoryOptions = useMemo(
    () => uniqueCategories.map((cat) => ({ id: cat, label: cat })),
    [uniqueCategories]
  );

  const uniqueItemNames = useMemo(() => {
    const byKey = new Map<string, string>();
    const addName = (name?: string) => {
      const trimmed = (name ?? "").trim();
      if (!trimmed) return;
      const key = normalizeFilterKey(trimmed);
      if (!key || byKey.has(key)) return;
      byKey.set(key, trimmed);
    };

    const catalogSource =
      categoryFilters.length > 0
        ? items.filter((i) => matchesCategoryItemFilters(i, categoryFilters, []))
        : items;
    catalogSource.forEach((i) => addName(i.item_name));

    const txSource =
      categoryFilters.length > 0
        ? timeSeriesData.filter((i) => matchesCategoryItemFilters(i, categoryFilters, []))
        : timeSeriesData;
    txSource.forEach((i) => addName(i.item_name));

    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [items, categoryFilters, timeSeriesData]);

  const itemNameOptions = useMemo(
    () => uniqueItemNames.map((name) => ({ id: name, label: name })),
    [uniqueItemNames]
  );

  const filteredItems = useMemo(() => {
    const matchesText = (item: { item_name?: string; id?: string }) =>
      !searchQuery ||
      matchesOptionSearch(item.item_name || "", searchQuery) ||
      String(item.id || "").toLowerCase().includes(searchQuery.toLowerCase());

    let result = items.filter((item) => {
      if (!matchesText(item)) return false;
      return matchesCategoryItemFilters(item, categoryFilters, itemNameFilters);
    });

    if (legendFilter !== null) {
      result = result.filter(
        (item) => getLegendBucket(item.live_stock, item.max_level) === legendFilter
      );
    }

    return result;
  }, [items, searchQuery, legendFilter, categoryFilters, itemNameFilters]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const datewiseTotalPages = Math.ceil(filteredDatewiseTransactions.length / itemsPerPage);
  const paginatedDatewiseTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDatewiseTransactions.slice(start, start + itemsPerPage);
  }, [filteredDatewiseTransactions, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedTxKeys(new Set());
  }, [searchQuery, legendFilter, categoryFilters, itemNameFilters, viewMode, filterPeriod, filterDate, filterStartDate, filterEndDate]);

  React.useEffect(() => {
    setItemNameFilters((prev) => {
      if (prev.length === 0) return prev;
      const valid = new Set(uniqueItemNames.map(normalizeFilterKey));
      const next = prev.filter((name) => valid.has(normalizeFilterKey(name)));
      return next.length === prev.length ? prev : next;
    });
  }, [categoryFilters, uniqueItemNames]);

  // KPIs
  const totalItems = items.length;
  const totalLiveStock = items.reduce((acc, curr) => acc + curr.live_stock, 0);
  const lowStockCount = items.filter(item => getLegendBucket(item.live_stock, item.max_level) >= 4).length;
  const totalValue = items.reduce((acc, curr) => acc + (curr.final_amount_num * Math.max(0, curr.live_stock)), 0);

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

  const calcFinalAmount = (est: string, gst: string): string => {
    const estNum = parseFloat(est);
    const gstNum = parseFloat(gst);
    if (!isNaN(estNum) && !isNaN(gstNum)) {
      return (estNum * (1 + gstNum / 100)).toFixed(3);
    }
    return "";
  };

  const handleInputChange = (field: string, value: string) => {
    setItemForm((prev) => {
      const updated: any = { ...prev, [field]: value };
      if (field === "est_amount_item" || field === "gst") {
        updated.final_amount = calcFinalAmount(
          field === "est_amount_item" ? value : prev.est_amount_item || "",
          field === "gst" ? value : prev.gst || ""
        );
      }
      return updated;
    });
  };

  const handleSaveItem = async () => {
    if (!itemForm.item_name || !itemForm.est_amount_item || !itemForm.gst) {
      showStatus("Please fill in all required fields", "error");
      return;
    }

    setSubmitting(true);
    const isPending = editingItem ? isPendingItem(editingItem) : false;
    showStatus(isPending ? "Adding to Details sheet..." : editingItem ? "Updating Item..." : "Adding New Item...", "loading");
    const method = isPending || !editingItem ? "POST" : "PUT";

    const payload = isPending
      ? {
          item_name: itemForm.item_name,
          est_amount_item: itemForm.est_amount_item,
          gst: itemForm.gst,
          final_amount: itemForm.final_amount,
          category: itemForm.category || "",
        }
      : itemForm;

    try {
      const res = await fetch("/api/ims", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const confirmDelete = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    setSubmitting(true);
    showStatus(`Deleting item...`, "loading");
    try {
      const res = await fetch(`/api/ims?id=${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        mutateMaster();
        showStatus("Item Deleted Successfully!", "success");
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


  const paginatedDatewiseWithMeta = useMemo(() => {
    return paginatedDatewiseTransactions.map((log) => {
      const txKey = getDatewiseTxKey(log);
      return { log, txKey, isApproved: approvedTxKeys.has(txKey) };
    });
  }, [paginatedDatewiseTransactions, approvedTxKeys]);

  const pageSelectableKeys = useMemo(
    () => paginatedDatewiseWithMeta.filter((row) => !row.isApproved).map((row) => row.txKey),
    [paginatedDatewiseWithMeta]
  );

  const allPageSelected =
    pageSelectableKeys.length > 0 && pageSelectableKeys.every((key) => selectedTxKeys.has(key));

  const toggleTxSelection = (txKey: string, isApproved: boolean) => {
    if (isApproved) return;
    setSelectedTxKeys((prev) => {
      const next = new Set(prev);
      if (next.has(txKey)) next.delete(txKey);
      else next.add(txKey);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedTxKeys((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageSelectableKeys.forEach((key) => next.delete(key));
      else pageSelectableKeys.forEach((key) => next.add(key));
      return next;
    });
  };

  const handleBulkApprove = async () => {
    const toApprove = filteredDatewiseTransactions.filter((log) =>
      selectedTxKeys.has(getDatewiseTxKey(log))
    );
    if (toApprove.length === 0) {
      showStatus("Select rows to approve", "error");
      return;
    }

    setIsApproving(true);
    showStatus(`Approving ${toApprove.length} transaction(s)...`, "loading");
    try {
      const res = await fetch("/api/ims/gfloor-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: toApprove.map((log) => ({
            item_name: log.item_name,
            category: log.category,
            date: log.date,
            in_qty: log.in_qty || 0,
            out_qty: log.out_qty || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save approvals");

      await mutateApprovals();
      setSelectedTxKeys(new Set());
      const skippedNote = data.skipped ? ` (${data.skipped} already approved)` : "";
      showStatus(`Saved ${data.added} approved row(s)${skippedNote}`, "success");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error saving approvals";
      showStatus(message, "error");
    } finally {
      setIsApproving(false);
    }
  };

  const handleExport = () => {
    let headers: string[];
    let rows: any[][];

    if (viewMode === 'datewise') {
      headers = ["Date", "Category", "Source", "Item Name", "In Qty", "Out Qty", "Live Stock", "Approval Status"];
      rows = filteredDatewiseTransactions.map((log: any) => [
        new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
        log.category,
        formatTxSourceLabel(log.source),
        log.item_name,
        log.in_qty > 0 ? `+${log.in_qty}` : "-",
        log.out_qty > 0 ? `-${log.out_qty}` : "-",
        (log as any).running_stock,
        approvedTxKeys.has(getDatewiseTxKey(log)) ? "Approved" : "Pending",
      ]);
    } else {
      headers = ["ID", "Item Name", "Est. Amount/Item", "GST", "Final Amount", "Category", "In Qty", "Out Qty", "Live Stock", "Sale %", "Avg Daily Con. (60d)", "Lead Time", "Safety Factor", "Max Level"];
      rows = filteredItems.map((item) => [
        item.id,
        item.item_name,
        item.est_amount_item,
        item.gst,
        item.final_amount,
        item.category,
        item.in_qty,
        item.out_qty,
        item.live_stock,
        item.sale_percent,
        item.avg_daily_con,
        item.lead_time,
        item.safety_factor,
        item.max_level,
      ]);
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ims_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dashboard Data Prep
  const healthPieData = [
    { name: 'Overstock', value: bucketCounts[1], color: '#8b5cf6' },
    { name: 'Healthy', value: bucketCounts[2], color: '#10b981' },
    { name: 'Warning', value: bucketCounts[3], color: '#fbbf24' },
    { name: 'Critical', value: bucketCounts[4], color: '#f43f5e' },
    { name: 'Stockout', value: bucketCounts[5] + bucketCounts[6], color: '#111827' },
  ].filter(d => d.value > 0);

  const topLiveStockData = useMemo(() => items
    .filter(i => i.live_stock > 0)
    .sort((a, b) => b.live_stock - a.live_stock)
    .slice(0, 10)
    .map(i => ({
      name: i.item_name,
      stock: i.live_stock,
      id: i.id
    })), [items]);

  const lowestStockData = useMemo(() => items
    .filter(i => getLegendBucket(i.live_stock, i.max_level) >= 4) // Only critical/stockout
    .sort((a, b) => a.live_stock - b.live_stock)
    .slice(0, 10)
    .map(i => ({
      name: i.item_name,
      stock: i.live_stock,
      id: i.id
    })), [items]);

  const categoryRadarData = useMemo(() => {
    const catMap: Record<string, number> = {};
    items.forEach(i => {
      if (!i.category) return;
      catMap[i.category] = (catMap[i.category] || 0) + i.live_stock;
    });
    return Object.entries(catMap).map(([cat, vol]) => ({ subject: cat, A: vol, fullMark: 1000 })).slice(0, 6);
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex flex-col h-[calc(100vh-4rem)] p-2 gap-2">
      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={statusType}
        message={statusMessage}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {/* Row 1: Title + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-[#1f2937] dark:hover:bg-white/10 rounded-lg transition-colors shadow-sm shrink-0"
              title="Back to IMS Hub"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-800 shadow-lg shadow-blue-900/20 rounded-lg shrink-0">
                <ClipboardDocumentListIcon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-blue-800 dark:text-blue-400 uppercase tracking-tight leading-none">IMS - G Floor</h1>
                <p className="text-[9px] font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mt-0.5">Ground Floor Storage</p>
              </div>
            </div>
          </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg shrink-0 h-[30px]">
            <button
              onClick={() => setViewMode('default')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all h-full ${
                viewMode === 'default'
                  ? 'bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <TableCellsIcon className="w-3.5 h-3.5" /> Default
            </button>
            <button
              onClick={() => setViewMode('timeseries')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all h-full ${
                viewMode === 'timeseries'
                  ? 'bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ChartBarIcon className="w-3.5 h-3.5" /> Time Series
            </button>
            <button
              onClick={() => setViewMode('datewise')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all h-full ${
                viewMode === 'datewise'
                  ? 'bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Date-Wise
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting || submitting} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-blue-200 dark:border-blue-500/20 shadow-sm disabled:opacity-50 h-[30px]">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" /> Import
            </button>
            <button onClick={handleExport} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-blue-200 dark:border-blue-500/20 shadow-sm h-[30px]">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Export
            </button>
            <GFloorLedgerModals
              stockItems={items}
              showStatus={showStatus}
              submitting={submitting}
              setSubmitting={setSubmitting}
            />
          </div>

          <button onClick={() => {
            setEditingItem(null);
            setItemForm({ item_name: "", est_amount_item: "", gst: "", final_amount: "", category: "" });
            setItemModalOpen(true);
          }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm h-[30px]">
            <PlusIcon className="w-3.5 h-3.5 stroke-2" /> Add Item
          </button>
        </div>
      </div>

      {/* Row 2: Search + category/item filters + date filter */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full">
        <div className="relative shrink-0 w-[220px]">
          <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH ID / ITEM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-[#003875] dark:text-white transition-all shadow-sm h-[30px]"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-1 min-w-[320px]">
          <div className="flex-1 min-w-[160px] max-w-[220px]">
            <SearchableMultiSelect
              options={categoryOptions}
              value={categoryFilters}
              onChange={setCategoryFilters}
              placeholder="Categories"
              className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-lg text-[10px]"
              accentClass="border-blue-500 ring-blue-500/20"
            />
          </div>
          <div className="flex-1 min-w-[180px] max-w-[260px]">
            <SearchableMultiSelect
              options={itemNameOptions}
              value={itemNameFilters}
              onChange={setItemNameFilters}
              placeholder="Items"
              className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-lg text-[10px]"
              accentClass="border-blue-500 ring-blue-500/20"
            />
          </div>
          {(categoryFilters.length > 0 || itemNameFilters.length > 0) && (
            <button
              onClick={() => {
                setCategoryFilters([]);
                setItemNameFilters([]);
              }}
              className="px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 transition-colors shrink-0 h-[30px]"
            >
              Clear
            </button>
          )}
        </div>

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
          theme="blue"
          className="flex-1 min-w-[300px]"
        />
      </div>

      {/* Row 3: Color logic — default view only */}
      {viewMode === 'default' && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 bg-white dark:bg-[#111827] px-2 py-1.5 rounded-xl border border-gray-200 dark:border-white/5">
          <div className="flex items-center gap-1 shrink-0">
            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Color Logic:</span>
          </div>
          <div className="flex flex-wrap gap-1 text-[9px] font-black text-white text-center cursor-pointer">
            <div onClick={() => setLegendFilter(legendFilter === 1 ? null : 1)} className={`px-2.5 py-0.5 rounded transition-transform hover:scale-105 ${legendFilter === 1 ? 'ring-2 ring-purple-600 ring-offset-1 bg-purple-600 shadow-md' : 'bg-purple-500'}`}> {'>'} 100% <sup className="font-bold opacity-80">{bucketCounts[1]}</sup></div>
            <div onClick={() => setLegendFilter(legendFilter === 2 ? null : 2)} className={`px-2.5 py-0.5 rounded transition-transform hover:scale-105 ${legendFilter === 2 ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-500 shadow-md' : 'bg-emerald-400'}`}> 51-100% <sup className="font-bold opacity-80">{bucketCounts[2]}</sup></div>
            <div onClick={() => setLegendFilter(legendFilter === 3 ? null : 3)} className={`text-black px-2.5 py-0.5 rounded transition-transform hover:scale-105 ${legendFilter === 3 ? 'ring-2 ring-amber-400 ring-offset-1 bg-amber-400 shadow-md' : 'bg-amber-300'}`}> 21-50% <sup className="font-bold opacity-80">{bucketCounts[3]}</sup></div>
            <div onClick={() => setLegendFilter(legendFilter === 4 ? null : 4)} className={`px-2.5 py-0.5 rounded transition-transform hover:scale-105 ${legendFilter === 4 ? 'ring-2 ring-rose-500 ring-offset-1 bg-rose-500 shadow-md' : 'bg-rose-400'}`}> 1-20% <sup className="font-bold opacity-80">{bucketCounts[4]}</sup></div>
            <div onClick={() => setLegendFilter(legendFilter === 5 ? null : 5)} className={`px-2.5 py-0.5 rounded transition-transform hover:scale-105 ${legendFilter === 5 ? 'ring-2 ring-black dark:ring-gray-700 ring-offset-1 bg-black dark:bg-gray-800 shadow-md' : 'bg-gray-800 dark:bg-gray-700'}`}> 0% <sup className="font-bold opacity-80">{bucketCounts[5]}</sup></div>
            <div onClick={() => setLegendFilter(legendFilter === 6 ? null : 6)} className={`px-2.5 py-0.5 rounded transition-transform hover:scale-105 ${legendFilter === 6 ? 'ring-2 ring-gray-400 ring-offset-1 bg-gray-400 shadow-md' : 'bg-gray-300'}`}> {'<'} 0% <sup className="font-bold opacity-80">{bucketCounts[6]}</sup></div>
          </div>
          {legendFilter !== null && (
            <button onClick={() => setLegendFilter(null)} className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-500 rounded text-[8px] uppercase font-black hover:bg-gray-200">Clear</button>
          )}
        </div>
      )}

      {viewMode === 'timeseries' ? (
        <div className="flex flex-col gap-2 shrink-0 mb-2">
          <TimeSeriesTable 
            transactions={filteredTimeSeriesData}
            bucket={mappedTimeBucket}
            isLoading={showTimeSeriesLoading}
            searchQuery={searchQuery}
          />
        </div>
      ) : viewMode === 'datewise' ? (
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0 mt-2">
          {filteredDatewiseTransactions.length > 0 && !showTimeSeriesLoading && (
            <div className="py-2 px-4 border-b border-blue-200/50 dark:border-blue-500/10 flex flex-wrap items-center justify-between gap-2 bg-blue-50/50 dark:bg-[#1f2937]/50 shrink-0">
              <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredDatewiseTransactions.length)} to {Math.min(currentPage * itemsPerPage, filteredDatewiseTransactions.length)} of {filteredDatewiseTransactions.length} transactions
              </p>
              <div className="flex items-center gap-2">
                {selectedTxKeys.size > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={isApproving}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    Approve Selected ({selectedTxKeys.size})
                  </button>
                )}
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
            {showTimeSeriesLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse relative">
                <thead className="bg-gray-100 dark:bg-[#1f2937] sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 text-center border-b border-gray-200 dark:border-white/10 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePageSelection}
                        disabled={pageSelectableKeys.length === 0}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40 cursor-pointer"
                        title="Select all on this page"
                      />
                    </th>
                    <th className="py-2.5 px-4 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">Date</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">Category</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">Source</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 min-w-[200px]">Item Name</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-right">In</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-right">Out</th>
                    <th className="py-2.5 px-4 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-right">Live Stock</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-center whitespace-nowrap">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {paginatedDatewiseWithMeta.map(({ log, txKey, isApproved }, index) => (
                    <tr
                      key={`${txKey}-${index}`}
                      className={`hover:bg-blue-50/30 dark:hover:bg-white/[0.03] even:bg-gray-50/50 dark:even:bg-[#1f2937]/30 transition-colors group ${isApproved ? "bg-emerald-50/40 dark:bg-emerald-500/5" : ""}`}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isApproved || selectedTxKeys.has(txKey)}
                          disabled={isApproved}
                          onChange={() => toggleTxSelection(txKey, isApproved)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-60 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-4 text-[11px] font-bold text-gray-500">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-500 uppercase">{log.category}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${getTxSourceBadgeClass(log.source)}`}>
                          {formatTxSourceLabel(log.source)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase whitespace-normal break-words min-w-[200px] max-w-[320px] leading-snug">{log.item_name}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-right">{log.in_qty > 0 ? `+${log.in_qty}` : "-"}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">{log.out_qty > 0 ? `-${log.out_qty}` : "-"}</td>
                      <td className="py-2 px-4 text-[11px] font-black text-[#003875] dark:text-[#FFD500] text-right">{(log as any).running_stock}</td>
                      <td className="py-2 px-3 text-center">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                            <CheckIcon className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredDatewiseTransactions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
      <>
      <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0">
        {!logsItem && (
          <>
            {filteredItems.length > 0 && !masterLoading && (
              <div className="py-2 px-4 border-b border-blue-200/50 dark:border-blue-500/10 flex items-center justify-between bg-blue-50/50 dark:bg-[#1f2937]/50 shrink-0">
                <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredItems.length)} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} entries
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-blue-200 dark:border-blue-500/20 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-blue-200 dark:border-blue-500/20 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
                    <thead className="bg-blue-50 dark:bg-blue-900/20 sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="py-2.5 px-3 border-b border-blue-200 dark:border-blue-500/20 text-center sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-30 shadow-[1px_0_0_0_#bfdbfe] dark:shadow-[1px_0_0_0_rgba(59,130,246,0.2)] w-24">
                          <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Acts</span>
                        </th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 whitespace-nowrap">ID</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 whitespace-nowrap">Category</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 whitespace-nowrap">Source</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 min-w-[200px]">Item Name</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Est. Amt</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">GST</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Final Amt</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">In Qty</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Out Qty</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Sale %</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Avg Con</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Lead</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">SF</th>
                        <th className="py-2.5 px-3 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-right">Max</th>
                        <th className="py-2.5 px-4 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-blue-200 dark:border-blue-500/20 text-left bg-blue-100/50 dark:bg-blue-500/10 w-56">Stock Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100 dark:divide-blue-500/10">
                      {paginatedItems.map((item, idx) => {
                        const health = getHealth(item.live_stock, item.max_level || 0);
                        const pending = isPendingItem(item);
                        return (
                          <tr
                            key={`${item.id}-${idx}`}
                            className={`hover:bg-blue-50/50 dark:hover:bg-white/[0.03] transition-colors group ${pending ? "bg-amber-50/40 dark:bg-amber-500/5" : ""}`}
                          >
                            <td className="py-1 px-2 text-center sticky left-0 z-20 transition-colors border-r shadow-[1px_0_0_0_#bfdbfe] dark:shadow-[1px_0_0_0_rgba(59,130,246,0.2)] bg-white group-even:bg-blue-50/30 dark:bg-[#111827] dark:group-even:bg-[#182031] group-hover:bg-blue-50/50 dark:group-hover:bg-[#1a2335] border-blue-100 dark:border-blue-500/10">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => { setLogsItem(item); setLogsModalOpen(true); }} className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-110 transition-all" title="View Transaction Logs">
                                  <EyeIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingItem(item);
                                    setItemForm({
                                      item_name: item.item_name,
                                      est_amount_item: item.est_amount_item || "",
                                      gst: item.gst || "",
                                      final_amount: item.final_amount || "",
                                      category: item.category || "",
                                    });
                                    setItemModalOpen(true);
                                  }}
                                  className="text-[#003875] dark:text-[#FFD500] hover:scale-110 transition-transform"
                                  title={pending ? "Add to Details sheet" : "Edit"}
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                {!pending && (
                                  <button onClick={() => { confirmDelete(item.id.toString()); }} className="text-rose-500 hover:scale-110 transition-transform" title="Delete">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-[11px] font-black text-[#003875] dark:text-[#FFD500] whitespace-nowrap">
                              {pending ? (
                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending</span>
                              ) : (
                                item.id
                              )}
                            </td>
                            <td className="py-2 px-3 text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">{item.category || (pending ? "—" : "")}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${sourceBadgeClass(item.source)}`}>
                                {item.source || "—"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase whitespace-normal break-words min-w-[200px] max-w-[320px] leading-snug">{item.item_name}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{pending && !item.est_amount_item ? "—" : item.est_amount_item}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{pending && !item.gst ? "—" : item.gst ? `${item.gst}%` : ""}</td>
                            <td className="py-2 px-3 text-[11px] font-black text-gray-800 dark:text-gray-200 text-right">{pending && !item.final_amount_num ? "—" : `₹${item.final_amount_num.toFixed(2)}`}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-right">{item.in_qty}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 text-right">{item.out_qty}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 text-right">{item.sale_percent}%</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.avg_daily_con}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.lead_time}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 text-right">{item.safety_factor}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-[#003875] dark:text-[#FFD500] text-right">{item.max_level}</td>
                            <td className="py-1 px-4 bg-gray-50/50 dark:bg-white/[0.02]">
                              <div className="flex flex-col gap-1 w-full max-w-[180px]">
                                <div className="flex justify-between items-baseline leading-none">
                                  <span className={`text-xs font-black ${health.text}`}>{item.live_stock}</span>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">{health.label}</span>
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
                          <td colSpan={16} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No items found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {logsItem && (
              <div className="flex-1 flex flex-col relative bg-gray-50 dark:bg-[#0a0f1c] min-h-0">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#111827] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setLogsModalOpen(false); setLogsItem(null); }} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors">
                      <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase leading-none">{logsItem.item_name}</h2>
                        <span className="px-2 py-0.5 bg-[#003875]/10 text-[#003875] dark:bg-[#FFD500]/20 dark:text-[#FFD500] border border-[#003875]/20 dark:border-[#FFD500]/30 rounded text-[10px] font-black tracking-widest">ID: {logsItem.id}</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{logsItem.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 text-right">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total IN</p>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{logsItem.in_qty}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total OUT</p>
                      <span className="text-xl font-black text-rose-600 dark:text-rose-400">{logsItem.out_qty}</span>
                    </div>
                    <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-2"></div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Live Stock</p>
                      <span className={`text-xl font-black ${getHealth(logsItem.live_stock, logsItem.max_level || 0).text}`}>{logsItem.live_stock}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-white dark:bg-[#111827]">
                  {logsLoading ? (
                    <div className="p-8 flex justify-center items-center h-full">
                      <div className="w-8 h-8 border-4 border-[#003875] dark:border-[#FFD500] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : logsData.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-100 dark:bg-[#1f2937] sticky top-0 shadow-sm z-10">
                        <tr>
                          <th className="py-2.5 px-6 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 w-40">Date</th>
                          <th className="py-2.5 px-6 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 w-32">Type</th>
                          <th className="py-2.5 px-6 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-right w-32">Quantity</th>
                          <th className="py-2.5 px-6 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono text-[11px]">
                        {logsData.map((log: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                            <td className="py-3 px-6 text-gray-500 font-bold whitespace-nowrap">{formatDate(log.date)}</td>
                            <td className="py-3 px-6 whitespace-nowrap">
                              <span className={`flex items-center gap-1.5 w-max px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                {log.type === 'IN' ? <ArrowDownTrayIcon className="w-3.5 h-3.5" /> : <ArrowUpTrayIcon className="w-3.5 h-3.5" />}
                                {log.type}
                              </span>
                            </td>
                            <td className={`py-3 px-6 font-black text-right text-sm ${log.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {log.type === 'IN' ? '+' : '-'}{log.qty}
                            </td>
                            <td className="py-3 px-6 text-gray-600 dark:text-gray-400 font-bold uppercase truncate max-w-[400px]" title={log.remarks}>{log.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                      <ArchiveBoxIcon className="w-12 h-12 mb-3 opacity-20" />
                      <p className="font-sans text-[11px] font-black uppercase tracking-widest mt-2">No transaction logs found</p>
                    </div>
                  )}
                </div>
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

      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_0_40px_rgba(0,56,117,0.3)] dark:shadow-[0_0_40px_rgba(255,213,0,0.1)] w-full max-w-2xl overflow-hidden border border-[#003875]/30 dark:border-[#FFD500]/20"
            >
              <div className="flex items-center justify-between p-5 border-b border-blue-800/20 dark:border-white/5 bg-gradient-to-r from-[#003875] to-blue-800 dark:from-[#1f2937] dark:to-[#111827] text-white">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-blue-200 dark:text-[#FFD500]" />
                  {editingItem && isPendingItem(editingItem) ? 'Add to Details Sheet' : editingItem ? 'Edit IMS Record' : 'Create IMS Record'}
                </h3>
                <button onClick={() => setItemModalOpen(false)} className="p-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 dark:bg-[#1f2937] rounded-lg shadow-sm transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#111827]">
                
                <FloatingInput label="Category" name="category" list="category-list" value={itemForm.category || ''} onChange={(val) => handleInputChange("category", val)} />
                <div className="hidden md:block"></div>

                <div className="md:col-span-2">
                  <FloatingInput
                    label="Item Name *"
                    name="item_name"
                    value={itemForm.item_name || ''}
                    onChange={(val) => handleInputChange("item_name", val)}
                    disabled={!!editingItem && isPendingItem(editingItem)}
                  />
                </div>

                <FloatingInput label="Est. Amount/Item *" name="est_amount_item" type="number" step="0.01" value={itemForm.est_amount_item || ''} onChange={(val) => handleInputChange("est_amount_item", val)} />
                <FloatingInput label="GST (%) *" name="gst" type="number" step="0.01" value={itemForm.gst || ''} onChange={(val) => handleInputChange("gst", val)} />

                <div className="md:col-span-2">
                  <FloatingInput label="Final Amount" name="final_amount" disabled={true} value={itemForm.final_amount || ''} onChange={() => {}} />
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button onClick={() => setItemModalOpen(false)} className="px-5 py-2 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white dark:hover:bg-[#111827] shadow-sm border border-gray-200 dark:border-white/10 transition-colors">Cancel</button>
                <button onClick={handleSaveItem} className="px-6 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#003875] to-blue-600 dark:from-[#FFD500] dark:to-yellow-400 dark:text-[#003875] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-blue-500/20 dark:shadow-yellow-500/20 transition-all">Save Record</button>
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
        title="Delete Item"
        message={`Are you sure you want to completely remove this item from the system? This action cannot be undone.`}
        confirmLabel="Delete"
        type="danger"
      />

      {importPreview && (
        <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl max-h-[calc(100vh-1.5rem)] my-auto shadow-2xl border border-white/10 overflow-hidden flex flex-col">
            <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-[#003875] text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Import Out Form</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1">{importFileName}</p>
                </div>
                {isImporting && (
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200">
                      {importPhase === "scanning" ? "Scanning File" : importPhase === "uploading" ? "Uploading Data" : "Completed"}
                    </p>
                    <p className="text-2xl font-black text-white">{importProgress}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 shadow-inner">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">File Preview</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">XLSX</span>
                </div>

                <div className="relative h-28 sm:h-32 overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)]">
                  <div className="absolute inset-0 opacity-30">
                    {Array.from({ length: 8 }).map((_, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-6 gap-px px-3 py-1">
                        {Array.from({ length: 6 }).map((__, colIndex) => (
                          <div key={colIndex} className="h-3 rounded-sm bg-slate-700/60" />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-x-4 top-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Out Form Import</p>
                    <p className="text-[9px] font-medium text-slate-400 mt-1 truncate">{importFileName}</p>
                  </div>

                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-400/10 to-transparent pointer-events-none" />

                  {isImporting && (
                    <>
                      <div
                        className="absolute inset-x-0 h-8 bg-gradient-to-b from-emerald-400/0 via-emerald-400/25 to-emerald-400/0 border-y border-emerald-300/40 shadow-[0_0_30px_rgba(52,211,153,0.35)] animate-punch-scan"
                        style={{ top: `${Math.max(8, Math.min(78, importProgress * 0.75))}%` }}
                      />
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(16,185,129,0.04)_0px,rgba(16,185,129,0.04)_1px,transparent_1px,transparent_8px)] pointer-events-none" />
                    </>
                  )}
                </div>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>
                      {importPhase === "scanning"
                        ? "Scanning Out Form rows"
                        : importPhase === "uploading"
                        ? "Saving to Out Form sheet"
                        : "Import complete"}
                    </span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {!isImporting && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-3 sm:p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Vouchers</p>
                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{importPreview.voucherCount}</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Line Items</p>
                    <p className="text-2xl font-black text-blue-800 dark:text-blue-200">{importPreview.itemCount}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Target</p>
                    <p className="text-sm font-black text-amber-800 dark:text-amber-200 mt-2">Out Form</p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Import Console</span>
                </div>
                <div
                  ref={importLogRef}
                  className="h-28 sm:h-32 overflow-y-auto p-3 font-mono text-[10px] leading-5 text-emerald-300 bg-[#020617]"
                >
                  {importLogs.length === 0 ? (
                    <p className="text-slate-500">Waiting to start import...</p>
                  ) : (
                    importLogs.map((log, index) => (
                      <div key={`${log}-${index}`} className="whitespace-pre-wrap break-all">
                        <span className="text-slate-500 mr-2">{String(index + 1).padStart(2, "0")}</span>
                        {log}
                      </div>
                    ))
                  )}
                  {isImporting && (
                    <div className="mt-1 text-emerald-400 animate-pulse">▮ processing...</div>
                  )}
                </div>
              </div>

              {!isImporting && (
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Voucher groups will be appended to the Out Form sheet. Line items are stored as JSON per voucher.
                </p>
              )}
            </div>

            <div className="shrink-0 px-5 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 flex justify-end gap-3">
              <button
                onClick={resetImportModal}
                disabled={isImporting}
                className="px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOutFormImport}
                disabled={isImporting || importPreview.groups.length === 0}
                className="px-5 py-2.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowUpTrayIcon className="w-4 h-4" />}
                {isImporting ? "Processing..." : "Confirm Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
