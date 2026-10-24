"use client";

import { useState, useEffect, useMemo } from "react";
import { PlusIcon, CurrencyRupeeIcon, ClockIcon, DocumentArrowUpIcon, XMarkIcon, ExclamationTriangleIcon, TrashIcon, PencilSquareIcon, BoltIcon, EyeIcon, CalendarIcon, WifiIcon, PhoneIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, DevicePhoneMobileIcon, CpuChipIcon, PlayCircleIcon, SparklesIcon, ShareIcon, ChevronDownIcon, ChevronUpIcon, CloudIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import ConfirmModal from "@/components/ConfirmModal";

export default function RechargePage() {
  const { data: session } = useSession();
  const currentUser = (session?.user as any)?.username || session?.user?.name || "Admin";

  const [recharges, setRecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isQuickRecharge, setIsQuickRecharge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Filter & Search State
  const [activeFilter, setActiveFilter] = useState<"ALL" | "OVERDUE" | "TODAY" | "TOMORROW" | "DAY_AFTER" | "DISCONTINUED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");

  // Confirm Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    id: "",
    timestamp: "",
    filled_by: "",
    doer_wifi_name: "",
    phone_wifi_num: "",
    date_of_recharge: "",
    validity: "",
    amount: "",
    attach_bill: "",
    type: "Recharge" as "Recharge" | "Discontinued",
  });

  const fetchRecharges = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recharge");
      const data = await res.json();
      setRecharges(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch recharges", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecharges();
  }, []);

  // Compute unique doers for datalist auto-fetch
  const uniqueDoers = useMemo(() => {
    const doerMap = new Map<string, string>();
    // Sort ascending by time so the last one set is the most recent
    const sortedForDoers = [...recharges].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    sortedForDoers.forEach(r => {
      if (r.doer_wifi_name && r.phone_wifi_num) {
        doerMap.set(r.doer_wifi_name, r.phone_wifi_num);
      }
    });
    return Array.from(doerMap.entries()).map(([name, num]) => ({ name, num }));
  }, [recharges]);

  // Auto-fetch phone number when doer name changes to an existing one
  useEffect(() => {
    if (!formData.phone_wifi_num && formData.doer_wifi_name) {
      const match = uniqueDoers.find(d => d.name === formData.doer_wifi_name);
      if (match) {
        setFormData(prev => ({ ...prev, phone_wifi_num: match.num }));
      }
    }
  }, [formData.doer_wifi_name, uniqueDoers]);

  const openAddModal = () => {
    setFormData({
      id: "",
      timestamp: "",
      filled_by: currentUser,
      doer_wifi_name: "",
      phone_wifi_num: "",
      date_of_recharge: new Date().toISOString().split("T")[0],
      validity: "30",
      amount: "",
      attach_bill: "",
      type: "Recharge",
    });
    setPendingFile(null);
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    setFormData({
      id: item.id,
      timestamp: item.timestamp,
      filled_by: item.filled_by,
      doer_wifi_name: item.doer_wifi_name,
      phone_wifi_num: item.phone_wifi_num,
      date_of_recharge: item.date_of_recharge,
      validity: item.validity,
      amount: item.amount,
      attach_bill: item.attach_bill,
      type: (item.type === "Remove from Recharge" ? "Discontinued" : item.type) || "Recharge",
    });
    setPendingFile(null);
    setIsEditing(true);
    setIsQuickRecharge(false);
    setShowModal(true);
  };

  const openQuickRechargeModal = (item: any) => {
    setFormData({
      id: "",
      timestamp: "",
      filled_by: currentUser,
      doer_wifi_name: item.doer_wifi_name,
      phone_wifi_num: item.phone_wifi_num,
      date_of_recharge: new Date().toISOString().split("T")[0],
      validity: item.validity || "30",
      amount: item.amount || "",
      attach_bill: "",
      type: "Recharge",
    });
    setPendingFile(null);
    setIsEditing(false);
    setIsQuickRecharge(true);
    setShowModal(true);
  };

  // Only store the selected file locally — actual upload happens on Save
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    // Clear any previously saved bill ID so it gets replaced on submit
    setFormData(prev => ({ ...prev, attach_bill: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const endpoint = "/api/recharge";
    const method = isEditing ? "PUT" : "POST";

    let attachBillId = formData.attach_bill;

    // Upload pending file now (on Save), not on file select
    if (pendingFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", pendingFile);
        const uploadRes = await fetch("/api/recharge/upload", {
          method: "POST",
          body: fd,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.fileId) {
          attachBillId = uploadData.fileId;
        } else {
          alert("Failed to upload bill. Please try again.");
          setSubmitting(false);
          setUploading(false);
          return;
        }
      } catch (error) {
        console.error("Upload failed", error);
        alert("Failed to upload bill.");
        setSubmitting(false);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const payload = {
      ...formData,
      attach_bill: attachBillId,
      type: formData.type === "Discontinued" ? "Remove from Recharge" : formData.type,
    };

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPendingFile(null);
        setShowModal(false);
        fetchRecharges();
      } else {
        alert("Failed to save recharge.");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred.");
    }
    setSubmitting(false);
  };

  const requestDelete = (id: string) => {
    setDeleteId(id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/recharge?id=${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        fetchRecharges();
      }
    } catch (error) {
      console.error(error);
    }
    setIsConfirmOpen(false);
    setDeleteId(null);
  };

  const exportToCSV = () => {
    const headers = ["Name", "Number", "Status", "Recharge Date", "Validity (Days)", "Amount", "Filled By"];
    const csvRows = [headers.join(",")];
    
    // Export the currently filtered groups, flattened
    const exportData = filteredGroups.flat();
    
    exportData.forEach((r: any) => {
      const status = r.type === "Remove from Recharge" ? "Discontinued" : r.type || "Recharge";
      const row = [
        `"${(r.doer_wifi_name || '').replace(/"/g, '""')}"`,
        `"${(r.phone_wifi_num || '').replace(/"/g, '""')}"`,
        `"${status}"`,
        `"${r.date_of_recharge || ''}"`,
        `"${r.validity || ''}"`,
        `"${r.amount || ''}"`,
        `"${(r.filled_by || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(","));
    });
    
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Recharge_Data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Helper formatting
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dd = String(date.getDate()).padStart(2, '0');
    const mmm = months[date.getMonth()];
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd} ${mmm} ${yy}`;
  };

  const getExpiryDate = (rDateStr: string, validity: string) => {
    if (!rDateStr || !validity) return null;
    // Parse the date parts manually to avoid UTC vs local timezone issues
    const parts = rDateStr.split("-");
    if (parts.length < 3) {
      const rDate = new Date(rDateStr);
      if (isNaN(rDate.getTime())) return null;
      const validityDays = parseInt(validity) || 0;
      const expiryDate = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate() + validityDays);
      return expiryDate;
    }
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const validityDays = parseInt(validity) || 0;
    // Create expiry date in local time (midnight) to avoid timezone offset
    const expiryDate = new Date(year, month, day + validityDays);
    return expiryDate;
  };

  const determineCategory = (name: string | undefined | null, numStr: string | undefined | null) => {
    const qName = (name || '').toLowerCase();
    const qNum = (numStr || '').toLowerCase();
    
    // ENTERTAINMENT
    if (qName.includes('netflix') || qName.includes('amazon prime') || qName.includes('prime')) 
      return { type: 'ENTERTAINMENT', label: 'Entertainment' };
    
    // SOCIAL & ADS
    if (qName.includes('meta') || qName.includes('facebook') || qName.includes('whatsapp') || qName.includes('insta') || qName.includes('linkedin')) 
      return { type: 'SOCIAL', label: 'Social & Ads' };
    
    // AI TOOLS
    if (qName.includes('claude') || qName.includes('chatgpt') || qName.includes('openai') || qName.includes('chat gpt') || qName.includes('annie')) 
      return { type: 'AI', label: 'AI Tools' };
      
    // DOMAINS & EMAIL
    if (qName.includes('domain') || qName.includes('email') || qName.includes('gmail'))
      return { type: 'DOMAIN', label: 'Domains & Email' };
      
    // SOFTWARE & SAAS
    if (qName.includes('zoom') || qName.includes('shopify') || qName.includes('callyzer') || qName.includes('envato') || qName.includes('automation'))
      return { type: 'SOFTWARE', label: 'Software & SaaS' };

    // WIFI & BROADBAND
    if (qName.includes('fiber') || qName.includes('broadband') || qName.includes('wifi') || qName.includes('airtel b-58') || qName.includes('bn - 15') || qName.includes('bn -15') || (qName.includes('airtel') && !qName.includes('sim'))) 
      return { type: 'WIFI', label: 'WiFi & Fiber' };

    // OFFICE MOBILE
    if (qName.includes('crm') || qName.includes('sales') || qName.includes('purchase') || qName.includes('hr') || qName.includes('receiption') || qName.includes('office') || qName.includes('c.c.') || qName.includes('k.b.'))
      return { type: 'OFFICE', label: 'Office Mobile' };

    // Fallback based on number
    if (qNum.includes('@') || qName.includes('@')) return { type: 'SOFTWARE', label: 'Software & SaaS' }; 
    const digits = qNum.replace(/\D/g, '');
    if (digits.length >= 10) return { type: 'MOBILE', label: 'Staff Mobile' };
    
    return { type: 'OTHER', label: 'Other' };
  };

  const CATEGORIES = [
    { id: "ALL", label: "All Categories", icon: BoltIcon, activeColor: "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/20", inactiveColor: "bg-white text-gray-600 border border-gray-200/70 hover:bg-gray-50 dark:bg-[#1C1C1E] dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300" },
    { id: "MOBILE", label: "Staff Mobile", icon: DevicePhoneMobileIcon, activeColor: "bg-[#5856D6] text-white shadow-md shadow-[#5856D6]/20", inactiveColor: "bg-white text-[#5856D6] border border-[#5856D6]/20 hover:bg-[#5856D6]/5 dark:bg-[#1C1C1E] dark:border-[#5856D6]/20 dark:hover:bg-[#5856D6]/10" },
    { id: "OFFICE", label: "Office Mobile", icon: PhoneIcon, activeColor: "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/20", inactiveColor: "bg-white text-[#2563EB] border border-[#2563EB]/20 hover:bg-[#2563EB]/5 dark:bg-[#1C1C1E] dark:border-[#2563EB]/20 dark:hover:bg-[#2563EB]/10" },
    { id: "WIFI", label: "WiFi & Fiber", icon: WifiIcon, activeColor: "bg-[#34C759] text-white shadow-md shadow-[#34C759]/20", inactiveColor: "bg-white text-[#34C759] border border-[#34C759]/20 hover:bg-[#34C759]/5 dark:bg-[#1C1C1E] dark:border-[#34C759]/20 dark:hover:bg-[#34C759]/10" },
    { id: "SOFTWARE", label: "Software & SaaS", icon: CloudIcon, activeColor: "bg-[#00C7BE] text-white shadow-md shadow-[#00C7BE]/20", inactiveColor: "bg-white text-[#00C7BE] border border-[#00C7BE]/20 hover:bg-[#00C7BE]/5 dark:bg-[#1C1C1E] dark:border-[#00C7BE]/20 dark:hover:bg-[#00C7BE]/10" },
    { id: "DOMAIN", label: "Domains", icon: GlobeAltIcon, activeColor: "bg-[#FF9500] text-white shadow-md shadow-[#FF9500]/20", inactiveColor: "bg-white text-[#FF9500] border border-[#FF9500]/20 hover:bg-[#FF9500]/5 dark:bg-[#1C1C1E] dark:border-[#FF9500]/20 dark:hover:bg-[#FF9500]/10" },
    { id: "AI", label: "AI Tools", icon: CpuChipIcon, activeColor: "bg-[#AF52DE] text-white shadow-md shadow-[#AF52DE]/20", inactiveColor: "bg-white text-[#AF52DE] border border-[#AF52DE]/20 hover:bg-[#AF52DE]/5 dark:bg-[#1C1C1E] dark:border-[#AF52DE]/20 dark:hover:bg-[#AF52DE]/10" },
    { id: "SOCIAL", label: "Social", icon: ShareIcon, activeColor: "bg-[#5AC8FA] text-white shadow-md shadow-[#5AC8FA]/20", inactiveColor: "bg-white text-[#5AC8FA] border border-[#5AC8FA]/20 hover:bg-[#5AC8FA]/5 dark:bg-[#1C1C1E] dark:border-[#5AC8FA]/20 dark:hover:bg-[#5AC8FA]/10" },
    { id: "ENTERTAINMENT", label: "Entertainment", icon: PlayCircleIcon, activeColor: "bg-[#FF2D55] text-white shadow-md shadow-[#FF2D55]/20", inactiveColor: "bg-white text-[#FF2D55] border border-[#FF2D55]/20 hover:bg-[#FF2D55]/5 dark:bg-[#1C1C1E] dark:border-[#FF2D55]/20 dark:hover:bg-[#FF2D55]/10" },
    { id: "OTHER", label: "Other", icon: SparklesIcon, activeColor: "bg-[#8E8E93] text-white shadow-md shadow-[#8E8E93]/20", inactiveColor: "bg-white text-[#8E8E93] border border-[#8E8E93]/20 hover:bg-[#8E8E93]/5 dark:bg-[#1C1C1E] dark:border-[#8E8E93]/20 dark:hover:bg-[#8E8E93]/10" },
  ];

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getGroupKey = (r: any) => `${r.doer_wifi_name?.trim().toLowerCase() || ''}-${r.phone_wifi_num?.trim() || ''}`;

  // Grouping logic for calculations
  const groupedAllRecharges = Object.values(recharges.reduce((acc: any, r: any) => {
    const key = getGroupKey(r);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {})).map((group: any) => {
    return group.sort((a: any, b: any) => {
      const aTime = new Date(a.date_of_recharge).getTime();
      const bTime = new Date(b.date_of_recharge).getTime();
      return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  });

  const latestRecharges = groupedAllRecharges.map(group => group[0]);

  // Calculations for dashboard
  const kpiBaseRecharges = latestRecharges.filter(r => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = (r.doer_wifi_name || "").toLowerCase().includes(q);
      const matchPhone = (r.phone_wifi_num || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone) return false;
    }
    if (activeCategory !== "ALL") {
      const cat = determineCategory(r.doer_wifi_name, r.phone_wifi_num);
      if (cat.type !== activeCategory) return false;
    }
    return true;
  });

  const kpiAllRecharges = recharges.filter(r => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = (r.doer_wifi_name || "").toLowerCase().includes(q);
      const matchPhone = (r.phone_wifi_num || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone) return false;
    }
    if (activeCategory !== "ALL") {
      const cat = determineCategory(r.doer_wifi_name, r.phone_wifi_num);
      if (cat.type !== activeCategory) return false;
    }
    return true;
  });

  const activeRecharges = kpiBaseRecharges.filter((r: any) => r.type !== "Discontinued" && r.type !== "Remove from Recharge");
  const totalAmount = kpiAllRecharges.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueCount = activeRecharges.filter((item: any) => {
    const expiryDate = getExpiryDate(item.date_of_recharge, item.validity);
    if (!expiryDate) return false;
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 0;
  }).length;

  const expiringToday = activeRecharges.filter((item: any) => {
    const expiryDate = getExpiryDate(item.date_of_recharge, item.validity);
    if (!expiryDate) return false;
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0;
  }).length;

  const expiringTomorrow = activeRecharges.filter((item: any) => {
    const expiryDate = getExpiryDate(item.date_of_recharge, item.validity);
    if (!expiryDate) return false;
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }).length;

  const expiringDayAfter = activeRecharges.filter((item: any) => {
    const expiryDate = getExpiryDate(item.date_of_recharge, item.validity);
    if (!expiryDate) return false;
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 2;
  }).length;

  const discontinuedCount = kpiBaseRecharges.filter((r: any) => r.type === "Discontinued" || r.type === "Remove from Recharge").length;

  // First, sort the groups by the latest recharge date
  const groupedSorted = groupedAllRecharges.sort((groupA: any, groupB: any) => {
    const aLatest = groupA[0];
    const bLatest = groupB[0];
    const aTime = new Date(aLatest.date_of_recharge).getTime();
    const bTime = new Date(bLatest.date_of_recharge).getTime();
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime) || new Date(bLatest.timestamp).getTime() - new Date(aLatest.timestamp).getTime();
  });

  const filteredGroups = groupedSorted.filter((group: any) => {
    const r = group[0]; // Filter based on the LATEST record properties
    
    // 1. Apply Search Query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = (r.doer_wifi_name || "").toLowerCase().includes(q);
      const matchPhone = (r.phone_wifi_num || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone) return false;
    }

    // 2. Apply Category Filter
    if (activeCategory !== "ALL") {
      const cat = determineCategory(r.doer_wifi_name, r.phone_wifi_num);
      if (cat.type !== activeCategory) return false;
    }

    // 3. Apply Expiry Filter
    if (activeFilter === "ALL") return true;

    if (activeFilter === "DISCONTINUED") {
      return r.type === "Discontinued" || r.type === "Remove from Recharge";
    }
    
    // Discontinued items don't expire for other filters
    if (r.type === "Discontinued" || r.type === "Remove from Recharge") return false;

    const expiryDate = getExpiryDate(r.date_of_recharge, r.validity);
    if (!expiryDate) return false;
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (activeFilter === "OVERDUE") return diffDays < 0;
    if (activeFilter === "TODAY") return diffDays === 0;
    if (activeFilter === "TOMORROW") return diffDays === 1;
    if (activeFilter === "DAY_AFTER") return diffDays === 2;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex flex-col h-[calc(100vh-4rem)] p-2 gap-2">
      
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete Recharge Record"
        message="Are you sure you want to permanently delete this recharge record? This action cannot be undone."
        onConfirm={performDelete}
        onClose={() => setIsConfirmOpen(false)}
      />

      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-3xl p-3 shadow-sm gap-4 shrink-0">
        <div className="flex items-center gap-3 ml-2">
          <div className="p-2.5 bg-[#2563EB] rounded-2xl shadow-inner">
            <BoltIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-wide leading-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Recharge Hub</h1>
            <p className="text-gray-500 dark:text-gray-400 font-semibold text-[13px] tracking-wider mt-1">Manage Connections & Payments</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mr-1">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-100/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/5 rounded-full text-[14px] font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all w-full md:w-56"
            />
          </div>
          <button onClick={exportToCSV} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full text-[14px] font-bold tracking-wide transition-all">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={openAddModal} className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white hover:bg-[#005bb5] rounded-full text-[14px] font-bold tracking-wide transition-all shadow-md shadow-[#2563EB]/20">
            <PlusIcon className="w-4 h-4" /> New Recharge
          </button>
        </div>
      </div>

      {/* Split Layout Container */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3">
        
        {/* Left Sidebar - KPIs */}
        <div className="w-full md:w-64 lg:w-72 flex flex-col gap-3 shrink-0 overflow-y-auto custom-scrollbar px-2 py-2">
          <div 
            onClick={() => setActiveFilter("ALL")}
            className={`cursor-pointer bg-[#2563EB] text-white rounded-3xl p-4 shadow-lg shadow-[#2563EB]/20 relative overflow-hidden group transition-all transform hover:scale-[1.02] ${activeFilter === "ALL" ? 'ring-4 ring-[#2563EB]/50 ring-offset-2 dark:ring-offset-[#0a0f1c]' : ''}`}
          >
            <div className="z-10 relative">
              <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">Total Bill Amount</p>
              <h2 className="text-2xl font-semibold leading-none flex items-center gap-1" style={{ letterSpacing: '-0.02em' }}>
                <span className="text-lg font-semibold opacity-80">₹</span>{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <CurrencyRupeeIcon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            {activeFilter === "ALL" && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
          </div>

          <div 
            onClick={() => setActiveFilter("OVERDUE")}
            className={`cursor-pointer bg-[#FF3B30] text-white rounded-3xl p-4 shadow-lg shadow-[#FF3B30]/20 relative overflow-hidden group transition-all transform hover:scale-[1.02] ${activeFilter === "OVERDUE" ? 'ring-4 ring-[#FF3B30]/50 ring-offset-2 dark:ring-offset-[#0a0f1c]' : ''}`}
          >
            <div className="z-10 relative">
              <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">Overdue Connections</p>
              <h2 className="text-3xl font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>
                {overdueCount} <span className="text-[14px] font-semibold opacity-80">Conns</span>
              </h2>
            </div>
            <ExclamationTriangleIcon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            {activeFilter === "OVERDUE" && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
          </div>

          <div 
            onClick={() => setActiveFilter("TODAY")}
            className={`cursor-pointer bg-[#FF2D55] text-white rounded-3xl p-4 shadow-lg shadow-[#FF2D55]/20 relative overflow-hidden group transition-all transform hover:scale-[1.02] ${activeFilter === "TODAY" ? 'ring-4 ring-[#FF2D55]/50 ring-offset-2 dark:ring-offset-[#0a0f1c]' : ''}`}
          >
            <div className="z-10 relative">
              <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">Expiring Today</p>
              <h2 className="text-3xl font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>
                {expiringToday} <span className="text-[14px] font-semibold opacity-80">Conns</span>
              </h2>
            </div>
            <ClockIcon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            {activeFilter === "TODAY" && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
          </div>

          <div 
            onClick={() => setActiveFilter("TOMORROW")}
            className={`cursor-pointer bg-[#FF9500] text-white rounded-3xl p-4 shadow-lg shadow-[#FF9500]/20 relative overflow-hidden group transition-all transform hover:scale-[1.02] ${activeFilter === "TOMORROW" ? 'ring-4 ring-[#FF9500]/50 ring-offset-2 dark:ring-offset-[#0a0f1c]' : ''}`}
          >
            <div className="z-10 relative">
              <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">Expiring Tomorrow</p>
              <h2 className="text-3xl font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>
                {expiringTomorrow} <span className="text-[14px] font-semibold opacity-80">Conns</span>
              </h2>
            </div>
            <ClockIcon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            {activeFilter === "TOMORROW" && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
          </div>

          <div 
            onClick={() => setActiveFilter("DAY_AFTER")}
            className={`cursor-pointer bg-[#34C759] text-white rounded-3xl p-4 shadow-lg shadow-[#34C759]/20 relative overflow-hidden group transition-all transform hover:scale-[1.02] ${activeFilter === "DAY_AFTER" ? 'ring-4 ring-[#34C759]/50 ring-offset-2 dark:ring-offset-[#0a0f1c]' : ''}`}
          >
            <div className="z-10 relative">
              <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">Expiring Day After Tomorrow</p>
              <h2 className="text-3xl font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>
                {expiringDayAfter} <span className="text-[14px] font-semibold opacity-80">Conns</span>
              </h2>
            </div>
            <CalendarIcon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            {activeFilter === "DAY_AFTER" && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
          </div>

          <div 
            onClick={() => setActiveFilter("DISCONTINUED")}
            className={`cursor-pointer bg-[#8E8E93] text-white rounded-3xl p-4 shadow-lg shadow-[#8E8E93]/20 relative overflow-hidden group transition-all transform hover:scale-[1.02] ${activeFilter === "DISCONTINUED" ? 'ring-4 ring-[#8E8E93]/50 ring-offset-2 dark:ring-offset-[#0a0f1c]' : ''}`}
          >
            <div className="z-10 relative">
              <p className="text-[14px] font-bold text-white/80 tracking-wide mb-1">Discontinued</p>
              <h2 className="text-3xl font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>
                {discontinuedCount} <span className="text-[14px] font-semibold opacity-80">Conns</span>
              </h2>
            </div>
            <XMarkIcon className="w-16 h-16 absolute -right-3 -bottom-3 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            {activeFilter === "DISCONTINUED" && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
          </div>
        </div>

        {/* Right Main Area - Wide Row Cards */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent rounded-2xl flex flex-col gap-3">
          
          {/* Categories Horizontal Row */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-3 shrink-0 px-2 pt-1">
            {CATEGORIES.map(c => (
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

          {loading ? (
            <div className="flex flex-col gap-3">
               {[1,2,3,4,5,6].map(i => (
                 <div key={i} className="animate-pulse bg-white dark:bg-[#111827] rounded-2xl h-24 border border-gray-200 dark:border-white/5"></div>
               ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredGroups.length > 0 && (
                <div className="text-[13px] font-semibold text-gray-500 mb-1 px-1">
                  {activeFilter === "ALL" ? "All Connections" : `Filtered: ${activeFilter.replace("_", " ")}`}
                </div>
              )}
              {filteredGroups.map((group: any, groupIndex: number) => {
                const r = group[0];
                const key = getGroupKey(r);
                const isExpanded = expandedGroups[key] || false;

                const displayType = r.type === "Remove from Recharge" ? "Discontinued" : r.type || "Recharge";
                const isDiscontinued = displayType === "Discontinued";
                const expiryDate = getExpiryDate(r.date_of_recharge, r.validity);
                
                // Determine icon color based on expiry
                let iconColor = "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
                if (isDiscontinued) {
                  iconColor = "text-gray-400 bg-gray-100 dark:bg-gray-800";
                } else if (expiryDate) {
                  const diffTime = expiryDate.getTime() - today.getTime();
                  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                  if (diffDays <= 0) iconColor = "text-rose-500 bg-rose-50 dark:bg-rose-500/10";
                  else if (diffDays === 1) iconColor = "text-amber-500 bg-amber-50 dark:bg-amber-500/10";
                  else if (diffDays === 2) iconColor = "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"; // Fine for now
                }
                
                const catInfo = determineCategory(r.doer_wifi_name, r.phone_wifi_num);
                let IconComponent = WifiIcon;
                if (catInfo.type === 'MOBILE') IconComponent = DevicePhoneMobileIcon;
                else if (catInfo.type === 'OFFICE') IconComponent = PhoneIcon;
                else if (catInfo.type === 'AI') IconComponent = CpuChipIcon;
                else if (catInfo.type === 'SOFTWARE') IconComponent = CloudIcon;
                else if (catInfo.type === 'DOMAIN') IconComponent = GlobeAltIcon;
                else if (catInfo.type === 'ENTERTAINMENT') IconComponent = PlayCircleIcon;
                else if (catInfo.type === 'SOCIAL') IconComponent = ShareIcon;
                else if (catInfo.type === 'OTHER') IconComponent = SparklesIcon;
                
                return (
                  <div key={`${r.id || 'group'}-${groupIndex}`} className="flex flex-col gap-2">
                    {/* Main Tile */}
                    <div className={`bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border ${isDiscontinued ? 'border-gray-200/50 dark:border-white/5 opacity-75' : 'border-gray-200/50 dark:border-white/5'} rounded-3xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-4 transition-all hover:shadow-md group relative overflow-hidden`}>
                    {!isDiscontinued && <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-[#2563EB] dark:bg-[#0A84FF]"></div>}
                    
                    {/* Icon & Status */}
                    <div className="flex flex-col items-center justify-center gap-2 min-w-[100px] shrink-0 pl-3">
                      <div className={`p-4 rounded-2xl shadow-sm ${iconColor}`}>
                        {isDiscontinued ? <XMarkIcon className="w-8 h-8" /> : <IconComponent className="w-8 h-8" />}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[13px] font-bold  tracking-wider text-center ${
                        isDiscontinued 
                          ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' 
                          : 'bg-green-100 text-green-700 dark:bg-[#34C759]/20 dark:text-[#34C759]'
                      }`}>
                        {displayType}
                      </span>
                    </div>

                    {/* Name & Phone */}
                    <div className="flex-1 min-w-[200px] px-4">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight tracking-tight" title={r.doer_wifi_name}>{r.doer_wifi_name}</h3>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <PhoneIcon className="w-4 h-4" />
                          <p className="text-sm font-semibold tracking-wide">{r.phone_wifi_num}</p>
                        </div>
                        <div className="text-[14px] font-semibold text-gray-400 tracking-wide mt-1">
                          Filled By: <span className="text-gray-600 dark:text-gray-300">{r.filled_by}</span>
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex gap-8 min-w-[250px] border-l border-gray-100 dark:border-white/5 pl-6 shrink-0">
                      <div>
                        <p className="text-[13px] font-bold text-gray-400 mb-1.5">Recharge Date</p>
                        <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{formatDate(r.date_of_recharge)}</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-gray-400 mb-1.5">Expiry Date <span className="lowercase font-bold opacity-70">({r.validity}d)</span></p>
                        <p className={`text-base font-bold ${isDiscontinued ? 'text-gray-500' : 'text-[#FF3B30] dark:text-[#FF453A]'}`}>
                          {expiryDate ? formatDate(expiryDate.toISOString()) : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="min-w-[150px] text-right border-l border-gray-100 dark:border-white/5 pl-6 pr-4 shrink-0">
                       <p className="text-[13px] font-bold text-gray-400 mb-1.5">Amount</p>
                       <p className="text-3xl font-semibold text-[#2563EB] dark:text-[#0A84FF] tracking-tight">₹{r.amount}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 min-w-[180px] border-l-2 border-gray-100 dark:border-white/5 pl-6 shrink-0">
                      {!isDiscontinued && (
                        <button onClick={() => openQuickRechargeModal(r)} title="Quick Recharge" className="p-2 bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 dark:text-[#0A84FF] dark:hover:bg-[#0A84FF]/20 rounded-lg transition-colors">
                          <BoltIcon className="w-4 h-4" />
                        </button>
                      )}
                      {r.attach_bill && (
                        <a href={`/api/drive-proxy?id=${r.attach_bill}`} target="_blank" rel="noreferrer" className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg transition-colors" title="View Bill">
                          <EyeIcon className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => openEditModal(r)} className="p-2 text-[#2563EB] bg-blue-50 hover:bg-blue-100 dark:text-[#60A5FA] dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20 rounded-lg transition-colors">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => requestDelete(r.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      {group.length > 1 && (
                        <button onClick={() => toggleGroup(key)} className="p-2 text-gray-500 bg-gray-50 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors ml-2 border border-gray-200 dark:border-gray-700">
                          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded History */}
                  {isExpanded && group.length > 1 && (
                    <div className="pl-12 pr-4 py-2 flex flex-col gap-2 relative">
                      {/* Connecting line */}
                      <div className="absolute left-6 top-0 bottom-4 w-px bg-gray-200 dark:bg-white/10" />
                      
                      {group.slice(1).map((hist: any, histIdx: number) => {
                        const histExpiry = getExpiryDate(hist.date_of_recharge, hist.validity);
                        return (
                          <div key={`hist-${hist.id || histIdx}`} className="bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl p-3 flex items-center justify-between gap-4 relative">
                             <div className="absolute -left-6 top-1/2 w-6 h-px bg-gray-200 dark:bg-white/10" />
                             
                             <div className="flex items-center gap-6 flex-1">
                               <div>
                                 <p className="text-[13px] font-semibold text-gray-400 mb-0.5">Recharge Date</p>
                                 <p className="text-sm font-bold text-gray-800 dark:text-gray-300">{formatDate(hist.date_of_recharge)}</p>
                               </div>
                               <div>
                                 <p className="text-[13px] font-semibold text-gray-400 mb-0.5">Expiry <span className="lowercase font-bold opacity-70">({hist.validity}d)</span></p>
                                 <p className="text-sm font-semibold text-gray-500">{histExpiry ? formatDate(histExpiry.toISOString()) : "-"}</p>
                               </div>
                             </div>

                             <div className="text-right min-w-[100px]">
                               <p className="text-[13px] font-semibold text-gray-400 mb-0.5">Amount</p>
                               <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 tracking-tight">₹{hist.amount}</p>
                             </div>

                             <div className="flex items-center gap-2 pl-4 border-l border-gray-200 dark:border-white/10">
                                {hist.attach_bill && (
                                  <a href={`/api/drive-proxy?id=${hist.attach_bill}`} target="_blank" rel="noreferrer" className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-md transition-colors" title="View Bill">
                                    <EyeIcon className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button onClick={() => openEditModal(hist)} className="p-1.5 text-gray-400 hover:text-[#2563EB] hover:bg-blue-50 dark:hover:text-[#60A5FA] dark:hover:bg-yellow-500/10 rounded-md transition-colors">
                                  <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => requestDelete(hist.id)} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors">
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
              {filteredGroups.length === 0 && (
                <div className="col-span-full p-8 text-center text-[14px] font-bold text-gray-400 bg-white dark:bg-[#111827] rounded-2xl border border-gray-200 dark:border-white/5">
                  No records found for this filter
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl w-full max-w-xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className={`p-5 flex items-center justify-between shrink-0 ${isQuickRecharge ? 'bg-emerald-500' : 'bg-[#2563EB]'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-2xl">
                  {isQuickRecharge ? (
                    <BoltIcon className="w-4 h-4 text-white" />
                  ) : (
                    <BoltIcon className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide leading-none">
                    {isQuickRecharge ? "Quick Recharge" : isEditing ? "Edit Record" : "New Recharge"}
                  </h2>
                  <p className="text-[13px] font-semibold text-white/70 mt-0.5 tracking-wider">
                    {isQuickRecharge ? "Add quick recharge for this connection" : isEditing ? "Update connection details" : "Add new connection"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-white" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 overflow-auto custom-scrollbar flex-1 space-y-5">

              {isQuickRecharge && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4">
                  <p className="text-[14px] font-bold text-emerald-700 dark:text-emerald-300 tracking-wide">
                    ✓ Connection Details (Read-Only)
                  </p>
                </div>
              )}

              {/* Type Toggle - Hide in quick recharge */}
              {!isQuickRecharge && (
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-black/30 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: "Recharge"})}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-semibold   transition-all ${
                      formData.type === "Recharge"
                        ? "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    ⚡ Recharge
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: "Discontinued"})}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-semibold   transition-all ${
                      formData.type === "Discontinued"
                        ? "bg-[#FF3B30] text-white shadow-md shadow-[#FF3B30]/30"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    ✕ Discontinued
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Doer / WiFi Name */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Doer / WiFi Name</label>
                  <input
                    required
                    disabled={isQuickRecharge}
                    list={!isQuickRecharge ? "doers-list" : undefined}
                    value={formData.doer_wifi_name}
                    onChange={e => setFormData({...formData, doer_wifi_name: e.target.value})}
                    className={`w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all  ${isQuickRecharge ? 'opacity-70 cursor-not-allowed' : ''}`}
                    placeholder="Enter or Select Name"
                  />
                  {!isQuickRecharge && (
                    <datalist id="doers-list">
                      {uniqueDoers.map((d, idx) => (
                        <option key={idx} value={d.name} />
                      ))}
                    </datalist>
                  )}
                </div>

                {/* Phone / WiFi Number */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Phone / WiFi Number</label>
                  <input
                    required
                    disabled={isQuickRecharge}
                    type="text"
                    value={formData.phone_wifi_num}
                    onChange={e => setFormData({...formData, phone_wifi_num: e.target.value})}
                    className={`w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all ${isQuickRecharge ? 'opacity-70 cursor-not-allowed' : ''}`}
                    placeholder="Enter Number"
                  />
                </div>

                {/* Date of Recharge */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Date of Recharge</label>
                  <input
                    required
                    type="date"
                    value={formData.date_of_recharge}
                    onChange={e => setFormData({...formData, date_of_recharge: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all"
                  />
                </div>

                {/* Validity */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Validity (Days)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={formData.validity}
                    onChange={e => setFormData({...formData, validity: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all"
                    placeholder="e.g. 30"
                  />
                </div>

                {/* Amount */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Amount</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-[#2563EB] font-semibold text-sm">₹</span>
                    </div>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 pl-9 text-[14px] font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Attach Bill */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Attach Bill</label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-2.5 cursor-pointer hover:border-[#2563EB] hover:bg-[#2563EB]/5 transition-all group">
                      <DocumentArrowUpIcon className="w-4 h-4 text-gray-400 group-hover:text-[#2563EB] transition-colors" />
                      <span className="text-[13px] font-bold text-gray-400 group-hover:text-[#2563EB] truncate max-w-[100px] transition-colors">
                        {pendingFile ? pendingFile.name : 'Choose File'}
                      </span>
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {(pendingFile || formData.attach_bill) && (
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold ${
                        pendingFile
                          ? 'bg-[#2563EB]/10 text-[#2563EB]'
                          : 'bg-[#34C759]/10 text-[#34C759]'
                      }`} title={pendingFile ? `Ready: ${pendingFile.name}` : 'Bill attached'}>
                        {pendingFile ? '📎' : '✓'}
                      </div>
                    )}
                  </div>
                  {pendingFile && (
                    <p className="text-[13px] font-semibold text-[#2563EB] mt-1.5 pl-1">Will upload when you save ↑</p>
                  )}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 mt-1 border-t border-gray-100 dark:border-white/5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-2xl text-[13px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className={`flex items-center gap-2 text-white px-6 py-2.5 rounded-2xl text-[13px] font-semibold   transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                    isQuickRecharge
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-[#2563EB] hover:bg-[#005bb5] shadow-md shadow-[#2563EB]/20'
                  }`}
                >
                  {(submitting || uploading) && (
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  )}
                  {uploading ? 'Uploading...' : submitting ? 'Saving...' : isQuickRecharge ? 'Save Recharge' : 'Save Record'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
