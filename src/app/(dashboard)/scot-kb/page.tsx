"use client";

import { useState, useRef, useMemo } from "react";
import useSWR from "swr";
import { read, utils } from "xlsx";
import {
  ChartBarIcon,
  DocumentArrowUpIcon,
  TableCellsIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  PhoneArrowUpRightIcon,
  UserGroupIcon,
  UserIcon,
  PhoneIcon,
  ClockIcon,
  CalendarIcon,
  TagIcon,
  ArrowTrendingUpIcon,
  PhoneArrowDownLeftIcon,
  NoSymbolIcon,
  InformationCircleIcon,
  ShoppingCartIcon,
  PencilIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

import { O2DKB } from "@/types/o2dkb";
import { DataFeeder } from "@/types/data-feeder";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { generateScotReportPDF } from "@/lib/utils/scotReportPdf";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

export default function ScotKbPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "data-feeder" | "scot">("dashboard");

  const { data: o2dkbDataRes, isValidating: isO2DKBLoading } = useSWR(
    `/api/o2dkb?limit=-1`,
    fetcher
  );

  const { data: feederData, mutate: mutateFeeder, isValidating: isFeederLoading } = useSWR(
    `/api/data-feeder?limit=-1`,
    fetcher
  );

  const { data: frequencyDataRes, mutate: mutateFrequency } = useSWR(
    `/api/scot/frequency?source=scot-kb`,
    fetcher
  );

  const { data: followUpsData, mutate: mutateFollowUps } = useSWR(
    `/api/scot?tab=followup&source=scot-kb`,
    fetcher
  );

  const o2ds: O2DKB[] = o2dkbDataRes?.data || [];
  const feeders: DataFeeder[] = feederData?.data || [];
  const followUps = followUpsData || [];
  const frequencyRecords: { partyName: string, frequency: string }[] = frequencyDataRes?.data || [];

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchScot, setSearchScot] = useState("");
  const [scotPage, setScotPage] = useState(1);
  const itemsPerPage = 25;
  const [selectedScotMonth, setSelectedScotMonth] = useState<string>("");
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  const [searchFeeder, setSearchFeeder] = useState("");
  const [feederPage, setFeederPage] = useState(1);

  const [isFreqModalOpen, setIsFreqModalOpen] = useState(false);
  const [freqParty, setFreqParty] = useState("");
  const [freqValue, setFreqValue] = useState("");
  const [isSavingFreq, setIsSavingFreq] = useState(false);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpParty, setFollowUpParty] = useState("");
  const [followUpDateValue, setFollowUpDateValue] = useState("");
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  const [isReportLoading, setIsReportLoading] = useState(false);

  const handleGenerateWeeklyReports = async () => {
    setIsReportLoading(true);
    // Since scot-kb is a specialized view, we use source=scot-kb to fetch from the KB specific sheets
    alert("Aggregating spreadsheet metrics for last week...");
    try {
      const res = await fetch('/api/scot/report?source=scot-kb');
      if (res.ok) {
        const data = await res.json();
        const coordinators = data.report || [];
        if (coordinators.length === 0) {
          alert("No active sales coordinator records found for last week.");
          return;
        }
        
        for (const coordinator of coordinators) {
          await generateScotReportPDF(coordinator, data.dateRange);
        }
        
        alert(`Successfully exported and downloaded ${coordinators.length} Coordinator PDF report(s)!`);
      } else {
        alert("Failed to load weekly report data from server");
      }
    } catch (err) {
      console.error("Error generating weekly reports:", err);
      alert("Error connecting to server while generating reports");
    } finally {
      setIsReportLoading(false);
    }
  };

  const saveFrequency = async () => {
    if (!freqParty || !freqValue) return;
    setIsSavingFreq(true);

    // Optimistic Update: instantly update UI
    const optimisticRecords = [...frequencyRecords];
    const existingIdx = optimisticRecords.findIndex(r => r.partyName === freqParty);
    if (existingIdx !== -1) {
      optimisticRecords[existingIdx] = { ...optimisticRecords[existingIdx], frequency: freqValue };
    } else {
      optimisticRecords.push({ partyName: freqParty, frequency: freqValue });
    }
    
    // Mutate local cache immediately and don't revalidate yet
    mutateFrequency({ success: true, data: optimisticRecords }, false);
    setIsFreqModalOpen(false);

    try {
      const res = await fetch("/api/scot/frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyName: freqParty, frequency: freqValue, source: 'scot-kb' })
      });
      if (!res.ok) {
        // If it failed, revalidate to get true state back
        mutateFrequency();
        const d = await res.json();
        alert(d.error || "Failed to save frequency");
      }
    } catch (e) {
      console.error(e);
      // Revalidate to rollback
      mutateFrequency();
      alert("Error saving frequency");
    } finally {
      setIsSavingFreq(false);
    }
  };

  const saveFollowUp = async () => {
    if (!followUpParty || !followUpDateValue) return;
    setIsSavingFollowUp(true);

    const payload = {
      type: 'followup',
      source: 'scot-kb',
      data: {
        partyName: followUpParty,
        status: "Pending",
        nextFollowUpDate: followUpDateValue,
        remarks: "Added manually from Scot KB",
        createdBy: "Admin",
        createdAt: new Date().toISOString(),
        lastFollowUpDate: ""
      }
    };

    try {
      const res = await fetch("/api/scot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        mutateFollowUps();
        setIsFollowUpModalOpen(false);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to save follow up");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving follow up");
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Parse Duration to Seconds
  const parseDurationToSeconds = (dur: string) => {
    if (!dur) return 0;
    let seconds = 0;
    const hMatch = dur.match(/(\d+)h/);
    const mMatch = dur.match(/(\d+)m/);
    const sMatch = dur.match(/(\d+)s/);
    if (hMatch) seconds += parseInt(hMatch[1]) * 3600;
    if (mMatch) seconds += parseInt(mMatch[1]) * 60;
    if (sMatch) seconds += parseInt(sMatch[1]);
    return seconds;
  };

  const formatSecondsToDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Converts an Excel/Google Sheets serial date (e.g. 46127.00012) to a Date object.
  const excelSerialToDate = (serial: string | number): Date | null => {
    if (!serial) return null;
    const num = typeof serial === 'string' ? parseFloat(serial) : serial;
    if (isNaN(num)) return null;
    if (num > 40000 && num < 60000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    const d = new Date(serial as string);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatCallDate = (callDate: string | number | undefined): string => {
    if (!callDate) return "No Date";
    const d = excelSerialToDate(callDate);
    if (!d) return String(callDate);
    const day = d.getDate().toString().padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`; // e.g. 19 Jun 26
  };

  const formatCallTime = (callTime: string | number | undefined): string => {
    if (!callTime) return "No Time";
    const num = typeof callTime === 'string' ? parseFloat(callTime) : callTime;
    if (isNaN(num) || num >= 1 || num < 0) return String(callTime); // Not a standard excel time fraction
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Parse Excel/CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage("Reading file...");

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const json = utils.sheet_to_json<any>(worksheet, { raw: false });

      // Map rows to DataFeeder objects
      const itemsToInsert = json.map((row: any) => ({
        employeeName: row["Employee Name"] || "",
        employeeNumber: row["Employee Number"] || String(row["Employee Number"] || ""),
        toName: row["To Name"] || "",
        countryCode: String(row["Country Code"] || ""),
        toNumber: String(row["To Number"] || ""),
        callType: row["Call Type"] || "",
        duration: String(row["Duration"] || ""),
        callDate: row["Call Date"] || "",
        callTime: row["Call Time"] || "",
      }));

      setUploadMessage("Uploading data...");
      
      const res = await fetch("/api/data-feeder/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToInsert })
      });

      if (!res.ok) throw new Error("Upload failed");

      setUploadMessage(`Success: ${itemsToInsert.length} records!`);
      mutateFeeder();
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      setTimeout(() => setUploadMessage(""), 4000);
    } catch (error: any) {
      console.error(error);
      setUploadMessage("Error: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    feeders.forEach(f => {
      const d = excelSerialToDate(f.callDate);
      if (d) set.add(`${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().substring(2)}`);
    });
    o2ds.forEach(o => {
      const d = new Date(o.created_at);
      if (!isNaN(d.getTime())) set.add(`${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().substring(2)}`);
    });
    
    // Ensure current month is always available
    const now = new Date();
    set.add(`${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear().toString().substring(2)}`);
    
    return Array.from(set).sort((a, b) => {
      const [m1, y1] = a.split(" ");
      const [m2, y2] = b.split(" ");
      const d1 = new Date(`${m1} 1, 20${y1}`);
      const d2 = new Date(`${m2} 1, 20${y2}`);
      return d2.getTime() - d1.getTime(); // Descending
    });
  }, [feeders, o2ds]);

  const activeScotMonth = selectedScotMonth || (uniqueMonths.length > 0 ? uniqueMonths[0] : "");

  const scotMonthDates = useMemo(() => {
    if (showTodayOnly) {
      const now = new Date();
      return [`${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`];
    }

    if (!activeScotMonth) return [];
    
    const [mStr, yStr] = activeScotMonth.split(" ");
    const monthIndex = new Date(`${mStr} 1, 20${yStr}`).getMonth();
    const year = parseInt(`20${yStr}`);
    
    const now = new Date();
    const isCurrentMonth = now.getMonth() === monthIndex && now.getFullYear() === year;
    
    const lastDay = isCurrentMonth ? now.getDate() : new Date(year, monthIndex + 1, 0).getDate();
    
    const dates = [];
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, monthIndex, i);
      const dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      dates.push(dateStr);
    }
    
    return dates;
  }, [activeScotMonth, showTodayOnly]);

  // Cross-reference logic for Scot Tab
  const scotRows = useMemo(() => {
    // 1. Group feeders by To Name and extract call types by date
    const feederGroup = new Map<string, { originalName: string, employeeName: string, callsByDate: Record<string, string> }>();
    feeders.forEach(f => {
      const key = f.toName?.toLowerCase().trim();
      if (!key) return;
      const d = excelSerialToDate(f.callDate);
      if (!d) return;
      
      const dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      
      const group = feederGroup.get(key) || { originalName: f.toName, employeeName: f.employeeName, callsByDate: {} };
      if (f.employeeName) group.employeeName = f.employeeName;
      group.callsByDate[dateStr] = f.callType;
      feederGroup.set(key, group);
    });
    
    // 1.5 Map manual frequencies
    const manualFreqMap = new Map<string, number>();
    frequencyRecords.forEach(r => {
      const name = (r.partyName || "").toLowerCase().trim();
      const freq = parseInt(r.frequency || "0", 10);
      if (name && !isNaN(freq) && freq > 0) {
        manualFreqMap.set(name, freq);
      }
    });

    // 2. Group O2Ds by normalized party_name
    const o2dGroup = new Map<string, O2DKB[]>();
    o2ds.forEach(o => {
      const name = (o.party_name || '').toLowerCase().trim();
      if (!name) return;
      const group = o2dGroup.get(name) || [];
      group.push(o);
      o2dGroup.set(name, group);
    });

    const allNormalizedNames = new Set<string>([
      ...Array.from(o2dGroup.keys())
    ]);

    const rows = Array.from(allNormalizedNames).map(normalizedToName => {
      const data = feederGroup.get(normalizedToName) || { originalName: '', employeeName: '', callsByDate: {} };
      const orders = o2dGroup.get(normalizedToName) || [];
      
      const toName = data.originalName || (orders.length > 0 ? orders[0].party_name : normalizedToName);
      
      
      const ordersByDate: Record<string, boolean> = {};
      
      // Sort orders by created_at desc (newest first)
      orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      orders.forEach(o => {
         const d = new Date(o.created_at);
         if (!isNaN(d.getTime())) {
           const dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
           ordersByDate[dateStr] = true;
         }
      });
      
      const totalOrders = orders.length;
      let lastOrderDate: Date | null = null;
      let frequencyDays: number | null = null;
      let isManualFrequency = false;
      let nextPlannedDate: Date | null = null;

      if (manualFreqMap.has(normalizedToName)) {
        frequencyDays = manualFreqMap.get(normalizedToName)!;
        isManualFrequency = true;
      } else if (totalOrders > 0) {
        lastOrderDate = new Date(orders[0].created_at);
        if (totalOrders > 1) {
          const firstOrderDate = new Date(orders[totalOrders - 1].created_at);
          const now = new Date();
          
          // Calculate elapsed days from first order to now
          const elapsedDays = (now.getTime() - firstOrderDate.getTime()) / 86400000;
          
          // Enforce a minimum 30-day baseline to prevent absurdly high targets for clustered orders
          const effectiveDays = Math.max(30, elapsedDays);
          
          // Frequency is the effective days divided by total orders
          frequencyDays = Math.max(1, Math.round(effectiveDays / totalOrders));
        }
      }

      const callDates = Object.keys(data.callsByDate).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
      const lastCallDate = callDates.length > 0 ? new Date(callDates[0]) : null;

      // Check if there's a manual follow-up date for this party in the Follow Up sheet
      let manualFollowUpDate: Date | null = null;
      const partyFollowUps = followUps.filter((f: any) => f.partyName?.toLowerCase().trim() === toName.toLowerCase());
      if (partyFollowUps.length > 0) {
        partyFollowUps.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        const latestManualFollowUp = partyFollowUps[0];
        if (latestManualFollowUp.nextFollowUpDate) {
           const parsedDate = new Date(latestManualFollowUp.nextFollowUpDate);
           if (!isNaN(parsedDate.getTime())) {
             manualFollowUpDate = parsedDate;
           }
        }
      }

      let freqNextPlannedDate: Date | null = null;
      if (frequencyDays) {
        let baseDate: Date | null = null;
        if (lastCallDate && lastOrderDate) {
          baseDate = lastCallDate.getTime() > lastOrderDate.getTime() ? lastCallDate : lastOrderDate;
        } else {
          baseDate = lastCallDate || lastOrderDate;
        }
        
        if (baseDate) {
          freqNextPlannedDate = new Date(baseDate.getTime() + (frequencyDays * 86400000));
        }
      }

      if (manualFollowUpDate && freqNextPlannedDate) {
        nextPlannedDate = manualFollowUpDate.getTime() > freqNextPlannedDate.getTime() ? manualFollowUpDate : freqNextPlannedDate;
      } else {
        nextPlannedDate = manualFollowUpDate || freqNextPlannedDate;
      }

      return {
        toName,
        employeeName: data.employeeName,
        callsByDate: data.callsByDate,
        ordersByDate,
        totalOrders,
        lastOrderDate,
        lastCallDate,
        frequencyDays,
        isManualFrequency,
        manualFollowUpDate,
        nextPlannedDate,
        rawOrders: orders
      };
    });

    // Search filter
    const searchTerm = searchScot.toLowerCase().trim();
    let filteredRows = rows;
    
    if (searchTerm) {
      filteredRows = filteredRows.filter(r => r.toName.toLowerCase().includes(searchTerm));
    }
    
    if (showTodayOnly) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      filteredRows = filteredRows.filter(r => {
        if (!r.nextPlannedDate) return false;
        const d = r.nextPlannedDate;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return dateStr === todayStr;
      });
    }

    filteredRows.sort((a, b) => {
      // O2D parties first
      if (a.totalOrders > 0 && b.totalOrders === 0) return -1;
      if (a.totalOrders === 0 && b.totalOrders > 0) return 1;
      return 0;
    });

    return filteredRows;
  }, [feeders, o2ds, searchScot, showTodayOnly, followUps]);

  const paginatedScotRows = scotRows.slice((scotPage - 1) * itemsPerPage, scotPage * itemsPerPage);

  const filteredFeeders = feeders.filter(f => {
    if (!searchFeeder) return true;
    const term = searchFeeder.toLowerCase();
    return f.toName?.toLowerCase().includes(term) || f.employeeName?.toLowerCase().includes(term) || f.toNumber?.includes(term);
  });
  const paginatedFeeders = filteredFeeders.slice((feederPage - 1) * itemsPerPage, feederPage * itemsPerPage);

  const exportScotCSV = () => {
    const headerRow = [
      "Target Name",
      "Total Orders",
      "Last Order Date",
      "Recent Follow Up",
      "Order Frequency",
      "Manual Follow Up",
      "Next Planned Date",
      ...scotMonthDates.map(dateStr => {
        const d = new Date(dateStr);
        const day = d.getDate();
        const month = d.toLocaleString('default', { month: 'short' });
        return `${day}${day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'} ${month}`;
      })
    ];

    const dataRows = scotRows.map(row => {
      const lastOrderStr = row.lastOrderDate ? row.lastOrderDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : "No Orders";
      const lastCallStr = row.lastCallDate ? row.lastCallDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : "No Calls";
      const freqStr = row.frequencyDays ? `${row.frequencyDays} Days` : "N/A";
      const manualDateStr = row.manualFollowUpDate ? row.manualFollowUpDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : "N/A";
      const nextDateStr = row.nextPlannedDate ? row.nextPlannedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : "N/A";

      const dailyData = scotMonthDates.map(dateStr => {
        const isScheduledDate = row.nextPlannedDate && 
          `${row.nextPlannedDate.getFullYear()}-${String(row.nextPlannedDate.getMonth() + 1).padStart(2, '0')}-${String(row.nextPlannedDate.getDate()).padStart(2, '0')}` === dateStr;
        const cType = row.callsByDate[dateStr];
        const hasOrder = row.ordersByDate[dateStr];

        if (isScheduledDate) return "S";
        if (cType) return cType;
        if (hasOrder) return "Order";
        return "-";
      });

      return [
        row.toName,
        row.totalOrders,
        lastOrderStr,
        lastCallStr,
        freqStr,
        manualDateStr,
        nextDateStr,
        ...dailyData
      ];
    });

    const csvContent = [
      headerRow.join(","),
      ...dataRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Scot_Analytics_${activeScotMonth.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] gap-6 max-w-[1600px] mx-auto animate-in fade-in zoom-in-95 duration-500">
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #94a3b8;
          border-radius: 8px;
          border: 3px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #64748b;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border: 3px solid #0f172a;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #475569;
        }
      `}} />
      {/* Header - Apple/Scheduler Theme */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-2xl">
            <InformationCircleIcon className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">Scot KB</h1>
            <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Call Data Integration & Analytics</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab("dashboard")} 
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <ChartBarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab("data-feeder")} 
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'data-feeder' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Data Feeder</span>
            </button>
            <button 
              onClick={() => setActiveTab("scot")} 
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'scot' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <TableCellsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Scot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <AnalyticsDashboard feeders={feeders} scotRows={scotRows} defaultEmployeeName="charanpreet kaur (SC)" />
      )}

      {/* Data Feeder Tab */}
      {activeTab === "data-feeder" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-6">
          <div className="flex-1 min-h-0 flex flex-col rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-500">
            {/* Header / Actions Row */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <TableCellsIcon className="w-5 h-5 text-blue-500" />
                  Recent Feeds
                </h3>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  {/* File Upload Button */}
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading}
                  />
                  <div className="flex items-center gap-2">
                    {uploadMessage && (
                      <span className="text-[13px] font-bold text-blue-500 animate-pulse whitespace-nowrap">
                        {uploadMessage}
                      </span>
                    )}
                    <label 
                      htmlFor="file-upload" 
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-semibold   text-[13px] transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap ${
                        uploading 
                          ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 pointer-events-none' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                      }`}
                    >
                      {uploading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <DocumentArrowUpIcon className="w-3.5 h-3.5" />}
                      {uploading ? "Importing..." : "Select File"}
                    </label>
                  </div>

                  {/* Pagination Actions */}
                  <div className="flex gap-1.5">
                    <button onClick={() => setFeederPage(p => Math.max(1, p - 1))} disabled={feederPage === 1} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">Prev</button>
                    <span className="flex items-center px-2 text-[13px] font-semibold text-slate-400 whitespace-nowrap">{feederPage} / {Math.ceil(filteredFeeders.length / itemsPerPage) || 1}</span>
                    <button onClick={() => setFeederPage(p => Math.min(Math.ceil(filteredFeeders.length / itemsPerPage), p + 1))} disabled={feederPage >= Math.ceil(filteredFeeders.length / itemsPerPage)} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">Next</button>
                  </div>

                  {/* Search Input */}
                  <input 
                    type="text" 
                    placeholder="Search Names or Numbers..." 
                    value={searchFeeder} 
                    onChange={(e) => {setSearchFeeder(e.target.value); setFeederPage(1);}} 
                    className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-[14px] font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white w-full sm:w-64 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative custom-scrollbar">
              <table className="w-full text-left border-collapse table-auto relative">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="px-6 py-4 text-[13px] font-semibold whitespace-nowrap border-r-2 border-blue-500/50">Employee Details</th>
                    <th className="px-6 py-4 text-[13px] font-semibold whitespace-nowrap border-r-2 border-blue-500/50">Target Info</th>
                    <th className="px-6 py-4 text-[13px] font-semibold whitespace-nowrap border-r-2 border-blue-500/50">Call Metrics</th>
                    <th className="px-6 py-4 text-[13px] font-semibold whitespace-nowrap">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 dark:divide-slate-800">
                  {paginatedFeeders.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-sm font-bold text-slate-400">No data available</td></tr>
                  ) : paginatedFeeders.map((f, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-500">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{f.employeeName || "Unknown"}</p>
                            <p className="text-[13px] font-bold text-slate-500 mt-0.5">#{f.employeeNumber || "N/A"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-[14px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <UserGroupIcon className="w-3.5 h-3.5 text-slate-400" />
                            {f.toName || "Unknown"}
                          </p>
                          <p className="text-[14px] font-bold text-slate-500 flex items-center gap-1.5">
                            <PhoneIcon className="w-3 h-3 text-slate-400" />
                            {f.countryCode ? `+${f.countryCode} ` : ""}{f.toNumber || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span className="inline-flex w-fit items-center px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[13px] font-semibold rounded">
                            {f.callType || 'N/A'}
                          </span>
                          <span className="text-[14px] font-bold text-slate-500 flex items-center gap-1.5">
                            <ClockIcon className="w-3 h-3 text-slate-400" />
                            {f.duration || '0s'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                            {formatCallDate(f.callDate)}
                          </span>
                          <span className="text-[14px] font-bold text-slate-500 flex items-center gap-1.5 ml-5">
                            {formatCallTime(f.callTime)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Scot Tab */}
      {activeTab === "scot" && (
        <div className="flex-1 min-h-0 flex flex-col rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-500">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TableCellsIcon className="w-5 h-5 text-emerald-500" />
              Party Call Cross-Reference
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleGenerateWeeklyReports}
                disabled={isReportLoading}
                className="px-4 py-1.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl text-[14px] font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download Sales Coordinator Reports"
              >
                {isReportLoading ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <DocumentTextIcon className="w-4 h-4" />
                )}
                {isReportLoading ? "Generating..." : "Weekly Report"}
              </button>

              {/* Pagination Actions */}
              <div className="flex gap-1.5">
                <button onClick={() => setScotPage(p => Math.max(1, p - 1))} disabled={scotPage === 1} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">Prev</button>
                <span className="flex items-center px-2 text-[13px] font-semibold text-slate-400 whitespace-nowrap">{scotPage} / {Math.ceil(scotRows.length / itemsPerPage) || 1}</span>
                <button onClick={() => setScotPage(p => Math.min(Math.ceil(scotRows.length / itemsPerPage), p + 1))} disabled={scotPage >= Math.ceil(scotRows.length / itemsPerPage)} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">Next</button>
              </div>

              {/* CSV Export Button */}
              <button 
                onClick={exportScotCSV}
                className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-xl text-[14px] font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <DocumentArrowUpIcon className="w-4 h-4" />
                CSV
              </button>

              {/* Today Button */}
              <button 
                onClick={() => {setShowTodayOnly(!showTodayOnly); setScotPage(1);}}
                className={`px-4 py-1.5 border rounded-xl text-[14px] font-semibold   transition-colors shadow-sm flex items-center gap-1.5 ${showTodayOnly ? 'bg-teal-500 text-white border-teal-600' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                <CalendarIcon className="w-4 h-4" />
                Today
              </button>

              {/* Search Input */}
              <input 
                type="text" 
                placeholder="Search Party Name..." 
                value={searchScot} 
                onChange={(e) => {setSearchScot(e.target.value); setScotPage(1);}} 
                className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-[14px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-white w-full sm:w-64 transition-all"
              />

              {/* Month Selector */}
              {uniqueMonths.length > 0 && (
                <select 
                  value={activeScotMonth}
                  onChange={(e) => setSelectedScotMonth(e.target.value)}
                  className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-[14px] font-bold outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white w-full sm:w-auto transition-all"
                >
                  {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative custom-scrollbar">
            <table className="w-full text-left border-collapse table-auto relative">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                  <th className="px-2 py-4 text-[13px] font-semibold whitespace-nowrap sticky top-0 left-0 z-30 bg-emerald-600 border-r-2 border-emerald-700/80 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]">Target Name</th>
                  <th className="px-2 py-4 text-[13px] font-semibold text-center whitespace-normal leading-tight sticky top-0 z-20 bg-emerald-600 border-r-2 border-emerald-500/80 min-w-[60px]">Total Orders</th>
                  <th className="px-2 py-4 text-[13px] font-semibold text-center whitespace-normal leading-tight sticky top-0 z-20 bg-emerald-600 border-r-2 border-emerald-500/80 min-w-[70px]">Last Order Date</th>
                  <th className="px-2 py-4 text-[13px] font-semibold text-center whitespace-normal leading-tight sticky top-0 z-20 bg-emerald-600 border-r-2 border-emerald-500/80 min-w-[70px]">Recent Follow Up</th>
                  <th className="px-2 py-4 text-[13px] font-semibold text-center whitespace-normal leading-tight sticky top-0 z-20 bg-emerald-600 border-r-2 border-emerald-500/80 min-w-[75px]">Order Frequency</th>
                  <th className="px-2 py-4 text-[13px] font-semibold text-center whitespace-normal leading-tight sticky top-0 z-20 bg-emerald-600 border-r-2 border-emerald-500/80 min-w-[70px]">Manual Follow Up</th>
                  <th className="px-2 py-4 text-[13px] font-semibold text-center whitespace-normal leading-tight sticky top-0 z-20 bg-emerald-600 border-r-2 border-emerald-500/80 min-w-[80px]">Next Planned Date</th>
                  {scotMonthDates.map(dateStr => {
                    const d = new Date(dateStr);
                    const day = d.getDate();
                    const month = d.toLocaleString('default', { month: 'short' });
                    return (
                      <th key={dateStr} className="px-4 py-4 text-[13px] font-semibold text-center whitespace-nowrap sticky top-0 z-20 bg-emerald-600/90 backdrop-blur-sm border-r-2 border-emerald-500/30">
                        {day}{day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'} {month}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-200 dark:divide-slate-700">
                {paginatedScotRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm font-bold text-slate-400">No target records found</td></tr>
                ) : paginatedScotRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group/row">
                    <td className="px-2 py-4 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)] truncate group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors max-w-[250px]">
                      <div className="flex flex-col gap-1">
                        <p className="text-[14px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <UserIcon className="w-4 h-4 text-emerald-500" />
                          {row.toName}
                        </p>
                        <p className="text-[13px] font-bold text-slate-500 flex items-center gap-1">
                          <UserGroupIcon className="w-3 h-3 text-slate-400" />
                          {row.employeeName || "Unknown"}
                        </p>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center whitespace-nowrap bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[14px] font-semibold rounded-xl">
                        {row.totalOrders}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-center whitespace-nowrap bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors">
                      <div className="flex items-center justify-center gap-1.5 text-[14px] font-bold text-slate-600 dark:text-slate-300">
                        {row.lastOrderDate ? (
                          <>
                            <CalendarIcon className="w-4 h-4 text-blue-500" />
                            {row.lastOrderDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </>
                        ) : (
                          <span className="opacity-50 text-slate-400 italic">No Orders</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center whitespace-nowrap bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors">
                      <div className="flex items-center justify-center gap-1.5 text-[14px] font-bold text-slate-600 dark:text-slate-300">
                        {row.lastCallDate ? (
                          <>
                            <PhoneIcon className="w-4 h-4 text-emerald-500" />
                            {row.lastCallDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </>
                        ) : (
                          <span className="opacity-50 text-slate-400 italic">No Calls</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center whitespace-nowrap group bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        {row.frequencyDays ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[13px] font-semibold   rounded-full border shadow-sm ${row.isManualFrequency ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'}`} title={row.isManualFrequency ? 'Manual Frequency' : 'Calculated Frequency'}>
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            {row.frequencyDays} Days
                          </span>
                        ) : (
                          <span className="text-[13px] font-bold text-slate-400">N/A</span>
                        )}
                        <button 
                          onClick={() => { setFreqParty(row.toName); setFreqValue(row.isManualFrequency ? String(row.frequencyDays) : ""); setIsFreqModalOpen(true); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
                        >
                          <PencilIcon className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center whitespace-nowrap group bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        {row.manualFollowUpDate ? (
                          <span className="text-[14px] font-bold text-slate-700 dark:text-slate-300">
                            {row.manualFollowUpDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-[13px] font-bold text-slate-400">N/A</span>
                        )}
                        <button 
                          onClick={() => { 
                            setFollowUpParty(row.toName); 
                            const isoDate = row.manualFollowUpDate ? new Date(row.manualFollowUpDate.getTime() - (row.manualFollowUpDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : "";
                            setFollowUpDateValue(isoDate); 
                            setIsFollowUpModalOpen(true); 
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
                        >
                          <PencilIcon className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center whitespace-nowrap bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/80 transition-colors">
                      {row.nextPlannedDate ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[13px] font-semibold rounded-full border border-emerald-500/20 shadow-sm">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {row.nextPlannedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-[13px] font-bold text-slate-400">N/A</span>
                      )}
                    </td>
                    {scotMonthDates.map(dateStr => {
                      const cType = row.callsByDate[dateStr];
                      const hasOrder = row.ordersByDate[dateStr];
                      const isScheduledDate = (row.nextPlannedDate && 
                        `${row.nextPlannedDate.getFullYear()}-${String(row.nextPlannedDate.getMonth() + 1).padStart(2, '0')}-${String(row.nextPlannedDate.getDate()).padStart(2, '0')}` === dateStr) ||
                        (row.manualFollowUpDate && 
                        `${row.manualFollowUpDate.getFullYear()}-${String(row.manualFollowUpDate.getMonth() + 1).padStart(2, '0')}-${String(row.manualFollowUpDate.getDate()).padStart(2, '0')}` === dateStr);

                      return (
                        <td key={dateStr} className="px-4 py-4 text-center border-l-2 border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-center gap-1">
                            {isScheduledDate && (
                              <span title="Scheduled Order Date" className="w-6 h-6 flex items-center justify-center rounded-full bg-teal-500 text-white shadow-md font-semibold text-[14px]">
                                S
                              </span>
                            )}
                            {cType && (
                              <span title={`Call Type: ${cType}`} className={`w-6 h-6 flex items-center justify-center rounded-full text-[14px] font-semibold text-white shadow-md ${
                                cType.toUpperCase().includes('MISS') ? 'bg-rose-500' :
                                cType.toUpperCase().includes('OUT') ? 'bg-emerald-500' :
                                cType.toUpperCase().includes('REJ') ? 'bg-amber-500' :
                                cType.toUpperCase().includes('IN') ? 'bg-blue-500' :
                                'bg-slate-500'
                              }`}>
                                {cType.charAt(0).toUpperCase()}
                              </span>
                            )}
                            {hasOrder && (
                              <span title="Order Placed" className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-500 text-white shadow-md">
                                <ShoppingCartIcon className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {!cType && !hasOrder && !isScheduledDate && (
                              <span className="text-slate-200 dark:text-slate-800">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Frequency Modal */}
      {isFreqModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Set Manual Frequency</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-6">Party: <span className="text-blue-500">{freqParty}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-500 mb-2">Frequency (in Days)</label>
                <input 
                  type="number" 
                  value={freqValue}
                  onChange={(e) => setFreqValue(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => setIsFreqModalOpen(false)}
                  disabled={isSavingFreq}
                  className="px-4 py-2 rounded-xl text-[14px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveFrequency}
                  disabled={isSavingFreq}
                  className="px-6 py-2 rounded-xl text-[14px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSavingFreq ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                  {isSavingFreq ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Follow Up Modal */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Set Manual Follow Up</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-6">Party: <span className="text-blue-500">{followUpParty}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-500 mb-2">Next Follow Up Date</label>
                <input 
                  type="date" 
                  value={followUpDateValue}
                  onChange={(e) => setFollowUpDateValue(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => setIsFollowUpModalOpen(false)}
                  disabled={isSavingFollowUp}
                  className="px-4 py-2 rounded-xl text-[14px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveFollowUp}
                  disabled={isSavingFollowUp}
                  className="px-6 py-2 rounded-xl text-[14px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSavingFollowUp ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                  {isSavingFollowUp ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
