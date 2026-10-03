"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import * as XLSX from "xlsx";
import { useSession } from "next-auth/react";
import {
  FlagIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ListBulletIcon,
  TableCellsIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  CurrencyRupeeIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import {
  MONTH_NAMES,
  MonthName,
  MessageType,
  CustomerTargetRow,
  MonthlyValues,
  SendScope,
  SendLogEntry,
} from "@/types/customer-target";
import { isValidMobile, importRowMatchesParty } from "@/lib/customer-target-messages";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DataTab = "party" | "target" | "achievement" | "log";

const emptyMonths = (): MonthlyValues =>
  MONTH_NAMES.reduce((acc, m) => {
    acc[m] = "";
    return acc;
  }, {} as MonthlyValues);

function getVisiblePages(current: number, total: number, max = 7): number[] {
  if (total <= 1) return [1];
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(max / 2);
  let start = Math.max(1, current - half);
  let end = start + max - 1;
  if (end > total) {
    end = total;
    start = Math.max(1, end - max + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function formatAmount(n: number) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function sendBlockedReason(row: CustomerTargetRow, msgType: MessageType): string | null {
  if (!isValidMobile(row.mobile)) {
    return row.mobile
      ? "Fix the mobile number first. This number is invalid so you cannot send the message."
      : "Add a valid 10-digit mobile first. Missing number so you cannot send the message.";
  }
  if (!(Number(row.target) > 0)) {
    return "Fill the Target first. Target is 0 so you cannot send the message.";
  }
  if (msgType === "ACHIEVEMENT" && !(Number(row.achieved) > 0)) {
    return "Fill the Achievement first. Achievement is 0 so you cannot send the message.";
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SENDING" || status === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-sky-500/40">
        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        Sending
      </span>
    );
  }
  const map: Record<string, string> = {
    SENT: "text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/40",
    FAILED: "text-white bg-gradient-to-r from-rose-500 to-orange-500 shadow-md shadow-rose-500/40",
    SKIPPED: "text-white bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow-md shadow-pink-500/40",
    NOT_SENT: "text-white bg-gradient-to-r from-slate-500 to-slate-700 shadow-md shadow-slate-500/30",
    QUEUED: "text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/40",
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${map[status] || map.NOT_SENT}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function PctBadge({ pct }: { pct: number }) {
  const color =
    pct >= 100
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : pct >= 50
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${color}`}>
      {pct}%
    </span>
  );
}

export default function CustomerTargetPage() {
  const { data: session } = useSession();
  const role = String((session?.user as any)?.role || "").toUpperCase();
  const canWrite = role === "ADMIN" || role === "EA";

  const now = new Date();
  const [month, setMonth] = useState<MonthName>(MONTH_NAMES[now.getMonth()]);
  const [msgType, setMsgType] = useState<MessageType>("TARGET");
  const [year] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<DataTab>("party");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewParty, setPreviewParty] = useState<CustomerTargetRow | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rowTip, setRowTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const showRowTip = (e: React.MouseEvent, reason: string | null) => {
    if (!reason) {
      setRowTip(null);
      return;
    }
    const width = 280;
    const x = Math.min(Math.max(12, e.clientX + 18), window.innerWidth - width - 12);
    const y = Math.max(12, e.clientY - 12);
    setRowTip({ text: reason, x, y });
  };

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusOpen, setStatusOpen] = useState(false);

  const showStatus = (msg: string, type: "loading" | "success" | "error" = "loading") => {
    setStatusMessage(msg);
    setStatusType(type);
    setStatusOpen(true);
  };

  const { data, mutate, isLoading } = useSWR(
    `/api/customer-target?month=${month}&type=${msgType}&year=${year}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const rows: CustomerTargetRow[] = data?.rows || [];
  const logs: SendLogEntry[] = data?.logs || [];
  const summary = data?.summary || {
    totalParties: 0,
    withTarget: 0,
    withAchievement: 0,
    pendingTarget: 0,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.partyName.toLowerCase().includes(q) ||
        (r.customerName || "").toLowerCase().includes(q) ||
        String(r.mobile).includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePages = useMemo(() => getVisiblePages(page, totalPages), [page, totalPages]);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [month, msgType]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, activeTab]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectEligible = (mode: "all" | "failed" | "not_sent" | "none") => {
    if (mode === "none") {
      setSelected(new Set());
      return;
    }
    const next = new Set<string>();
    rows.forEach((r) => {
      if (sendBlockedReason(r, msgType)) return;
      if (mode === "all") next.add(r.partyName);
      if (mode === "failed" && r.sendStatus === "FAILED") next.add(r.partyName);
      if (mode === "not_sent" && (r.sendStatus === "NOT_SENT" || r.sendStatus === "SKIPPED")) next.add(r.partyName);
    });
    setSelected(next);
  };

  const [crudOpen, setCrudOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerTargetRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formMonths, setFormMonths] = useState<MonthlyValues>(emptyMonths());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormCustomerName("");
    setFormMobile("");
    setFormMonths(emptyMonths());
    setCrudOpen(true);
  };

  const openEdit = async (row: CustomerTargetRow) => {
    setEditing(row);
    setFormName(row.partyName);
    setFormCustomerName(row.customerName || "");
    setFormMobile(row.mobile);
    const months = emptyMonths();
    months[month] = row.target || "";
    setFormMonths(months);
    setCrudOpen(true);
    try {
      const res = await fetch(`/api/customer-target?month=${month}&type=${msgType}&year=${year}&full=1`);
      const json = await res.json();
      const full = (json.rows || []).find((r: any) => r.partyName === row.partyName);
      if (full?.customerName) setFormCustomerName(full.customerName);
      if (full?.allMonths) setFormMonths({ ...emptyMonths(), ...full.allMonths });
    } catch {
      /* keep partial */
    }
  };

  const openEditSelected = () => {
    const name = Array.from(selected)[0];
    const row = rows.find((r) => r.partyName === name);
    if (!row) {
      showStatus("Select one party to edit", "error");
      return;
    }
    openEdit(row);
  };

  const openDeleteSelected = () => {
    const name = Array.from(selected)[0];
    if (!name) {
      showStatus("Select one party to delete", "error");
      return;
    }
    setDeleteTarget(name);
  };

  const savePlanned = async () => {
    if (!canWrite) return;
    if (!formName.trim()) {
      showStatus("Party name is required", "error");
      return;
    }
    showStatus(editing ? "Updating party..." : "Adding party...", "loading");
    try {
      const res = await fetch("/api/customer-target", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName: formName.trim(),
          customerName: formCustomerName.trim(),
          mobile: formMobile.trim(),
          months: formMonths,
          originalPartyName: editing?.partyName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setCrudOpen(false);
      await mutate();
      showStatus("Saved successfully", "success");
      setTimeout(() => setStatusOpen(false), 1500);
    } catch (e: any) {
      showStatus(e.message || "Save failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !canWrite) return;
    showStatus("Deleting...", "loading");
    try {
      const res = await fetch("/api/customer-target", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyName: deleteTarget }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setDeleteTarget(null);
      await mutate();
      showStatus("Deleted", "success");
      setTimeout(() => setStatusOpen(false), 1500);
    } catch (e: any) {
      showStatus(e.message || "Delete failed", "error");
    }
  };

  const importRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: { no: string; mobile: string; customerName: string; amount: number }[];
    fileName: string;
  } | null>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const parsed = json
        .map((row) => {
          const keys = Object.keys(row);
          const norm = (k: string) => k.toLowerCase().replace(/\./g, "").trim();
          const customerKey = keys.find((k) => {
            const h = norm(k);
            return h === "customer name" || h === "customer";
          });
          const mobileKey = keys.find((k) => {
            const h = norm(k);
            return h === "mobile no" || h === "mobile num" || h === "mobile number" || h === "mobile";
          });
          const noKey =
            keys.find((k) => norm(k) === "no") ||
            (!mobileKey && !customerKey
              ? keys.find((k) => norm(k) === "party name") ||
                keys.find((k) => norm(k).includes("account") && norm(k).includes("name"))
              : undefined);
          const amtKey =
            keys.find((k) => {
              const h = norm(k);
              return h === "achievement amount" || h === "achievement" || h.includes("achievement");
            }) ||
            keys.find((k) => norm(k).includes("nett") && norm(k).includes("sale")) ||
            keys.find((k) => {
              const h = norm(k);
              return h === "amount" || h === "amt" || h.includes("amount");
            });
          const customerName = String(customerKey ? row[customerKey] : "").trim();
          const mobile = String(mobileKey ? row[mobileKey] : "").trim();
          const no = String(noKey ? row[noKey] : "").trim();
          const rawAmt = amtKey ? row[amtKey] : 0;
          const amount = round2(
            typeof rawAmt === "number"
              ? rawAmt
              : parseFloat(String(rawAmt).replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0
          );
          return { no, mobile, customerName, amount };
        })
        .filter((r) => r.no || r.mobile || r.customerName);
      if (parsed.length === 0) {
        throw new Error("No rows found. Use No + Achievement Amount, or Customer Name + Mobile No + Achievement Amount.");
      }
      setImportPreview({ rows: parsed, fileName: file.name });
    } catch (err: any) {
      showStatus(err.message || "Failed to parse file", "error");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const importMatchStats = useMemo(() => {
    if (!importPreview) return { matched: 0, unmatched: 0 };
    let matched = 0;
    let unmatched = 0;
    importPreview.rows.forEach((r) => {
      if (rows.some((row) => importRowMatchesParty(r, row))) matched += 1;
      else unmatched += 1;
    });
    return { matched, unmatched };
  }, [importPreview, rows]);

  const confirmImport = async () => {
    if (!importPreview || !canWrite) return;
    showStatus(`Importing ${month} achievement...`, "loading");
    try {
      const res = await fetch("/api/customer-target/import-achievement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          rows: importPreview.rows.map((r) => ({
            no: r.no,
            mobile: r.mobile,
            customerName: r.customerName,
            amount: round2(r.amount),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setImportPreview(null);
      await mutate();
      showStatus(`Imported ${json.updated} for ${month}. Unmatched: ${json.unmatched?.length || 0}`, "success");
      setTimeout(() => setStatusOpen(false), 2500);
    } catch (e: any) {
      showStatus(e.message || "Import failed", "error");
    }
  };

  const [testPhone, setTestPhone] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendScope, setSendScope] = useState<SendScope>("not_sent");
  const [forceConfirm, setForceConfirm] = useState("");
  const [lastFailed, setLastFailed] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0, sent: 0, failed: 0, skipped: 0 });

  const applySendScope = (scope: SendScope) => {
    setSendScope(scope);
    if (scope === "failed_only") selectEligible("failed");
    else if (scope === "not_sent") selectEligible("not_sent");
  };

  const recipientsForScope = useMemo(() => {
    let list = rows;
    if (sendScope === "failed_only") {
      list = list.filter((r) => r.sendStatus === "FAILED");
      if (selected.size > 0) list = list.filter((r) => selected.has(r.partyName));
    } else if (sendScope === "not_sent") {
      list = list.filter((r) => r.sendStatus === "NOT_SENT" || r.sendStatus === "SKIPPED");
      if (selected.size > 0) list = list.filter((r) => selected.has(r.partyName));
    } else if (sendScope === "selected") {
      list = list.filter((r) => selected.has(r.partyName) && r.sendStatus !== "SENT");
    } else if (sendScope === "selected_force") {
      list = list.filter((r) => selected.has(r.partyName));
    }
    return list.filter((r) => !sendBlockedReason(r, msgType));
  }, [rows, selected, sendScope, msgType]);

  const bulkStats = useMemo(() => {
    const selectedRows = rows.filter((r) => selected.has(r.partyName));
    return {
      selected: selected.size,
      willSend: recipientsForScope.length,
      failedLatest: selectedRows.filter((r) => r.sendStatus === "FAILED").length || rows.filter((r) => r.sendStatus === "FAILED" && Number(r.target) > 0).length,
      alreadySent: selectedRows.filter((r) => r.sendStatus === "SENT").length,
    };
  }, [rows, selected, recipientsForScope]);

  const sendTest = async () => {
    if (!canWrite) return;
    if (!isValidMobile(testPhone)) {
      showStatus("Enter a valid 10-digit mobile number", "error");
      return;
    }
    const sample =
      (selected.size > 0 ? rows.find((r) => selected.has(r.partyName)) : null) ||
      rows.find((r) => r.target > 0) ||
      rows[0];
    if (!sample) {
      showStatus("No party available for test", "error");
      return;
    }
    showStatus("Sending test message...", "loading");
    try {
      const res = await fetch("/api/customer-target/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "test",
          type: msgType,
          month,
          year,
          testPhone,
          partyNames: [sample.partyName],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Test send failed");
      showStatus(`Test sent using sample: ${json.sampleParty}`, "success");
      setTimeout(() => setStatusOpen(false), 2000);
    } catch (e: any) {
      showStatus(e.message || "Test failed", "error");
    }
  };

  const sendRowMessage = async (row: CustomerTargetRow) => {
    if (!canWrite || sending) return;
    if (!isValidMobile(row.mobile)) {
      showStatus("This party has no valid mobile number", "error");
      return;
    }
    const blocked = sendBlockedReason(row, msgType);
    if (blocked) {
      showStatus(blocked, "error");
      return;
    }
    if ((liveStatus[row.partyName] || row.sendStatus) === "SENT") {
      showStatus("Already SENT. Use Force Resend Selected if you need to send again.", "error");
      return;
    }

    setSelected(new Set([row.partyName]));
    setSending(true);
    setLiveStatus((prev) => ({ ...prev, [row.partyName]: "SENDING" }));

    try {
      const res = await fetch("/api/customer-target/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bulk",
          type: msgType,
          month,
          year,
          sendScope: "selected",
          partyNames: [row.partyName],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      const status = String((json.results || [])[0]?.status || "FAILED").toUpperCase();
      setLiveStatus((prev) => ({ ...prev, [row.partyName]: status }));
      await mutate();
      if (status !== "SENT" && status !== "SKIPPED") {
        throw new Error((json.results || [])[0]?.error || "Send failed");
      }
    } catch (e: any) {
      setLiveStatus((prev) => ({ ...prev, [row.partyName]: "FAILED" }));
      showStatus(e.message || "Send failed", "error");
    } finally {
      setSending(false);
    }
  };

  const openBulkConfirm = () => {
    if (!canWrite || sending) return;
    if (recipientsForScope.length === 0) {
      showStatus("No recipients for this send mode", "error");
      return;
    }
    setForceConfirm("");
    setSendOpen(true);
  };

  const runBulkSend = async () => {
    if (!canWrite || sending) return;
    if (sendScope === "selected_force" && forceConfirm.trim().toUpperCase() !== "FORCE") {
      showStatus("Type FORCE to confirm resend to already-sent parties", "error");
      return;
    }

    const queue = [...recipientsForScope];
    if (queue.length === 0) {
      showStatus("No recipients for this send mode", "error");
      return;
    }

    setSending(true);
    setSendOpen(false);
    setLastFailed([]);
    setSendProgress({ done: 0, total: queue.length, sent: 0, failed: 0, skipped: 0 });

    // Mark all queued rows so user sees what's pending
    setLiveStatus((prev) => {
      const next = { ...prev };
      queue.forEach((r) => {
        next[r.partyName] = "QUEUED";
      });
      return next;
    });

    const failedNames: string[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < queue.length; i++) {
      const party = queue[i];
      setLiveStatus((prev) => ({ ...prev, [party.partyName]: "SENDING" }));

      try {
        const res = await fetch("/api/customer-target/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "bulk",
            type: msgType,
            month,
            year,
            sendScope,
            partyNames: [party.partyName],
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Send failed");

        const result = (json.results || [])[0];
        const status = String(result?.status || "FAILED").toUpperCase();
        setLiveStatus((prev) => ({ ...prev, [party.partyName]: status }));

        if (status === "SENT") sent += 1;
        else if (status === "SKIPPED") skipped += 1;
        else {
          failed += 1;
          failedNames.push(party.partyName);
        }
      } catch (e: any) {
        failed += 1;
        failedNames.push(party.partyName);
        setLiveStatus((prev) => ({ ...prev, [party.partyName]: "FAILED" }));
      }

      setSendProgress({ done: i + 1, total: queue.length, sent, failed, skipped });
    }

    setLastFailed(failedNames);
    await mutate();
    setSending(false);

    if (failedNames.length > 0) {
      applySendScope("failed_only");
    }

    // Brief non-blocking completion notice (not a spinner modal)
    showStatus(`Done — Sent ${sent}, Failed ${failed}, Skipped ${skipped}`, failed > 0 ? "error" : "success");
    setTimeout(() => setStatusOpen(false), 2500);

    // Clear live overrides after refresh so sheet status is source of truth
    setTimeout(() => setLiveStatus({}), 800);
  };

  const exportReport = () => {
    const headers =
      msgType === "ACHIEVEMENT"
        ? ["Party Name", "Customer Name", "Mobile", "Target", "Achieved", "Pending", "Achievement %", "Status"]
        : ["Party Name", "Customer Name", "Mobile", "Target", "Status"];
    const lines = [
      headers.join(","),
      ...filtered.map((r) => {
        const base = [`"${r.partyName}"`, `"${r.customerName || ""}"`, `"${r.mobile}"`, r.target, ...(msgType === "ACHIEVEMENT" ? [r.achieved, r.pending, r.achievementPct] : []), `"${r.sendStatus}"`];
        return base.join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Customer_Target_${month}_${year}_${msgType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showAchievementColumns = msgType === "ACHIEVEMENT" || activeTab === "achievement";

  const tabs: { id: DataTab; label: string; icon: React.ElementType; active: string; idle: string }[] = [
    { id: "party", label: "Party List", icon: ListBulletIcon, active: "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-300/50", idle: "bg-white dark:bg-slate-950/50 text-blue-700 border border-blue-100 dark:border-blue-500/20 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30" },
    { id: "target", label: "Target (Sheet1)", icon: TableCellsIcon, active: "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-300/50", idle: "bg-white dark:bg-slate-950/50 text-indigo-700 border border-indigo-100 dark:border-indigo-500/20 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30" },
    { id: "achievement", label: "Achievement", icon: ChartBarIcon, active: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300/50", idle: "bg-white dark:bg-slate-950/50 text-emerald-700 border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30" },
    { id: "log", label: "Send Log", icon: ClipboardDocumentListIcon, active: "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 ring-2 ring-violet-300/50", idle: "bg-white dark:bg-slate-950/50 text-violet-700 border border-violet-100 dark:border-violet-500/20 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/30" },
  ];

  return (
    <div className="flex flex-col h-full gap-4 pb-2 -m-1 md:-m-2 p-1 md:p-2 min-h-full bg-white dark:bg-[#0B1120]">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Customer Target</h1>
            <button
              type="button"
              title="How to use this page"
              onClick={() => setGuideOpen(true)}
              className="p-1 rounded-full text-[#003875] dark:text-[#FFD500] hover:bg-[#003875]/10 dark:hover:bg-[#FFD500]/10"
            >
              <InformationCircleIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
            Plan targets, import achievements and send WhatsApp updates to your customers.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Select Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value as MonthName)}
              className="px-3 py-2.5 rounded-xl border-2 border-indigo-100 dark:border-indigo-500/30 bg-white dark:bg-slate-950 text-sm font-semibold focus:border-indigo-400 outline-none min-w-[150px]"
            >
              {MONTH_NAMES.map((m) => (
                <option key={m} value={m}>{m} {year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 mb-1">Message Type</label>
            <div className="flex rounded-xl overflow-hidden border-2 border-sky-100 dark:border-sky-500/30 bg-sky-50/60 dark:bg-sky-950/20 p-1 gap-1">
              {([
                { id: "TARGET" as MessageType, label: "Target", icon: FlagIcon, active: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30" },
                { id: "ACHIEVEMENT" as MessageType, label: "Achievement", icon: ListBulletIcon, active: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMsgType(t.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    msgType === t.id
                      ? t.active
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/5"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {canWrite && (
            <>
              <button
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold shadow-md shadow-orange-500/25 hover:brightness-105"
              >
                <ArrowUpTrayIcon className="w-4 h-4" /> Import Achievement
              </button>
              <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            </>
          )}
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/25 hover:brightness-105"
          >
            <ArrowDownTrayIcon className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Left: tiles + table · Right: WhatsApp desk (full height) */}
      <div className={`flex-1 min-h-0 grid gap-4 ${canWrite ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
      {/* Left column */}
      <div className="min-h-0 flex flex-col gap-4">
        {/* Month snapshot tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white p-3.5 shadow-md shadow-blue-500/25 ring-1 ring-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-100">Total Parties</p>
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <UserGroupIcon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black leading-none">{summary.totalParties}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-3.5 shadow-md shadow-indigo-500/25 ring-1 ring-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">With Target</p>
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <FlagIcon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black leading-none">{summary.withTarget}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3.5 shadow-md shadow-emerald-500/25 ring-1 ring-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100">With Achievement</p>
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <ChartBarIcon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black leading-none">{summary.withAchievement}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white p-3.5 shadow-md shadow-rose-500/25 ring-1 ring-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-rose-100">Pending Target</p>
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <CurrencyRupeeIcon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black leading-none">₹ {formatAmount(summary.pendingTarget)}</p>
          </div>
        </div>

      {/* Main card */}
      <div className="flex-1 min-h-0 rounded-2xl border border-blue-200/50 dark:border-blue-500/20 bg-white dark:bg-slate-900 shadow-lg shadow-blue-500/5 flex flex-col overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3.5 bg-gradient-to-r from-slate-50 via-blue-50/40 to-violet-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-violet-950/10 border-b border-blue-100/80 dark:border-white/10">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition-all ${
                  activeTab === tab.id ? tab.active : tab.idle
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== "log" && canWrite && (
            <div className="flex flex-wrap items-center gap-2 pb-3 lg:pb-0">
              <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[11px] font-bold shadow-md shadow-emerald-500/25 hover:brightness-105">
                <PlusIcon className="w-4 h-4" /> Add Party
              </button>
              <button onClick={openEditSelected} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[11px] font-bold shadow-md shadow-blue-500/25 hover:brightness-105">
                <PencilSquareIcon className="w-4 h-4" /> Edit
              </button>
              <button onClick={openDeleteSelected} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-[11px] font-bold shadow-md shadow-rose-500/25 hover:brightness-105">
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
              <button onClick={sendTest} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-800 text-white text-[11px] font-bold shadow-md shadow-slate-500/20 hover:brightness-105">
                <PaperAirplaneIcon className="w-4 h-4" /> Test Message
              </button>
            </div>
          )}
        </div>

        {activeTab !== "log" && (
          <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-blue-50 dark:border-white/5 bg-gradient-to-r from-white via-sky-50/30 to-white dark:from-slate-900 dark:via-sky-950/10 dark:to-slate-900">
            <div className="relative flex-1 min-w-[180px]">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sky-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search party / customer / mobile"
                className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-sky-100 dark:border-sky-500/20 bg-white dark:bg-slate-950 text-xs font-semibold focus:border-sky-400 outline-none"
              />
            </div>
            <button
              onClick={() => selectEligible("all")}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/20 hover:brightness-105"
            >
              Select Eligible
            </button>
            <button
              onClick={() => selectEligible("failed")}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-sm shadow-rose-500/20 hover:brightness-105"
            >
              Select Failed
            </button>
            <button
              onClick={() => selectEligible("not_sent")}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/20 hover:brightness-105"
            >
              Select Not Sent
            </button>
            <button
              onClick={() => selectEligible("none")}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gradient-to-r from-slate-500 to-slate-700 text-white shadow-sm hover:brightness-105"
            >
              Clear
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest ml-auto px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/20">
              Selected {selected.size} · Rows {filtered.length}
            </span>
          </div>
        )}

        <div className="flex-1 min-h-[280px] overflow-auto">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-xs font-black uppercase tracking-widest text-gray-400">Loading...</div>
          ) : activeTab === "log" ? (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  <th className="p-3">Time</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Target</th>
                  <th className="p-3 text-right">Achieved</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Sent By</th>
                  <th className="p-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {logs.length === 0 && (
                  <tr><td colSpan={9} className="p-10 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No send log for {month} {year}</td></tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                    <td className="p-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap">{l.timestamp ? new Date(l.timestamp).toLocaleString("en-IN") : "—"}</td>
                    <td className="p-3 text-xs font-bold uppercase">{l.partyName}</td>
                    <td className="p-3 text-xs font-semibold">{l.mobile}</td>
                    <td className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-500">{l.type}</td>
                    <td className="p-3 text-right text-xs font-bold">{formatAmount(l.target)}</td>
                    <td className="p-3 text-right text-xs font-bold">{formatAmount(l.achieved)}</td>
                    <td className="p-3"><StatusBadge status={l.status} /></td>
                    <td className="p-3 text-xs font-semibold text-gray-500">{l.sentBy}</td>
                    <td className="p-3 text-[10px] text-red-500 max-w-[160px] truncate" title={l.error}>{l.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Mobile</th>
                  {(activeTab === "party" || activeTab === "target" || activeTab === "achievement") && (
                    <th className="p-3 text-right">Target (₹)</th>
                  )}
                  {showAchievementColumns && (
                    <>
                      <th className="p-3 text-right">Achieved (₹)</th>
                      <th className="p-3 text-right">Pending (₹)</th>
                      <th className="p-3 text-right">Achievement %</th>
                    </>
                  )}
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {paginated.map((row) => {
                  const blockReason = sendBlockedReason(row, msgType);
                  const cannotSend = !!blockReason;
                  const targetZero = !(Number(row.target) > 0);
                  const achievedZero = !(Number(row.achieved) > 0);
                  return (
                    <tr
                      key={row.partyName}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/5"
                      onMouseEnter={(e) => showRowTip(e, blockReason)}
                      onMouseMove={(e) => showRowTip(e, blockReason)}
                      onMouseLeave={() => setRowTip(null)}
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          aria-label={selected.has(row.partyName) ? "Deselect party" : "Select party"}
                          onClick={() => toggleSelect(row.partyName)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            selected.has(row.partyName)
                              ? "border-emerald-500 bg-emerald-500 shadow-sm"
                              : "border-gray-400 bg-white dark:bg-slate-900 dark:border-gray-500 hover:border-emerald-400"
                          }`}
                        >
                          {selected.has(row.partyName) && (
                            <CheckIcon className="w-3.5 h-3.5 text-white stroke-[3]" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-xs font-bold text-gray-900 dark:text-white">{row.partyName}</td>
                      <td className="p-3 text-xs font-semibold text-gray-700 dark:text-gray-200">{row.customerName || "—"}</td>
                      <td className="p-3 text-xs font-semibold">
                        {row.mobile ? (
                          isValidMobile(row.mobile) ? (
                            <span className="text-gray-600 dark:text-gray-300">{row.mobile}</span>
                          ) : (
                            <span className="text-red-500 inline-flex items-center gap-1">
                              <ExclamationTriangleIcon className="w-3.5 h-3.5" />{row.mobile}
                            </span>
                          )
                        ) : (
                          <span className="text-red-500 inline-flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Missing
                          </span>
                        )}
                      </td>
                      <td className={`p-3 text-right text-xs font-bold ${targetZero ? "text-amber-500" : ""}`}>
                        {formatAmount(row.target)}
                      </td>
                      {showAchievementColumns && (
                        <>
                          <td className={`p-3 text-right text-xs font-bold ${msgType === "ACHIEVEMENT" && achievedZero ? "text-amber-500" : "text-emerald-600"}`}>
                            {formatAmount(row.achieved)}
                          </td>
                          <td className="p-3 text-right text-xs font-bold text-amber-600">{formatAmount(row.pending)}</td>
                          <td className="p-3 text-right"><PctBadge pct={row.achievementPct} /></td>
                        </>
                      )}
                      <td className="p-3">
                        <StatusBadge status={liveStatus[row.partyName] || row.sendStatus} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <button
                            onClick={() => setPreviewParty(row)}
                            className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md shadow-blue-500/30 hover:brightness-110"
                          >
                            Preview
                          </button>
                          {canWrite && (
                            <button
                              onClick={() => !cannotSend && sendRowMessage(row)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white ${
                                sending || cannotSend
                                  ? "bg-gradient-to-r from-slate-300 to-slate-400 shadow-none cursor-not-allowed"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30 hover:brightness-110"
                              }`}
                            >
                              Send
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={showAchievementColumns ? 10 : 7} className="p-10 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                      No parties found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {activeTab !== "log" && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold text-gray-500">
            <div className="flex items-center gap-2">
              <span>
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>Show {n}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40">Prev</button>
              {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-[11px] font-black ${page === p ? "bg-[#2563eb] text-white" : "border border-gray-200 dark:border-white/10"}`}
                  >
                    {p}
                  </button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
      </div>{/* end left column */}

      {/* WhatsApp right panel — full height beside tiles + table */}
      {canWrite && (
        <aside className="rounded-2xl border border-emerald-200/70 dark:border-emerald-500/20 bg-gradient-to-b from-emerald-50/90 via-white to-sky-50/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 shadow-lg shadow-emerald-500/10 p-0 flex flex-col h-full min-h-0 overflow-hidden xl:self-stretch">
          <div className="px-4 py-3.5 bg-gradient-to-r from-[#128C7E] via-[#25D366] to-[#34B7F1] text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <PaperAirplaneIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">WhatsApp Desk</p>
                <p className="text-sm font-black leading-tight">Send & Test</p>
              </div>
            </div>
          </div>

          <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          <div className="rounded-2xl bg-white dark:bg-slate-950/60 border border-teal-100 dark:border-teal-500/20 p-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              Test WhatsApp Message
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex rounded-xl border-2 border-teal-100 dark:border-teal-500/30 bg-teal-50/40 dark:bg-teal-950/20 overflow-hidden focus-within:border-teal-400 transition-colors">
                <span className="px-3 py-2.5 text-xs font-black text-teal-600 dark:text-teal-400 border-r border-teal-100 dark:border-teal-500/30 bg-teal-100/50 dark:bg-teal-900/30">+91</span>
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10 digit mobile"
                  className="px-3 py-2.5 text-sm font-semibold bg-transparent flex-1 outline-none min-w-0"
                />
              </div>
              <button
                onClick={sendTest}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all"
              >
                Send Test Message
              </button>
            </div>
            <p className="text-[10px] text-teal-700/60 dark:text-teal-300/50 mt-2 font-medium leading-relaxed">
              Uses first selected party (or first with target) as message sample.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Bulk Send Summary
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 text-white px-3 py-2.5 shadow-md shadow-slate-500/20">
                <p className="text-white/70 font-bold text-[9px] uppercase tracking-wider">Selected</p>
                <p className="text-xl font-black leading-tight mt-0.5">{bulkStats.selected}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-3 py-2.5 shadow-md shadow-emerald-500/25">
                <p className="text-emerald-100 font-bold text-[9px] uppercase tracking-wider">Will be Sent</p>
                <p className="text-xl font-black leading-tight mt-0.5">{bulkStats.willSend}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white px-3 py-2.5 shadow-md shadow-rose-500/25">
                <p className="text-rose-100 font-bold text-[9px] uppercase tracking-wider">Failed</p>
                <p className="text-xl font-black leading-tight mt-0.5">{bulkStats.failedLatest}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white px-3 py-2.5 shadow-md shadow-violet-500/25">
                <p className="text-violet-100 font-bold text-[9px] uppercase tracking-wider">Already Sent</p>
                <p className="text-xl font-black leading-tight mt-0.5">{bulkStats.alreadySent}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Send Mode
            </p>
            <div className="space-y-2">
              {([
                {
                  id: "failed_only" as SendScope,
                  label: "Retry Failed Only",
                  badge: "Recommended",
                  badgeClass: "bg-emerald-500 text-white",
                  active: "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-900/30 dark:ring-emerald-500/20 dark:text-emerald-100",
                  idle: "border-emerald-100 dark:border-emerald-500/15 hover:border-emerald-300 hover:bg-emerald-50/50",
                },
                {
                  id: "not_sent" as SendScope,
                  label: "Send Not-Yet-Sent Only",
                  badge: "",
                  badgeClass: "",
                  active: "border-sky-400 bg-sky-50 ring-2 ring-sky-200 text-sky-900 dark:border-sky-500/50 dark:bg-sky-900/30 dark:ring-sky-500/20 dark:text-sky-100",
                  idle: "border-sky-100 dark:border-sky-500/15 hover:border-sky-300 hover:bg-sky-50/50",
                },
                {
                  id: "selected_force" as SendScope,
                  label: "Force Resend Selected",
                  badge: "Danger",
                  badgeClass: "bg-rose-500 text-white",
                  active: "border-rose-400 bg-rose-50 ring-2 ring-rose-200 text-rose-900 dark:border-rose-500/50 dark:bg-rose-900/30 dark:ring-rose-500/20 dark:text-rose-100",
                  idle: "border-rose-100 dark:border-rose-500/15 hover:border-rose-300 hover:bg-rose-50/50",
                },
              ]).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 cursor-pointer text-xs font-semibold rounded-xl border-2 px-3 py-2.5 transition-all ${
                    sendScope === opt.id ? opt.active : `bg-white dark:bg-slate-950/40 text-gray-700 dark:text-gray-200 ${opt.idle}`
                  }`}
                >
                  <input
                    type="radio"
                    name="sendScope"
                    checked={sendScope === opt.id}
                    onChange={() => applySendScope(opt.id)}
                    className="accent-[#25D366] mt-0.5"
                  />
                  <span className="flex-1 leading-snug">
                    {opt.label}
                    {opt.badge && (
                      <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${opt.badgeClass}`}>
                        {opt.badge}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-1">
            <button
              onClick={openBulkConfirm}
              disabled={sending || recipientsForScope.length === 0}
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-[#128C7E] via-[#25D366] to-emerald-500 hover:brightness-105 text-white text-sm font-black shadow-lg shadow-emerald-500/30 disabled:opacity-40 disabled:shadow-none transition-all"
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending {sendProgress.done}/{sendProgress.total}
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-5 h-5" />
                  Send WhatsApp ({recipientsForScope.length})
                </>
              )}
            </button>
            {sending && (
              <div className="w-full rounded-xl bg-white/80 dark:bg-slate-950/50 p-2.5 border border-emerald-100 dark:border-emerald-500/20">
                <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#128C7E] to-[#25D366] transition-all duration-300"
                    style={{ width: `${sendProgress.total ? (sendProgress.done / sendProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold mt-1.5">
                  Sent {sendProgress.sent} · Failed {sendProgress.failed} · Skipped {sendProgress.skipped}
                </p>
              </div>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Status updates row-by-row. Retry failed after completion.
            </p>
            {lastFailed.length > 0 && (
              <button
                onClick={() => {
                  const csv = ["Party Name", ...lastFailed].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `failed_${month}_${msgType}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3 py-2 text-left hover:bg-rose-100 transition-colors"
              >
                Download Failed ({lastFailed.length})
              </button>
            )}
          </div>
          </div>
        </aside>
      )}
      </div>

      {/* Preview modal */}
      {previewParty && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-[#003875] text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Message Preview · {msgType}</p>
                <h3 className="font-black uppercase">{previewParty.customerName || previewParty.partyName}</h3>
                {previewParty.customerName && previewParty.customerName !== previewParty.partyName && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{previewParty.partyName}</p>
                )}
              </div>
              <button onClick={() => setPreviewParty(null)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <pre className="p-5 text-sm whitespace-pre-wrap font-medium text-gray-800 dark:text-gray-100 leading-relaxed max-h-[60vh] overflow-auto">
              {previewParty.preview}
            </pre>
          </div>
        </div>
      )}

      {/* CRUD modal */}
      {crudOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest">{editing ? "Edit Party" : "Add Party"}</h3>
              <button onClick={() => setCrudOpen(false)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Party Name</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent text-sm font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Customer Name</label>
                  <input value={formCustomerName} onChange={(e) => setFormCustomerName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent text-sm font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Mobile Num</label>
                  <input value={formMobile} onChange={(e) => setFormMobile(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent text-sm font-bold" />
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Monthly Targets</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MONTH_NAMES.map((m) => (
                    <div key={m}>
                      <label className="text-[9px] font-bold text-gray-400">{m}</label>
                      <input
                        type="number"
                        value={formMonths[m] === "" ? "" : formMonths[m]}
                        onChange={(e) =>
                          setFormMonths((prev) => ({
                            ...prev,
                            [m]: e.target.value === "" ? "" : Number(e.target.value),
                          }))
                        }
                        className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-xs font-bold"
                      />
                    </div>
                  ))}
                </div>
                {editing && (
                  <p className="text-[10px] text-amber-600 mt-2 font-bold">Leave a month blank to keep its existing target unchanged.</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-white/10 flex justify-end gap-2">
              <button onClick={() => setCrudOpen(false)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
              <button onClick={savePlanned} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-[#003875] text-white dark:bg-[#FFD500] dark:text-black">Save</button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
              <h3 className="text-sm font-black uppercase tracking-widest">Import {month} Achievement</h3>
              <p className="text-[10px] font-bold text-gray-400 mt-1">
                {importPreview.fileName} · {importPreview.rows.length} rows
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
                  Matched {importMatchStats.matched}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700">
                  Not found {importMatchStats.unmatched}
                </span>
              </div>
              {importMatchStats.unmatched > 0 && (
                <p className="text-[11px] font-semibold text-rose-600 mt-2">
                  Red rows are not in Sheet1. Match Mobile No first, then No, then Customer / Party Name. Fix Sheet1, then import again.
                </p>
              )}
            </div>
            <div className="p-5 flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1">Customer Name</th>
                    <th className="py-1">No / Mobile</th>
                    <th className="py-1 text-right">Achievement Amount</th>
                    <th className="py-1 text-right pl-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((r, i) => {
                    const matched = rows.some((row) => importRowMatchesParty(r, row));
                    const id = r.mobile || r.no || "—";
                    return (
                      <tr
                        key={i}
                        className={`border-t ${
                          matched
                            ? "border-gray-50 dark:border-white/5"
                            : "border-rose-100 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-500/20"
                        }`}
                      >
                        <td className="py-1.5 pr-2 text-gray-400 font-bold">{i + 1}</td>
                        <td className={`py-1.5 font-bold ${matched ? "text-gray-900 dark:text-white" : "text-rose-700 dark:text-rose-300"}`}>
                          {r.customerName || "—"}
                        </td>
                        <td className={`py-1.5 font-bold tabular-nums ${matched ? "text-gray-900 dark:text-white" : "text-rose-700 dark:text-rose-300"}`}>
                          {id}
                        </td>
                        <td className="py-1.5 text-right font-black tabular-nums">{formatAmount(r.amount)}</td>
                        <td className="py-1.5 text-right pl-2">
                          {matched ? (
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">OK</span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">Missing</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <p className="text-[10px] font-bold text-gray-400">
                Only matched rows will import. Files can be No + Amount, or Customer Name + Mobile No + Amount.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setImportPreview(null)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
                <button
                  onClick={confirmImport}
                  disabled={importMatchStats.matched === 0}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 text-white disabled:opacity-40"
                >
                  Confirm Import → {month} ({importMatchStats.matched})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex gap-3 items-start">
              <ExclamationTriangleIcon className={`w-6 h-6 shrink-0 ${sendScope === "selected_force" ? "text-red-500" : "text-amber-500"}`} />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Confirm Bulk WhatsApp</h3>
                <p className="text-xs text-gray-500 mt-1 font-bold">{msgType} · {month} {year} · {sendScope.replace(/_/g, " ")}</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Recipients</p>
                <p className="text-3xl font-black text-[#2563eb]">{recipientsForScope.length}</p>
              </div>
              <div className="max-h-40 overflow-auto text-[11px] font-bold text-gray-600 dark:text-gray-300 space-y-1">
                {recipientsForScope.slice(0, 40).map((r) => (
                  <div key={r.partyName} className="flex justify-between gap-2 border-b border-gray-50 dark:border-white/5 py-1">
                    <span>{r.customerName || r.partyName}</span>
                    <StatusBadge status={r.sendStatus} />
                  </div>
                ))}
              </div>
              {sendScope === "selected_force" && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Type FORCE to confirm</p>
                  <input value={forceConfirm} onChange={(e) => setForceConfirm(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 text-sm font-black" placeholder="FORCE" />
                </div>
              )}
              <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                Already SENT parties are never re-messaged unless Force Resend.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-white/10 flex justify-end gap-2">
              <button onClick={() => setSendOpen(false)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
              <button onClick={runBulkSend} disabled={recipientsForScope.length === 0} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500 text-white disabled:opacity-40">
                Send {recipientsForScope.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {guideOpen && (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setGuideOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl border border-white/10 overflow-hidden max-h-[min(92vh,900px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-[#003875] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <InformationCircleIcon className="w-5 h-5 text-[#FFD500] shrink-0" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Customer Target — How To Use</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-0.5">Full page guidance</p>
                </div>
              </div>
              <button type="button" onClick={() => setGuideOpen(false)} className="p-1.5 rounded-full hover:bg-white/10"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-sm">
              <section className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1">Who can do what</p>
                <ul className="space-y-1 text-xs font-bold text-amber-900/90 dark:text-amber-100/90">
                  <li>ADMIN / EA — Add/Edit/Delete, Import, Test, Bulk Send, Force Resend.</li>
                  <li>Others — View / search / preview only.</li>
                  <li>Always Send Test to your number before bulk. Target data is confidential.</li>
                </ul>
              </section>
              <section className="space-y-2">
                {[
                  ["Month + Message Type", "Month drives all numbers and WhatsApp text. Target = assigned target message. Achievement = pending/achieved message. Greeting uses Customer Name (falls back to Party Name)."],
                  ["Summary card", "Total parties, how many have target/achievement, and total pending ₹ for the month."],
                  ["Tabs", "Party List (work table), Target Sheet1 view, Achievement view, Send Log audit."],
                  ["Select Eligible", "Only parties with valid mobile AND target > 0."],
                  ["Footer send modes", "Retry Failed Only (default after failures), Not-Yet-Sent Only, or Force Resend Selected (type FORCE)."],
                  ["Send WhatsApp button", "Confirms recipients then sends sequentially. Failed parties can be retried without re-messaging SENT ones."],
                ].map(([t, b]) => (
                  <div key={t} className="rounded-xl border border-gray-100 dark:border-white/10 px-3 py-2.5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#003875] dark:text-[#FFD500]">{t}</p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-1">{b}</p>
                  </div>
                ))}
              </section>
            </div>
            <div className="shrink-0 p-4 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button type="button" onClick={() => setGuideOpen(false)} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-[#003875] text-white dark:bg-[#FFD500] dark:text-black">Got It</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Party"
        message={`Remove ${deleteTarget} from Target (Sheet1) and Achievement sheets?`}
        confirmLabel="Delete"
        type="danger"
      />

      {rowTip && (
        <div
          className="fixed z-[400] pointer-events-none -translate-y-full"
          style={{ left: rowTip.x, top: rowTip.y }}
        >
          <div className="relative w-72 rounded-2xl bg-gradient-to-br from-slate-900 via-[#1e293b] to-amber-950 text-white shadow-[0_12px_40px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/50 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/40">
                <ExclamationTriangleIcon className="w-4 h-4 text-white" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">Cannot send</p>
                <p className="mt-1 text-xs font-bold leading-relaxed text-white/95">{rowTip.text}</p>
              </div>
            </div>
            <span className="absolute left-6 top-full h-0 w-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-amber-900" />
          </div>
        </div>
      )}

      <ActionStatusModal
        isOpen={statusOpen}
        message={statusMessage}
        status={statusType}
        onClose={() => setStatusOpen(false)}
      />
    </div>
  );
}
