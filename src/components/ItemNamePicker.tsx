"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Canonical item-name picker (Sahil, 2026-10-23): names come from the Busy
 * sale register (last 6 months — the "perfect" spellings) plus the Master
 * catalog, via /api/item-names. Free typing is allowed but a name outside
 * the list shows a warning; admins get a one-click "add to list" that
 * writes the new name into the Master sheet. Using this in GRN and I2R
 * forms kills name-mismatch stock errors at the source.
 */
export default function ItemNamePicker({
  value,
  onChange,
  isAdmin = false,
  placeholder = "Select or type item name...",
  className = "",
  listId = "canonical-item-names",
}: {
  value: string;
  onChange: (v: string) => void;
  isAdmin?: boolean;
  placeholder?: string;
  className?: string;
  listId?: string;
}) {
  const { data, mutate } = useSWR<{ names: string[] }>("/api/item-names", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  });
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  const names = data?.names || [];
  const nameSet = useMemo(() => new Set(names.map((n) => n.trim().toLowerCase())), [names]);
  const trimmed = (value || "").trim();
  const inList = !trimmed || nameSet.has(trimmed.toLowerCase());

  const handleAdd = async () => {
    if (!trimmed || adding) return;
    setAdding(true);
    setAddMsg("");
    try {
      const res = await fetch("/api/item-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: trimmed }),
      });
      if (!res.ok) throw new Error();
      setAddMsg("Added to the official list ✓");
      mutate();
    } catch {
      setAddMsg("Could not add — try again");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1">
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => {
          setAddMsg("");
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={
          className ||
          "w-full px-4 py-3 bg-[#FFFBF0] dark:bg-navy-800 border border-orange-100/50 dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-all shadow-sm"
        }
      />
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {!inList && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wide">
            ⚠ Ye naam official list mein nahi hai — spelling check karein
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding}
              className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#003875] text-white hover:bg-[#002a5c] disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding..." : "+ Add as new official name"}
            </button>
          )}
        </div>
      )}
      {addMsg && <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">{addMsg}</p>}
    </div>
  );
}
