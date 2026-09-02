"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mutate as globalMutate } from "swr";
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import SearchableSelect from "@/components/SearchableSelect";
import { FloorIMS } from "@/types/ims-floor";
import { computeAuditDiff, getGFloorItemStock, roundQty, type GFloorStockItem } from "@/lib/gfloor-ledger-utils";

const tableInputClass =
  "w-full px-2 py-1.5 text-[11px] font-bold text-gray-900 dark:text-white bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-md outline-none focus:ring-1 focus:ring-[#003875] dark:focus:ring-[#FFD500] uppercase";

const thClass =
  "py-2 px-2 text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest text-left whitespace-nowrap bg-gray-50 dark:bg-[#1f2937] border-b border-gray-200 dark:border-white/10";

const tdClass = "py-1.5 px-2 align-middle border-b border-gray-100 dark:border-white/5";

type ProductionRow = {
  id: string;
  item_name: string;
  category: string;
  qty: string;
  date: string;
};

type AuditRow = {
  id: string;
  item_name: string;
  category: string;
  live_stock: number;
  physical_qty: string;
  diff_qty: number;
  diff_type: "IN" | "OUT" | "NONE";
  fromPaste?: boolean;
};

type Props = {
  stockItems: GFloorStockItem[];
  showStatus: (msg: string, type?: "loading" | "success" | "error") => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
};

async function refreshIMSData() {
  await Promise.all([
    globalMutate("/api/ims"),
    globalMutate("/api/ims/time-series"),
    globalMutate("/api/ims/summary"),
    globalMutate("/api/ims/gfloor-approval"),
    globalMutate("/api/ims/floor?location=g&ledgerOnly=1"),
  ]);
}

export default function GFloorLedgerModals({
  stockItems,
  showStatus,
  submitting,
  setSubmitting,
}: Props) {
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [productionRows, setProductionRows] = useState<ProductionRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditPasteText, setAuditPasteText] = useState("");

  const itemOptions = useMemo(
    () =>
      [...stockItems]
        .filter((i) => i.item_name?.trim())
        .map((i) => ({ id: i.item_name.trim(), label: i.item_name.trim() }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [stockItems]
  );

  const validItemKeys = useMemo(
    () => new Set(itemOptions.map((o) => o.id.toLowerCase().trim())),
    [itemOptions]
  );

  const isValidItem = (name: string) => validItemKeys.has(name.toLowerCase().trim());

  const openProduction = () => {
    setProductionRows([
      { id: Date.now().toString(), item_name: "", category: "", qty: "", date: "" },
    ]);
    setIsProductionOpen(true);
  };

  const openAudit = () => {
    setAuditRows([]);
    setAuditPasteText("");
    setAuditRows([
      {
        id: Date.now().toString(),
        item_name: "",
        category: "",
        live_stock: 0,
        physical_qty: "",
        diff_qty: 0,
        diff_type: "NONE",
      },
    ]);
    setIsAuditOpen(true);
  };

  const handleProductionRowChange = (id: string, field: keyof ProductionRow, value: string) => {
    setProductionRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value };
        if (field === "item_name") {
          const { category } = getGFloorItemStock(value, stockItems);
          next.category = category;
        }
        return next;
      })
    );
  };

  const handleAuditRowChange = (id: string, field: keyof AuditRow, value: string) => {
    setAuditRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value } as AuditRow;
        if (field === "item_name") {
          const { live_stock, category } = getGFloorItemStock(value, stockItems);
          next.category = category;
          next.live_stock = live_stock;
        }
        if (field === "item_name" || field === "physical_qty") {
          const phys = parseFloat(field === "physical_qty" ? value : next.physical_qty);
          if (!isNaN(phys)) {
            const { diff_qty, diff_type } = computeAuditDiff(phys, next.live_stock);
            next.diff_qty = diff_qty;
            next.diff_type = diff_type;
          } else {
            next.diff_qty = 0;
            next.diff_type = "NONE";
          }
        }
        return next;
      })
    );
  };

  const saveProduction = async () => {
    for (const row of productionRows) {
      const qty = parseFloat(row.qty);
      if (!row.item_name || !row.qty || isNaN(qty) || qty <= 0) {
        showStatus("Fill item name and IN qty > 0 for every row", "error");
        return;
      }
      if (!isValidItem(row.item_name)) {
        showStatus("Select a valid item from the list", "error");
        return;
      }
    }

    setSubmitting(true);
    showStatus("Saving production IN entries...", "loading");
    try {
      const today = new Date().toISOString().split("T")[0];
      const items: Partial<FloorIMS>[] = productionRows.map((row) => ({
        item_name: row.item_name.trim(),
        category: row.category,
        in_qty: String(roundQty(parseFloat(row.qty))),
        out_qty: "0",
        date: row.date || today,
        updated_at: new Date().toISOString(),
      }));
      const res = await fetch("/api/ims/floor?location=g", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refreshIMSData();
      setIsProductionOpen(false);
      setProductionRows([]);
      showStatus("Production IN saved!", "success");
    } catch {
      showStatus("Error saving production IN.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuditPaste = () => {
    if (!auditPasteText.trim()) {
      showStatus("Paste Item Name and Physical Qty columns", "error");
      return;
    }
    const lines = auditPasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const newRows: AuditRow[] = [];
    lines.forEach((line, idx) => {
      let parts = line.split("\t");
      if (parts.length < 2 && line.includes(",")) parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) return;
      if (/item\s*name/i.test(parts[0]) && /qty|physical/i.test(parts[1])) return;
      const itemName = parts[0].trim();
      const physicalQty = parseFloat(parts[1].trim());
      if (!itemName || isNaN(physicalQty) || !isValidItem(itemName)) return;
      const { live_stock, category } = getGFloorItemStock(itemName, stockItems);
      const { diff_qty, diff_type } = computeAuditDiff(physicalQty, live_stock);
      if (diff_type === "NONE") return;
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
      showStatus("No adjustments found in pasted data", "error");
      return;
    }
    setAuditRows((prev) => {
      const emptyOnly = prev.length === 1 && !prev[0].item_name && !prev[0].physical_qty;
      return emptyOnly ? newRows : [...prev, ...newRows];
    });
    setAuditPasteText("");
    showStatus(`Loaded ${newRows.length} adjustment row(s)`, "success");
  };

  const saveAudit = async () => {
    const validRows = auditRows.filter(
      (r) => r.item_name && r.diff_type !== "NONE" && r.diff_qty > 0
    );
    if (validRows.length === 0) {
      showStatus("No stock differences to apply", "error");
      return;
    }
    if (validRows.some((r) => !isValidItem(r.item_name))) {
      showStatus("Select valid items from the list", "error");
      return;
    }

    setSubmitting(true);
    showStatus("Applying physical stock adjustments...", "loading");
    try {
      const today = new Date().toISOString().split("T")[0];
      const items: Partial<FloorIMS>[] = validRows.map((row) => ({
        item_name: row.item_name.trim(),
        category: row.category,
        in_qty: row.diff_type === "IN" ? String(roundQty(row.diff_qty)) : "0",
        out_qty: row.diff_type === "OUT" ? String(roundQty(row.diff_qty)) : "0",
        date: today,
        updated_at: new Date().toISOString(),
      }));
      const res = await fetch("/api/ims/floor?location=g", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refreshIMSData();
      setIsAuditOpen(false);
      setAuditRows([]);
      setAuditPasteText("");
      showStatus("Physical stock reconciled!", "success");
    } catch {
      showStatus("Error saving adjustments.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={openProduction}
        disabled={submitting}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-emerald-200 dark:border-emerald-500/20 shadow-sm disabled:opacity-50 h-[30px]"
      >
        <PlusIcon className="w-3.5 h-3.5" /> Production IN
      </button>
      <button
        onClick={openAudit}
        disabled={submitting}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-500/10 dark:hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-violet-300 dark:border-violet-500/30 shadow-sm disabled:opacity-50 h-[30px]"
      >
        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" /> Physical Check
      </button>

      <AnimatePresence>
        {isProductionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-emerald-500/20 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-emerald-600 to-teal-700 text-white shrink-0">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardDocumentListIcon className="w-5 h-5" />
                  Production IN — G Floor
                </h3>
                <button onClick={() => setIsProductionOpen(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Manual IN from production only. OUT entries are created via Physical Check when stock differs.
                </p>
                <button
                  onClick={() =>
                    setProductionRows((prev) => [
                      ...prev,
                      { id: Date.now().toString(), item_name: "", category: "", qty: "", date: "" },
                    ])
                  }
                  className="mb-3 px-3 py-1.5 border border-dashed border-emerald-300 rounded-lg text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                >
                  + Add Row
                </button>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Item Name *</th>
                        <th className={`${thClass} w-32`}>Category</th>
                        <th className={`${thClass} w-24 text-right`}>IN Qty *</th>
                        <th className={`${thClass} w-36`}>Date</th>
                        <th className={`${thClass} w-10 text-center`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className={tdClass}>
                            <SearchableSelect
                              label=""
                              options={itemOptions}
                              value={row.item_name}
                              onChange={(val) => handleProductionRowChange(row.id, "item_name", val)}
                              placeholder="Select item..."
                              className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-md text-[11px] min-h-[34px]"
                            />
                          </td>
                          <td className={tdClass}>
                            <input
                              type="text"
                              value={row.category}
                              onChange={(e) => handleProductionRowChange(row.id, "category", e.target.value)}
                              className={tableInputClass}
                            />
                          </td>
                          <td className={tdClass}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.qty}
                              onChange={(e) => handleProductionRowChange(row.id, "qty", e.target.value)}
                              className={`${tableInputClass} text-right`}
                            />
                          </td>
                          <td className={tdClass}>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleProductionRowChange(row.id, "date", e.target.value)}
                              className={tableInputClass}
                            />
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <button
                              onClick={() => setProductionRows((prev) => prev.filter((r) => r.id !== row.id))}
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
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button onClick={() => setIsProductionOpen(false)} className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Cancel</button>
                <button onClick={saveProduction} disabled={submitting} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                  {submitting ? "Saving..." : "Save IN"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAuditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111827] rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden border border-teal-500/20 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-teal-600 to-cyan-700 text-white shrink-0">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-5 h-5" />
                  Physical Stock Check — G Floor
                </h3>
                <button onClick={() => setIsAuditOpen(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Enter physical count. System creates IN or OUT adjustment rows in IMS-G Floor sheet.
                </p>
                <div className="flex flex-wrap gap-2">
                  <textarea
                    value={auditPasteText}
                    onChange={(e) => setAuditPasteText(e.target.value)}
                    placeholder={"Item Name\tPhysical Qty\n..."}
                    className="flex-1 min-w-[200px] h-16 p-2 text-[11px] font-mono border rounded-lg dark:bg-[#0a0f1c] dark:border-white/10"
                  />
                  <button onClick={handleAuditPaste} className="px-4 py-2 h-fit text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-200 rounded-lg dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20">
                    Load Paste
                  </button>
                </div>
                <button
                  onClick={() =>
                    setAuditRows((prev) => [
                      ...prev,
                      { id: Date.now().toString(), item_name: "", category: "", live_stock: 0, physical_qty: "", diff_qty: 0, diff_type: "NONE" },
                    ])
                  }
                  className="px-3 py-1.5 border border-dashed border-teal-300 rounded-lg text-[10px] font-black uppercase text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                >
                  + Add Row
                </button>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Item Name *</th>
                        <th className={`${thClass} w-24 text-right`}>Live Stock</th>
                        <th className={`${thClass} w-28 text-right`}>Physical Qty *</th>
                        <th className={`${thClass} w-28 text-center`}>Adjustment</th>
                        <th className={`${thClass} w-10 text-center`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className={tdClass}>
                            <SearchableSelect
                              label=""
                              options={itemOptions}
                              value={row.item_name}
                              onChange={(val) => handleAuditRowChange(row.id, "item_name", val)}
                              placeholder="Select item..."
                              className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 py-1.5 px-2 rounded-md text-[11px] min-h-[34px]"
                            />
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <span className="text-[11px] font-black text-[#003875] dark:text-[#FFD500]">{row.live_stock}</span>
                          </td>
                          <td className={tdClass}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.physical_qty}
                              onChange={(e) => handleAuditRowChange(row.id, "physical_qty", e.target.value)}
                              className={`${tableInputClass} text-right`}
                            />
                          </td>
                          <td className={`${tdClass} text-center`}>
                            {row.diff_type === "NONE" ? (
                              <span className="text-[10px] font-bold text-gray-400">—</span>
                            ) : (
                              <span className={`text-[10px] font-black uppercase ${row.diff_type === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                                {row.diff_type} {row.diff_qty}
                              </span>
                            )}
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <button
                              onClick={() => setAuditRows((prev) => prev.filter((r) => r.id !== row.id))}
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
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50/50 dark:bg-[#1f2937]/50">
                <button onClick={() => setIsAuditOpen(false)} className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Cancel</button>
                <button onClick={saveAudit} disabled={submitting} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50">
                  {submitting ? "Saving..." : "Apply Adjustments"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
