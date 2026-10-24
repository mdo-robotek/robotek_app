"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ScaleIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type LedgerRow = {
  item_name: string;
  category: string;
  active_status: string;
  in_grn: number;
  in_floor: number;
  in_locally_packed: number;
  in_assembled: number;
  total_in: number;
  total_out: number;
  net: number;
  flagged: boolean;
};

type LedgerEntry = {
  id: string;
  date: string;
  item_name: string;
  qty: number;
  source_type: string;
  remarks?: string;
  entered_by?: string;
  created_at?: string;
};

export default function ItemLedgerPage() {
  const { data, isLoading, mutate } = useSWR<{ rows: LedgerRow[]; flaggedCount: number; entries: LedgerEntry[] }>(
    "/api/item-ledger",
    fetcher,
    { revalidateOnFocus: false }
  );
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    qty: "",
    source_type: "Locally Packed" as "Locally Packed" | "Assembled",
    date: new Date().toISOString().split("T")[0],
    remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statementItem, setStatementItem] = useState<string | null>(null);

  const rows = useMemo(() => {
    let r = data?.rows || [];
    if (showOnlyFlagged) r = r.filter((x) => x.flagged);
    if (categoryFilter) r = r.filter((x) => (x.category || "").trim() === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) => x.item_name.toLowerCase().includes(q));
    }
    return r;
  }, [data, showOnlyFlagged, search, categoryFilter]);

  const categories = useMemo(
    () => Array.from(new Set((data?.rows || []).map((r) => (r.category || "").trim()).filter(Boolean))).sort(),
    [data]
  );

  const exportCSV = () => {
    const header = ["Item", "Category", "GRN IN", "Floor IN", "Local Pack (rec)", "Assembled (rec)", "Total IN", "Total OUT", "Net", "Flagged"];
    const lines = rows.map((r) =>
      [r.item_name, r.category, r.in_grn, r.in_floor, r.in_locally_packed, r.in_assembled, r.total_in, r.total_out, r.net, r.flagged ? "YES" : ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `item-ledger-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const itemNames = useMemo(() => Array.from(new Set((data?.rows || []).map((r) => r.item_name))).sort(), [data]);

  type StatementEntry = { date: string; type: string; ref: string; inQty: number; outQty: number; recordOnly: boolean; balance: number };
  const { data: statement, isLoading: statementLoading } = useSWR<{
    item: string; entries: StatementEntry[]; totalIn: number; totalOut: number; net: number;
    reconciled: boolean; summaryTotals: { totalIn: number; totalOut: number };
  }>(statementItem ? `/api/item-ledger?item=${encodeURIComponent(statementItem)}` : null, fetcher, { revalidateOnFocus: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.item_name.trim() || !form.qty || Number(form.qty) <= 0) {
      setError("Item name and a positive quantity are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/item-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: form.item_name.trim(),
          qty: Number(form.qty),
          source_type: form.source_type,
          date: form.date,
          remarks: form.remarks,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setForm({ item_name: "", qty: "", source_type: "Locally Packed", date: new Date().toISOString().split("T")[0], remarks: "" });
      setIsFormOpen(false);
      mutate();
    } catch {
      setError("Saving failed — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ScaleIcon className="w-6 h-6 text-[#2563EB]" />
            Item Ledger
          </h1>
          <p className="text-[14px] font-bold text-gray-500 dark:text-zinc-400 mt-1">
            Per-item IN vs OUT, so a mismatch (like the MAGLOCK correction) is caught automatically instead of found by accident.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-[14px] font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <PlusCircleIcon className="w-4 h-4" /> Punch IN Entry
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-[14px] font-bold outline-none focus:border-[#2563EB]"
        />
        <button
          onClick={() => setShowOnlyFlagged((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold   transition-colors ${
            showOnlyFlagged ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-zinc-300"
          }`}
        >
          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          Flagged only {data ? `(${data.flaggedCount})` : ""}
        </button>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-[13px] font-semibold outline-none focus:border-[#2563EB]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={exportCSV}
          className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-zinc-300 text-[13px] font-semibold hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
        >
          ⬇ Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-navy-800">
        <table className="w-full text-[14px]">
          <thead className="bg-gray-50 dark:bg-navy-950/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-[13px] text-gray-500">Item</th>
              <th className="px-3 py-2 text-left font-semibold text-[13px] text-gray-500">Category</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">GRN IN</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">Floor IN</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500" title="Record only — not added to stock (stock already comes via GRN/floor)">Local Pack (rec)</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500" title="Record only — not added to stock (stock already comes via GRN/floor)">Assembled (rec)</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">Total IN</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">Total OUT</th>
              <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">Net</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400 font-bold">Loading...</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400 font-bold">No items to show.</td></tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.item_name}
                onClick={() => setStatementItem(r.item_name)}
                title="Click for full ledger statement"
                className={`border-t border-gray-100 dark:border-navy-800 cursor-pointer hover:bg-amber-50/40 dark:hover:bg-navy-800/60 ${r.flagged ? "bg-red-50 dark:bg-red-950/20" : ""}`}
              >
                <td className="px-3 py-2 font-bold text-gray-800 dark:text-zinc-100">
                  {r.flagged && <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500 inline mr-1 -mt-0.5" />}
                  {r.item_name}
                </td>
                <td className="px-3 py-2 text-gray-500">{r.category || "—"}</td>
                <td className="px-3 py-2 text-right font-bold">{r.in_grn || "—"}</td>
                <td className="px-3 py-2 text-right font-bold">{r.in_floor || "—"}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-400">{r.in_locally_packed || "—"}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-400">{r.in_assembled || "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.total_in}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.total_out}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.net < 0 ? "text-red-600" : "text-emerald-600"}`}>{r.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.entries && data.entries.length > 0 && (
        <div>
          <h2 className="text-[14px] font-semibold text-gray-500 mb-2">Recent IN Entries</h2>
          <div className="space-y-1.5">
            {data.entries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[14px] bg-gray-50 dark:bg-navy-950/40 rounded-lg px-3 py-2">
                <span className="font-bold">{e.item_name}</span>
                <span className="text-gray-500">{e.source_type}</span>
                <span className="font-semibold">+{e.qty}</span>
                <span className="text-gray-400">{e.date}</span>
                <span className="text-gray-400">{e.entered_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {statementItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setStatementItem(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-navy-900 rounded-2xl p-5 w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">{statement?.item || statementItem} — Item Ledger</h3>
                {statement && (
                  <p className="text-[13px] font-bold mt-0.5">
                    <span className="text-gray-500">IN {statement.totalIn} · OUT {statement.totalOut} · NET </span>
                    <span className={statement.net < 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>{statement.net}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[13px] font-semibold  ${statement.reconciled ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {statement.reconciled ? "✓ Summary se match" : `⚠ Mismatch vs summary (IN ${statement.summaryTotals.totalIn} / OUT ${statement.summaryTotals.totalOut})`}
                    </span>
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setStatementItem(null)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 rounded-xl border border-gray-100 dark:border-navy-800">
              <table className="w-full text-[14px]">
                <thead className="bg-gray-50 dark:bg-navy-950/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[13px] text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-[13px] text-gray-500">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-[13px] text-gray-500">Ref</th>
                    <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">IN</th>
                    <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">OUT</th>
                    <th className="px-3 py-2 text-right font-semibold text-[13px] text-gray-500">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementLoading && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 font-bold">Loading statement...</td></tr>
                  )}
                  {!statementLoading && (statement?.entries || []).length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 font-bold">No movement entries found.</td></tr>
                  )}
                  {(statement?.entries || []).map((e, i) => (
                    <tr key={i} className={`border-t border-gray-50 dark:border-navy-800 ${e.recordOnly ? "opacity-50" : ""} ${e.balance < 0 && !e.recordOnly ? "bg-red-50/60 dark:bg-red-950/20" : ""}`}>
                      <td className="px-3 py-1.5 font-bold text-gray-600 dark:text-zinc-300 whitespace-nowrap">{e.date || "—"}</td>
                      <td className="px-3 py-1.5 font-bold">
                        <span className={e.type.includes("IN") ? "text-emerald-600" : e.type.startsWith("Record") ? "text-gray-400" : "text-blue-600"}>{e.type}</span>
                        {e.recordOnly && <span className="ml-1 text-[12px] font-semibold text-gray-400">(record only)</span>}
                      </td>
                      <td className="px-3 py-1.5 text-gray-400">{e.ref || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">{e.inQty ? `+${Math.round(e.inQty)}` : ""}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{e.outQty ? `-${Math.round(e.outQty)}` : ""}</td>
                      <td className={`px-3 py-1.5 text-right font-semibold ${e.balance < 0 ? "text-red-600" : "text-gray-800 dark:text-zinc-100"}`}>{e.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] font-bold text-gray-400 mt-2">Balance jis din negative hua, usi ke aas-paas ki entry mein galti hai — wahi se investigate karein. "Record only" rows stock mein count nahi hote.</p>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsFormOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-navy-900 rounded-2xl p-5 w-full max-w-md space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Punch IN Entry</h3>
              <button type="button" onClick={() => setIsFormOpen(false)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-gray-400 block mb-1">Item Name</label>
              <input
                list="item-ledger-names"
                value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-transparent text-[14px] font-bold outline-none focus:border-[#2563EB]"
                placeholder="Exact item name as in IMS"
              />
              <datalist id="item-ledger-names">
                {itemNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-semibold text-gray-400 block mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-transparent text-[14px] font-bold outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[13px] font-semibold text-gray-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-transparent text-[14px] font-bold outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-gray-400 block mb-1">Source Type</label>
              <select
                value={form.source_type}
                onChange={(e) => setForm({ ...form, source_type: e.target.value as "Locally Packed" | "Assembled" })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-transparent text-[14px] font-bold outline-none focus:border-[#2563EB]"
              >
                <option value="Locally Packed">Locally Packed (China-unpackaged, packed+tested here)</option>
                <option value="Assembled">Assembled (in-house assembly)</option>
              </select>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-gray-400 block mb-1">Remarks (optional)</label>
              <input
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-800 bg-transparent text-[14px] font-bold outline-none focus:border-[#2563EB]"
              />
            </div>
            {error && <p className="text-[14px] font-bold text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#2563EB] text-white py-2.5 rounded-xl text-[14px] font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Entry"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
