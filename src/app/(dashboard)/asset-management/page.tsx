"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR from "swr";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import {
  ComputerDesktopIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  CheckBadgeIcon,
  WrenchScrewdriverIcon,
  ArchiveBoxXMarkIcon,
  IdentificationIcon,
  TagIcon,
  DocumentTextIcon,
  UserCircleIcon,
  HashtagIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowDownTrayIcon,
  DevicePhoneMobileIcon,
  WifiIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  TruckIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { AssetItem } from "@/types/asset";

const fetcher = (url: string) => fetch(url).then(res => res.json());

const ASSET_CATEGORY_OPTIONS = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Phone/Tablet",
  "Network Equipment",
  "Furniture",
  "Vehicle",
  "Other",
];

const CATEGORIES = [
  {
    id: "ALL",
    label: "All Categories",
    icon: ArchiveBoxIcon,
    activeColor: "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/20",
    inactiveColor:
      "bg-white text-gray-600 border border-gray-200/70 hover:bg-gray-50 dark:bg-[#1C1C1E] dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300",
  },
  {
    id: "Laptop",
    label: "Laptop",
    icon: ComputerDesktopIcon,
    activeColor: "bg-[#5856D6] text-white shadow-md shadow-[#5856D6]/20",
    inactiveColor:
      "bg-white text-[#5856D6] border border-[#5856D6]/20 hover:bg-[#5856D6]/5 dark:bg-[#1C1C1E] dark:border-[#5856D6]/20 dark:hover:bg-[#5856D6]/10",
  },
  {
    id: "Desktop",
    label: "Desktop",
    icon: CubeIcon,
    activeColor: "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/20",
    inactiveColor:
      "bg-white text-[#2563EB] border border-[#2563EB]/20 hover:bg-[#2563EB]/5 dark:bg-[#1C1C1E] dark:border-[#2563EB]/20 dark:hover:bg-[#2563EB]/10",
  },
  {
    id: "Monitor",
    label: "Monitor",
    icon: ComputerDesktopIcon,
    activeColor: "bg-[#34C759] text-white shadow-md shadow-[#34C759]/20",
    inactiveColor:
      "bg-white text-[#34C759] border border-[#34C759]/20 hover:bg-[#34C759]/5 dark:bg-[#1C1C1E] dark:border-[#34C759]/20 dark:hover:bg-[#34C759]/10",
  },
  {
    id: "Phone/Tablet",
    label: "Phone / Tablet",
    icon: DevicePhoneMobileIcon,
    activeColor: "bg-[#AF52DE] text-white shadow-md shadow-[#AF52DE]/20",
    inactiveColor:
      "bg-white text-[#AF52DE] border border-[#AF52DE]/20 hover:bg-[#AF52DE]/5 dark:bg-[#1C1C1E] dark:border-[#AF52DE]/20 dark:hover:bg-[#AF52DE]/10",
  },
  {
    id: "Network Equipment",
    label: "Network",
    icon: WifiIcon,
    activeColor: "bg-[#00C7BE] text-white shadow-md shadow-[#00C7BE]/20",
    inactiveColor:
      "bg-white text-[#00C7BE] border border-[#00C7BE]/20 hover:bg-[#00C7BE]/5 dark:bg-[#1C1C1E] dark:border-[#00C7BE]/20 dark:hover:bg-[#00C7BE]/10",
  },
  {
    id: "Furniture",
    label: "Furniture",
    icon: BuildingOfficeIcon,
    activeColor: "bg-[#FF9500] text-white shadow-md shadow-[#FF9500]/20",
    inactiveColor:
      "bg-white text-[#FF9500] border border-[#FF9500]/20 hover:bg-[#FF9500]/5 dark:bg-[#1C1C1E] dark:border-[#FF9500]/20 dark:hover:bg-[#FF9500]/10",
  },
  {
    id: "Vehicle",
    label: "Vehicle",
    icon: TruckIcon,
    activeColor: "bg-[#FF2D55] text-white shadow-md shadow-[#FF2D55]/20",
    inactiveColor:
      "bg-white text-[#FF2D55] border border-[#FF2D55]/20 hover:bg-[#FF2D55]/5 dark:bg-[#1C1C1E] dark:border-[#FF2D55]/20 dark:hover:bg-[#FF2D55]/10",
  },
  {
    id: "Other",
    label: "Other",
    icon: SparklesIcon,
    activeColor: "bg-[#8E8E93] text-white shadow-md shadow-[#8E8E93]/20",
    inactiveColor:
      "bg-white text-[#8E8E93] border border-[#8E8E93]/20 hover:bg-[#8E8E93]/5 dark:bg-[#1C1C1E] dark:border-[#8E8E93]/20 dark:hover:bg-[#8E8E93]/10",
  },
];

const normalizeCategory = (category: string | undefined) => {
  const value = (category || "").trim();
  if (!value) return "Other";
  const match = ASSET_CATEGORY_OPTIONS.find(
    (opt) => opt.toLowerCase() === value.toLowerCase()
  );
  return match || "Other";
};

const getCategoryMeta = (category: string | undefined) => {
  const normalized = normalizeCategory(category);
  return CATEGORIES.find((c) => c.id === normalized) || CATEGORIES[CATEGORIES.length - 1];
};

const FORM_LABEL =
  "block text-[14px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 tracking-wide";
const FORM_INPUT =
  "w-full bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-white/10 rounded-2xl py-2.5 text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[#E5E5EA] dark:disabled:bg-white/5";
const FORM_INPUT_WITH_ICON = `${FORM_INPUT} pl-10`;
const FORM_INPUT_PLAIN = `${FORM_INPUT} px-3.5`;

const OutlineInput = ({
  label,
  value,
  onChange,
  type = "text",
  step,
  disabled,
  name,
  list,
  icon: Icon,
  placeholder,
}: {
  label: string;
  value: any;
  onChange: (val: string) => void;
  type?: string;
  step?: string;
  disabled?: boolean;
  name?: string;
  list?: string;
  icon?: any;
  placeholder?: string;
}) => (
  <div className="w-full">
    <label htmlFor={name} className={FORM_LABEL}>
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]/70 dark:text-[#0A84FF]/80">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        type={type}
        step={step}
        name={name}
        id={name}
        list={list}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={Icon ? FORM_INPUT_WITH_ICON : FORM_INPUT_PLAIN}
      />
    </div>
  </div>
);

const OutlineSelect = ({
  label,
  value,
  onChange,
  options,
  disabled,
  name,
  icon: Icon,
}: {
  label: string;
  value: any;
  onChange: (val: string) => void;
  options: string[];
  disabled?: boolean;
  name?: string;
  icon?: any;
}) => (
  <div className="w-full">
    <label htmlFor={name} className={FORM_LABEL}>
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]/70 dark:text-[#0A84FF]/80 z-10">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <select
        name={name}
        id={name}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${Icon ? FORM_INPUT_WITH_ICON : FORM_INPUT_PLAIN} appearance-none pr-10`}
      >
        <option value="" disabled className="dark:bg-[#2C2C2E]">
          Select option
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="dark:bg-[#2C2C2E]">
            {opt}
          </option>
        ))}
      </select>
    </div>
  </div>
);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const d = date.getDate().toString().padStart(2, "0");
  const m = date.toLocaleString("default", { month: "short" });
  const y = date.getFullYear().toString().slice(-2);
  return `${d} ${m} ${y}`;
};

const SearchableUserSelect = ({
  label,
  value,
  onChange,
  options,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  icon?: any;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );
  const displayValue = isOpen ? search : value;

  return (
    <div className="w-full relative z-20" ref={dropdownRef}>
      <label className={FORM_LABEL}>{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]/70 dark:text-[#0A84FF]/80 z-10">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type="text"
          value={displayValue}
          placeholder="Search or select user"
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
          }}
          className={`${Icon ? FORM_INPUT_WITH_ICON : FORM_INPUT_PLAIN} cursor-text`}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl z-50">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt}
                className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-[#2563EB]/8 dark:hover:bg-[#0A84FF]/15 cursor-pointer transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-[14px] font-semibold text-gray-400 text-center">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function AssetManagementPage() {
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");

  const showStatus = (msg: string, type: "loading" | "success" | "error" = "loading") => {
    setStatusMessage(msg);
    setStatusType(type);
    setIsStatusModalOpen(true);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetItem["status"] | "ALL">("ALL");
  const [activeCategory, setActiveCategory] = useState("ALL");

  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AssetItem | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Partial<AssetItem>>({});

  const { data: rawItems, mutate: mutateAssets, isLoading: assetsLoading } = useSWR<AssetItem[]>(
    "/api/assets",
    fetcher
  );
  const items = rawItems || [];

  const { data: usersData } = useSWR<any[]>("/api/users", fetcher);
  const userOptions = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((u) => u.username).sort();
  }, [usersData]);

  const kpiBaseItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        (item.asset_name?.toLowerCase() || "").includes(q) ||
        (item.asset_id?.toLowerCase() || "").includes(q) ||
        (item.assigned_to?.toLowerCase() || "").includes(q) ||
        (item.category?.toLowerCase() || "").includes(q) ||
        (item.serial_number?.toLowerCase() || "").includes(q) ||
        (item.location?.toLowerCase() || "").includes(q);
      const matchesCategory =
        activeCategory === "ALL" || normalizeCategory(item.category) === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, activeCategory]);

  const filteredItems = useMemo(() => {
    let result = kpiBaseItems;
    if (statusFilter !== "ALL") {
      result = result.filter((item) => item.status === statusFilter);
    }
    return result;
  }, [kpiBaseItems, statusFilter]);

  const totalAssets = kpiBaseItems.length;
  const availableCount = kpiBaseItems.filter((i) => i.status === "Available").length;
  const inUseCount = kpiBaseItems.filter((i) => i.status === "In Use").length;
  const maintenanceCount = kpiBaseItems.filter((i) => i.status === "Maintenance").length;
  const retiredCount = kpiBaseItems.filter((i) => i.status === "Retired").length;

  const exportToCSV = () => {
    const headers = [
      "Asset ID",
      "Category",
      "Asset Name",
      "Assigned To",
      "Status",
      "Serial Number",
      "Purchase Date",
      "Location",
      "Remarks",
    ];
    const csvRows = [headers.join(",")];

    filteredItems.forEach((item) => {
      const row = [
        `"${(item.asset_id || "").replace(/"/g, '""')}"`,
        `"${(item.category || "").replace(/"/g, '""')}"`,
        `"${(item.asset_name || "").replace(/"/g, '""')}"`,
        `"${(item.assigned_to || "").replace(/"/g, '""')}"`,
        `"${item.status || ""}"`,
        `"${(item.serial_number || "").replace(/"/g, '""')}"`,
        `"${item.purchase_date || ""}"`,
        `"${(item.location || "").replace(/"/g, '""')}"`,
        `"${(item.remarks || "").replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Asset_Data_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSaveItem = async () => {
    setSubmitting(true);
    showStatus(editingItem ? "Updating Asset Record..." : "Creating New Asset...", "loading");
    const isEdit = !!editingItem;
    const method = isEdit ? "PUT" : "POST";

    if (!isEdit && !itemForm.asset_id) {
      const maxId = items.reduce((max, item) => {
        if (item.asset_id && item.asset_id.toUpperCase().startsWith("AST-")) {
          const num = parseInt(item.asset_id.replace(/[^0-9]/g, ""), 10);
          return !isNaN(num) && num > max ? num : max;
        }
        return max;
      }, 0);
      itemForm.asset_id = `AST-${String(maxId + 1).padStart(4, "0")}`;
    }

    if (!itemForm.status) {
      itemForm.status = "Available";
    }

    try {
      const res = await fetch("/api/assets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });

      if (res.ok) {
        mutateAssets();
        setItemModalOpen(false);
        setItemForm({});
        setEditingItem(null);
        showStatus("Record Saved Successfully!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      showStatus("Error saving asset record.", "error");
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
    setIsConfirmOpen(false);
    showStatus("Deleting asset...", "loading");
    try {
      const res = await fetch(`/api/assets?id=${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        mutateAssets();
        showStatus("Asset Deleted Successfully!", "success");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      showStatus("Error deleting item.", "error");
    } finally {
      setSubmitting(false);
      setPendingDeleteId(null);
    }
  };

  const handleNewAssetClick = () => {
    setEditingItem(null);
    const maxId = items.reduce((max, item) => {
      if (item.asset_id && item.asset_id.toUpperCase().startsWith("AST-")) {
        const num = parseInt(item.asset_id.replace(/[^0-9]/g, ""), 10);
        return !isNaN(num) && num > max ? num : max;
      }
      return max;
    }, 0);
    const nextId = `AST-${String(maxId + 1).padStart(4, "0")}`;

    setItemForm({ asset_id: nextId, status: "Available" });
    setItemModalOpen(true);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-700 dark:bg-[#34C759]/20 dark:text-[#34C759]";
      case "In Use":
        return "bg-blue-100 text-blue-700 dark:bg-[#2563EB]/20 dark:text-[#0A84FF]";
      case "Maintenance":
        return "bg-amber-100 text-amber-700 dark:bg-[#FF9500]/20 dark:text-[#FF9500]";
      case "Retired":
        return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getStatusAccent = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-[#34C759]";
      case "In Use":
        return "bg-[#2563EB] dark:bg-[#0A84FF]";
      case "Maintenance":
        return "bg-[#FF9500]";
      case "Retired":
        return "bg-[#8E8E93]";
      default:
        return "bg-[#8E8E93]";
    }
  };

  const getStatusIconStyle = (status: string) => {
    switch (status) {
      case "Available":
        return "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
      case "In Use":
        return "text-blue-500 bg-blue-50 dark:bg-[#2563EB]/10";
      case "Maintenance":
        return "text-amber-500 bg-amber-50 dark:bg-[#FF9500]/10";
      case "Retired":
        return "text-gray-400 bg-gray-100 dark:bg-gray-800";
      default:
        return "text-gray-400 bg-gray-100 dark:bg-gray-800";
    }
  };

  const getFormStatusStyle = (status: string, active: boolean) => {
    if (!active) {
      return "bg-[#F2F2F7] dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-[#2563EB]/40";
    }
    switch (status) {
      case "Available":
        return "bg-[#34C759] text-white shadow-md shadow-[#34C759]/30";
      case "In Use":
        return "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30";
      case "Maintenance":
        return "bg-[#FF9500] text-white shadow-md shadow-[#FF9500]/30";
      case "Retired":
        return "bg-[#8E8E93] text-white shadow-md shadow-[#8E8E93]/30";
      default:
        return "bg-[#8E8E93] text-white";
    }
  };

  const kpiCards = [
    {
      key: "ALL" as const,
      label: "Total Assets",
      count: totalAssets,
      suffix: "Items",
      bg: "bg-[#2563EB]",
      shadow: "shadow-[#2563EB]/20",
      ring: "ring-[#2563EB]/50",
      icon: ArchiveBoxIcon,
    },
    {
      key: "Available" as const,
      label: "Available",
      count: availableCount,
      suffix: "Items",
      bg: "bg-[#34C759]",
      shadow: "shadow-[#34C759]/20",
      ring: "ring-[#34C759]/50",
      icon: CheckBadgeIcon,
    },
    {
      key: "In Use" as const,
      label: "In Use",
      count: inUseCount,
      suffix: "Items",
      bg: "bg-[#5856D6]",
      shadow: "shadow-[#5856D6]/20",
      ring: "ring-[#5856D6]/50",
      icon: ComputerDesktopIcon,
    },
    {
      key: "Maintenance" as const,
      label: "In Maintenance",
      count: maintenanceCount,
      suffix: "Items",
      bg: "bg-[#FF9500]",
      shadow: "shadow-[#FF9500]/20",
      ring: "ring-[#FF9500]/50",
      icon: WrenchScrewdriverIcon,
    },
    {
      key: "Retired" as const,
      label: "Retired",
      count: retiredCount,
      suffix: "Items",
      bg: "bg-[#8E8E93]",
      shadow: "shadow-[#8E8E93]/20",
      ring: "ring-[#8E8E93]/50",
      icon: ArchiveBoxXMarkIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex flex-col h-[calc(100vh-4rem)] p-2 gap-2">
      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={statusType}
        message={statusMessage}
        onClose={() => setIsStatusModalOpen(false)}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete Asset"
        message="Are you sure you want to delete this asset? This action cannot be undone."
        onConfirm={performDelete}
        onClose={() => setIsConfirmOpen(false)}
        type="danger"
      />

      <div className="flex flex-col md:flex-row items-center justify-between bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-3xl p-3 shadow-sm gap-4 shrink-0">
        <div className="flex items-center gap-3 ml-2">
          <div className="p-2.5 bg-[#2563EB] rounded-2xl shadow-inner">
            <ComputerDesktopIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1
              className="text-base font-semibold text-gray-900 dark:text-white tracking-wide leading-none"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              Asset Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-semibold text-[13px] tracking-wider mt-1">
              Resource Tracking & Inventory
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mr-1">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-100/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/5 rounded-full text-[14px] font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all w-full md:w-56"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full text-[14px] font-bold tracking-wide transition-all"
          >
            <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleNewAssetClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white hover:bg-[#005bb5] rounded-full text-[14px] font-bold tracking-wide transition-all shadow-md shadow-[#2563EB]/20"
          >
            <PlusIcon className="w-4 h-4" /> New Asset
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3">
        <div className="w-full md:w-64 lg:w-72 flex flex-col gap-3 shrink-0 overflow-y-auto custom-scrollbar px-2 py-2">
          {kpiCards.map((card) => (
            <div
              key={card.key}
              onClick={() => setStatusFilter(card.key)}
              className={`cursor-pointer ${card.bg} text-white rounded-3xl p-4 shadow-lg ${card.shadow} relative overflow-hidden group transition-all transform hover:scale-[1.02] ${statusFilter === card.key ? `ring-4 ${card.ring} ring-offset-2 dark:ring-offset-[#0a0f1c]` : ""}`}
            >
              <div className="z-10 relative">
                <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">{card.label}</p>
                <h2 className="text-3xl font-semibold leading-none" style={{ letterSpacing: "-0.02em" }}>
                  {card.count}{" "}
                  <span className="text-[14px] font-semibold opacity-80">{card.suffix}</span>
                </h2>
              </div>
              <card.icon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
              {statusFilter === card.key && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-3 shrink-0 px-2 pt-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-4 py-2 rounded-full text-[14px] font-bold tracking-wide whitespace-nowrap transition-all ${activeCategory === c.id ? c.activeColor : c.inactiveColor}`}
              >
                <div className="flex items-center gap-1.5">
                  <c.icon className="w-4 h-4" />
                  {c.label}
                </div>
              </button>
            ))}
          </div>

          {assetsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-white dark:bg-[#1C1C1E] rounded-3xl h-28 border border-gray-200 dark:border-white/5"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredItems.length > 0 && (
                <div className="text-[13px] font-semibold text-gray-500 mb-1 px-1">
                  {statusFilter === "ALL" ? "All Assets" : `Filtered: ${statusFilter}`}
                  {activeCategory !== "ALL" ? ` · ${activeCategory}` : ""}
                </div>
              )}

              {filteredItems.map((item, idx) => {
                const catMeta = getCategoryMeta(item.category);
                const CatIcon = catMeta.icon;
                const isRetired = item.status === "Retired";

                return (
                  <div
                    key={item.id || idx}
                    className={`bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border ${isRetired ? "border-gray-200/50 dark:border-white/5 opacity-75" : "border-gray-200/50 dark:border-white/5"} rounded-3xl p-4 shadow-sm flex flex-col lg:flex-row items-center gap-4 transition-all hover:shadow-md group relative overflow-hidden`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${getStatusAccent(item.status)}`} />

                    <div className="flex flex-col items-center justify-center gap-2 min-w-[100px] shrink-0 pl-3">
                      <div className={`p-4 rounded-2xl shadow-sm ${getStatusIconStyle(item.status)}`}>
                        <CatIcon className="w-8 h-8" />
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[13px] font-bold  tracking-wider text-center ${getStatusBadgeStyle(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex-1 min-w-[200px] px-2 lg:px-4">
                      <h3
                        className="text-xl font-bold text-gray-900 dark:text-white mb-1 leading-tight tracking-tight"
                        title={item.asset_name}
                      >
                        {item.asset_name}
                      </h3>
                      <p className="text-sm font-bold text-[#2563EB] dark:text-[#0A84FF] mb-2">{item.asset_id}</p>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <UserCircleIcon className="w-4 h-4 shrink-0" />
                          <p className="text-sm font-semibold tracking-wide">
                            {item.assigned_to || "Unassigned"}
                          </p>
                        </div>
                        <div className="text-[14px] font-semibold text-gray-400 tracking-wide">
                          Category:{" "}
                          <span className="text-gray-600 dark:text-gray-300">
                            {normalizeCategory(item.category)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-6 lg:gap-8 min-w-[220px] border-l border-gray-100 dark:border-white/5 pl-4 lg:pl-6 shrink-0">
                      <div>
                        <p className="text-[13px] font-bold text-gray-400 mb-1.5">
                          Serial No.
                        </p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {item.serial_number || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-gray-400 mb-1.5">
                          Purchase Date
                        </p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {formatDate(item.purchase_date)}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-[120px] text-left lg:text-right border-l border-gray-100 dark:border-white/5 pl-4 lg:pl-6 shrink-0">
                      <p className="text-[13px] font-bold text-gray-400 mb-1.5">
                        Location
                      </p>
                      <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                        {item.location || "-"}
                      </p>
                      {item.remarks && (
                        <p className="text-[13px] font-semibold text-gray-400 mt-1 truncate max-w-[140px]" title={item.remarks}>
                          {item.remarks}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 min-w-[100px] border-l-2 border-gray-100 dark:border-white/5 pl-4 lg:pl-6 shrink-0">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setItemForm(item);
                          setItemModalOpen(true);
                        }}
                        className="p-2 text-[#2563EB] bg-blue-50 hover:bg-blue-100 dark:text-[#0A84FF] dark:bg-[#2563EB]/10 dark:hover:bg-[#2563EB]/20 rounded-lg transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(item.id)}
                        className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="p-8 text-center text-[14px] font-bold text-gray-400 bg-white dark:bg-[#1C1C1E] rounded-3xl border border-gray-200 dark:border-white/5">
                  No assets found for this filter
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 flex items-center justify-between shrink-0 bg-[#2563EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-2xl">
                  <ComputerDesktopIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide leading-none">
                    {editingItem ? "Edit Asset" : "New Asset"}
                  </h2>
                  <p className="text-[13px] font-semibold text-white/70 mt-0.5 tracking-wider">
                    {itemForm.asset_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-[#F2F2F7] dark:bg-[#000000]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <OutlineInput
                  icon={IdentificationIcon}
                  label="Asset ID (Auto)"
                  name="asset_id"
                  value={itemForm.asset_id || ""}
                  onChange={(v) => setItemForm({ ...itemForm, asset_id: v })}
                  disabled
                />
                <OutlineSelect
                  icon={TagIcon}
                  label="Category"
                  name="category"
                  value={itemForm.category || ""}
                  onChange={(v) => setItemForm({ ...itemForm, category: v })}
                  options={ASSET_CATEGORY_OPTIONS}
                />
                <OutlineInput
                  icon={DocumentTextIcon}
                  label="Asset Name"
                  name="asset_name"
                  placeholder="Enter asset name"
                  value={itemForm.asset_name || ""}
                  onChange={(v) => setItemForm({ ...itemForm, asset_name: v })}
                />
                <SearchableUserSelect
                  icon={UserCircleIcon}
                  label="Assigned To"
                  value={itemForm.assigned_to || ""}
                  onChange={(v) => setItemForm({ ...itemForm, assigned_to: v })}
                  options={userOptions}
                />

                <div className="md:col-span-2 bg-white dark:bg-[#1C1C1E] border border-gray-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                  <label className={FORM_LABEL}>Current Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Available", "In Use", "Maintenance", "Retired"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setItemForm({ ...itemForm, status })}
                        className={`px-4 py-2 rounded-xl text-[14px] font-bold tracking-wide transition-all ${getFormStatusStyle(status, itemForm.status === status)}`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <OutlineInput
                  icon={HashtagIcon}
                  label="Serial Number"
                  name="serial_number"
                  placeholder="Enter serial number"
                  value={itemForm.serial_number || ""}
                  onChange={(v) => setItemForm({ ...itemForm, serial_number: v })}
                />
                <OutlineInput
                  icon={CalendarDaysIcon}
                  label="Purchase Date"
                  name="purchase_date"
                  type="date"
                  value={itemForm.purchase_date || ""}
                  onChange={(v) => setItemForm({ ...itemForm, purchase_date: v })}
                />
                <OutlineInput
                  icon={MapPinIcon}
                  label="Location"
                  name="location"
                  placeholder="Enter location"
                  value={itemForm.location || ""}
                  onChange={(v) => setItemForm({ ...itemForm, location: v })}
                />
                <OutlineInput
                  icon={ChatBubbleBottomCenterTextIcon}
                  label="Remarks"
                  name="remarks"
                  placeholder="Optional notes"
                  value={itemForm.remarks || ""}
                  onChange={(v) => setItemForm({ ...itemForm, remarks: v })}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200/70 dark:border-white/10 bg-white dark:bg-[#1C1C1E] flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setItemModalOpen(false)}
                className="px-6 py-2.5 rounded-2xl text-[14px] font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={submitting || !itemForm.asset_name}
                className="px-6 py-2.5 rounded-2xl text-[14px] font-bold bg-[#2563EB] text-white hover:bg-[#005bb5] shadow-md shadow-[#2563EB]/20 transition-all disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
