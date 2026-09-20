"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  O2D,
  O2DItem,
  O2D_STEPS,
  O2D_STEP_SHORTS,
  O2DStepConfig,
} from "@/types/o2d";
import { PartyManagement } from "@/types/party-management";
import useSWR, { mutate, useSWRConfig } from "swr";
import { useSSE } from "@/hooks/useSSE";
import { applyPaginatedIncrementalUpdate } from "@/lib/utils/swr-sync";

const O2D_SSE_MODULES = ["o2d"];
const fetcher = async (url: string) => {
  const res = await fetch(url);
  return res.json();
};

const expandO2DItem = (item: O2D): O2D[] => {
  if (item.item_name && /^1\.\s/.test(item.item_name)) {
    const names = item.item_name
      .split(" | ")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim());
    const qtys = (item.item_qty || "")
      .split(" | ")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim());
    const amounts = (item.est_amount || "")
      .split(" | ")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim());
    const specs = (item.item_specification || "")
      .split(" | ")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim());

    return names.map((name, idx) => ({
      ...item,
      id: idx === 0 ? item.id : `${item.id}-${idx}`,
      item_name: name,
      item_qty: qtys[idx] || "",
      est_amount: amounts[idx] || "",
      item_specification: specs[idx] || "",
    }));
  } else if (item.item_name && item.item_name.includes('\n')) {
    const names = item.item_name.split('\n').map(s => s.trim());
    const qtys = (item.item_qty || "").split('\n').map(s => s.trim());
    const amounts = (item.est_amount || "").split('\n').map(s => s.trim());
    const specs = (item.item_specification || "").split('\n').map(s => s.trim());

    return names.map((name, idx) => ({
      ...item,
      id: idx === 0 ? item.id : `${item.id}-${idx}`,
      item_name: name,
      item_qty: qtys[idx] || "",
      est_amount: amounts[idx] || "",
      item_specification: specs[idx] || "",
    }));
  }
  return [item];
};
import { getDriveImageUrl, getDriveDownloadUrl, getDrivePreviewUrl } from "@/lib/drive-utils";
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
  ShoppingBagIcon,
  PhotoIcon,
  UserIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  IdentificationIcon,
  BuildingOfficeIcon,
  ChatBubbleBottomCenterTextIcon,
  CurrencyRupeeIcon,
  HashtagIcon,
  ArchiveBoxIcon,
  EyeIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  ClockIcon,
  PauseCircleIcon,
  NoSymbolIcon,
  MinusCircleIcon,
  CheckBadgeIcon,
  ShareIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  GiftIcon,
  TagIcon,
} from "@heroicons/react/24/solid";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import PartyFormModal from "@/components/PartyFormModal";
import ItemFormModal from "@/components/ItemFormModal";
import PremiumDatePicker from "@/components/PremiumDatePicker";

// --- Searchable Dropdown ---
interface SearchableDropdownProps {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  keepOpen?: boolean;
  listPosition?: "absolute" | "relative";
  hideLabel?: boolean;
  isMulti?: boolean;
  onFocus?: (e: React.FocusEvent) => void;
  error?: boolean;
}

function SearchableDropdown({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
  required,
  keepOpen = false,
  listPosition = "absolute",
  hideLabel = false,
  isMulti = false,
  onFocus,
  error = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Open on Tab/Focus
  const handleFocus = (e: React.FocusEvent) => {
    if (!isOpen && !dropdownRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(true);
    }
    onFocus?.(e);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const selectedValues = useMemo(() => {
    if (!isMulti) return value ? [value] : [];
    return value ? value.split(",").map((v) => v.trim()) : [];
  }, [value, isMulti]);

  const toggleValue = (val: string) => {
    if (!isMulti) {
      onChange(val);
      return;
    }
    const current = selectedValues;
    if (current.includes(val)) {
      onChange(current.filter((v) => v !== val).join(", "));
    } else {
      onChange([...current, val].join(", "));
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset active index when search changes or dropdown opens
  useEffect(() => {
    setActiveIndex(-1);
  }, [search, isOpen]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase()),
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? filteredOptions.length - 1 : prev - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        toggleValue(filteredOptions[activeIndex]);
        if (!keepOpen && !isMulti) {
          setIsOpen(false);
          setSearch("");
          setActiveIndex(-1);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearch("");
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {!hideLabel && (
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5 group">
          <Icon className="w-3 h-3 transition-colors group-hover:text-[#FFD500]" />
          {label}
        </label>
      )}
      <div
        ref={triggerRef}
        tabIndex={0}
        onMouseDown={(e) => {
            setIsOpen(!isOpen);
            // Small timeout to allow focus to settle if needed
            setTimeout(() => triggerRef.current?.focus(), 0);
        }}
        onFocus={handleFocus}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full ${isMulti ? "min-h-[34px] py-1" : "h-[34px]"} ${error ? "bg-red-50 dark:bg-red-900/20 border-red-500 ring-1 ring-red-500 text-red-700 dark:text-red-400" : "bg-[#FEF6DB] dark:bg-black border-orange-100 dark:border-navy-700 focus:border-[#FFD500] focus:ring-1 focus:ring-[#FFD500]"} px-3 rounded-lg border outline-none cursor-pointer flex items-center justify-between shadow-sm transition-all`}
      >
        <div className="flex flex-wrap gap-1 items-center min-w-0 flex-1">
          {isMulti && selectedValues.length > 0 ? (
            selectedValues.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#003875] text-[#FFD500] rounded-md text-[9px] font-black group/chip transition-all hover:pr-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleValue(v);
                }}
              >
                {v}
                <XMarkIcon className="w-2.5 h-2.5 opacity-60 group-hover/chip:opacity-100" />
              </span>
            ))
          ) : (
            <span
              className={`text-[11px] font-bold truncate pr-2 ${error ? "text-red-700 dark:text-red-400" : value ? "text-gray-800 dark:text-zinc-100" : "text-gray-400"}`}
            >
              {value || placeholder || `Select...`}
            </span>
          )}
        </div>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen && (
        <div
          className={`${listPosition} z-[10000] w-full mt-1 bg-white dark:bg-navy-800 border border-orange-100 dark:border-navy-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}
        >
          <div className="p-2 border-b border-gray-100 dark:border-navy-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search... (↑↓ to navigate, Enter to select)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={onFocus}
                onKeyDown={handleKeyDown}
                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-navy-950 border-none outline-none text-[11px] font-bold text-gray-700 dark:text-white rounded-md"
              />
            </div>
          </div>
          <div ref={listRef} className="max-h-52 overflow-y-auto no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, i) => {
                const isSelected = selectedValues.includes(opt);
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    onClick={() => {
                      toggleValue(opt);
                      if (!keepOpen && !isMulti) {
                        setIsOpen(false);
                        setSearch("");
                        setActiveIndex(-1);
                      }
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`px-4 py-2 text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-between ${i === activeIndex
                        ? "bg-[#003875] text-white dark:bg-[#FFD500] dark:text-black"
                        : isSelected
                          ? "bg-orange-50 text-[#003875] dark:bg-white/10 dark:text-[#FFD500]"
                          : "text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-white/5"
                      }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <CheckCircleIcon className="w-3.5 h-3.5" />}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-[10px] text-gray-400 font-bold text-center italic">
                No matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const formatDate = (dateString: string) => {
  if (!dateString || dateString === "-") return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch (e) {
    return dateString;
  }
};

const getTimeDelay = (pRaw: string, aRaw: string) => {
  if (!pRaw || pRaw === "-" || pRaw.trim() === "") return null;
  const pDate = new Date(pRaw);
  if (isNaN(pDate.getTime())) return null;

  let cDate = new Date();
  if (aRaw && aRaw !== "-" && aRaw.trim() !== "") {
    const aDate = new Date(aRaw);
    if (!isNaN(aDate.getTime())) cDate = aDate;
  }

  const diffMs = pDate.getTime() - cDate.getTime();
  const absDiff = Math.abs(diffMs);

  if (absDiff < 60000) return { text: "On Time", isDelayed: false };

  const isDelayed = diffMs < 0;
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((absDiff / 1000 / 60) % 60);

  let textParts = [];
  if (days > 0) textParts.push(`${days}d`);
  if (hours > 0) textParts.push(`${hours}h`);
  if (minutes > 0 || textParts.length === 0) textParts.push(`${minutes}m`);

  return {
    text: (isDelayed ? "-" : "+") + textParts.join(" "),
    isDelayed: isDelayed,
  };
};

// --- Main Page ---
export default function O2DPage() {
  const client = null; // Removed AWS Amplify client

  const { data: session } = useSession();
  const currentUser = (session?.user as any)?.username || "";

  // Search and general filters
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states - MUST be before SWR hook that uses them
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [tableFilterParty, setTableFilterParty] = useState("");
  const [tableFilterOrderNo, setTableFilterOrderNo] = useState("");
  const [tableFilterItemName, setTableFilterItemName] = useState("");
  const [multiRowQty, setMultiRowQty] = useState(1);
  const lastFocusedRowRef = useRef<number>(-1);
  const modalScrollRef = useRef<HTMLFormElement>(null);
  const partnerNameRef = useRef<any>(null);



  const centerOnFocus = (e: React.FocusEvent | HTMLElement) => {
    const target = "target" in e ? (e.target as HTMLElement) : e;
    if (!target) return;
    
    // Use a small delay to handle layout shifts (like dropdowns opening)
    setTimeout(() => {
        target.scrollIntoView({ 
            block: "center", 
            behavior: "smooth" 
        });
    }, 100);
  };
  const [tableFilterPending, setTableFilterPending] = useState(false);
  const [selectedDateFilters, setSelectedDateFilters] = useState<string[]>([]);
  const [selectedStepFilters, setSelectedStepFilters] = useState<number[]>([]);

  const [allO2Ds, setAllO2Ds] = useState<O2D[]>([]);
  const [isAllLoading, setIsAllLoading] = useState(false);
  const [totalOrdersServer, setTotalOrdersServer] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- TABLE view: 100 items per page, server-side ---
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const [tableItemsPerPage] = useState(10);
  const tableQueryKey = `/api/o2d?page=${tableCurrentPage}&limit=${tableItemsPerPage}&search=${debouncedSearch}&dateFilters=${encodeURIComponent(JSON.stringify(selectedDateFilters))}&stepFilters=${encodeURIComponent(JSON.stringify(selectedStepFilters))}&partyFilter=${tableFilterParty}&orderFilter=${tableFilterOrderNo}&itemNameFilter=${tableFilterItemName}&pendingFilter=${tableFilterPending}&startDate=${filterStartDate}&endDate=${filterEndDate}`;

  const { data: paginatedResponse, error: paginatedError } = useSWR(
    tableQueryKey,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  useEffect(() => {
    if (paginatedResponse) {
      const expanded = (paginatedResponse.data || []).flatMap(expandO2DItem);
      // Strictly filter items by name in the table view if a filter is active
      const filtered = tableFilterItemName 
        ? expanded.filter((item: O2D) => item.item_name.toLowerCase().trim() === tableFilterItemName.toLowerCase().trim())
        : expanded;
      setAllO2Ds(filtered);
      setTotalOrdersServer(paginatedResponse.total || 0);
      setIsAllLoading(false);
    } else if (!paginatedError) {
      setIsAllLoading(true);
    }
  }, [paginatedResponse, paginatedError, tableFilterItemName]);

  // Fetch all unique item names for the filter dropdown (never shrinks)
  const { data: allItemNamesMaster } = useSWR<string[]>(
    "/api/o2d?type=itemnames",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 600000 }
  );

  // --- SIDEBAR/PANELS view: 10 orders per page, lazy server-side ---
  const [sidebarCurrentPage, setSidebarCurrentPage] = useState(1);
  const [sidebarItemsPerPage] = useState(10);
  const sidebarQueryKey = `/api/o2d?page=${sidebarCurrentPage}&limit=${sidebarItemsPerPage}&search=${debouncedSearch}&dateFilters=${encodeURIComponent(JSON.stringify(selectedDateFilters))}&stepFilters=${encodeURIComponent(JSON.stringify(selectedStepFilters))}&partyFilter=${tableFilterParty}&orderFilter=${tableFilterOrderNo}&itemNameFilter=${tableFilterItemName}&pendingFilter=${tableFilterPending}&startDate=${filterStartDate}&endDate=${filterEndDate}`;
  const { data: sidebarResponse, isLoading: isSidebarLoading } = useSWR(
    sidebarQueryKey,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0, keepPreviousData: true }
  );

  // Fetch summary data first to know total count
  const { data: summaryData } = useSWR<{
    stepCounts: number[];
    totalOrders: number;
    totalRows: number;
  }>(
    "/api/o2d/summary",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  // Use summaryData to set total rows if not already set by paginated fetch
  useEffect(() => {
    if (summaryData?.totalOrders && !totalOrdersServer) {
      setTotalOrdersServer(summaryData.totalOrders);
    }
  }, [summaryData, totalOrdersServer]);

  // Removed sequential chunk fetching logic - now using server-side pagination above

  const allO2DData = allO2Ds;


  // Fetch all order numbers for the Order ID filter dropdown
  const { data: allOrderNumbers } = useSWR<string[]>(
    "/api/o2d?type=ordernumbers",
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 300000,
    }
  );


  const { mutate: globalMutate } = useSWRConfig();

  useSSE({
    modules: O2D_SSE_MODULES,
    onUpdate: (incremental) => {
      const updates = incremental.find((m) => m.module === "o2d");
      if (!updates) return;
      globalMutate(
        tableQueryKey,
        (current: any) => applyPaginatedIncrementalUpdate(current, updates.upserts, updates.currentIds),
        { revalidate: false }
      );
      if (sidebarQueryKey !== tableQueryKey) {
        globalMutate(
          sidebarQueryKey,
          (current: any) => applyPaginatedIncrementalUpdate(current, updates.upserts, updates.currentIds),
          { revalidate: false }
        );
      }
    },
  });

  const patchO2DOrderCache = (mergedOrder: O2D) => {
    const patch = (current: any) => {
      if (!current?.data) return current;
      return {
        ...current,
        data: current.data.map((row: O2D) =>
          row.order_no === mergedOrder.order_no || String(row.id) === String(mergedOrder.id)
            ? { ...row, ...mergedOrder, id: row.id }
            : row
        ),
      };
    };
    globalMutate(tableQueryKey, patch, { revalidate: false });
    if (sidebarQueryKey !== tableQueryKey) {
      globalMutate(sidebarQueryKey, patch, { revalidate: false });
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setActionStatus("loading");
    setActionMessage("Syncing with Google Sheets...");
    setIsStatusModalOpen(true);

    try {
      // Call API with refresh=true to invalidate server cache
      await fetch(`${tableQueryKey}&refresh=true`);
      
      // Trigger SWR revalidation
      await Promise.all([
        globalMutate(tableQueryKey, undefined, { revalidate: true }),
        globalMutate(sidebarQueryKey, undefined, { revalidate: true }),
        globalMutate("/api/o2d/summary", undefined, { revalidate: true })
      ]);

      setActionStatus("success");
      setActionMessage("Synced Successfully");
      setTimeout(() => setIsStatusModalOpen(false), 500);
    } catch (error) {
      setActionStatus("error");
      setActionMessage("Sync failed");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    } finally {
      setIsSyncing(false);
    }
  };
  // Extract O2D data
  const allO2DsRaw = allO2DData || [];

  const groupedOrders = useMemo(() => {
    return allO2DsRaw.reduce((acc: Record<string, O2D[]>, o2d: O2D) => {
      const orderNo = (o2d.order_no || "Unknown").trim();
      if (!acc[orderNo]) acc[orderNo] = [];
      acc[orderNo].push(o2d);
      return acc;
    }, {});
  }, [allO2DsRaw]);

  // Dedicated grouped map for the SIDEBAR — built from the sidebar's own page data
  // This avoids crashes when sidebar is on page N but table is on page 1
  const sidebarGroupedOrders = useMemo(() => {
    let rows: O2D[] = (sidebarResponse?.data || []).flatMap(expandO2DItem);
    if (tableFilterItemName) {
      rows = rows.filter((item: O2D) => item.item_name.toLowerCase().trim() === tableFilterItemName.toLowerCase().trim());
    }
    return rows.reduce((acc: Record<string, O2D[]>, o2d: O2D) => {
      const orderNo = (o2d.order_no || "Unknown").trim();
      if (!acc[orderNo]) acc[orderNo] = [];
      acc[orderNo].push(o2d);
      return acc;
    }, {});
  }, [sidebarResponse, tableFilterItemName]);

  // State for loading during page transitions
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      // Focus the first meaningful field when modal opens
      setTimeout(() => {
        const firstField = document.querySelector('[data-initial-focus]') as HTMLElement;
        if (firstField) {
            firstField.focus();
            centerOnFocus(firstField);
        }
      }, 300);
    }
  }, [isModalOpen]);
  const [editingOrderNo, setEditingOrderNo] = useState<string | null>(null);
  const userRole = (session?.user as any)?.role || "User";
  const isSpecialRole =
    userRole.toUpperCase() === "ADMIN" || 
    userRole.toUpperCase() === "EA" || 
    userRole.toUpperCase() === "SALES" || 
    userRole.toUpperCase() === "CRM";
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);

  // Data
  const [parties, setParties] = useState<string[]>([]);
  const [fullParties, setFullParties] = useState<any[]>([]);
  const [dropdownItems, setDropdownItems] = useState<
    { name: string; amount: string }[]
  >([]);

  // Form State
  const [commonData, setCommonData] = useState({
    order_no: "",
    party_name: "",
    remark: "",
  });
  const [items, setItems] = useState<O2DItem[]>([]);
  const [newPartyDraft, setNewPartyDraft] =
    useState<Partial<PartyManagement> | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Modals
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<
    "loading" | "success" | "error"
  >("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    type: "delete" | "hold" | "cancelled";
    orderNo: string;
    currentValue?: string;
  } | null>(null);
  const [isRemoveFollowUpModalOpen, setIsRemoveFollowUpModalOpen] =
    useState(false);
  const [removeStep, setRemoveStep] = useState(1);
  const [removeOnwards, setRemoveOnwards] = useState(true);

  const [isBusyModalOpen, setIsBusyModalOpen] = useState(false);
  const [busySearchQuery, setBusySearchQuery] = useState("");

  // Fetch all orders for Busy Modal (not paginated)
  const busyQueryKey = `/api/o2d?page=1&limit=-1&pendingFilter=true&currentUser=${currentUser}&userRole=${userRole}`;
  const { data: busyResponse } = useSWR(
    isBusyModalOpen ? busyQueryKey : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );

  const busyOrdersGrouped = useMemo(() => {
    return (busyResponse?.data || []).reduce((acc: Record<string, O2D[]>, o2d: O2D) => {
      const orderNo = (o2d.order_no || "Unknown").trim();
      if (!acc[orderNo]) acc[orderNo] = [];
      acc[orderNo].push(o2d);
      return acc;
    }, {});
  }, [busyResponse]);

  const [masterOrderMap, setMasterOrderMap] = useState<Record<string, O2D[]>>({});

  useEffect(() => {
    setMasterOrderMap(prev => {
      const next = { ...prev };
      
      // Helper to merge while avoiding overwriting full data with partial/filtered data
      const mergeIfBetter = (no: string, items: O2D[]) => {
        if (!no || !items || items.length === 0) return;
        const trimmedNo = no.trim();
        const existing = next[trimmedNo];
        
        // If we don't have it, or the new data has more items, or we don't have a filter active that might be restricting items
        // We generally want to merge if we have no existing data or if the new data looks 'fresher' or more complete
        const isNewer = !existing || items.length >= existing.length;
        const noFilter = !tableFilterItemName;
        
        if (isNewer || noFilter) {
          next[trimmedNo] = items;
        }
      };

      // Merge Table orders (usually 10 items per page)
      Object.entries(groupedOrders as Record<string, O2D[]>).forEach(([no, items]) => {
        mergeIfBetter(no, items);
      });

      // Merge Sidebar orders (usually 10 orders per page)
      Object.entries(sidebarGroupedOrders as Record<string, O2D[]>).forEach(([no, items]) => {
        mergeIfBetter(no, items);
      });

      // Merge Busy orders (from modal)
      Object.entries(busyOrdersGrouped as Record<string, O2D[]>).forEach(([no, items]) => {
        mergeIfBetter(no, items);
      });

      return next;
    });
  }, [groupedOrders, sidebarGroupedOrders, busyOrdersGrouped, tableFilterItemName]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderNo) return [];
    const trimmedNo = selectedOrderNo.trim();
    
    // Priority order for finding selected order data:
    // 1. Persistent master map (primary source of truth - should have most complete data)
    const fromMaster = masterOrderMap[trimmedNo];
    if (fromMaster && fromMaster.length > 0) {
      // If we have a filter, verify if the current sidebar/table has a more "relevant" version
      // but generally the master map should be the safest bet for completeness.
      const fromSidebar = (sidebarGroupedOrders as Record<string, O2D[]>)[trimmedNo];
      if (fromSidebar && fromSidebar.length > fromMaster.length) return fromSidebar;
      return fromMaster;
    }
    
    // 2. Sidebar (current page - reactive fallback)
    const fromSidebar = (sidebarGroupedOrders as Record<string, O2D[]>)[trimmedNo];
    if (fromSidebar && fromSidebar.length > 0) return fromSidebar;

    // 3. Table view (current page - reactive fallback)
    const fromTable = (groupedOrders as Record<string, O2D[]>)[trimmedNo];
    if (fromTable && fromTable.length > 0) return fromTable;
    
    // 4. Busy orders (from modal - reactive fallback)
    const fromBusy = (busyOrdersGrouped as Record<string, O2D[]>)[trimmedNo];
    if (fromBusy && fromBusy.length > 0) return fromBusy;

    return [];
  }, [masterOrderMap, sidebarGroupedOrders, groupedOrders, busyOrdersGrouped, selectedOrderNo]);

  const getPreviewUrl = (path: string | null | undefined) => {
    if (!path) return "#";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return getDrivePreviewUrl(path);
  };

  const getDownloadUrl = (path: string | null | undefined) => {
    if (!path) return "#";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return getDriveDownloadUrl(path);
  };

  const [detailViewMode, setDetailViewMode] = useState<"full" | "table">(
    "full",
  );
  const [pageViewMode, setPageViewMode] = useState<"panels" | "table">(
    "panels",
  );

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportIncludeDetails, setExportIncludeDetails] = useState(true);
  const [exportSelectedSteps, setExportSelectedSteps] = useState<number[]>([]);

  // Reset BOTH sidebar and table pages when filters change
  useEffect(() => {
    setSidebarCurrentPage(1);
    setTableCurrentPage(1);
  }, [searchTerm, selectedDateFilters, selectedStepFilters, tableFilterParty, tableFilterOrderNo, tableFilterItemName, tableFilterPending, filterStartDate, filterEndDate]);


  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  // Setup Config
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [globalConfigs, setGlobalConfigs] = useState<O2DStepConfig[]>([]);
  const [stepConfigs, setStepConfigs] = useState<O2DStepConfig[]>([]);
  const [usersList, setUsersList] = useState<string[]>([]);

  // Step Update Modal State
  const [isStepUpdateModalOpen, setIsStepUpdateModalOpen] = useState(false);
  const [currentStepToUpdate, setCurrentStepToUpdate] = useState<number>(1);
  const [stepUpdateFields, setStepUpdateFields] = useState<any>({});
  const [stepAttachment, setStepAttachment] = useState<File | null>(null);
  const [stepAttachmentPreview, setStepAttachmentPreview] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchO2Ds();
    fetchDetails();
  }, []);

  const fetchO2Ds = async () => {
    // Now handled by SWR
    // We just trigger a revalidation if needed
    mutate("O2D");
  };

  const fetchDetails = async () => {
    try {
      const [imsRes, configRes, partiesRes] = await Promise.all([
        fetch("/api/ims"),
        fetch("/api/o2d/config"),
        fetch("/api/party-management?limit=9999"), // get all party names for dropdown
      ]);

      const imsData = await imsRes.json();
      const configData = await configRes.json();
      const partiesRaw = await partiesRes.json();

      // API returns paginated { data: [], total: N } — unwrap .data
      const partiesData = Array.isArray(partiesRaw) ? partiesRaw : (partiesRaw?.data || []);

      if (Array.isArray(partiesData) && partiesData.length > 0) {
        setFullParties(partiesData);
        setParties(partiesData.map((p: any) => p.partyName).filter(Boolean));
      }

      if (Array.isArray(imsData)) {
        setDropdownItems(
          imsData.map((item: any) => ({
            name: item.item_name,
            amount: item.final_amount,
            gst: item.gst,
          }))
        );
      }

      if (configData && Array.isArray(configData)) {
        const mergedConfigs = O2D_STEPS.map((step, idx) => {
          const found =
            configData.find((c: any) => c.step_name === step) || configData[idx];
          return {
            step_name: step,
            tat: found?.tat || "24 Hrs",
            responsible_person: found?.responsible_person || "",
          };
        });
        setGlobalConfigs(mergedConfigs);
        setStepConfigs(mergedConfigs);
      }
    } catch (error) {
      console.error("Error fetching o2d details:", error);
    }
  };

  const generateOrderNo = (orderNos: string[]) => {
    if (!orderNos || orderNos.length === 0) return "OR-01";
    const maxNum = orderNos.reduce((max, no) => {
      const num = parseInt(no?.replace("OR-", "") || "0");
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `OR-${(maxNum + 1).toString().padStart(2, "0")}`;
  };

  const calculatePlannedDate = (baseDate: string | Date, tatString: string) => {
    if (!baseDate || !tatString) return "";
    let date = new Date(baseDate);
    if (isNaN(date.getTime())) return "";

    const parts = tatString.trim().split(" ");
    let val = parseFloat(parts[0]);
    const unit = parts[1]?.toLowerCase() || "hrs";
    if (isNaN(val)) return date.toISOString();

    // Convert everything to minutes to consume
    let totalMinutesToConsume = unit.includes("day") ? val * 10 * 60 : val * 60;

    const WORK_START_HOUR = 9.5; // 9:30 AM
    const WORK_END_HOUR = 18.5; // 6:30 PM
    const MINS_PER_WORK_DAY = (WORK_END_HOUR - WORK_START_HOUR) * 60;

    while (totalMinutesToConsume > 0) {
      // 1. Skip Sunday
      if (date.getDay() === 0) {
        date.setDate(date.getDate() + 1);
        date.setHours(9, 30, 0, 0);
        continue;
      }

      // 2. Adjust current time to working window if outside
      let hours = date.getHours();
      let mins = date.getMinutes();
      let currentTimeVal = hours + mins / 60;

      if (currentTimeVal >= WORK_END_HOUR) {
        // Move to next day 9:30 AM
        date.setDate(date.getDate() + 1);
        date.setHours(9, 30, 0, 0);
        continue;
      }

      if (currentTimeVal < WORK_START_HOUR) {
        date.setHours(9, 30, 0, 0);
        currentTimeVal = WORK_START_HOUR;
      }

      // 3. Calculate available minutes in the current window
      const endOfToday = new Date(date);
      endOfToday.setHours(18, 30, 0, 0);
      const availableMinutesToday =
        (endOfToday.getTime() - date.getTime()) / (1000 * 60);

      if (totalMinutesToConsume <= availableMinutesToday) {
        date.setMinutes(date.getMinutes() + totalMinutesToConsume);
        totalMinutesToConsume = 0;
      } else {
        totalMinutesToConsume -= availableMinutesToday;
        // Move to next day 9:30 AM
        date.setDate(date.getDate() + 1);
        date.setHours(9, 30, 0, 0);
      }
    }

    // Final check: if final date falls on Sunday, move to Monday
    if (date.getDay() === 0) {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 30, 0, 0);
    }

    return date.toISOString();
  };

  const getPendingStepIdx = (orderItems: O2D[]): number => {
    const firstItem = orderItems[0] as any;
    for (let i = 1; i <= 11; i++) {
      const pVal = (firstItem[`planned_${i}`] || "").toString().trim();
      const aVal = (firstItem[`actual_${i}`] || "").toString().trim();
      const sVal = (firstItem[`status_${i}`] || "").toString().trim();

      // Step is active if it's PLANNED...
      if (pVal && pVal !== "-" && pVal !== "") {
        const hasActual = aVal && aVal !== "-" && aVal !== "";
        const isStep3CompletedNo = i === 3 && sVal === "No";
        const isStep4CompletedNo = i === 4 && sVal === "No";

        // Step 3 with "No" is only "done" if Step 4 is planned
        let stepDone = hasActual && sVal !== "No";
        if (isStep3CompletedNo) {
          const step4Plan = (firstItem[`planned_4`] || "").toString().trim();
          if (step4Plan && step4Plan !== "-" && step4Plan !== "") {
            stepDone = true;
          }
        }

        // Step 4 with "No" is always "done" (it terminates the process)
        if (isStep4CompletedNo) stepDone = true;

        if (!stepDone) {
          return i;
        }

        // If Step 4 specifically was the termination point, return -1
        if (isStep4CompletedNo) return -1;
      }
    }
    return -1;
  };

  const getBaseFilterMatch = (no: string, items: O2D[]): boolean => {
    // With server-side filtering, we just return true here as the data is already filtered
    return true;
  };

  // Helper: check if an order matches the date filter based on planned times of steps
  const orderMatchesDateFilter = (
    orderItems: O2D[],
    filter: string,
  ): boolean => {
    if (!filter) return true; // Status-based filters
    if (filter === "Hold")
      return !!orderItems[0].hold && !orderItems[0].cancelled;
    if (filter === "Cancelled") return !!orderItems[0].cancelled;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const pendingStepIdx = getPendingStepIdx(orderItems);

    // If fully completed, it doesn't show in active date filters
    if (pendingStepIdx === -1) return false;

    const firstItem = orderItems[0] as any;
    const plannedRaw = firstItem[`planned_${pendingStepIdx}`] as string;
    if (!plannedRaw || plannedRaw === "-" || plannedRaw.trim() === "")
      return false;

    const pd = new Date(plannedRaw);
    if (isNaN(pd.getTime())) return false;

    const pdDay = new Date(pd);
    pdDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (pdDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (filter === "Delayed") return pd < now;
    if (filter === "Today") return diffDays === 0;
    if (filter === "Tomorrow") return diffDays === 1;
    if (filter === "Next5") return diffDays > 0 && diffDays <= 5;
    if (filter === "Next10") return diffDays > 0 && diffDays <= 10;

    return false;
  };

  const getStepFilterCount = (stepIdx: number): number => {
    if (summaryData?.stepCounts && stepIdx >= 1 && stepIdx <= 11) {
      return summaryData.stepCounts[stepIdx - 1] || 0;
    }
    return 0;
  };

  const getDateFilterCount = (filter: string): number => {
    if (!summaryData) return 0;
    if (filter === "Hold") return summaryData.stepCounts?.[11] || 0; // Assuming we add this to summary API
    if (filter === "Cancelled") return summaryData.stepCounts?.[12] || 0;

    // For other date filters like Today, Tomorrow, etc.
    // If the summary API doesn't provide them, we might need to calculate from current page
    // but the user wants the "overall" count.
    // For now, let's return 0 or a placeholder if not in summaryData
    return 0;
  };

  const memoizedOrderOptions = useMemo(() => {
    return allOrderNumbers || [];
  }, [allOrderNumbers]);

  const memoizedItemOptions = useMemo(() => {
    return allItemNamesMaster || [];
  }, [allItemNamesMaster]);

  // Sidebar uses its own server-driven page of order numbers
  const filteredOrderNumbers = useMemo(() => {
    return sidebarResponse?.orders || [];
  }, [sidebarResponse]);

  const sidebarTotalOrders = sidebarResponse?.total ?? totalOrdersServer;
  const sidebarTotalPages = Math.ceil(sidebarTotalOrders / sidebarItemsPerPage) || 1;

  const totalOrdersCount = totalOrdersServer;
  const totalItemsCount = paginatedResponse?.totalRows || 0;

  useEffect(() => {
    // Scroll to top on filter change
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchTerm, selectedDateFilters, selectedStepFilters]);

  const toggleDateFilter = (id: string) => {
    if (id === "") {
      setSelectedDateFilters([]);
      return;
    }
    setSelectedDateFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const toggleStepFilter = (stepIdx: number) => {
    setSelectedStepFilters((prev) =>
      prev.includes(stepIdx)
        ? prev.filter((s) => s !== stepIdx)
        : [...prev, stepIdx],
    );
  };



  const handlePasteData = () => {
    if (!pasteText.trim()) {
        setIsPasteModalOpen(false);
        return;
    }

    const lines = pasteText.split('\n');
    const newItems: O2DItem[] = [];

    lines.forEach(line => {
      let parts = line.split('\t');
      if (parts.length < 2 && line.includes(',')) {
        parts = line.split(',');
      }
      
      if (parts.length >= 2) {
        const itemName = parts[0].trim();
        const matchingItem = dropdownItems.find(di => di.name.toLowerCase() === itemName.toLowerCase());
        
        newItems.push({
          item_name: itemName,
          item_qty: parts[1].trim(),
          est_amount: matchingItem ? matchingItem.amount : "",
          item_specification: parts[2] ? parts[2].trim() : ""
        });
      } else if (parts.length === 1 && parts[0].trim() !== "") {
        const itemName = parts[0].trim();
        const matchingItem = dropdownItems.find(di => di.name.toLowerCase() === itemName.toLowerCase());
        
        newItems.push({
          item_name: itemName,
          item_qty: "1",
          est_amount: matchingItem ? matchingItem.amount : "",
          item_specification: ""
        });
      }
    });

    if (newItems.length > 0) {
      if (items.length === 1 && !items[0].item_name && !items[0].item_qty) {
        setItems(newItems);
      } else {
        setItems([...items, ...newItems]);
      }
    }
    
    setPasteText("");
    setIsPasteModalOpen(false);
  };

  const addItemRow = (count = 1) => {
    const newRows = Array.from({ length: count }).map(() => ({ 
        item_name: "", 
        item_qty: "", 
        est_amount: "", 
        item_specification: "" 
    }));
    setItems([...items, ...newRows]);
    lastFocusedRowRef.current = items.length; // Focus the first new item
  };

  // Effect to handle auto-focusing newly added rows
  useEffect(() => {
    if (lastFocusedRowRef.current !== -1) {
      const targetIndex = lastFocusedRowRef.current;
      // Small timeout to wait for render
      setTimeout(() => {
        const nomenclatureFields = document.querySelectorAll('[data-nomenclature-trigger]');
        const target = nomenclatureFields[targetIndex] as HTMLElement;
        if (target) {
            target.focus();
            centerOnFocus(target);
        }
      }, 50);
      lastFocusedRowRef.current = -1;
    }
  }, [items.length]);
  const removeItemRow = (index: number) =>
    items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const handleItemChange = (
    index: number,
    field: keyof O2DItem,
    value: string,
  ) => {
    const newItems = [...items];
    newItems[index][field] = value;
    const itemName = field === "item_name" ? value : newItems[index].item_name;
    const qty = parseFloat(
      field === "item_qty" ? value : newItems[index].item_qty,
    );
    const match = dropdownItems.find((di) => di.name === itemName);
    if (match) {
      const unitPrice = parseFloat(match.amount);
      if (!isNaN(unitPrice) && !isNaN(qty))
        newItems[index].est_amount = (unitPrice * qty).toFixed(2);
      else if (!isNaN(unitPrice))
        newItems[index].est_amount = unitPrice.toFixed(2);
    }
    setItems(newItems);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setScreenshotFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setCommonData({ order_no: "", party_name: "", remark: "" });
    setItems([
      { item_name: "", item_qty: "", est_amount: "", item_specification: "" },
    ]);
    setScreenshotFile(null);
    setImagePreview(null);
    setEditingOrderNo(null);
  };

  const mergeItems = (itemsToMerge: O2DItem[]) => {
    const item_name = itemsToMerge.map((it, i) => `${i + 1}. ${it.item_name}`).join(" | ");
    const item_qty = itemsToMerge.map((it, i) => `${i + 1}. ${it.item_qty}`).join(" | ");
    const est_amount = itemsToMerge.map((it, i) => `${i + 1}. ${it.est_amount}`).join(" | ");
    const item_specification = itemsToMerge.map((it, i) => `${i + 1}. ${it.item_specification || ""}`).join(" | ");
    return { item_name, item_qty, est_amount, item_specification };
  };

  const mergeExpandedItems = (expandedItems: O2D[]): O2D | null => {
    if (expandedItems.length === 0) return null;
    if (expandedItems.length === 1) return expandedItems[0];

    const base = { ...expandedItems[0] };
    // Restore the original ID by removing any -idx suffix
    if (typeof base.id === "string") {
      base.id = base.id.split("-")[0];
    }

    const itemsToMerge = expandedItems.map(it => ({
      item_name: it.item_name,
      item_qty: it.item_qty,
      est_amount: it.est_amount,
      item_specification: it.item_specification
    }));

    const { item_name, item_qty, est_amount, item_specification } = mergeItems(itemsToMerge);
    return { 
      ...base, 
      item_name, 
      item_qty, 
      est_amount, 
      item_specification 
    };
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mandatory Field Validation

    if (!commonData.party_name) {
      setActionStatus("error");
      setActionMessage("Partner Name is mandatory.");
      setIsStatusModalOpen(true);
      return;
    }
    if (items.length === 0 || !items[0].item_name || !items[0].item_qty) {
      setActionStatus("error");
      setActionMessage("At least one item with name and quantity is mandatory.");
      setIsStatusModalOpen(true);
      return;
    }

    const now = new Date().toISOString();

    // Show loader
    setActionStatus("loading");
    setActionMessage(
      editingOrderNo ? "Updating Order..." : "Creating Order...",
    );
    setIsStatusModalOpen(true);

    // Optimistic Update
    const currentO2Ds = allO2DsRaw;
    let optimisticO2Ds = [...allO2DsRaw];
    let currentMaxId =
      allO2DsRaw.length > 0 ? Math.max(...allO2DsRaw.map((o: any) => parseInt(o.id) || 0)) : 0;

    try {
      if (editingOrderNo) {
        let baseRecord = { ...(masterOrderMap[editingOrderNo] || groupedOrders[editingOrderNo])[0] };

        // Cascading logic
        let currentBase = baseRecord.created_at || now;
        for (let i = 0; i < 11; i++) {
          const tat = globalConfigs[i]?.tat || "24 Hrs";
          const pKey = `planned_${i + 1}`;
          if (i === 0) {
            if (!(baseRecord as any)[pKey])
              (baseRecord as any)[pKey] = calculatePlannedDate(
                currentBase,
                tat,
              );
          } else {
            const prevActual = (baseRecord as any)[`actual_${i}`];
            if (prevActual && prevActual !== "-" && prevActual.trim() !== "") {
              (baseRecord as any)[pKey] = calculatePlannedDate(prevActual, tat);
            } else if (!(baseRecord as any)[pKey]) {
              (baseRecord as any)[pKey] = "";
            }
          }
        }

        const { item_name, item_qty, est_amount, item_specification } = mergeItems(items);
        let idToUse = items[0]?.id || baseRecord.id;
        if (idToUse && typeof idToUse === "string") {
          idToUse = idToUse.split("-")[0];
        }
        
        if (!idToUse) {
          currentMaxId++;
          idToUse = currentMaxId.toString();
        }

        const baseTime = baseRecord.created_at || now;
        const updated = {
          ...baseRecord,
          id: idToUse,
          item_name,
          item_qty,
          est_amount,
          item_specification,
          party_name: commonData.party_name,
          remark: commonData.remark,
          created_at: baseTime,
          updated_at: now,
        } as O2D;

        // Recalculate cascading logic for THIS item/row
        let currentBaseForUpdated = updated.created_at || now;
        for (let i = 0; i < 11; i++) {
          const tat = globalConfigs[i]?.tat || "24 Hrs";
          const pKey = `planned_${i + 1}`;
          const stepIdx = i + 1;

          if (i === 0) {
            if (!(updated as any)[pKey])
              (updated as any)[pKey] = calculatePlannedDate(currentBaseForUpdated, tat);
          } else {
            const prevActual = (updated as any)[`actual_${i}`];
            const prevStatus = (updated as any)[`status_${i}`];

            // Skip logic: if Step 3 is Yes, skip Step 4 and go to Step 5
            if (stepIdx === 4 && prevStatus === "Yes" && i === 3) {
              (updated as any)[pKey] = ""; // Skip Step 4
              continue;
            }
            if (stepIdx === 5 && (updated as any)[`status_3`] === "Yes") {
              const actual3 = (updated as any)[`actual_3`];
              if (actual3 && actual3 !== "-" && actual3.trim() !== "") {
                (updated as any)[pKey] = calculatePlannedDate(actual3, tat);
                continue;
              }
            }

            // Termination logic: if Step 4 is No, end the process (no planned Step 5)
            if (stepIdx === 5 && prevStatus === "No" && i === 4) {
              (updated as any)[pKey] = ""; // Skip Step 5
              continue;
            }

            if (
              prevActual &&
              prevActual !== "-" &&
              prevActual.trim() !== ""
            ) {
              (updated as any)[pKey] = calculatePlannedDate(prevActual, tat);
            } else if (!(updated as any)[pKey]) {
              (updated as any)[pKey] = "";
            }
          }
        }
        const updatedItems = [updated];

        optimisticO2Ds = optimisticO2Ds.filter(
          (o) => o.order_no !== editingOrderNo,
        );
        optimisticO2Ds = [...updatedItems.flatMap(expandO2DItem), ...optimisticO2Ds];

        // Optimistic UI removed for data integrity
        
        setIsModalOpen(false);
        resetForm();

        const formData = new FormData();
        formData.append("o2dData", JSON.stringify(updatedItems));
        if (screenshotFile) formData.append("order_screenshot", screenshotFile);

        const res = await fetch(`/api/o2d/order/${editingOrderNo}`, {
          method: "PUT",
          body: formData,
        });
        if (!res.ok) throw new Error("Update failed");
      } else {
        const tat1 = globalConfigs[0]?.tat || "24 Hrs";
        const finalOrderNo = generateOrderNo(allOrderNumbers || []);
        let initRecord: any = { planned_1: calculatePlannedDate(now, tat1) };
        for (let i = 2; i <= 11; i++) initRecord[`planned_${i}`] = "";

        const { item_name, item_qty, est_amount, item_specification } = mergeItems(items);
        const newId = Date.now().toString();
        const newItems = [{
          ...initRecord,
          id: newId,
          order_no: finalOrderNo,
          party_name: commonData.party_name,
          item_name,
          item_qty,
          est_amount,
          item_specification,
          remark: commonData.remark,
          filled_by: currentUser,
          created_at: now,
          updated_at: now,
        } as O2D];

        optimisticO2Ds = [...newItems.flatMap(expandO2DItem), ...optimisticO2Ds];

        // Optimistic UI removed for data integrity

        setIsModalOpen(false);
        resetForm();

        const formData = new FormData();
        formData.append("o2dData", JSON.stringify(newItems));
        if (screenshotFile) formData.append("order_screenshot", screenshotFile);
        const res = await fetch("/api/o2d", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Creation failed");

        // IF we have a NEW PARTY draft, submit it now with the actual finalOrderNo
        if (newPartyDraft) {
          const finalPartyPayload = {
            ...newPartyDraft,
            customerType: `NEW (${finalOrderNo})`,
          };

          await fetch("/api/party-management", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalPartyPayload),
          });

          setNewPartyDraft(null); // Clear draft
          await fetchDetails(); // Refresh parties to show newly formatted customerType
        }
      }
      setActionStatus("success");
      setActionMessage(editingOrderNo ? "Order Updated!" : "Order Created!");
      
      // Revalidate all relevant keys
      globalMutate(tableQueryKey);
      globalMutate(sidebarQueryKey);
      globalMutate("/api/o2d/summary");
      globalMutate("/api/o2d?type=ordernumbers");

      // MANUAL CACHE UPDATE: Ensure the master map has the latest data immediately
      // This handles the case where the order is not on the current sidebar pagination page
      if (editingOrderNo) {
        const { item_name, item_qty, est_amount, item_specification } = mergeItems(items);
        const updatedItems = [{
          ...groupedOrders[editingOrderNo][0],
          item_name,
          item_qty,
          est_amount,
          item_specification,
          party_name: commonData.party_name,
          remark: commonData.remark,
          updated_at: now
        }].flatMap(expandO2DItem);
        
        setMasterOrderMap(prev => ({
          ...prev,
          [editingOrderNo]: updatedItems
        }));
      }

      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } catch (error: any) {
      console.error(error);
      // Rollback
      globalMutate(tableQueryKey, paginatedResponse, false);
      globalMutate(sidebarQueryKey, sidebarResponse, false);
      
      setActionStatus("error");
      setActionMessage(error.message);
      setIsStatusModalOpen(true);
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const handleEdit = (orderNo: string) => {
    const orderItems = masterOrderMap[orderNo.trim()] || [];
    setEditingOrderNo(orderNo);
    setCommonData({
      order_no: orderNo,
      party_name: orderItems[0].party_name,
      remark: orderItems[0].remark,
    });
    
    setItems(
      orderItems.map((o) => ({
        id: o.id,
        item_name: o.item_name,
        item_qty: o.item_qty,
        est_amount: o.est_amount,
        item_specification: o.item_specification || "",
      })),
    );

    setImagePreview(
      orderItems[0].order_screenshot
        ? getDriveImageUrl(orderItems[0].order_screenshot)
        : null,
    );
    setIsModalOpen(true);
  };

  const handleDeleteClick = (orderNo: string) => {
    setConfirmPayload({ type: "delete", orderNo });
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    const orderNo = confirmPayload?.orderNo;
    if (!orderNo) return;

    // Optimistic UI removed for data integrity

    setSelectedOrderNo(null);
    setConfirmPayload(null);
    setIsConfirmOpen(false);

    // Show loader
    setActionStatus("loading");
    setActionMessage("Deleting Order...");
    setIsStatusModalOpen(true);

    try {
      const res = await fetch(`/api/o2d/order/${orderNo}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setActionStatus("success");
      setActionMessage("Order Deleted");
      
      // Simple summary refresh
      // Revalidate
      globalMutate(tableQueryKey);
      globalMutate(sidebarQueryKey);
      globalMutate("/api/o2d/summary");
      globalMutate("/api/o2d?type=ordernumbers");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    } catch (err) {
      setActionStatus("error");
      setActionMessage("Delete Failed");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const handleOpenSetup = async () => {
    setActionStatus("loading");
    setActionMessage("Fetching Configurations...");
    setIsStatusModalOpen(true);
    try {
      const [configRes, usersRes] = await Promise.all([
        fetch("/api/o2d/config"),
        fetch("/api/users"),
      ]);
      const configData = await configRes.json();
      const usersData = await usersRes.json();

      setUsersList(usersData.map((u: any) => u.username));

      if (configData && Array.isArray(configData)) {
        const mergedConfigs = O2D_STEPS.map((step, idx) => {
          const found =
            configData.find((c) => c.step_name === step) || configData[idx];
          return {
            step_name: step,
            tat: found?.tat || "",
            responsible_person: found?.responsible_person || "",
          };
        });
        setStepConfigs(mergedConfigs);
      } else {
        setStepConfigs(
          O2D_STEPS.map((step) => ({
            step_name: step,
            tat: "",
            responsible_person: "",
          })),
        );
      }
      setIsStatusModalOpen(false);
      setIsSetupModalOpen(true);
    } catch (e: any) {
      setActionStatus("error");
      setActionMessage(e.message || "Failed to fetch parameters");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionStatus("loading");
    setActionMessage("Saving Configurations...");
    setIsStatusModalOpen(true);
    try {
      const res = await fetch("/api/o2d/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepConfigs),
      });
      if (!res.ok) throw new Error("Save failed");

      // Update global configs in memory
      setGlobalConfigs(stepConfigs);

      setActionStatus("success");
      setActionMessage("Configuration Saved Successfully");
      setTimeout(() => {
        setIsStatusModalOpen(false);
        setIsSetupModalOpen(false);
      }, 1500);
    } catch (e: any) {
      setActionStatus("error");
      setActionMessage(e.message || "Failed to save configuration");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const handleToggleStatus = async (
    orderNo: string,
    action: "hold" | "cancelled",
    currentValue: string | undefined,
  ) => {
    if (!orderNo) return;

    const newValue = !currentValue ? new Date().toISOString() : "";
    setConfirmPayload(null);
    setConfirmPayload(null);
    setIsConfirmOpen(false);

    // Show loader
    const actionLabel =
      action === "hold"
        ? newValue
          ? "Putting On Hold..."
          : "Releasing Hold..."
        : newValue
          ? "Cancelling Order..."
          : "Restoring Order...";
    setActionStatus("loading");
    setActionMessage(actionLabel);
    setIsStatusModalOpen(true);

    try {
      const res = await fetch("/api/o2d/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, action, value: newValue }),
      });

      if (!res.ok) throw new Error(`Failed to toggle ${action}`);
      setActionStatus("success");
      setActionMessage("Status Updated");

      // MANUAL CACHE UPDATE: Reflect the status change in the master map immediately
      setMasterOrderMap(prev => {
        const existing = prev[orderNo];
        if (!existing) return prev;
        const updated = existing.map(o => ({
          ...o,
          [action]: newValue,
          updated_at: new Date().toISOString()
        }));
        return { ...prev, [orderNo]: updated };
      });
      setAllO2Ds((prev) =>
        prev.map((o) =>
          o.order_no === orderNo ? { ...o, [action]: newValue, updated_at: new Date().toISOString() } : o
        )
      );
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } catch (e: any) {
      setActionStatus("error");
      setActionMessage(e.message || "Action failed");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const flattenedO2Ds = useMemo(() => {
    if (!allO2DsRaw || allO2DsRaw.length === 0) return [];

    // 1. Group by order_no
    const groups: Record<string, O2D[]> = {};
    allO2DsRaw.forEach((item: any) => {
      const no = (item.order_no || "Unknown").trim();
      if (!groups[no]) groups[no] = [];
      groups[no].push(item);
    });

    // 2. Sort groups by their latest item's created_at (descending) -> "latest order on top"
    // Also ensuring items within group are chronological (original order usually)
    const sortedNos = Object.keys(groups).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 3. Flatten back, items in groups should be ASCENDING created_at (first entry on top)
    const result: O2D[] = [];
    sortedNos.forEach((no) => {
      const sortedGroup = [...groups[no]].sort(
        (x, y) =>
          new Date(x.created_at || 0).getTime() -
          new Date(y.created_at || 0).getTime(),
      );
      result.push(...sortedGroup);
    });

    return result;
  }, [allO2DsRaw]);

  const filteredTableData = useMemo(() => {
    return flattenedO2Ds.filter((item) => {
      // Basic Search (Order No, Party, Item Name)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (item.order_no || "").toLowerCase().includes(searchLower) ||
        (item.party_name || "").toLowerCase().includes(searchLower) ||
        (item.item_name || "").toLowerCase().includes(searchLower);

      // Party Filter
      const matchesParty =
        !tableFilterParty ||
        (item.party_name || "").toLowerCase().includes(tableFilterParty.toLowerCase());

      // Order ID Filter
      const matchesOrderId =
        !tableFilterOrderNo ||
        (item.order_no || "").toLowerCase().includes(tableFilterOrderNo.toLowerCase());

      // Item Name Filter
      const matchesItemName =
        !tableFilterItemName ||
        (item.item_name || "")
          .toLowerCase()
          .includes(tableFilterItemName.toLowerCase());

      // Date Range Filter
      let matchesDateRange = true;
      if (filterStartDate || filterEndDate) {
        const itemDate = new Date(item.created_at || item.updated_at);
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) matchesDateRange = false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) matchesDateRange = false;
        }
      }

      // Pending Filter
      let matchesPending = true;
      if (tableFilterPending) {
        const isHold = !!item.hold;
        const isCancelled = !!item.cancelled;
        const oItems = groupedOrders[item.order_no] || [item];
        const pIdx = getPendingStepIdx(oItems);
        matchesPending = !isHold && !isCancelled && pIdx !== -1;
      }

      return (
        matchesSearch &&
        matchesParty &&
        matchesOrderId &&
        matchesItemName &&
        matchesDateRange &&
        matchesPending
      );
    });
  }, [
    flattenedO2Ds,
    searchTerm,
    tableFilterParty,
    tableFilterOrderNo,
    tableFilterItemName,
    filterStartDate,
    filterEndDate,
    tableFilterPending,
  ]);

  const tableTotalPages = Math.ceil(totalOrdersServer / tableItemsPerPage);
  const tableData = allO2Ds;

  const handleRemoveFollowUp = async () => {
    if (!selectedOrderNo) return;
    setActionStatus("loading");
    setActionMessage(
      `Purging Step ${removeStep}${removeOnwards ? " Onwards" : ""}...`,
    );
    setIsStatusModalOpen(true);

    try {
      const res = await fetch("/api/o2d/remove-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNo: selectedOrderNo,
          startStep: removeStep,
          onlyThisStep: !removeOnwards,
        }),
      });

      if (!res.ok) throw new Error("Purge failed");

      setActionStatus("success");
      setActionMessage("Data Cleared Successfully");
      setIsRemoveFollowUpModalOpen(false);

      // MANUAL CACHE UPDATE: Refresh the master map to reflect purged steps immediately
      setMasterOrderMap(prev => {
        const existing = prev[selectedOrderNo];
        if (!existing) return prev;
        const updated = existing.map(o => {
          const newO = { ...o };
          for (let i = removeStep; i <= 11; i++) {
            if (removeOnwards || i === removeStep) {
              (newO as any)[`status_${i}`] = "";
              (newO as any)[`actual_${i}`] = "";
              (newO as any)[`planned_${i}`] = "";
            }
          }
          return newO;
        });
        return { ...prev, [selectedOrderNo]: updated };
      });
      setTimeout(() => setIsStatusModalOpen(false), 500);
    } catch (e: any) {
      setActionStatus("error");
      setActionMessage(e.message || "Purge failed");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const handleExport = async () => {
    if (!exportIncludeDetails && exportSelectedSteps.length === 0) {
      setActionStatus("error");
      setActionMessage("Please select at least one step or order details to export");
      setIsStatusModalOpen(true);
      setTimeout(() => setIsStatusModalOpen(false), 2000);
      return;
    }

    setActionStatus("loading");
    setActionMessage("Generating export file...");
    setIsStatusModalOpen(true);

    try {
      // Send export request
      const response = await fetch("/api/o2d/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedSteps: exportSelectedSteps,
          includeDetails: exportIncludeDetails,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Get the CSV blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `O2D_Export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setActionStatus("success");
      setActionMessage("Export downloaded successfully!");
      setIsExportModalOpen(false);
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    } catch (error: any) {
      console.error("Export error:", error);
      setActionStatus("error");
      setActionMessage(error.message || "Export failed");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  const getCurrentStep = (order: O2D[]) => {
    return getPendingStepIdx(order);
  };

  const isStep1Lockout = useMemo(() => {
    if (!selectedOrder || selectedOrder.length === 0) return false;
    const first = selectedOrder[0];
    const stepIdx = getCurrentStep(selectedOrder);
    if (stepIdx !== 1) return false;

    if (!first.created_at) return false;
    const createdAt = new Date(first.created_at).getTime();
    const now = currentTime.getTime();
    const thirtyMinutes = 30 * 60 * 1000;

    return now - createdAt < thirtyMinutes;
  }, [selectedOrder, currentTime]);

  const lockoutTimeLeft = useMemo(() => {
    if (!selectedOrder || selectedOrder.length === 0) return { m: 0, s: 0 };
    const first = selectedOrder[0];
    if (!first.created_at) return { m: 0, s: 0 };
    const createdAt = new Date(first.created_at).getTime();
    const now = currentTime.getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    const timePassed = now - createdAt;
    const timeLeft = Math.max(0, thirtyMinutes - timePassed);

    const m = Math.floor(timeLeft / (1000 * 60));
    const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return { m, s };
  }, [selectedOrder, currentTime]);

  const openStepUpdateModal = () => {
    if (!selectedOrder) return;
    const stepIdx = getCurrentStep(selectedOrder);
    if (stepIdx === -1) return; // Process ended or all steps done

    setCurrentStepToUpdate(stepIdx);

    // Initialize fields with current values
    const first = selectedOrder[0];
    const fields: any = {
      status: (first as any)[`status_${stepIdx}`] || "Yes",
      actual: (first as any)[`actual_${stepIdx}`] || new Date().toISOString(),
    };

    // Add step-specific fields
    if (stepIdx === 1) {
      fields.final_amount_1 = first?.final_amount_1 || "";
      fields.so_number_1 = first?.so_number_1 || "";
      fields.merge_order_with_1 = first?.merge_order_with_1 || "";
    } else if (stepIdx === 5) {
      fields.num_of_parcel_5 = first?.num_of_parcel_5 || "";
      fields.actual_date_of_order_packed_5 =
        first?.actual_date_of_order_packed_5 || "";
    } else if (stepIdx === 7) {
      fields.voucher_num_7 = first?.voucher_num_7 || "";
    } else if (stepIdx === 8) {
      fields.order_details_checked_8 = first?.order_details_checked_8 || "No";
      fields.voucher_num_51_8 = first?.voucher_num_51_8 || "";
      fields.t_amt_8 = first?.t_amt_8 || "";
    } else if (stepIdx === 9) {
      fields.num_of_parcel_9 = first?.num_of_parcel_9 || "";
    }

    setStepUpdateFields(fields);
    setStepAttachment(null);
    setStepAttachmentPreview(null);
    setIsStepUpdateModalOpen(true);
  };

  const handleStepUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderNo) return;

    // Mandatory Field Validation (only if status is "Yes")
    const stepIdx = currentStepToUpdate;
    const fields = stepUpdateFields;
    const first = selectedOrder[0] as any;

    if (fields.status === "Yes") {
      let errorMsg = "";
      const existingAttachment =
        stepIdx === 1 ? first.upload_so_1 :
        stepIdx === 5 ? first.upload_pi_5 :
        stepIdx === 9 ? first.attach_bilty_9 : "";

      if (stepIdx === 1) {
        if (!fields.so_number_1) errorMsg = "SO Number is mandatory.";
        else if (!fields.final_amount_1) errorMsg = "Final Amount is mandatory.";
        else if (!stepAttachment && !existingAttachment) errorMsg = "SO Attachment is mandatory.";
      } else if (stepIdx === 5) {
        if (!fields.num_of_parcel_5) errorMsg = "Number of Parcels is mandatory.";
        else if (!fields.actual_date_of_order_packed_5) errorMsg = "Actual Date of Packing is mandatory.";
        else if (!stepAttachment && !existingAttachment) errorMsg = "PI Attachment is mandatory.";
      } else if (stepIdx === 7) {
        if (!fields.voucher_num_7) errorMsg = "Voucher Number is mandatory.";
      } else if (stepIdx === 8) {
        if (!fields.voucher_num_51_8) errorMsg = "Voucher Number (51) is mandatory.";
        else if (!fields.t_amt_8) errorMsg = "Total Amount is mandatory.";
      } else if (stepIdx === 9) {
        if (!fields.num_of_parcel_9) errorMsg = "Number of Parcels is mandatory.";
        else if (!stepAttachment && !existingAttachment) errorMsg = "Bilty Attachment is mandatory.";
      }

      if (errorMsg) {
        setActionStatus("error");
        setActionMessage(errorMsg);
        setIsStatusModalOpen(true);
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const currentO2Ds = allO2DsRaw;

    const orderItems = selectedOrder.map((o2d: any) => {
      const updated = { ...o2d };
      const stepIdx = currentStepToUpdate;

      (updated as any)[`status_${stepIdx}`] = stepUpdateFields.status;
      (updated as any)[`actual_${stepIdx}`] = timestamp;

      if (stepIdx === 1) {
        updated.final_amount_1 = stepUpdateFields.final_amount_1;
        updated.so_number_1 = stepUpdateFields.so_number_1;
        updated.merge_order_with_1 = stepUpdateFields.merge_order_with_1;
      } else if (stepIdx === 5) {
        updated.num_of_parcel_5 = stepUpdateFields.num_of_parcel_5;
        updated.actual_date_of_order_packed_5 =
          stepUpdateFields.actual_date_of_order_packed_5;
      } else if (stepIdx === 7) {
        updated.voucher_num_7 = stepUpdateFields.voucher_num_7;
      } else if (stepIdx === 8) {
        updated.order_details_checked_8 =
          stepUpdateFields.order_details_checked_8;
        updated.voucher_num_51_8 = stepUpdateFields.voucher_num_51_8;
        updated.t_amt_8 = stepUpdateFields.t_amt_8;
      } else if (stepIdx === 9) {
        updated.num_of_parcel_9 = stepUpdateFields.num_of_parcel_9;
      }

      if (
        (stepUpdateFields.status === "Yes" ||
          (stepIdx === 3 && stepUpdateFields.status === "No")) &&
        stepIdx < 11
      ) {
        let nextStepIdx = stepIdx + 1;

        // Skip logic: if Step 3 is Yes, skip Step 4 and go straight to Step 5
        if (stepIdx === 3 && stepUpdateFields.status === "Yes") {
          (updated as any)[`planned_4`] = "";
          nextStepIdx = 5;
        }

        // Termination logic: if Step 4 is No, end the process (do not plan Step 5)
        if (stepIdx === 4 && stepUpdateFields.status === "No") {
          return updated;
        }

        const nextTat = globalConfigs[nextStepIdx - 1]?.tat || "24 Hrs";
        let baseForNext = timestamp;
        (updated as any)[`planned_${nextStepIdx}`] = calculatePlannedDate(
          baseForNext,
          nextTat,
        );
      }
      updated.updated_at = timestamp;
      return updated;
    });

    setIsStepUpdateModalOpen(false);

    // Show loader
    setActionStatus("loading");
    setActionMessage(`Updating Step ${currentStepToUpdate}...`);
    setIsStatusModalOpen(true);

    try {
      // Handle file attachment if present
      let fileUploaded = false;
      let uploadedFileId = "";
      if (stepAttachment) {
        const formData = new FormData();
        formData.append("file", stepAttachment);
        formData.append("orderNo", selectedOrderNo);
        formData.append("step", currentStepToUpdate.toString());

        const uploadRes = await fetch("/api/o2d/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          uploadedFileId = data.fileId;
          fileUploaded = true;
        }
      }

      const mergedOrder = mergeExpandedItems(orderItems);

      // If we uploaded a file, attach its ID to the merged record
      if (fileUploaded && mergedOrder && uploadedFileId) {
        const fieldMap: any = {
          1: "upload_so_1",
          5: "upload_pi_5",
          9: "attach_bilty_9",
        };
        const targetField = fieldMap[currentStepToUpdate];
        if (targetField) {
          (mergedOrder as any)[targetField] = uploadedFileId;
        }
      }

      const res = await fetch(`/api/o2d/order/${selectedOrderNo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergedOrder ? [mergedOrder] : []),
      });

      if (!res.ok) throw new Error("Step update failed");
      setActionStatus("success");
      setActionMessage("Step Updated Successfully");
      if (mergedOrder) {
        patchO2DOrderCache(mergedOrder);
        setAllO2Ds((prev) => {
          const expanded = orderItems.flatMap(expandO2DItem);
          return prev.map((row) => {
            if (row.order_no !== selectedOrderNo) return row;
            return expanded.find((item) => String(item.id) === String(row.id) || item.item_name === row.item_name) || {
              ...row,
              ...mergedOrder,
              id: row.id,
              item_name: row.item_name,
            };
          });
        });
      }

      // MANUAL CACHE UPDATE: Ensure the detail panel shows the updated step immediately
      const stepItems = orderItems.map(expandO2DItem).flat();
      if (stepItems.length > 0) {
        setMasterOrderMap(prev => ({
          ...prev,
          [selectedOrderNo]: stepItems
        }));
      }
      setTimeout(() => setIsStatusModalOpen(false), 500);
    } catch (error: any) {
      setActionStatus("error");
      setActionMessage(error.message);
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] space-y-3">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-2 shrink-0">
        <div className="text-center lg:text-left min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight italic">
            O2D SYSTEM
          </h1>
          <p className="text-[#003875] dark:text-[#FFD500] font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] opacity-80 -mt-1">
            Syncing Intelligence
          </p>
        </div>
        <div className="flex justify-end flex-shrink-0 min-w-0 lg:ml-auto">
          <div className="flex items-center gap-1 rounded-full border-2 border-[#003875] dark:border-[#FFD500] bg-white dark:bg-navy-800 shadow-lg p-0.5 overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 text-[#003875] dark:text-[#FFD500] px-2 sm:px-4 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-full hover:bg-[#003875]/5 dark:hover:bg-navy-700 transition-all"
            >
              <PlusIcon className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">New Order</span>
            </button>
            <div className="h-4 w-[1px] bg-[#003875]/10 dark:bg-[#FFD500]/10 mx-0.5" />

            {/* View Mode Switcher - Prominent in pill as requested */}
            <button
              onClick={() =>
                setPageViewMode(pageViewMode === "panels" ? "table" : "panels")
              }
              className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-full transition-all border-2 ${pageViewMode === "table"
                  ? "bg-[#003875] text-[#FFD500] border-[#003875]"
                  : "text-[#003875] dark:text-[#FFD500] border-transparent hover:bg-[#003875]/5 dark:hover:bg-navy-700"
                }`}
            >
              {pageViewMode === "panels" ? (
                <Squares2X2Icon className="w-4 h-4 stroke-[3]" />
              ) : (
                <ListBulletIcon className="w-4 h-4 stroke-[3]" />
              )}
              <span className="hidden sm:inline">
                {pageViewMode === "panels" ? "Table View" : "Panel View"}
              </span>
            </button>
            <div className="h-4 w-[1px] bg-[#003875]/10 dark:bg-[#FFD500]/10 mx-0.5" />

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 text-[#003875] dark:text-[#FFD500] px-2 sm:px-3 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-full hover:bg-[#003875]/5 dark:hover:bg-navy-700 transition-all"
            >
              <ArrowDownTrayIcon className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <div className="h-4 w-[1px] bg-[#003875]/10 dark:bg-[#FFD500]/10 mx-0.5" />
            <button
              onClick={handleOpenSetup}
              className="flex items-center gap-2 text-[#003875] dark:text-[#FFD500] px-2 sm:px-3 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-full hover:bg-[#003875]/5 dark:hover:bg-navy-700 transition-all"
            >
              <Cog6ToothIcon className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Setup</span>
            </button>
            <div className="h-4 w-[1px] bg-[#003875]/10 dark:bg-[#FFD500]/10 mx-0.5" />
            <button
              onClick={() => setIsBusyModalOpen(true)}
              className="flex items-center gap-2 text-[#003875] dark:text-[#FFD500] px-2 sm:px-3 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-full hover:bg-[#003875]/5 dark:hover:bg-navy-700 transition-all"
            >
              <ClipboardDocumentCheckIcon className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">For Busy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Master-Detail View Wrapper */}
      <div className="flex-1 flex flex-col relative">
        {/* Toggle Filters Button - Floating at the top edge */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[50]">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-full shadow-md hover:shadow-lg transition-all text-[#003875] dark:text-[#FFD500] group"
          >
            <FunnelIcon
              className={`w-3 h-3 transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
            />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {showFilters ? "Hide Filters" : "Show Filters"}
            </span>
            {showFilters ? (
              <ChevronUpIcon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            ) : (
              <ChevronDownIcon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            )}
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-gray-100 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-xl">
          {showFilters && (
            <div className="flex flex-col shrink-0 border-b border-gray-100 dark:border-navy-800 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2 bg-white dark:bg-navy-900">
                {O2D_STEP_SHORTS.map((stepName, idx) => {
                  const stepIdx = idx + 1;
                  const count = getStepFilterCount(stepIdx);
                  const isActive = selectedStepFilters.includes(stepIdx);
                  return (
                    <button
                      key={stepIdx}
                      onClick={() => toggleStepFilter(stepIdx)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${isActive
                          ? "bg-[#CE2029] border-[#CE2029] text-white shadow-lg scale-105"
                          : "bg-white dark:bg-navy-800 border-gray-100 dark:border-navy-700 text-gray-500 hover:border-[#CE2029]/30"
                        }`}
                    >
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-white" : "text-gray-600 dark:text-gray-300"}`}
                      >
                        {stepName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${isActive ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-navy-700 text-gray-400"}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Advanced Filter Sub-Row */}
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-gray-50/50 dark:bg-navy-800/20 border-t border-gray-100 dark:border-navy-800">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Date Range:
                  </span>
                  <div className="relative group/date flex items-center bg-white dark:bg-black border border-gray-200 dark:border-navy-700 rounded-lg px-2 h-[34px] focus-within:border-[#FFD500] transition-all shadow-sm">
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 group-focus-within/date:text-[#FFD500] shrink-0" />
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="bg-transparent border-none outline-none pl-1.5 text-[10px] font-bold text-gray-700 dark:text-zinc-100 min-w-[100px]"
                    />
                  </div>
                  <span className="text-gray-300 font-bold">-</span>
                  <div className="relative group/date flex items-center bg-white dark:bg-black border border-gray-200 dark:border-navy-700 rounded-lg px-2 h-[34px] focus-within:border-[#FFD500] transition-all shadow-sm">
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 group-focus-within/date:text-[#FFD500] shrink-0" />
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="bg-transparent border-none outline-none pl-1.5 text-[10px] font-bold text-gray-700 dark:text-zinc-100 min-w-[100px]"
                    />
                  </div>
                </div>
                <div className="h-4 w-[1px] bg-gray-200 dark:bg-navy-700" />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Party:
                  </span>
                  <div className="w-44">
                    <SearchableDropdown
                      label="Party"
                      icon={IdentificationIcon}
                      value={tableFilterParty}
                      onChange={(val) => setTableFilterParty(val)}
                      options={parties}
                      placeholder="Filter Party..."
                      hideLabel={true}
                    />
                  </div>
                </div>

                <div className="h-4 w-[1px] bg-gray-200 dark:bg-navy-700" />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Order ID:
                  </span>
                  <div className="w-32">
                    <SearchableDropdown
                      label="Order ID"
                      icon={HashtagIcon}
                      value={tableFilterOrderNo}
                      onChange={(val) => setTableFilterOrderNo(val)}
                      options={memoizedOrderOptions}
                      placeholder="OR-XXXXX"
                      hideLabel={true}
                    />
                  </div>
                </div>

                <div className="h-4 w-[1px] bg-gray-200 dark:bg-navy-700" />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Item Name:
                  </span>
                  <div className="w-44">
                    <SearchableDropdown
                      label="Item Name"
                      icon={ShoppingBagIcon}
                      value={tableFilterItemName}
                      onChange={(val) => setTableFilterItemName(val)}
                      options={memoizedItemOptions}
                      placeholder="Search Item..."
                      hideLabel={true}
                    />
                  </div>
                </div>
                <div className="h-4 w-[1px] bg-gray-200 dark:bg-navy-700" />
                <button
                  onClick={() => setTableFilterPending(!tableFilterPending)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 border ${tableFilterPending
                      ? "bg-[#003875] text-[#FFD500] border-[#003875] shadow-md"
                      : "bg-white dark:bg-navy-800 text-gray-400 border-gray-200 dark:border-navy-700 hover:border-[#003875]"
                    }`}
                >
                  <ClockIcon
                    className={`w-3.5 h-3.5 ${tableFilterPending ? "text-[#FFD500]" : "text-gray-400"}`}
                  />
                  Pending
                </button>
                <button
                  onClick={() => {
                    setFilterStartDate("");
                    setFilterEndDate("");
                    setTableFilterParty("");
                    setTableFilterOrderNo("");
                    setTableFilterItemName("");
                    setTableFilterPending(false);
                    setSearchTerm("");
                  }}
                  className="ml-auto px-3 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}

          {/* Loading Bar Indicator */}
          {(isAllLoading || isTransitioning) && (
            <div className="h-1 bg-gradient-to-r from-[#003875] via-[#FFD500] to-[#003875] animate-pulse shrink-0" />
          )}

          {/* Simple Table vs Master-Detail Panels Row */}
          <div className="flex-1 flex overflow-hidden relative">
            {pageViewMode === "table" ? (
              <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-navy-900">
                <div className="flex-1 overflow-auto no-scrollbar pb-10">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 z-20 shadow-sm">
                      <tr className="bg-gray-50 dark:bg-navy-950 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-navy-800">
                        <th className="px-6 py-4">Order ID</th>
                        <th className="px-6 py-4">Party Name</th>
                        <th className="px-6 py-4">Item Name</th>
                        <th className="px-6 py-4">Item Spec</th>
                        <th className="px-6 py-4 text-center">Item Qty</th>
                        <th className="px-6 py-4">Created At</th>
                        <th className="px-6 py-4">Filled By</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-navy-800/20">
                      {tableData.length > 0 ? (
                        tableData.map((item: O2D, idx: number) => (
                          <tr
                            key={idx}
                            className="group hover:bg-[#003875]/[0.02] dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[13px] font-black text-[#003875] dark:text-[#FFD500]">
                                  {item.order_no}
                                </span>
                                {item.hold && (
                                  <span className="text-[7px] text-orange-500 font-black uppercase tracking-tighter">
                                    On Hold
                                  </span>
                                )}
                                {item.cancelled && (
                                  <span className="text-[7px] text-red-500 font-black uppercase tracking-tighter">
                                    Cancelled
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className="px-6 py-4 text-[12px] font-black text-gray-700 dark:text-gray-200 uppercase max-w-[200px] truncate"
                              title={item.party_name}
                            >
                              {item.party_name}
                            </td>
                            <td
                              className="px-6 py-4 text-[12px] font-bold text-gray-600 dark:text-gray-300 uppercase max-w-[250px] truncate"
                              title={item.item_name}
                            >
                              {item.item_name}
                            </td>
                            <td
                              className="px-6 py-4 text-[12px] font-bold text-gray-500 dark:text-gray-400 uppercase max-w-[200px] truncate"
                              title={item.item_specification}
                            >
                              {item.item_specification || "-"}
                            </td>
                            <td className="px-6 py-4 text-center font-black text-[#003875] dark:text-[#FFD500] text-[13px]">
                              {item.item_qty}
                            </td>
                            <td className="px-6 py-4 text-[11px] font-bold text-gray-400 tracking-tight">
                              {item.created_at ? (
                                <div className="flex flex-col">
                                  <span className="text-gray-700 dark:text-gray-200">
                                    {new Date(
                                      item.created_at,
                                    ).toLocaleDateString("en-GB")}
                                  </span>
                                  <span className="text-[9px] text-[#003875] dark:text-[#FFD500] font-black opacity-70 uppercase">
                                    {new Date(
                                      item.created_at,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                      hour12: false,
                                    })}
                                  </span>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-tighter">
                              {item.filled_by || "-"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setSelectedOrderNo(item.order_no);
                                    setPageViewMode("panels");
                                  }}
                                  className="p-1.5 bg-[#003875]/5 text-[#003875] rounded-lg hover:bg-[#003875] hover:text-white transition-all"
                                >
                                  <EyeIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleEdit(item.order_no)}
                                  className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all"
                                >
                                  <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-20 text-center">
                            <ArchiveBoxIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">
                              No data matches your intelligence criteria
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Table Pagination Footer */}
                <div className="p-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-100 dark:border-navy-800 flex items-center justify-between shrink-0">
                  <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Showing <span className="text-[#003875] dark:text-[#FFD500]">{(tableCurrentPage - 1) * tableItemsPerPage + 1}</span> to <span className="text-[#003875] dark:text-[#FFD500]">{Math.min(tableCurrentPage * tableItemsPerPage, totalOrdersServer)}</span> of <span className="text-[#003875] dark:text-[#FFD500]">{totalOrdersServer}</span> entries
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTableCurrentPage(p => Math.max(1, p - 1))}
                      disabled={tableCurrentPage === 1}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-black border border-gray-100 dark:border-navy-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#FFD500] disabled:opacity-30 transition-all shadow-sm group"
                    >
                      <ChevronLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                      Prev
                    </button>

                    <div className="flex items-center gap-1 mx-2">
                      {/* Show current, first, last, and some relative pages if many exist */}
                      {(() => {
                        const totalPages = Math.ceil(totalOrdersServer / tableItemsPerPage);
                        if (totalPages <= 1) return null;

                        return (
                          <span className="px-4 py-2 bg-[#003875]/5 dark:bg-[#FFD500]/5 rounded-xl border border-[#003875]/10 dark:border-[#FFD500]/10 text-[11px] font-black text-[#003875] dark:text-[#FFD500]">
                            Page {tableCurrentPage} of {totalPages}
                          </span>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => setTableCurrentPage(p => Math.min(Math.ceil(totalOrdersServer / tableItemsPerPage), p + 1))}
                      disabled={tableCurrentPage >= Math.ceil(totalOrdersServer / tableItemsPerPage)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-black border border-gray-100 dark:border-navy-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#FFD500] disabled:opacity-30 transition-all shadow-sm group"
                    >
                      Next
                      <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Master Pane: Order List */}
                <div
                  className={`w-full lg:w-80 flex flex-col border-r border-[#003875]/5 dark:border-navy-800 ${selectedOrderNo ? "hidden lg:flex" : "flex"}`}
                >
                  <div className="p-2 border-b border-gray-50 dark:border-navy-800 bg-gray-50/30 dark:bg-navy-900/40">
                    <div className="relative group mb-2">
                      <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#FFD500] transition-colors" />
                      <input
                        type="text"
                        placeholder="Search resources..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 h-[34px] bg-white dark:bg-black border border-gray-100 dark:border-navy-700 focus:border-[#FFD500] outline-none font-bold text-[11px] rounded-xl transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] focus:shadow-md"
                      />
                    </div>

                    {/* Compact Pagination — right under search */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {isSidebarLoading && (
                          <div className="w-2.5 h-2.5 border-2 border-[#003875]/20 border-t-[#003875] dark:border-[#FFD500]/20 dark:border-t-[#FFD500] rounded-full animate-spin shrink-0" />
                        )}
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          {sidebarCurrentPage} / {sidebarTotalPages}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSidebarCurrentPage(p => Math.max(1, p - 1))}
                          disabled={sidebarCurrentPage === 1 || isSidebarLoading}
                          className="p-1 bg-white dark:bg-black border border-gray-100 dark:border-navy-700 rounded-lg hover:border-[#FFD500] disabled:opacity-30 transition-all shadow-sm"
                        >
                          <ChevronLeftIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setSidebarCurrentPage(p => Math.min(sidebarTotalPages, p + 1))}
                          disabled={sidebarCurrentPage >= sidebarTotalPages || isSidebarLoading}
                          className="p-1 bg-white dark:bg-black border border-gray-100 dark:border-navy-700 rounded-lg hover:border-[#FFD500] disabled:opacity-30 transition-all shadow-sm"
                        >
                          <ChevronRightIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                    {/* Only show full spinner on true first load; keepPreviousData shows stale content while fetching */}
                    {isSidebarLoading && filteredOrderNumbers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 space-y-3">
                        <div className="w-8 h-8 border-3 border-[#FFD500]/20 border-t-[#FFD500] rounded-full animate-spin" />
                        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                          Loading Orders...
                        </p>
                      </div>
                    ) : filteredOrderNumbers.length === 0 ? (
                      <div className="text-center py-20 opacity-50">
                        <ShoppingBagIcon className="w-10 h-10 text-gray-100 mx-auto mb-2" />
                        <p className="text-[11px] font-black uppercase tracking-widest italic text-gray-400">
                          No records
                        </p>
                      </div>
                    ) : (
                      <>
                        {filteredOrderNumbers.map((no: string) => {
                          const orderItems = sidebarGroupedOrders[no.trim()];
                          if (!orderItems || orderItems.length === 0) return null;
                          const first = orderItems[0];
                          const totalQty = orderItems.reduce(
                            (sum: number, item: O2D) =>
                              sum + (parseFloat(item.item_qty) || 0),
                            0,
                          );
                          const totalAmt = orderItems.reduce(
                            (sum: number, item: O2D) =>
                              sum + (parseFloat(item.est_amount) || 0),
                            0,
                          );

                          // Find current pending stage using the unified helper
                          const pIdx = getPendingStepIdx(orderItems);
                          const currentStageIdx = pIdx !== -1 ? pIdx - 1 : -1;
                          const allDone = currentStageIdx === -1;
                          const isSelected = selectedOrderNo?.trim() === no.trim();
                          const isCancelled = !!first?.cancelled;
                          const isHold = !!first?.hold && !isCancelled;

                          // Extract planned time for current stage
                          let plannedTimeStr = "";
                          if (!allDone && first) {
                            const pVal = (first as any)[`planned_${pIdx}`];
                            if (pVal && pVal !== "-") {
                              const d = new Date(pVal);
                              if (!isNaN(d.getTime())) {
                                plannedTimeStr = d.toLocaleDateString("en-GB", { day: '2-digit', month: 'short' }) + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              } else {
                                plannedTimeStr = pVal;
                              }
                            }
                          }

                          return (
                            <div
                              key={no}
                              onClick={() => {
                                const trimmedNo = no.trim();
                                // Set selection first for immediate visual feedback
                                setSelectedOrderNo(trimmedNo);
                                // Ensure this specific order's data is immediately in the master map
                                // We use the same defensive merge logic as the useEffect to avoid overwriting full data with partial data
                                if (trimmedNo && orderItems && orderItems.length > 0) {
                                  setMasterOrderMap(prev => {
                                    const existing = prev[trimmedNo];
                                    // Only overwrite if we don't have existing data, OR the new data has more items, OR no filter is active
                                    if (!existing || orderItems.length >= existing.length || !tableFilterItemName) {
                                      return { ...prev, [trimmedNo]: orderItems };
                                    }
                                    return prev;
                                  });
                                }
                              }}
                              className={`group relative p-2 rounded-xl border transition-all cursor-pointer ${isSelected
                                  ? "border-[#003875] dark:border-[#FFD500] bg-[#003875]/5 dark:bg-[#FFD500]/5 shadow-xl scale-[1.02] z-10"
                                  : isCancelled
                                    ? "border-red-200 dark:border-red-800/40 bg-gradient-to-br from-red-100 via-red-50 to-white dark:from-red-900/30 dark:via-red-900/10 dark:to-navy-800/50 shadow-md hover:shadow-lg hover:scale-[1.01]"
                                    : isHold
                                      ? "border-orange-200 dark:border-orange-800/40 bg-gradient-to-br from-orange-100 via-orange-50 to-white dark:from-orange-900/30 dark:via-orange-900/10 dark:to-navy-800/50 shadow-md hover:shadow-lg hover:scale-[1.01]"
                                      : "border-gray-100 dark:border-navy-700 bg-white dark:bg-navy-800/50 shadow-md hover:shadow-lg dark:hover:border-navy-600 hover:scale-[1.01]"
                                }`}
                            >
                              <div
                                className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all ${isSelected
                                    ? "bg-[#FFD500]"
                                    : isCancelled
                                      ? "bg-red-500"
                                      : isHold
                                        ? "bg-orange-500"
                                        : "bg-[#003875]/10 group-hover:bg-[#003875]/20"
                                  }`}
                              />

                              {/* Line 1: Order No & Status Labels */}
                              <div className="flex justify-between items-start mb-0.5 pl-1.5">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span className="text-[13px] font-black text-gray-900 dark:text-white truncate tracking-tight flex items-center gap-2">
                                    {currentStageIdx === 0 &&
                                      !isCancelled &&
                                      !isHold && (
                                        <span className="relative flex h-2 w-2 shrink-0">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></span>
                                        </span>
                                      )}
                                    {no}
                                  </span>
                                  {first?.cancelled ? (
                                    <span className="px-1.5 py-0.5 rounded-sm bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-[7px] uppercase tracking-widest leading-none font-bold">
                                      Cancelled
                                    </span>
                                  ) : null}
                                  {first?.hold && !first?.cancelled ? (
                                    <span className="px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 text-[7px] uppercase tracking-widest leading-none font-bold">
                                      Hold
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(no);
                                    }}
                                    className="p-1 px-1.5 bg-[#003875]/5 text-[#003875] dark:bg-[#FFD500]/10 dark:text-[#FFD500] hover:bg-[#003875] hover:text-white dark:hover:bg-[#FFD500] dark:hover:text-black rounded-lg transition-all"
                                  >
                                    <PencilSquareIcon className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(no);
                                    }}
                                    className="p-1 px-1.5 bg-[#CE2029]/5 text-[#CE2029] hover:bg-[#CE2029] hover:text-white rounded-lg transition-all"
                                  >
                                    <TrashIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Line 2: Party Name */}
                              <div className="pl-1.5 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">
                                {first?.party_name}
                              </div>

                              {/* Line 3: Current Stage & Item Details */}
                              <div className="flex items-end justify-between pl-1.5 min-w-0">
                                <div className="min-w-0 mr-2">
                                  {allDone ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 truncate">
                                      <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
                                      Completed
                                    </span>
                                  ) : (
                                    <span className="inline-flex flex-col items-start px-1.5 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 leading-none">
                                      <span className="flex items-center gap-1 min-w-0">
                                        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse shrink-0 block" />
                                        <span className="truncate">
                                          Step {currentStageIdx + 1}:{" "}
                                          {O2D_STEP_SHORTS[currentStageIdx]}
                                        </span>
                                      </span>
                                      {plannedTimeStr && (
                                        <span className="text-[8px] opacity-75 font-semibold pl-2 mt-0.5 flex items-center gap-1 tracking-wider normal-case">
                                          <ClockIcon className="w-2 h-2" />
                                          {plannedTimeStr}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col items-end shrink-0 leading-[1.1]">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">
                                    {orderItems.length} ITEMS
                                  </span>
                                  <span className="text-[12px] font-black text-[#003875] dark:text-[#FFD500]">
                                    ₹
                                    {(totalAmt || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* Thick Dark Blue Divider Line */}
                <div className="w-[3px] bg-[#003875] h-full hidden lg:block opacity-80" />

                {/* Detail Pane: Order Details - Modularized */}
                <O2DDetailPanel
                  selectedOrder={selectedOrder}
                  selectedOrderNo={selectedOrderNo}
                  setSelectedOrderNo={setSelectedOrderNo}
                  isAllLoading={isAllLoading}
                  isTransitioning={isTransitioning}
                  isSpecialRole={isSpecialRole}
                  setIsRemoveFollowUpModalOpen={setIsRemoveFollowUpModalOpen}
                  openStepUpdateModal={openStepUpdateModal}
                  setConfirmPayload={setConfirmPayload}
                  setIsConfirmOpen={setIsConfirmOpen}
                  detailViewMode={detailViewMode}
                  setDetailViewMode={setDetailViewMode}
                  lockoutTimeLeft={lockoutTimeLeft}
                  isStep1Lockout={isStep1Lockout}
                  getPreviewUrl={getPreviewUrl}
                  getDownloadUrl={getDownloadUrl}
                  fullParties={fullParties}
                />
              </>
            )}
          </div>
          {/* end Panels Row */}
        </div>
        {/* end Main Container (now inside wrapper) */}
      </div>
      {/* end Main Master-Detail View Wrapper */}

      {/* Export Selection Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-md"
            onClick={() => setIsExportModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-50 dark:border-navy-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-[#003875] dark:text-[#FFD500] italic uppercase">
                  EXPORT SELECTION
                </h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                  Configure your data payload
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-navy-800 cursor-pointer hover:border-[#FFD500] transition-all group">
                  <input
                    type="checkbox"
                    checked={exportIncludeDetails}
                    onChange={(e) => setExportIncludeDetails(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#003875] focus:ring-[#003875]"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                      Order Details
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      No, Party, Item, Qty, Amount, etc.
                    </span>
                  </div>
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Workflow Steps
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        setExportSelectedSteps(
                          Array.from({ length: 11 }, (_, i) => i + 1),
                        )
                      }
                      className="text-[9px] font-black text-[#003875] dark:text-[#FFD500] uppercase hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setExportSelectedSteps([])}
                      className="text-[9px] font-black text-red-500 uppercase hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {O2D_STEP_SHORTS.map((step, idx) => {
                    const stepIdx = idx + 1;
                    const isSelected = exportSelectedSteps.includes(stepIdx);
                    return (
                      <button
                        key={stepIdx}
                        onClick={() => {
                          if (isSelected)
                            setExportSelectedSteps((prev) =>
                              prev.filter((s) => s !== stepIdx),
                            );
                          else
                            setExportSelectedSteps((prev) => [
                              ...prev,
                              stepIdx,
                            ]);
                        }}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${isSelected
                            ? "bg-[#003875] border-[#003875] text-[#FFD500] shadow-md"
                            : "bg-white dark:bg-black/20 border-gray-100 dark:border-navy-800 text-gray-400 hover:border-gray-200"
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-[#FFD500] border-[#FFD500]" : "border-gray-300"}`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 bg-[#003875] rounded-sm" />
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest truncate">
                          {step}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-50 dark:border-navy-800 bg-gray-50/50 dark:bg-black/10">
              <button
                onClick={handleExport}
                disabled={
                  !exportIncludeDetails && exportSelectedSteps.length === 0
                }
                className="w-full h-14 bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] shadow-lg shadow-[#003875]/20 dark:shadow-[#FFD500]/10 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Initialize Export
              </button>
            </div>
          </div>
        </div>
      )}

      <PartyFormModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onSuccess={(partyName, partyData) => {
          setParties((prev) => Array.from(new Set([...prev, partyName])));
          if (partyData) {
            setFullParties((prev) => [...prev, partyData]);
            if (!editingOrderNo) {
              setNewPartyDraft(partyData);
            }
          }
          setCommonData((prev) => ({ ...prev, party_name: partyName }));
          setIsPartyModalOpen(false);
        }}
        salePersonName={session?.user?.name || ""}
        linkedOrderNo={commonData.order_no}
        skipSubmit={!editingOrderNo}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-2xl rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-orange-100/30 dark:border-navy-700 flex items-center justify-between shrink-0 bg-[#FEF6DB] dark:bg-navy-800">
              <div>
                <h2 className="text-xl font-black text-[#003875] dark:text-[#FFD500] italic">
                  {editingOrderNo
                    ? `EDIT ORDER: ${editingOrderNo}`
                    : "CREATE NEW ORDER"}
                </h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mt-0.5">
                  Automated Intelligence Protocol
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                <XMarkIcon className="w-6 h-6 shrink-0" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-5 md:p-7 space-y-5 bg-white/40 dark:bg-navy-900 no-scrollbar"
            >
              <div className="space-y-6">
                {/* Common Information */}
                <div className="bg-white dark:bg-navy-800/60 p-5 rounded-3xl border border-gray-100 dark:border-navy-700 shadow-sm space-y-5">
                  <div className="flex items-center gap-2 -ml-1">
                    <div className="w-1 h-5 bg-[#003875] dark:bg-[#FFD500] rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-200">
                      MASTER CLASSIFICATION
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-end gap-5">
                    <div className="relative group">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <PhotoIcon className="w-3 h-3 text-[#FFD500]" />
                        Order Proof <span className="text-red-500 ml-1">*</span>
                      </label>
                      <label
                        className="flex flex-col items-center justify-center w-28 h-28 bg-gray-50/50 dark:bg-navy-900 border-2 border-dashed border-gray-100 dark:border-navy-700 rounded-3xl hover:border-[#FFD500] cursor-pointer transition-all active:scale-95 shadow-inner overflow-hidden relative"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            setScreenshotFile(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      >
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            className="w-full h-full object-cover"
                            alt="Order Proof"
                          />
                        ) : (
                          <>
                            <PhotoIcon className="w-7 h-7 text-gray-200 group-hover:text-[#FFD500] transition-colors" />
                            <span className="text-[8px] font-black text-gray-300 mt-2 tracking-tighter">
                              UPLOAD
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                      </label>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotFile(null);
                            setImagePreview(null);
                          }}
                          className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-xl shadow-lg border-2 border-white"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col gap-4">
                      <div className={!editingOrderNo ? "hidden" : ""}>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                          <IdentificationIcon className="w-3 h-3" />
                          Order ID
                        </label>
                        <input
                          type="text"
                          value={commonData.order_no}
                          readOnly
                          className="w-full h-[36px] bg-gray-50 dark:bg-black border border-transparent dark:border-navy-700 px-3 rounded-xl font-bold text-[11px] text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-inner"
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 min-w-0">
                          <SearchableDropdown
                            label="Partner Name *"
                            icon={BuildingOfficeIcon}
                            value={commonData.party_name}
                            onFocus={centerOnFocus}
                            data-initial-focus
                            onChange={(val) =>
                              setCommonData({ ...commonData, party_name: val })
                            }
                            options={parties}
                          />
                        </div>
                          <button
                            type="button"
                            onClick={() => setIsPartyModalOpen(true)}
                            className="w-[36px] h-[36px] shrink-0 bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black rounded-xl flex items-center justify-center shadow-sm hover:scale-105 transition-all mt-[auto] border border-[#003875]/20 dark:border-[#FFD500]/20"
                            title="Create New Party"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <ChatBubbleBottomCenterTextIcon className="w-3 h-3" />
                      Remarks
                    </label>
                    <textarea
                      value={commonData.remark}
                      onFocus={centerOnFocus}
                      onChange={(e) =>
                        setCommonData({ ...commonData, remark: e.target.value })
                      }
                      className="w-full bg-[#FEF6DB] dark:bg-black p-3 rounded-2xl border border-orange-100 dark:border-navy-700 focus:border-[#FFD500] outline-none font-bold text-[11px] text-gray-800 dark:text-gray-100 shadow-sm min-h-[60px] no-scrollbar"
                      placeholder="Order notes..."
                    />
                  </div>
                </div>

                {/* Dynamic Items */}
                <div className="space-y-3">
                  <div className="flex items-center px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 bg-[#CE2029] rounded-full" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-200">
                        ITEMIZED LOGISTICS
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {/* Add Line Item - top (Controls-First) */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-2 px-1">
                      <div className="flex items-center bg-[#003875]/5 dark:bg-[#FFD500]/5 px-4 py-2 rounded-2xl border border-[#003875]/10 dark:border-[#FFD500]/10 shadow-sm">
                          <label className="text-[9px] font-black uppercase text-gray-400 tracking-tighter mr-2 whitespace-nowrap">Bulk Rows:</label>
                          <input 
                              type="number" 
                              min="1" 
                              max="50"
                              value={multiRowQty}
                              onChange={(e) => setMultiRowQty(parseInt(e.target.value) || 1)}
                              className="w-12 bg-transparent text-center font-black text-[#003875] dark:text-[#FFD500] text-[12px] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => addItemRow(multiRowQty)}
                            className="ml-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black px-3 py-1.5 rounded-xl hover:scale-105 transition-all shadow-sm"
                          >
                            <PlusIcon className="w-3.5 h-3.5 stroke-[3]" /> Generate
                          </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => addItemRow(1)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#003875] dark:text-[#FFD500] hover:scale-105 transition-all bg-[#003875]/10 dark:bg-[#FFD500]/15 px-6 py-2.5 rounded-2xl shadow-sm border-2 border-transparent hover:border-[#003875]/20"
                      >
                        <PlusIcon className="w-4 h-4 stroke-[3]" /> Add Single Line
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPasteModalOpen(true)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#003875] dark:text-[#FFD500] hover:scale-105 transition-all bg-[#003875]/10 dark:bg-[#FFD500]/15 px-6 py-2.5 rounded-2xl shadow-sm border-2 border-transparent hover:border-[#003875]/20"
                      >
                        <ClipboardDocumentCheckIcon className="w-4 h-4 stroke-[3]" /> Paste Data
                      </button>
                    </div>
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white dark:bg-navy-800/50 rounded-2xl border border-gray-100 dark:border-navy-700 animate-in slide-in-from-right-2 duration-300 shadow-sm space-y-4 relative group"
                      >
                        {/* Remove Button - Top Right Absolute for Mobile Optimization */}
                        {items.length > 1 && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => removeItemRow(index)}
                            className="absolute top-2.5 right-2.5 p-1.5 text-gray-300 hover:text-[#CE2029] hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all z-10"
                            title="Remove Line Item"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
                          <div className="md:col-span-6 min-w-0">
                            <div className="flex gap-2 items-end">
                              <div className="flex-1 min-w-0">
                                 <SearchableDropdown
                                  label="Nomenclature *"
                                  icon={ArchiveBoxIcon}
                                  value={item.item_name}
                                  error={Boolean(item.item_name && items.findIndex(i => i.item_name === item.item_name) < index)}
                                  data-nomenclature-trigger={index}
                                  onFocus={centerOnFocus}
                                  onChange={(val) => {
                                    handleItemChange(index, "item_name", val);
                                    const matchingItem = dropdownItems.find(
                                      (di) => di.name === val,
                                    );
                                    if (matchingItem?.amount) {
                                      handleItemChange(
                                        index,
                                        "est_amount",
                                        matchingItem.amount,
                                      );
                                    }
                                  }}
                                  options={dropdownItems.map((i) => i.name)}
                                />
                              </div>
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  setActiveItemIndex(index);
                                  setIsItemModalOpen(true);
                                }}
                                className="w-[34px] h-[34px] shrink-0 bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black rounded-lg flex items-center justify-center shadow-sm hover:scale-105 transition-all mb-0.5 border border-[#003875]/20 dark:border-[#FFD500]/20"
                                title="Add New Item"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                              <HashtagIcon className="w-2.5 h-2.5" />
                              Qty <span className="text-red-500 ml-0.5">*</span>
                            </label>
                            <input
                              type="text"
                              value={item.item_qty}
                              onFocus={centerOnFocus}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "item_qty",
                                  e.target.value,
                                )
                              }
                              className="w-full h-[34px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 focus:border-[#FFD500] outline-none font-bold text-[11px] text-gray-800 dark:text-gray-100 shadow-sm transition-all"
                              required
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                              <CurrencyRupeeIcon className="w-2.5 h-2.5" />
                              Total
                            </label>
                            <input
                              type="text"
                              value={item.est_amount}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "est_amount",
                                  e.target.value,
                                )
                              }
                              onFocus={centerOnFocus}
                              tabIndex={!!dropdownItems.find(di => di.name === item.item_name) ? -1 : 0}
                              readOnly={!!dropdownItems.find(di => di.name === item.item_name)}
                              className={`w-full h-[34px] px-3 rounded-lg border focus:border-[#FFD500] outline-none font-bold text-[11px] shadow-sm transition-all ${dropdownItems.find(di => di.name === item.item_name)
                                  ? "bg-gray-100 dark:bg-navy-950 text-gray-500 cursor-not-allowed border-gray-200 dark:border-navy-700"
                                  : "bg-[#FEF6DB] dark:bg-black text-[#003875] dark:text-[#FFD500] border-orange-100 dark:border-navy-700"
                                }`}
                            />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-50 dark:border-white/5">
                          <input
                            type="text"
                            value={item.item_specification}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "item_specification",
                                e.target.value,
                              )
                            }
                            onFocus={centerOnFocus}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addItemRow(1);
                                }
                            }}
                            className="w-full h-[34px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 focus:border-[#FFD500] outline-none font-bold text-[11px] text-gray-800 dark:text-gray-100 shadow-sm transition-all"
                            placeholder="Item Specification..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>


                </div>
              </div>

              <div className="pt-5 border-t border-orange-100/30 dark:border-navy-700 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-[48px] rounded-2xl font-black text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all uppercase tracking-widest text-[10px]"
                >
                  Abandon
                </button>
                <button
                  type="submit"
                  className="flex-[2] h-[48px] bg-[#CE2029] hover:bg-[#8E161D] text-white rounded-2xl font-black transition-all shadow-[0_8px_20px_-6px_rgba(206,32,41,0.5)] active:scale-95 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 group"
                >
                  <PlusIcon className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-300" />{" "}
                  {editingOrderNo ? "PROTOCOL UPDATE" : "EXECUTE ORDER"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSetupModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-md"
            onClick={() => setIsSetupModalOpen(false)}
          />
          <div className="relative bg-[#FEF6DB] dark:bg-navy-900 w-full max-w-4xl rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-orange-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-orange-100/50 dark:border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-black text-[#003875] dark:text-[#FFD500] italic">
                  SYSTEM CONFIGURATION
                </h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mt-0.5">
                  Define TAT and Operators
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSetupModalOpen(false)}
                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                <XMarkIcon className="w-6 h-6 shrink-0" />
              </button>
            </div>

            <form
              onSubmit={handleSaveSetup}
              className="flex-1 overflow-y-auto p-5 md:p-7 space-y-3 no-scrollbar"
            >
              {stepConfigs.map((config, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white dark:bg-navy-800/50 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm items-center hover:border-orange-100 dark:hover:border-[#FFD500]/30 transition-colors"
                >
                  <div className="md:col-span-5 flex flex-col">
                    <span className="text-[9px] font-black text-[#003875]/50 dark:text-[#FFD500]/50 uppercase tracking-widest mb-1">
                      Step {index + 1}
                    </span>
                    <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                      {config.step_name}
                    </span>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                      <ClockIcon className="w-3 h-3 text-[#FFD500]" /> TAT
                    </label>
                    <div className="flex h-[38px] bg-[#FEF6DB] dark:bg-navy-950/50 border border-orange-100 dark:border-navy-700 focus-within:border-[#FFD500] rounded-2xl shadow-sm transition-all overflow-hidden items-center p-1">
                      <div className="flex gap-1 bg-white/50 dark:bg-navy-900 p-0.5 rounded-xl border border-gray-100 dark:border-navy-800 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const val = config.tat.split(" ")[0] || "24";
                            const newConfigs = [...stepConfigs];
                            newConfigs[index].tat = `${val} Hrs`;
                            setStepConfigs(newConfigs);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${config.tat.includes("Hrs") ? "bg-[#FFD500] text-black shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"}`}
                        >
                          Hrs
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const val = config.tat.split(" ")[0] || "1";
                            const newConfigs = [...stepConfigs];
                            newConfigs[index].tat = `${val} Days`;
                            setStepConfigs(newConfigs);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${config.tat.includes("Days") ? "bg-[#FFD500] text-black shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"}`}
                        >
                          Days
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={config.tat.split(" ")[0] || ""}
                        onChange={(e) => {
                          const unit = config.tat.split(" ")[1] || "Hrs";
                          const newConfigs = [...stepConfigs];
                          newConfigs[index].tat = `${e.target.value} ${unit}`;
                          setStepConfigs(newConfigs);
                        }}
                        placeholder="24"
                        className="w-full bg-transparent px-3 outline-none text-[12px] font-black text-gray-800 dark:text-gray-100 placeholder:text-gray-400/50 text-right"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-4 self-end">
                    <SearchableDropdown
                      label="Responsible Operator"
                      icon={UserIcon}
                      value={config.responsible_person}
                      onChange={(val) => {
                        const newConfigs = [...stepConfigs];
                        newConfigs[index].responsible_person = val;
                        setStepConfigs(newConfigs);
                      }}
                      options={usersList}
                      placeholder="Assign to..."
                      isMulti={true}
                    />
                  </div>
                </div>
              ))}
            </form>

            <div className="p-5 border-t border-orange-100/50 dark:border-navy-700 flex gap-3 shrink-0 bg-white/40 dark:bg-transparent">
              <button
                type="button"
                onClick={() => setIsSetupModalOpen(false)}
                className="flex-1 h-[48px] rounded-2xl font-black text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-orange-50 dark:hover:bg-white/5 transition-all uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSaveSetup}
                className="flex-[2] h-[48px] bg-[#003875] dark:bg-[#FFD500] hover:bg-[#002855] dark:hover:bg-[#E6C000] text-white dark:text-black rounded-2xl font-black transition-all shadow-[0_8px_20px_-6px_rgba(0,56,117,0.5)] dark:shadow-[0_8px_20px_-6px_rgba(255,213,0,0.3)] active:scale-95 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2"
              >
                <Cog6ToothIcon className="w-5 h-5 stroke-[2.5]" /> SAVE
                CONFIGURATION
              </button>
            </div>
          </div>
        </div>
      )}

      {isStepUpdateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-md"
            onClick={() => setIsStepUpdateModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-orange-100/30 dark:border-navy-700 flex items-center justify-between shrink-0 bg-[#FEF6DB] dark:bg-navy-800">
              <div>
                <h2 className="text-lg font-black text-[#CE2029] italic uppercase tracking-tight">
                  Step Update: {O2D_STEP_SHORTS[currentStepToUpdate - 1]}
                </h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-0.5">
                  Execution Protocol {selectedOrderNo}
                </p>
              </div>
              <button
                onClick={() => setIsStepUpdateModalOpen(false)}
                className="p-2 text-gray-400 hover:text-red-500 transition-all"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleStepUpdateSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar"
            >
              <div className="space-y-4">
                {/* Status Toggle */}
                <YesNoToggle
                  label="Mission Completed?"
                  value={stepUpdateFields.status}
                  onChange={(val) =>
                    setStepUpdateFields({ ...stepUpdateFields, status: val })
                  }
                />

                {/* Actual Time - Automated */}
                <div className="hidden">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <ClockIcon className="w-3 h-3 text-[#FFD500]" /> Actual
                    Timestamp
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      stepUpdateFields.actual
                        ? new Date(stepUpdateFields.actual)
                          .toISOString()
                          .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setStepUpdateFields({
                        ...stepUpdateFields,
                        actual: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full h-[38px] bg-[#FEF6DB] dark:bg-black px-4 rounded-xl border border-orange-100 dark:border-navy-700 font-bold text-[11px] outline-none focus:border-[#FFD500]"
                  />
                </div>

                {/* Step Specific Fields */}
                {currentStepToUpdate === 1 && (
                  <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                          Final Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={stepUpdateFields.final_amount_1}
                          onChange={(e) =>
                            setStepUpdateFields({
                              ...stepUpdateFields,
                              final_amount_1: e.target.value,
                            })
                          }
                          className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white"
                          placeholder="Value..."
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                          SO Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={stepUpdateFields.so_number_1}
                          onChange={(e) =>
                            setStepUpdateFields({
                              ...stepUpdateFields,
                              so_number_1: e.target.value,
                            })
                          }
                          className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white"
                          placeholder="SO#..."
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <SearchableDropdown
                        label="Merge Order With"
                        icon={IdentificationIcon}
                        value={
                          stepUpdateFields.merge_order_with_1
                            ? (() => {
                              const match = Object.keys(groupedOrders).find(
                                (no) =>
                                  no === stepUpdateFields.merge_order_with_1,
                              );
                              return match
                                ? `${match} | ${(groupedOrders as any)[match][0]?.party_name || ""}`
                                : stepUpdateFields.merge_order_with_1;
                            })()
                            : ""
                        }
                        onChange={(val) => {
                          const no = val.split(" | ")[0];
                          setStepUpdateFields({
                            ...stepUpdateFields,
                            merge_order_with_1: no,
                          });
                        }}
                        options={Object.keys(groupedOrders)
                          .filter((no) => no !== selectedOrderNo)
                          .map(
                            (no) =>
                              `${no} | ${groupedOrders[no][0]?.party_name || ""}`,
                          )}
                        placeholder="Select Order ID..."
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block flex items-center gap-1.5">
                        <PhotoIcon className="w-3 h-3" /> Upload SO (Attachment) <span className="text-red-500">*</span>
                      </label>
                      <label
                        className="flex items-center justify-center w-full h-24 border-2 border-dashed border-orange-100 rounded-2xl hover:bg-orange-50/30 cursor-pointer overflow-hidden relative"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            setStepAttachment(file);
                            setStepAttachmentPreview(URL.createObjectURL(file));
                          }
                        }}
                      >
                        {stepAttachmentPreview &&
                          stepAttachment?.type.startsWith("image/") ? (
                          <img
                            src={stepAttachmentPreview || ""}
                            className="w-full h-full object-cover"
                          />
                        ) : stepAttachment ? (
                          <div className="flex flex-col items-center gap-1">
                            <ArchiveBoxIcon className="w-8 h-8 text-[#003875]/40" />
                            <span className="text-[8px] font-black text-gray-400 max-w-[150px] truncate">
                              {stepAttachment?.name}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <PlusIcon className="w-5 h-5 text-gray-300 mx-auto" />
                            <span className="text-[9px] font-black text-gray-300 tracking-widest uppercase">
                              Select File
                            </span>
                          </div>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setStepAttachment(file);
                              setStepAttachmentPreview(
                                URL.createObjectURL(file),
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {currentStepToUpdate === 5 && (
                  <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block font-bold">
                        Number of Parcel <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={stepUpdateFields.num_of_parcel_5}
                        onChange={(e) =>
                          setStepUpdateFields({
                            ...stepUpdateFields,
                            num_of_parcel_5: e.target.value,
                          })
                        }
                        className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white"
                        placeholder="Count..."
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block font-bold">
                        Actual Date of Packing <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={
                          stepUpdateFields.actual_date_of_order_packed_5
                            ? new Date(
                              stepUpdateFields.actual_date_of_order_packed_5,
                            )
                              .toISOString()
                              .split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          setStepUpdateFields({
                            ...stepUpdateFields,
                            actual_date_of_order_packed_5: new Date(
                              e.target.value,
                            ).toISOString(),
                          })
                        }
                        className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block flex items-center gap-1.5 font-bold">
                        <PhotoIcon className="w-3 h-3" /> Upload PI (Attachment) <span className="text-red-500">*</span>
                      </label>
                      <label
                        className="flex items-center justify-center w-full h-24 border-2 border-dashed border-orange-100 rounded-2xl hover:bg-orange-50/30 cursor-pointer overflow-hidden relative mt-1.5"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            setStepAttachment(file);
                            setStepAttachmentPreview(URL.createObjectURL(file));
                          }
                        }}
                      >
                        {stepAttachmentPreview &&
                          stepAttachment?.type.startsWith("image/") ? (
                          <img
                            src={stepAttachmentPreview || ""}
                            className="w-full h-full object-cover"
                          />
                        ) : stepAttachment ? (
                          <div className="flex flex-col items-center gap-1">
                            <ArchiveBoxIcon className="w-8 h-8 text-[#003875]/40" />
                            <span className="text-[8px] font-black text-gray-400 max-w-[150px] truncate">
                              {stepAttachment?.name}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <PlusIcon className="w-5 h-5 text-gray-300 mx-auto" />
                            <span className="text-[9px] font-black text-gray-300 tracking-widest uppercase">
                              Select PI
                            </span>
                          </div>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setStepAttachment(file);
                              setStepAttachmentPreview(
                                URL.createObjectURL(file),
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {currentStepToUpdate === 7 && (
                  <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block font-bold">
                        Voucher Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={stepUpdateFields.voucher_num_7}
                        onChange={(e) =>
                          setStepUpdateFields({
                            ...stepUpdateFields,
                            voucher_num_7: e.target.value,
                          })
                        }
                        className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white"
                        placeholder="Voucher#..."
                      />
                    </div>
                  </div>
                )}

                {currentStepToUpdate === 8 && (
                  <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                    <YesNoToggle
                      label="Details checked in Sheet?"
                      value={stepUpdateFields.order_details_checked_8}
                      onChange={(val) =>
                        setStepUpdateFields({
                          ...stepUpdateFields,
                          order_details_checked_8: val,
                        })
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block font-bold">
                          Voucher Num (51) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={stepUpdateFields.voucher_num_51_8}
                          onChange={(e) =>
                            setStepUpdateFields({
                              ...stepUpdateFields,
                              voucher_num_51_8: e.target.value,
                            })
                          }
                          className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white"
                          placeholder="V#51..."
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block font-bold">
                          T. Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={stepUpdateFields.t_amt_8}
                          onChange={(e) =>
                            setStepUpdateFields({
                              ...stepUpdateFields,
                              t_amt_8: e.target.value,
                            })
                          }
                          className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-[#003875] dark:text-[#FFD500]"
                          placeholder="Amt..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStepToUpdate === 9 && (
                  <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/5">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block font-bold">
                        Number of Parcel <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={stepUpdateFields.num_of_parcel_9}
                        onChange={(e) =>
                          setStepUpdateFields({
                            ...stepUpdateFields,
                            num_of_parcel_9: e.target.value,
                          })
                        }
                        className="w-full h-[36px] bg-[#FEF6DB] dark:bg-black px-3 rounded-lg border border-orange-100 dark:border-navy-700 font-bold text-[11px] text-gray-800 dark:text-white"
                        placeholder="Count..."
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block flex items-center gap-1.5 font-bold font-bold">
                        <PhotoIcon className="w-3 h-3" /> Attach Bilty to CRM
                        (Attachment) <span className="text-red-500">*</span>
                      </label>
                      <label
                        className="flex items-center justify-center w-full h-24 border-2 border-dashed border-orange-100 rounded-2xl hover:bg-orange-50/30 cursor-pointer overflow-hidden relative mt-1.5"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            setStepAttachment(file);
                            setStepAttachmentPreview(URL.createObjectURL(file));
                          }
                        }}
                      >
                        {stepAttachmentPreview &&
                          stepAttachment?.type.startsWith("image/") ? (
                          <img
                            src={stepAttachmentPreview || ""}
                            className="w-full h-full object-cover"
                          />
                        ) : stepAttachment ? (
                          <div className="flex flex-col items-center gap-1">
                            <ArchiveBoxIcon className="w-8 h-8 text-[#003875]/40" />
                            <span className="text-[8px] font-black text-gray-400 max-w-[150px] truncate">
                              {stepAttachment?.name}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <PlusIcon className="w-5 h-5 text-gray-300 mx-auto" />
                            <span className="text-[9px] font-black text-gray-300 tracking-widest uppercase">
                              Select Bilty to CRM
                            </span>
                          </div>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setStepAttachment(file);
                              setStepAttachmentPreview(
                                URL.createObjectURL(file),
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStepUpdateModalOpen(false)}
                  className="flex-1 h-[44px] rounded-xl font-black text-gray-400 uppercase tracking-widest text-[9px] hover:bg-gray-50 transition-all"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  className="flex-[2] h-[44px] bg-[#CE2029] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Deploy Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen && !!confirmPayload}
        onClose={() => {
          setIsConfirmOpen(false);
          setConfirmPayload(null);
        }}
        onConfirm={async () => {
          if (!confirmPayload) return;
          if (confirmPayload.type === "delete") {
            await performDelete();
          } else {
            await handleToggleStatus(
              confirmPayload.orderNo as string,
              confirmPayload.type as "hold" | "cancelled",
              confirmPayload.currentValue,
            );
          }
          setIsConfirmOpen(false);
          setConfirmPayload(null);
        }}
        title={
          confirmPayload?.type === "delete"
            ? "Terminate Protocol?"
            : confirmPayload?.type === "hold"
              ? confirmPayload?.currentValue
                ? "Release Hold?"
                : "Place on Hold?"
              : "Cancel Order?"
        }
        message={
          confirmPayload?.type === "delete"
            ? "This action will permanently purge this record from the grid. Are you sure you want to execute this command?"
            : confirmPayload?.type === "hold"
              ? confirmPayload?.currentValue
                ? "Do you want to release this order from the hold status?"
                : "Do you want to place this order on hold?"
              : "Are you sure you want to cancel this order? This action will mark it as cancelled."
        }
        confirmLabel="Yes, Execute"
        cancelLabel="No, Abort"
        type={
          confirmPayload?.type === "delete" ||
            confirmPayload?.type === "cancelled"
            ? "danger"
            : "info"
        }
      />
      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={actionStatus}
        message={actionMessage}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {/* Paste Data Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-md"
            onClick={() => setIsPasteModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-navy-700 flex items-center justify-between bg-gray-50/50 dark:bg-navy-800">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white italic uppercase tracking-tight flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-5 h-5 text-[#003875] dark:text-[#FFD500]" />
                  Paste Items Data
                </h2>
                <p className="text-[10px] font-bold text-gray-400 mt-1">Paste your Excel data here. Ensure columns are: Name, Quantity, Specification.</p>
              </div>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="p-2 text-gray-400 hover:text-red-500 transition-all"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Item A\t10\tSpec A\nItem B\t5\tSpec B`}
                className="w-full h-[200px] bg-[#FEF6DB] dark:bg-black p-4 rounded-2xl border border-orange-100 dark:border-navy-700 focus:border-[#FFD500] outline-none font-bold text-[12px] text-gray-800 dark:text-gray-100 shadow-sm whitespace-pre"
              />
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-navy-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasteData}
                  className="flex-1 py-3 px-4 bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm hover:scale-[1.02] transition-all"
                >
                  Import Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ItemFormModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setActiveItemIndex(null);
        }}
        onSuccess={(name, price) => {
          fetchDetails();
          if (activeItemIndex !== null) {
            handleItemChange(activeItemIndex, "item_name", name);
            if (price) {
              handleItemChange(activeItemIndex, "est_amount", price);
            }
          }
        }}
      />

      {/* Remove Follow-up Modal */}
      {isRemoveFollowUpModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-md"
            onClick={() => setIsRemoveFollowUpModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-navy-700 flex items-center justify-between bg-gray-50/50 dark:bg-navy-800">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white italic uppercase tracking-tight">
                  Revision Protocol
                </h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-0.5">
                  Clear Operational Data: {selectedOrderNo}
                </p>
              </div>
              <button
                onClick={() => setIsRemoveFollowUpModalOpen(false)}
                className="p-2 text-gray-400 hover:text-red-500 transition-all"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5 block">
                  Target Step to Clear
                </label>
                <select
                  value={removeStep}
                  onChange={(e) => setRemoveStep(parseInt(e.target.value))}
                  className="w-full h-[48px] bg-[#FEF6DB] dark:bg-black px-4 rounded-xl border border-orange-100 dark:border-navy-700 font-bold text-[13px] outline-none appearance-none"
                >
                  {O2D_STEPS.map((step, idx) => (
                    <option key={idx} value={idx + 1}>
                      Step {idx + 1}: {step}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Clearance Scope
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRemoveOnwards(false)}
                    className={`py-3 px-4 rounded-xl border-2 transition-all text-center ${!removeOnwards ? "border-[#CE2029] bg-[#CE2029]/5 text-[#CE2029]" : "border-gray-100 dark:border-navy-700 text-gray-400 hover:border-gray-200"}`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-tighter">
                      Only Step {removeStep}
                    </p>
                    <p className="text-[8px] font-bold opacity-60">
                      Surgical Clear
                    </p>
                  </button>
                  <button
                    onClick={() => setRemoveOnwards(true)}
                    className={`py-3 px-4 rounded-xl border-2 transition-all text-center ${removeOnwards ? "border-[#CE2029] bg-[#CE2029]/5 text-[#CE2029]" : "border-gray-100 dark:border-navy-700 text-gray-400 hover:border-gray-200"}`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-tighter">
                      Step {removeStep} Onwards
                    </p>
                    <p className="text-[8px] font-bold opacity-60">
                      Sequence Reset
                    </p>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-100 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                  <span className="font-black uppercase tracking-widest block mb-1">
                    Impact Analysis:
                  </span>
                  This will clear Status, Actual Time, and Step-specific data
                  (Vouchers, SO#, etc.).{" "}
                  <strong>Planned dates will be preserved</strong> to allow
                  accurate re-entry.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsRemoveFollowUpModalOpen(false)}
                  className="flex-1 h-[48px] rounded-xl font-black text-gray-400 uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all underline decoration-dotted"
                >
                  Abort
                </button>
                <button
                  onClick={handleRemoveFollowUp}
                  className="flex-[2] h-[48px] bg-[#CE2029] text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-red-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Confirm Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BusyModal
        isOpen={isBusyModalOpen}
        onClose={() => setIsBusyModalOpen(false)}
        groupedOrders={busyOrdersGrouped}
        fullParties={fullParties}
      />
    </div>
  );
}

function BusyModal({
  isOpen,
  onClose,
  groupedOrders,
  fullParties,
}: {
  isOpen: boolean;
  onClose: () => void;
  groupedOrders: any;
  fullParties: any[];
}) {
  const [selectedNos, setSelectedNos] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("Copy All for Busy");
  const [selectedBusyDate, setSelectedBusyDate] = useState<string>("");
  const [isBusyCalendarOpen, setIsBusyCalendarOpen] = useState(false);
  const [isLoadingOrders] = useState(false);

  // Use the groupedOrders prop directly — it's already populated from the
  // parent's SWR cache and contains normalized field names.
  const allGroupedOrders = groupedOrders;

  // Reset selections when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSelectedNos([]);
    setSelectedBusyDate("");
  }, [isOpen]);

  const orderOptions = useMemo(() => {
    let filteredOrders = Object.keys(allGroupedOrders);

    if (selectedBusyDate) {
      filteredOrders = filteredOrders.filter((no) => {
        const order = allGroupedOrders[no][0];
        if (!order || !order.created_at) return false;

        const orderDate = new Date(order.created_at);
        const filterDate = new Date(selectedBusyDate + "T00:00:00");

        return (
          orderDate.getFullYear() === filterDate.getFullYear() &&
          orderDate.getMonth() === filterDate.getMonth() &&
          orderDate.getDate() === filterDate.getDate()
        );
      });
    }

    return filteredOrders
      .map((no) => ({
        no,
        party: allGroupedOrders[no][0]?.party_name || "",
      }))
      .sort((a, b) => b.no.localeCompare(a.no)) // Sort newest first
      .map((item) => `${item.no} | ${item.party}`);
  }, [allGroupedOrders, selectedBusyDate]);

  const results = useMemo(() => {
    return selectedNos.map((no) => {
      const orders = Object.keys(allGroupedOrders)
        .filter((k) => k.toLowerCase() === no.toLowerCase())
        .map((k) => allGroupedOrders[k])[0];

      if (!orders || orders.length === 0)
        return {
          orderNo: no,
          found: false,
          partyName: "",
          items: [],
          promoItems: [],
        };

      const first = orders[0];
      const activeParty = fullParties.find(
        (p) => p.partyName === first.party_name,
      );
      let promoItems: { name: string; qty: string }[] = [];

      if (activeParty && activeParty.firstOrderItems) {
        const match = (activeParty.customerType || "").match(
          /NEW\s*\((.+?)\)/i,
        );
        const firstOrderNo = match ? match[1].trim() : null;

        if (firstOrderNo && firstOrderNo === first.order_no) {
          promoItems = activeParty.firstOrderItems
            .split(",")
            .map((s: string) => {
              const m = s.trim().match(/(.*?)\s*\(Qty:\s*(.*?)\)/);
              return m
                ? { name: m[1].trim(), qty: m[2] }
                : { name: s.trim(), qty: "1" };
            })
            .filter((i: { name: string }) => i.name);
        }
      }

      const expandedOrders = orders.flatMap(expandO2DItem);

      return {
        orderNo: first.order_no,
        partyName: first.party_name,
        items: expandedOrders.map((o: any) => ({ name: o.item_name, qty: o.item_qty })),
        promoItems,
        found: true,
      };
    });
  }, [selectedNos, allGroupedOrders, fullParties]);

  const handleCopy = () => {
    // Format as Tab-Separated Values for easy pasting into grids
    let text = "";
    results
      .filter((r) => r.found)
      .forEach((r) => {
        r.items.forEach((i: any) => {
          text += `${i.name}\t${i.qty}\n`;
        });
        if (r.promoItems && r.promoItems.length > 0) {
          r.promoItems.forEach((p: any) => {
            text += `${p.name} (PROMO)\t${p.qty}\n`;
          });
        }
      });

    navigator.clipboard.writeText(text);
    setCopyStatus("Copied to Clipboard!");
    setTimeout(() => setCopyStatus("Copy All for Busy"), 2000);
  };

  const addOrder = (val: string) => {
    const no = val.split(" | ")[0];
    if (no && !selectedNos.includes(no)) {
      setSelectedNos((prev) => [...prev, no]);
    }
  };

  const removeOrder = (no: string) => {
    setSelectedNos((prev) => prev.filter((n) => n !== no));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-navy-700 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-orange-100/30 dark:border-navy-700 flex items-center justify-between shrink-0 bg-[#FEF6DB] dark:bg-navy-800">
          <div>
            <h2 className="text-xl font-black text-[#003875] dark:text-[#FFD500] italic uppercase">
              DATA FOR BUSY
            </h2>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mt-0.5">
              Simple Item Logistics
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto no-scrollbar space-y-6 bg-white/40 dark:bg-navy-900">
          <div className="space-y-4">
            {/* Date Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                onClick={() => setSelectedBusyDate("")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!selectedBusyDate ? "bg-[#003875] text-white shadow-md" : "bg-white dark:bg-navy-950 text-gray-400 border border-gray-100 dark:border-navy-800"}`}
              >
                Show All
              </button>

              {(() => {
                const now = new Date();
                const fmtLocal = (d: Date) => {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                };
                const today = fmtLocal(now);
                const yd = new Date(now);
                yd.setDate(yd.getDate() - 1);
                const yesterday = fmtLocal(yd);
                const dbyd = new Date(now);
                dbyd.setDate(dbyd.getDate() - 2);
                const dayBeforeYesterday = fmtLocal(dbyd);

                return (
                  <>
                    <button
                      onClick={() => setSelectedBusyDate(dayBeforeYesterday)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedBusyDate === dayBeforeYesterday ? "bg-[#003875] text-white shadow-md" : "bg-white dark:bg-navy-950 text-gray-400 border border-gray-100 dark:border-navy-800"}`}
                    >
                      D-B Yesterday
                    </button>
                    <button
                      onClick={() => setSelectedBusyDate(yesterday)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedBusyDate === yesterday ? "bg-[#003875] text-white shadow-md" : "bg-white dark:bg-navy-950 text-gray-400 border border-gray-100 dark:border-navy-800"}`}
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => setSelectedBusyDate(today)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedBusyDate === today ? "bg-[#003875] text-white shadow-md" : "bg-white dark:bg-navy-950 text-gray-400 border border-gray-100 dark:border-navy-800"}`}
                    >
                      Today
                    </button>
                  </>
                );
              })()}

              <div className="relative">
                <button
                  onClick={() => setIsBusyCalendarOpen(!isBusyCalendarOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedBusyDate &&
                      ![0, 1, 2].some((d) => {
                        const dt = new Date();
                        const y = dt.getFullYear();
                        const m = String(dt.getMonth() + 1).padStart(2, "0");
                        const day = String(dt.getDate() - d).padStart(2, "0");
                        return `${y}-${m}-${day}` === selectedBusyDate;
                      })
                      ? "bg-[#003875] text-white shadow-md"
                      : "bg-white dark:bg-navy-950 text-gray-400 border border-gray-100 dark:border-navy-800"
                    }`}
                >
                  <CalendarDaysIcon className="w-3.5 h-3.5" />
                  {selectedBusyDate &&
                    ![0, 1, 2].some((d) => {
                      const dt = new Date();
                      const y = dt.getFullYear();
                      const m = String(dt.getMonth() + 1).padStart(2, "0");
                      const day = String(dt.getDate() - d).padStart(2, "0");
                      return `${y}-${m}-${day}` === selectedBusyDate;
                    })
                    ? new Date(selectedBusyDate + "T00:00:00").toLocaleDateString("en-GB")
                    : "Calendar"}
                </button>

                {isBusyCalendarOpen && (
                  <div className="absolute top-full left-0 mt-2 z-[9999]">
                    <PremiumDatePicker
                      value={selectedBusyDate}
                      onChange={(date) => {
                        setSelectedBusyDate(date);
                        setIsBusyCalendarOpen(false);
                      }}
                      allowPast={true}
                    />
                  </div>
                )}
              </div>
            </div>

            <SearchableDropdown
              label="Select Orders"
              icon={MagnifyingGlassIcon}
              value=""
              onChange={addOrder}
              options={orderOptions.filter((no) => !selectedNos.includes(no))}
              placeholder="Search and select orders..."
              keepOpen={true}
              listPosition="relative"
            />

            {selectedNos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedNos.map((no) => (
                  <span
                    key={no}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#003875] text-[#FFD500] rounded-full text-[10px] font-black shadow-sm"
                    title={allGroupedOrders[no]?.[0]?.party_name}
                  >
                    {no}
                    <span className="opacity-60 font-bold border-l border-[#FFD500]/30 pl-1.5 ml-0.5 truncate max-w-[80px]">
                      {allGroupedOrders[no]?.[0]?.party_name}
                    </span>
                    <button
                      onClick={() => removeOrder(no)}
                      className="hover:text-red-400 transition-colors ml-1"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setSelectedNos([])}
                  className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline ml-auto"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {results.length > 0 ? (
              results.map((r, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border-2 ${r.found ? "bg-white dark:bg-navy-800/50 border-orange-100/30 dark:border-navy-700 shadow-sm" : "bg-red-50 border-red-100 text-red-500 opacity-60"}`}
                >
                  {!r.found ? (
                    <p className="text-[10px] font-black italic">
                      Order {r.orderNo} not found
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col border-b border-gray-50 dark:border-white/5 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] font-black text-[#003875] dark:text-[#FFD500] italic">
                            {r.orderNo}
                          </span>
                          <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest truncate max-w-[200px]">
                            {r.partyName}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        {/* Header */}
                        <div className="col-span-10 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-white/5 pb-1">
                          Item Description
                        </div>
                        <div className="col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-white/5 pb-1 text-right">
                          Qty
                        </div>

                        {/* Items */}
                        {r.items.map((i: any, ii: number) => (
                          <React.Fragment key={ii}>
                            <div className="col-span-10 text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase truncate py-0.5">
                              {i.name}
                            </div>
                            <div className="col-span-2 text-[11px] font-black text-[#003875] dark:text-[#FFD500] text-right py-0.5">
                              {i.qty}
                            </div>
                          </React.Fragment>
                        ))}

                        {/* Promos */}
                        {r.promoItems &&
                          r.promoItems.length > 0 &&
                          r.promoItems.map((p: any, ii: number) => (
                            <React.Fragment key={`p-${ii}`}>
                              <div className="col-span-10 text-[11px] font-bold text-rose-500 uppercase truncate py-0.5 flex items-center gap-1.5 mt-1 border-t border-rose-50 dark:border-rose-900/10 pt-1">
                                <span className="w-1 h-1 rounded-full bg-rose-400" />
                                {p.name} (X-TRA)
                              </div>
                              <div className="col-span-2 text-[11px] font-black text-rose-500 text-right py-0.5 mt-1 border-t border-rose-50 dark:border-rose-900/10 pt-1">
                                {p.qty}
                              </div>
                            </React.Fragment>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 opacity-30">
                <ArchiveBoxIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Ready for extraction
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-navy-700 bg-white/80 dark:bg-navy-800/80 backdrop-blur-md flex flex-col gap-3">
          <button
            onClick={handleCopy}
            disabled={results.filter((r) => r.found).length === 0}
            className="w-full h-[52px] bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-lg disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2 group"
          >
            <ClipboardDocumentCheckIcon className="w-5 h-5" />
            {copyStatus}
          </button>
          <button
            onClick={onClose}
            className="w-full h-[40px] rounded-xl font-black text-gray-400 uppercase tracking-widest text-[9px] hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          >
            Close Modal
          </button>
        </div>
      </div>
    </div>
  );
}

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#FEF6DB] to-white dark:from-navy-800 dark:to-navy-900 rounded-2xl border border-orange-100 dark:border-navy-700 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#FFD500]/30" />
      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">
        {label}
      </span>
      <div className="flex bg-gray-100/50 dark:bg-black/40 p-1.5 rounded-full border border-gray-100 dark:border-navy-800 backdrop-blur-sm relative">
        <div
          className={`absolute top-1.5 bottom-1.5 transition-all duration-300 rounded-full shadow-lg ${value === "Yes"
              ? "left-1.5 right-[calc(50%+6px)] bg-emerald-500"
              : "left-[calc(50%+6px)] right-1.5 bg-[#CE2029]"
            }`}
        />
        <button
          type="button"
          onClick={() => onChange("Yes")}
          className={`relative z-10 w-20 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${value === "Yes" ? "text-white" : "text-gray-400 hover:text-gray-600"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange("No")}
          className={`relative z-10 w-20 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${value === "No" ? "text-white" : "text-gray-400 hover:text-gray-600"}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

interface O2DDetailPanelProps {
  selectedOrder: O2D[];
  selectedOrderNo: string | null;
  setSelectedOrderNo: (no: string | null) => void;
  isAllLoading: boolean;
  isTransitioning: boolean;
  isSpecialRole: boolean;
  setIsRemoveFollowUpModalOpen: (open: boolean) => void;
  openStepUpdateModal: () => void;
  setConfirmPayload: (payload: any) => void;
  setIsConfirmOpen: (open: boolean) => void;
  detailViewMode: 'full' | 'table';
  setDetailViewMode: (mode: 'full' | 'table') => void;
  lockoutTimeLeft: { m: number; s: number };
  isStep1Lockout: boolean;
  getPreviewUrl: (path: string) => string;
  getDownloadUrl: (path: string) => string;
  fullParties: any[];
}

function O2DDetailPanel({
  selectedOrder,
  selectedOrderNo,
  setSelectedOrderNo,
  isAllLoading,
  isTransitioning,
  isSpecialRole,
  setIsRemoveFollowUpModalOpen,
  openStepUpdateModal,
  setConfirmPayload,
  setIsConfirmOpen,
  detailViewMode,
  setDetailViewMode,
  lockoutTimeLeft,
  isStep1Lockout,
  getPreviewUrl,
  getDownloadUrl,
  fullParties,
}: O2DDetailPanelProps) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  useEffect(() => {
    if (detailViewMode === "table" && bottomScrollRef.current) {
      const updateWidth = () => {
        const tableElement = bottomScrollRef.current?.querySelector("table");
        if (tableElement) {
          setTableScrollWidth(tableElement.offsetWidth);
        }
      };

      const observer = new ResizeObserver(updateWidth);
      observer.observe(bottomScrollRef.current);
      updateWidth();
      return () => observer.disconnect();
    }
  }, [detailViewMode, selectedOrder]);

  const handleTopScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };
  return (
    <div
      key={selectedOrderNo || "none"}
      className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-navy-900/20 relative z-10 ${!selectedOrderNo ? "hidden lg:flex" : "flex"}`}
    >
      {/* Loading Overlay */}
      {(isAllLoading || isTransitioning) && (!selectedOrder || selectedOrder.length === 0) && (
        <div className="absolute inset-0 bg-white/60 dark:bg-navy-900/60 backdrop-blur-sm flex items-center justify-center z-40 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#003875]/20 dark:border-[#FFD500]/20 border-t-[#003875] dark:border-t-[#FFD500] rounded-full animate-spin" />
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              Loading...
            </p>
          </div>
        </div>
      )}
      {selectedOrder && selectedOrder.length > 0 ? (
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
          {" "}
          {/* CREAM HEADER - Compact with all Actions */}
          <div className="px-4 py-2 flex items-center justify-between bg-[#FEF6DB] dark:bg-navy-800 border-b border-orange-100 dark:border-navy-700 text-[#003875] dark:text-[#FFD500]">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSelectedOrderNo(null)}
                className="lg:hidden p-1.5 bg-[#003875]/10 hover:bg-[#003875]/20 rounded-full transition-all"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#003875] dark:text-[#FFD500]" />
              </button>
              <h2 className="text-[15px] font-black italic tracking-tight uppercase">
                {selectedOrderNo}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              {" "}
              {/* Workflow Actions */}
              {!selectedOrder[0]?.hold &&
                !selectedOrder[0]?.cancelled &&
                !isStep1Lockout && (
                  <div className="flex items-center gap-1.5">
                    {isSpecialRole && (
                      <button
                        onClick={() =>
                          setIsRemoveFollowUpModalOpen(true)
                        }
                        className="flex items-center gap-1.5 p-1.5 sm:px-4 sm:py-1.5 bg-[#003875]/5 hover:bg-[#003875]/10 rounded-full text-[#003875] dark:text-[#FFD500] transition-all transition-transform active:scale-90 border border-[#003875]/10 dark:border-[#FFD500]/10"
                        title="Remove Follow-up"
                      >
                        <MinusCircleIcon className="w-4 h-4" />
                        <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest">
                          Remove Follow-up
                        </span>
                      </button>
                    )}
                    <button
                      onClick={openStepUpdateModal}
                      className="flex items-center gap-1.5 p-1.5 sm:px-5 sm:py-1.5 bg-[#003875] text-[#FFD500] hover:bg-[#002a5a] rounded-full transition-all transition-transform active:scale-90 shadow-lg shadow-black/10 animate-pulse"
                      title="Update Progress"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                      <span className="hidden lg:inline text-[10px] font-black uppercase opacity-90">
                        Update
                      </span>
                    </button>
                  </div>
                )}
              {/* Status Actions: Hold & Cancel */}
              <button
                onClick={() => {
                  setConfirmPayload({
                    type: "hold",
                    orderNo: selectedOrderNo as string,
                    currentValue: selectedOrder[0]?.hold,
                  });
                  setIsConfirmOpen(true);
                }}
                className={`flex items-center gap-1.5 p-1.5 sm:px-4 sm:py-1.5 rounded-full transition-all transition-transform active:scale-90 border ${selectedOrder[0]?.hold ? "bg-orange-500 text-white border-orange-400 shadow-md" : "bg-[#003875]/5 text-[#003875]/80 border-[#003875]/10 hover:bg-[#003875]/10 hover:text-[#003875] dark:text-[#FFD500]/80 dark:border-[#FFD500]/10 dark:hover:bg-[#FFD500]/10 dark:hover:text-[#FFD500]"}`}
                title={
                  selectedOrder[0]?.hold
                    ? "Resume Order"
                    : "Put on Hold"
                }
              >
                <PauseCircleIcon className="w-4 h-4" />
                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest">
                  {selectedOrder[0]?.hold ? "On Hold" : "Hold"}
                </span>
              </button>
              <button
                onClick={() => {
                  setConfirmPayload({
                    type: "cancelled",
                    orderNo: selectedOrderNo as string,
                    currentValue: selectedOrder[0]?.cancelled,
                  });
                  setIsConfirmOpen(true);
                }}
                className={`flex items-center gap-1.5 p-1.5 sm:px-4 sm:py-1.5 rounded-full transition-all transition-transform active:scale-90 border ${selectedOrder[0]?.cancelled ? "bg-black text-white border-black shadow-md" : "bg-[#003875]/5 text-[#003875]/80 border-[#003875]/10 hover:bg-[#003875]/10 hover:text-[#003875] dark:text-[#FFD500]/80 dark:border-[#FFD500]/10 dark:hover:bg-[#FFD500]/10 dark:hover:text-[#FFD500]"}`}
                title={
                  selectedOrder[0]?.cancelled
                    ? "Undo Cancellation"
                    : "Cancel Order"
                }
              >
                <NoSymbolIcon className="w-4 h-4" />
                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest">
                  {selectedOrder[0]?.cancelled
                    ? "Cancelled"
                    : "Cancel"}
                </span>
              </button>
              <div className="w-px h-5 bg-[#003875]/10 dark:bg-white/20 mx-1 hidden sm:block" />
              <div className="flex items-center gap-1.5 p-1 bg-[#003875]/5 dark:bg-black/10 rounded-full border border-[#003875]/10 dark:border-white/20 backdrop-blur-sm">
                <button
                  onClick={() => setDetailViewMode("full")}
                  className={`p-1.5 rounded-full transition-all ${detailViewMode === "full" ? "bg-[#003875] text-[#FFD500] shadow-md scale-105" : "text-[#003875]/60 hover:text-[#003875] dark:text-white/60 dark:hover:text-white"}`}
                >
                  <Squares2X2Icon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDetailViewMode("table")}
                  className={`p-1.5 rounded-full transition-all ${detailViewMode === "table" ? "bg-[#003875] text-[#FFD500] shadow-md scale-105" : "text-[#003875]/60 hover:text-[#003875] dark:text-white/60 dark:hover:text-white"}`}
                >
                  <ListBulletIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          {detailViewMode === "full" ? (
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 animate-in fade-in duration-200">
              {/* Consolidated Summary - Cream Background */}
              <div className="bg-white dark:bg-navy-800/50 p-6 rounded-2xl border-2 border-gray-100 dark:border-navy-700 shadow-md grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-9">
                  <div className="mb-5">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">
                      ESTABLISHED PARTNER
                    </p>
                    <p className="text-lg font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-wide">
                      {selectedOrder[0]?.party_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-3">
                      <ArchiveBoxIcon className="w-4.5 h-4.5 text-[#003875]/40" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-400 uppercase">
                          Loadout
                        </span>
                        <span className="text-[13px] font-black text-gray-700 dark:text-gray-100">
                          {selectedOrder.length} Items
                        </span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-[#003875]/5 mx-1 hidden sm:block" />
                    <div className="flex items-center gap-3">
                      <UserIcon className="w-4.5 h-4.5 text-[#003875]/40" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-400 uppercase">
                          Operator
                        </span>
                        <span className="text-[13px] font-black text-gray-700 dark:text-gray-100 uppercase truncate max-w-[120px]">
                          {selectedOrder[0]?.filled_by}
                        </span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-[#003875]/5 mx-1 hidden sm:block" />
                    <div className="flex items-center gap-3">
                      <CalendarDaysIcon className="w-4.5 h-4.5 text-[#003875]/40" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-400 uppercase">
                          Timestamp
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-gray-700 dark:text-gray-100">
                            {(() => {
                              const o = selectedOrder[0];
                              const d = o?.created_at || (o as any)?.actual_1 || (o as any)?.planned_1;
                              if (!d) return "N/A";
                              const ts = new Date(d);
                              if (isNaN(ts.getTime()) || ts.getFullYear() <= 1970) return "N/A";
                              return ts.toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              });
                            })()}
                          </span>
                          {isStep1Lockout && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 text-[12px] font-black shadow-sm">
                              <ClockIcon className="w-4 h-4 animate-pulse" />
                              -
                              {lockoutTimeLeft.m
                                .toString()
                                .padStart(2, "0")}
                              :
                              {lockoutTimeLeft.s
                                .toString()
                                .padStart(2, "0")}{" "}
                              to enable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedOrder[0]?.hold &&
                      !selectedOrder[0]?.cancelled && (
                        <>
                          <div className="w-px h-8 bg-orange-500/10 mx-1 hidden sm:block" />
                          <div className="flex items-center gap-3">
                            <PauseCircleIcon className="w-4.5 h-4.5 text-orange-500/60" />
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-orange-400 uppercase">
                                Held On
                              </span>
                              <span className="text-[13px] font-black text-orange-500">
                                {selectedOrder[0]?.hold &&
                                  new Date(
                                    selectedOrder[0]?.hold,
                                  ).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                    {selectedOrder[0]?.cancelled && (
                      <>
                        <div className="w-px h-8 bg-red-500/10 mx-1 hidden sm:block" />
                        <div className="flex items-center gap-3">
                          <NoSymbolIcon className="w-4.5 h-4.5 text-red-500/60" />
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-red-400 uppercase">
                              Cancelled On
                            </span>
                            <span className="text-[13px] font-black text-[#CE2029]">
                              {selectedOrder[0]?.cancelled &&
                                new Date(
                                  selectedOrder[0]?.cancelled,
                                ).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <div className="relative group w-28 h-28">
                    <div className="absolute inset-0 bg-[#FFD500] blur-lg opacity-10" />
                    <div className="relative h-full bg-white dark:bg-black border-4 border-white dark:border-navy-800 rounded-xl overflow-hidden shadow-xl group-hover:scale-105 transition-transform">
                      {selectedOrder[0]?.order_screenshot ? (
                        <img
                          src={getPreviewUrl(
                            selectedOrder[0]?.order_screenshot,
                          )}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <PhotoIcon className="w-6 h-6 text-gray-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a
                          href={getPreviewUrl(
                            selectedOrder[0]?.order_screenshot,
                          )}
                          target="_blank"
                          className="p-2 bg-white rounded-full transition-transform hover:scale-110"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4 text-black" />
                        </a>
                        {selectedOrder[0]?.order_screenshot && (
                          <a
                            href={getDownloadUrl(
                              selectedOrder[0]?.order_screenshot,
                            )}
                            target="_blank"
                            className="p-2 bg-white rounded-full transition-transform hover:scale-110"
                            title="Download"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4 text-black" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Promotional Deployment - Extra Items for Dispatch */}
              {(() => {
                const activeParty = fullParties.find(
                  (p: any) =>
                    p.partyName === selectedOrder[0]?.party_name,
                );
                if (activeParty && activeParty.firstOrderItems) {
                  // Parse order no from customerType e.g. "NEW (OR-05)"
                  const match = (
                    activeParty.customerType || ""
                  ).match(/NEW\s*\((.+?)\)/i);
                  const firstOrderNo = match
                    ? match[1].trim()
                    : null;
                  // Only show if this is the specific linked first order
                  if (
                    firstOrderNo &&
                    firstOrderNo === selectedOrder[0]?.order_no
                  ) {
                    const promoItems = activeParty.firstOrderItems
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                    if (promoItems.length > 0) {
                      // Icon + color map for known promo items
                      const promoIconMap: Record<
                        string,
                        { icon: React.ElementType; color: string }
                      > = {
                        "T Shirt": {
                          icon: TagIcon,
                          color: "text-rose-500",
                        },
                        "Note Pad": {
                          icon: DocumentTextIcon,
                          color: "text-sky-500",
                        },
                        Pen: {
                          icon: PencilSquareIcon,
                          color: "text-violet-500",
                        },
                        Thele: {
                          icon: ShoppingBagIcon,
                          color: "text-emerald-500",
                        },
                        "Tape Roll": {
                          icon: ArchiveBoxIcon,
                          color: "text-amber-500",
                        },
                        Posters: {
                          icon: PhotoIcon,
                          color: "text-pink-500",
                        },
                        Catalogue: {
                          icon: ClipboardDocumentCheckIcon,
                          color: "text-teal-500",
                        },
                      };
                      return (
                        <div className="bg-gradient-to-r from-amber-50 to-[#FFFBF0] dark:from-navy-800 dark:to-navy-900 rounded-2xl border-2 border-[#FFD500] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-400 relative">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#FFD500]" />
                          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest flex items-center gap-2">
                                <GiftIcon className="w-5 h-5 text-[#FFD500]" />
                                PROMOTIONAL DEPLOYMENT
                              </h3>
                              <p className="text-[10px] font-bold text-gray-500 mt-0.5 ml-7 uppercase tracking-wider">
                                Required First Order Extras for
                                Dispatch
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {promoItems.map(
                                (item: string, idx: number) => {
                                  const itemMatch = item.match(
                                    /(.*?)\s*\((Qty:\s*(.*?))\)/,
                                  );
                                  const name = itemMatch
                                    ? itemMatch[1].trim()
                                    : item;
                                  const qty = itemMatch
                                    ? itemMatch[3]
                                    : "1";
                                  const promo = promoIconMap[
                                    name
                                  ] || {
                                    icon: GiftIcon,
                                    color: "text-orange-500",
                                  };
                                  const ItemIcon = promo.icon;
                                  return (
                                    <div
                                      key={idx}
                                      className="bg-white dark:bg-black px-3 py-1.5 rounded-lg border border-orange-100 dark:border-navy-700 flex items-center gap-2 shadow-sm"
                                    >
                                      <ItemIcon
                                        className={`w-3.5 h-3.5 shrink-0 ${promo.color}`}
                                      />
                                      <span className="text-[11px] font-black text-gray-800 dark:text-gray-100">
                                        {name}
                                      </span>
                                      <div className="w-px h-3 bg-gray-200 dark:bg-navy-700" />
                                      <span className="text-[11px] font-black text-[#003875] dark:text-[#FFD500]">
                                        ×{qty}
                                      </span>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }
                }
                return null;
              })()}

              {/* Tactical Inventory - Reverted to Simple 4-Column Table View */}
              <div className="bg-white dark:bg-navy-800/50 rounded-2xl border-2 border-gray-100 dark:border-navy-700 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="px-6 py-3 border-b border-gray-100 dark:border-navy-700 flex items-center justify-between bg-white/40 dark:bg-transparent">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 items-center">
                    <div className="w-1 h-3.5 bg-[#003875] rounded-full" />{" "}
                    Tactical Inventory
                  </h3>
                  <div className="text-[12px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-tighter">
                    TOTAL Value: ₹
                    {selectedOrder
                      .reduce(
                        (sum: number, i: O2D) =>
                          sum + (parseFloat(i.est_amount) || 0),
                        0,
                      )
                      .toLocaleString()}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-100 dark:bg-navy-950 text-[10px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">
                        <th className="px-6 py-3">NOMENCLATURE</th>
                        <th className="px-6 py-3">
                          ITEM SPECIFICATION
                        </th>
                        <th className="px-6 py-3 text-center">
                          QUANTITY
                        </th>
                        <th className="px-6 py-3 text-right">
                          ESTIMATED AMOUNT
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-800/20">
                      {selectedOrder.map((item: O2D, idx: number) => (
                        <tr
                          key={idx}
                          className="text-[12px] font-bold text-gray-700 dark:text-gray-300 hover:bg-[#003875]/[0.02] dark:hover:bg-navy-700/10 transition-colors"
                        >
                          <td className="px-6 py-4 font-black text-gray-900 dark:text-white uppercase">
                            {item.item_name}
                          </td>
                          <td className="px-6 py-4 text-[11px] font-medium text-gray-500 dark:text-gray-400 italic italic">
                            {item.item_specification || "-"}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-[#003875] dark:text-[#FFD500]">
                            {item.item_qty}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-[#CE2029]">
                            ₹
                            {(parseFloat(item.est_amount) || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-100/50 dark:bg-black/20 text-[11px] font-black uppercase tracking-widest text-[#003875] dark:text-[#FFD500]">
                        <td
                          colSpan={2}
                          className="px-6 py-4 italic"
                        >
                          Aggregate Order Sum
                        </td>
                        <td className="px-6 py-4 text-center bg-[#003875]/5 dark:bg-[#003875]/10 text-gray-700 dark:text-gray-300">
                          {selectedOrder.length} Items
                        </td>
                        <td className="px-6 py-4 text-right bg-[#003875] text-white">
                          ₹
                          {selectedOrder
                            .reduce(
                              (sum: number, i: O2D) =>
                                sum +
                                (parseFloat(i.est_amount) || 0),
                              0,
                            )
                            .toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              {/* Operational Manifest - Step Specific Details */}
              <div className="bg-white dark:bg-navy-800/50 rounded-2xl border-2 border-gray-100 dark:border-navy-700 shadow-md overflow-hidden">
                <div className="px-6 py-3 border-b border-gray-100 dark:border-navy-700 bg-white/40 dark:bg-transparent">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 items-center">
                    <div className="w-1 h-3.5 bg-[#003875] rounded-full" />{" "}
                    Operational Manifest
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12">
                  {/* Step 1: SO Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest border-b border-gray-100 pb-2">
                      <IdentificationIcon className="w-4 h-4" />{" "}
                      Step 1: SO Protocol
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          SO Number
                        </span>
                        <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                          {selectedOrder[0]?.so_number_1 || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          Final Amt
                        </span>
                        <span className="text-[14px] font-black text-[#003875] dark:text-[#FFD500]">
                          ₹
                          {(parseFloat(
                            selectedOrder[0]?.final_amount_1 || "0",
                          ) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                        Merge With
                      </span>
                      <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                        {selectedOrder[0]?.merge_order_with_1 ||
                          "N/A"}
                      </span>
                    </div>
                    {(() => {
                      const soDoc = selectedOrder.find((o: O2D) => o.upload_so_1)?.upload_so_1;
                      if (!soDoc) return null;
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={getPreviewUrl(soDoc)}
                            target="_blank"
                            className="p-1 px-2.5 bg-[#003875]/5 dark:bg-[#FFD500]/5 text-[#003875] dark:text-[#FFD500] rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-[#003875] hover:text-white dark:hover:bg-[#FFD500] dark:hover:text-black transition-all flex items-center gap-1"
                          >
                            <EyeIcon className="w-3 h-3" />
                            View
                          </a>
                          <a
                            href={getDownloadUrl(soDoc)}
                            target="_blank"
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#003875]/5 rounded-lg text-[11px] font-black text-[#003875] hover:bg-[#003875]/10 transition-all uppercase tracking-widest"
                            title="Download SO Doc"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </a>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Step 5: Packing */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest border-b border-gray-100 pb-2">
                      <ArchiveBoxIcon className="w-4 h-4" /> Step 5:
                      Packing
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          Parcels
                        </span>
                        <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                          {selectedOrder[0]?.num_of_parcel_5 || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          Packed On
                        </span>
                        <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                          {selectedOrder[0]
                            ?.actual_date_of_order_packed_5
                            ? new Date(
                              selectedOrder[0]
                                ?.actual_date_of_order_packed_5,
                            ).toLocaleDateString()
                            : "-"}
                        </span>
                      </div>
                    </div>
                    {(() => {
                      const piDoc = selectedOrder.find((o: O2D) => o.upload_pi_5)?.upload_pi_5;
                      if (!piDoc) return null;
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={getPreviewUrl(piDoc)}
                            target="_blank"
                            className="p-1 px-2.5 bg-[#003875]/5 dark:bg-[#FFD500]/5 text-[#003875] dark:text-[#FFD500] rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-[#003875] hover:text-white dark:hover:bg-[#FFD500] dark:hover:text-black transition-all flex items-center gap-1"
                          >
                            <EyeIcon className="w-3 h-3" />
                            View
                          </a>
                          <a
                            href={getDownloadUrl(piDoc)}
                            target="_blank"
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#003875]/5 rounded-lg text-[11px] font-black text-[#003875] hover:bg-[#003875]/10 transition-all uppercase tracking-widest"
                            title="Download PI Doc"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </a>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Step 7 & 9: Dispatch & Bilty */}
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest border-b border-gray-100 pb-2">
                        <CalendarDaysIcon className="w-4 h-4" />{" "}
                        Step 7: Dispatch
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          Voucher #
                        </span>
                        <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                          {selectedOrder[0]?.voucher_num_7 || "-"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest border-b border-gray-100 pb-2">
                        <HashtagIcon className="w-4 h-4" /> Step 9:
                        Send Bilty to CRM
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            Parcels
                          </span>
                          <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                            {selectedOrder[0]?.num_of_parcel_9 ||
                              "-"}
                          </span>
                        </div>
                        {(() => {
                          const biltyDoc = selectedOrder.find((o: O2D) => o.attach_bilty_9)?.attach_bilty_9;
                          if (!biltyDoc) return null;
                          return (
                            <div className="flex items-center gap-2 self-end mb-1">
                              <a
                                href={getPreviewUrl(biltyDoc)}
                                target="_blank"
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#003875]/5 rounded-lg text-[10px] font-black text-[#003875] hover:bg-[#003875]/10 w-fit transition-all uppercase tracking-widest"
                              >
                                <EyeIcon className="w-3.5 h-3.5" /> Bilty
                              </a>
                              <a
                                href={getDownloadUrl(biltyDoc)}
                                target="_blank"
                                className="p-1.5 bg-[#003875]/5 rounded-lg text-[#003875] hover:bg-[#003875]/10 transition-all"
                                title="Download Bilty"
                              >
                                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Step 8: Verification */}
                  <div className="space-y-4 lg:col-span-2">
                    <div className="flex items-center gap-2 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest border-b border-gray-100 pb-2">
                      <CalendarDaysIcon className="w-4 h-4" /> Step
                      8: Operational Audit
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          Checked
                        </span>
                        <span
                          className={`text-[14px] font-black ${selectedOrder[0]?.order_details_checked_8 === "Yes" ? "text-green-500" : "text-red-500"}`}
                        >
                          {selectedOrder[0]
                            ?.order_details_checked_8 || "No"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          Voucher 51
                        </span>
                        <span className="text-[14px] font-black text-gray-700 dark:text-gray-200">
                          {selectedOrder[0]?.voucher_num_51_8 ||
                            "-"}
                        </span>
                      </div>
                      <div className="flex flex-col sm:col-span-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          T. Amount
                        </span>
                        <span className="text-[14px] font-black text-[#003875] dark:text-[#FFD500]">
                          ₹
                          {(parseFloat(
                            selectedOrder[0]?.t_amt_8 || "0",
                          ) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dark Blue Decorative Line */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-[#003875]/20 to-transparent" />

              {/* Compact Remarks - Cream Background */}
              {selectedOrder[0]?.remark && (
                <div className="bg-[#FEF6DB] dark:bg-navy-800/50 p-5 rounded-2xl border-2 border-orange-100 dark:border-navy-700 relative shadow-md">
                  <ChatBubbleBottomCenterTextIcon className="absolute top-4 right-4 w-6 h-6 text-[#003875]/10" />
                  <span className="text-[9px] font-black text-[#003875]/40 uppercase tracking-[0.2em] block mb-1.5 font-bold">
                    Intelligence Report
                  </span>
                  <p className="text-[12px] font-bold text-gray-600 dark:text-gray-400 leading-relaxed italic">
                    "{selectedOrder[0]?.remark}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Pure Simple Table View - Cream Background Theme */
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-navy-900 animate-in slide-in-from-bottom-2 duration-200">
              {/* Top Synchronized Scrollbar */}
              <div 
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="mx-6 mt-4 overflow-x-auto overflow-y-hidden theme-scrollbar h-3 shrink-0"
              >
                <div style={{ width: tableScrollWidth, height: '1px' }}></div>
              </div>

              <div 
                ref={bottomScrollRef}
                onScroll={handleBottomScroll}
                className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar p-6 pt-2"
              >
              <div className="bg-white dark:bg-navy-900 rounded-xl border-2 border-gray-100 dark:border-navy-700 shadow-xl w-max min-w-full overflow-hidden">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-amber-100 dark:bg-navy-950 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">
                      <th className="px-6 py-4 border-r border-[#003875]/10 sticky left-0 z-10 bg-amber-100 dark:bg-navy-950">
                        Nomenclature
                      </th>
                      <th className="px-6 py-4 border-r border-[#003875]/10">
                        Item Specification
                      </th>
                      <th className="px-6 py-4 text-center border-r border-[#003875]/10">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-right border-r border-[#003875]/10">
                        Estimated Amount
                      </th>
                      {O2D_STEPS.map((step, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-center border-r border-[#003875]/10 last:border-r-0 align-top"
                          title={step}
                        >
                          <div className="flex flex-col items-center justify-center gap-0.5 min-w-[120px]">
                            <span className="text-[8px] opacity-50 uppercase tracking-[0.2em] font-black">
                              Step {idx + 1}
                            </span>
                            <span className="text-[10px] whitespace-normal leading-tight">
                              {O2D_STEP_SHORTS[idx]}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CE2029]/5 dark:divide-navy-800/20">
                    {selectedOrder.map((item: O2D, idx: number) => (
                      <tr
                        key={idx}
                        className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors text-[13px] font-medium text-gray-700 dark:text-gray-200"
                      >
                        <td className="px-6 py-3 border-r border-[#CE2029]/5 sticky left-0 z-10 bg-white dark:bg-navy-800">
                          {item.item_name}
                        </td>
                        <td
                          className="px-6 py-3 border-r border-[#CE2029]/5 italic text-gray-500 text-[11px] max-w-[250px] truncate"
                          title={item.item_specification}
                        >
                          {item.item_specification || "-"}
                        </td>
                        <td className="px-6 py-3 text-center border-r border-[#CE2029]/5 bg-[#FFD500]/5 dark:bg-navy-900 font-black">
                          {item.item_qty}
                        </td>
                        <td className="px-6 py-3 text-right font-black text-[#003875] dark:text-[#FFD500] border-r border-[#CE2029]/5">
                          ₹
                          {parseFloat(
                            item.est_amount,
                          ).toLocaleString()}
                        </td>
                        {O2D_STEPS.map((_, stepIdx) => {
                          const plannedRaw = item[
                            `planned_${stepIdx + 1}` as keyof O2D
                          ] as string;
                          const actualRaw = item[
                            `actual_${stepIdx + 1}` as keyof O2D
                          ] as string;
                          const status = item[
                            `status_${stepIdx + 1}` as keyof O2D
                          ] as string;

                          const planned = formatDate(plannedRaw);
                          const actual = formatDate(actualRaw);
                          const delay = getTimeDelay(
                            plannedRaw,
                            actualRaw,
                          );

                          return (
                            <td
                              key={stepIdx}
                              className="px-6 py-2 min-w-[140px] border-r border-[#CE2029]/5 last:border-r-0"
                            >
                              <div className="flex flex-col gap-1.5 text-[10.5px]">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-gray-400 font-black tracking-widest uppercase text-[9px]">
                                    Plan
                                  </span>{" "}
                                  <span className="font-bold text-gray-800 dark:text-gray-200">
                                    {planned}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-gray-400 font-black tracking-widest uppercase text-[9px]">
                                    Actual
                                  </span>{" "}
                                  <span className="font-black text-[#003875] dark:text-[#FFD500]">
                                    {actual}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-gray-400 font-black tracking-widest uppercase text-[9px]">
                                    Status
                                  </span>{" "}
                                  <span
                                    className={`font-black uppercase ${(status || "").toString().trim().toLowerCase() === "done" || (status || "").toString().trim().toLowerCase() === "yes" ? "text-green-500" : "text-[#CE2029]"}`}
                                  >
                                    {status || "-"}
                                  </span>
                                </div>
                                {delay && (
                                  <div
                                    className={`flex justify-between items-center gap-2 border-t pt-1.5 mt-0.5 ${delay.isDelayed ? "border-red-100 dark:border-red-900/30" : "border-green-100 dark:border-green-900/30"}`}
                                  >
                                    <span className="text-gray-400 font-black tracking-widest uppercase text-[9px]">
                                      Delay
                                    </span>
                                    <span
                                      className={`font-black text-[10px] ${delay.isDelayed ? "text-[#CE2029]" : "text-green-600"}`}
                                    >
                                      {delay.text}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FEF6DB]/80 dark:bg-navy-950 font-black text-[#003875] dark:text-white text-[13px] border-t-2 border-[#003875]/20 shadow-inner">
                      <td className="px-6 py-4 border-r border-[#003875]/10 sticky left-0 z-10 bg-[#FEF6DB]/80 dark:bg-navy-950 backdrop-blur-md">
                        AGGREGATE SUM
                      </td>
                      <td className="px-6 py-4 border-r border-[#003875]/10"></td>
                      <td className="px-6 py-4 text-center border-r border-[#003875]/10">
                        {selectedOrder.reduce(
                          (sum: number, i: O2D) =>
                            sum + (parseFloat(i.item_qty) || 0),
                          0,
                        )}{" "}
                        Units
                      </td>
                      <td className="px-6 py-4 text-right text-[#003875] dark:text-[#FFD500] border-r border-[#003875]/10">
                        ₹
                        {selectedOrder
                          .reduce(
                            (sum: number, i: O2D) =>
                              sum + (parseFloat(i.est_amount) || 0),
                            0,
                          )
                          .toLocaleString()}
                      </td>
                      <td
                        colSpan={O2D_STEPS.length}
                        className="px-6 py-4"
                      ></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-30">
          <div className="w-16 h-16 bg-[#003875]/5 rounded-full flex items-center justify-center mb-4">
            <Squares2X2Icon className="w-8 h-8 text-[#003875]" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#003875] italic">
            Select record to engage
          </p>
        </div>
      )}
    </div>
  );
}

