"use client";

import React, { useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  MagnifyingGlassIcon,
  TrashIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import ConfirmModal from "@/components/ConfirmModal";
import type { OutFormRow } from "@/types/ims-out-form";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const normalizeSo = (value?: string) => String(value || "").trim().toUpperCase();

const formatQty = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return "—";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_INDEX: Record<string, number> = Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i]));

const pad2 = (n: number | string) => String(n).padStart(2, "0");

const toYmd = (y: number | string, m: number | string, d: number | string) =>
  `${y}-${pad2(m)}-${pad2(d)}`;

const excelSerialToYmd = (serial: number) => {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const date = new Date(utc);
  return toYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

const normalizeDateKey = (value?: string | number) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 90000) return excelSerialToYmd(value);
    return "";
  }

  const raw = String(value).trim();
  if (!raw) return "";

  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = parseFloat(raw);
    if (serial > 20000 && serial < 90000) return excelSerialToYmd(serial);
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return toYmd(iso[1], iso[2], iso[3]);

  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const a = parseInt(dmy[1], 10);
    const b = parseInt(dmy[2], 10);
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    if (a > 12) return toYmd(y, b, a);
    if (b > 12) return toYmd(y, a, b);
    return toYmd(y, b, a);
  }

  const named = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})/);
  if (named) {
    const month = MONTH_INDEX[named[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      let y = parseInt(named[3], 10);
      if (y < 100) y += y >= 70 ? 1900 : 2000;
      return toYmd(y, month + 1, named[1]);
    }
  }

  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) {
    const date = new Date(ts);
    return toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  return "";
};

const sortNewestFirst = (a: OutFormRow, b: OutFormRow) => {
  const dateDiff = normalizeDateKey(b.date).localeCompare(normalizeDateKey(a.date));
  if (dateDiff !== 0) return dateDiff;
  return (b.rowIndex || 0) - (a.rowIndex || 0);
};

const formatUiDate = (value?: string) => {
  const key = normalizeDateKey(value);
  if (!key) return value || "—";
  const [y, m, d] = key.split("-");
  return `${d} ${MONTHS[parseInt(m, 10) - 1] || m} ${y.slice(-2)}`;
};

export default function GFloorOutFormTab({
  showStatus,
}: {
  showStatus: (msg: string, type?: "loading" | "success" | "error") => void;
}) {
  const { data = [], isLoading, mutate } = useSWR<OutFormRow[]>("/api/ims/out-form", fetcher, {
    revalidateOnFocus: false,
  });
  const rows = Array.isArray(data) ? data : [];

  const [searchQuery, setSearchQuery] = useState("");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const itemsPerPage = 50;

  const duplicateSoKeys = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const so = normalizeSo(row.orderNo);
      if (!so) return;
      counts.set(so, (counts.get(so) || 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([so]) => so)
    );
  }, [rows]);

  const duplicateRowCount = useMemo(
    () => rows.filter((row) => duplicateSoKeys.has(normalizeSo(row.orderNo))).length,
    [rows, duplicateSoKeys]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows
      .filter((row) => {
        const so = normalizeSo(row.orderNo);
        if (duplicatesOnly && !duplicateSoKeys.has(so)) return false;
        if (!q) return true;
        const haystack = [
          row.orderNo,
          row.date,
          row.partyName,
          ...(row.items || []).map((item) => item.description),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(sortNewestFirst);
  }, [rows, searchQuery, duplicatesOnly, duplicateSoKeys]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [searchQuery, duplicatesOnly]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const extraDuplicateRowIndexes = useMemo(() => {
    const seen = new Set<string>();
    const extras: number[] = [];
    [...rows].sort(sortNewestFirst).forEach((row) => {
      const so = normalizeSo(row.orderNo);
      if (!duplicateSoKeys.has(so)) return;
      if (seen.has(so)) extras.push(row.rowIndex);
      else seen.add(so);
    });
    return extras;
  }, [rows, duplicateSoKeys]);

  const toggleExpand = (rowIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const pageSelectable = pageRows.map((row) => row.rowIndex);
  const allPageSelected = pageSelectable.length > 0 && pageSelectable.every((id) => selectedRows.has(id));

  const togglePage = () => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageSelectable.forEach((id) => next.delete(id));
      else pageSelectable.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectExtraDuplicates = () => {
    setDuplicatesOnly(true);
    setSelectedRows(new Set(extraDuplicateRowIndexes));
  };

  const handleDelete = async () => {
    const rowIndexes = Array.from(selectedRows);
    if (rowIndexes.length === 0) return;
    setSubmitting(true);
    showStatus(`Deleting ${rowIndexes.length} Out Form row(s)...`, "loading");
    try {
      const res = await fetch("/api/ims/out-form", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndexes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setSelectedRows(new Set());
      setIsConfirmOpen(false);
      await Promise.all([
        mutate(),
        globalMutate("/api/ims"),
        globalMutate("/api/ims/summary"),
        globalMutate("/api/ims/time-series"),
      ]);
      showStatus(`Deleted ${data.deleted || rowIndexes.length} duplicate row(s)`, "success");
    } catch {
      showStatus("Failed to delete Out Form rows", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0 mt-2">
      <div className="py-2 px-4 border-b border-orange-200/60 dark:border-orange-500/10 bg-orange-50/60 dark:bg-orange-500/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="relative w-[220px]">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH SO / ITEM..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-orange-500 dark:text-white shadow-sm h-[30px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setDuplicatesOnly((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border h-[30px] ${
              duplicatesOnly
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white dark:bg-[#111827] text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
            }`}
          >
            Duplicates ({duplicateSoKeys.size} SO / {duplicateRowCount} rows)
          </button>
          {extraDuplicateRowIndexes.length > 0 && (
            <button
              type="button"
              onClick={selectExtraDuplicates}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 h-[30px]"
            >
              Select extras ({extraDuplicateRowIndexes.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedRows.size > 0 && (
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-50 flex items-center gap-1.5 h-[30px]"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete selected ({selectedRows.size})
            </button>
          )}
          <p className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">
            Showing {filteredRows.length === 0 ? 0 : Math.min((currentPage - 1) * itemsPerPage + 1, filteredRows.length)} to {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length}
          </p>
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {duplicateRowCount > 0 && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-100 dark:border-rose-500/20 flex items-center gap-2 shrink-0">
          <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Duplicate SO numbers are highlighted. Keep one row per SO, then delete the extras.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : (
          <table className="w-full text-left border-collapse relative min-w-[980px]">
            <thead className="bg-orange-50 dark:bg-orange-900/20 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="py-2.5 px-3 text-center border-b border-orange-200 dark:border-orange-500/20 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    disabled={pageSelectable.length === 0}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Date</th>
                <th className="py-2.5 px-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">SO No</th>
                <th className="py-2.5 px-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Particulars</th>
                <th className="py-2.5 px-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 min-w-[240px]">Items</th>
                <th className="py-2.5 px-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Qty</th>
                <th className="py-2.5 px-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100 dark:divide-orange-500/10">
              {pageRows.map((row) => {
                const so = normalizeSo(row.orderNo);
                const isDup = duplicateSoKeys.has(so);
                const selected = selectedRows.has(row.rowIndex);
                const items = row.items || [];
                const expanded = expandedRows.has(row.rowIndex);
                const previewCount = 2;
                const visibleItems = expanded ? items : items.slice(0, previewCount);
                const hiddenCount = Math.max(0, items.length - previewCount);
                return (
                  <tr
                    key={row.rowIndex}
                    className={`${
                      isDup
                        ? "bg-rose-50 dark:bg-rose-500/10"
                        : "hover:bg-orange-50/40 dark:hover:bg-white/[0.03]"
                    } ${selected ? "ring-1 ring-inset ring-rose-300 dark:ring-rose-500/40" : ""}`}
                  >
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRow(row.rowIndex)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3 text-[11px] font-bold text-gray-500 whitespace-nowrap">{formatUiDate(row.date)}</td>
                    <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase">
                      {row.orderNo || "—"}
                    </td>
                    <td className="py-2 px-3 text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase">
                      {row.partyName || "—"}
                    </td>
                    <td className="py-2 px-3 align-middle min-w-[360px]">
                      {items.length === 0 ? (
                        <span className="text-[11px] text-gray-400">—</span>
                      ) : (
                        <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 max-h-[3.25rem] ${expanded ? "overflow-y-auto custom-scrollbar pr-1" : "overflow-hidden"}`}>
                          {visibleItems.map((item, idx) => (
                            <span key={`${row.rowIndex}-${idx}`} className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase leading-tight whitespace-nowrap">
                              {item.description}
                              <span className="text-gray-400"> × {formatQty(item.qty)}</span>
                              {idx < visibleItems.length - 1 ? <span className="text-gray-300 dark:text-gray-600"> ·</span> : null}
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.rowIndex)}
                              className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap"
                            >
                              {expanded ? "Less" : `+${hiddenCount} more`}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">
                      {formatQty(row.totalQty)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isDup ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-[9px] font-black uppercase">
                          Duplicate SO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[9px] font-black uppercase">
                          <CheckIcon className="w-3 h-3" /> Unique
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 text-[11px] font-black uppercase">
                    {isLoading ? "Loading..." : "No Out Form rows found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Out Form rows"
        message={`Delete ${selectedRows.size} selected Out Form row(s)? This cannot be undone and will change G Floor OUT qty.`}
        confirmLabel="Delete"
        type="danger"
      />
    </div>
  );
}
