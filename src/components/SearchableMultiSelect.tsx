"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MagnifyingGlassIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { matchesOptionSearch } from "@/lib/ims-filters";

interface Option {
  id: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  accentClass?: string;
}

export default function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  label,
  className = "",
  accentClass = "border-blue-500 ring-blue-500/20",
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const filteredOptions = options.filter((opt) =>
    matchesOptionSearch(opt.label || "", searchTerm)
  );

  const selectedLabels = options
    .filter((opt) => value.includes(opt.id))
    .map((opt) => opt.label);

  const displayText =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? selectedLabels[0]
        : `${value.length} selected`;

  const toggleOption = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectAllFiltered = () => {
    const ids = filteredOptions.map((o) => o.id);
    const merged = Array.from(new Set([...value, ...ids]));
    onChange(merged);
  };

  const clearAll = () => onChange([]);

  const updateDropdownPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 260),
    });
  }, []);

  const openDropdown = () => {
    updateDropdownPos();
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm("");
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPos();
    window.addEventListener("scroll", updateDropdownPos, true);
    window.addEventListener("resize", updateDropdownPos);
    return () => {
      window.removeEventListener("scroll", updateDropdownPos, true);
      window.removeEventListener("resize", updateDropdownPos);
    };
  }, [isOpen, updateDropdownPos]);

  return (
    <div className="w-full" ref={triggerRef}>
      {label && (
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
          {label}
        </label>
      )}

      <div
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className={`w-full p-3 rounded-xl cursor-pointer flex justify-between items-center gap-2 transition-all ${
          className || "bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5"
        } ${isOpen ? `ring-1 ${accentClass}` : ""}`}
      >
        <span
          className={`text-[10px] font-bold truncate ${
            value.length > 0 ? "text-gray-900 dark:text-white" : "text-gray-400"
          }`}
          title={selectedLabels.join(", ")}
        >
          {displayText}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Clear selection"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDownIcon
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {isOpen && dropdownPos.width > 0 && (
        <div
          ref={dropdownRef}
          className="fixed z-[11000] bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
          }}
        >
          <div className="p-2 border-b border-gray-100 dark:border-white/5 flex items-center gap-2 bg-gray-50/50 dark:bg-slate-800/50">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 ml-1 shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent border-none outline-none text-[10px] font-bold p-1 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <XMarkIcon
                className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600 shrink-0"
                onClick={() => setSearchTerm("")}
              />
            )}
          </div>

          <div className="px-2 py-1.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
            >
              Select all{searchTerm ? " shown" : ""}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[9px] font-black uppercase tracking-wider text-gray-500 hover:underline"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const checked = value.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "bg-blue-50 dark:bg-blue-500/10"
                        : "hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(opt.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span
                      className={`text-[10px] font-bold leading-snug ${
                        checked
                          ? "text-blue-800 dark:text-blue-300"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })
            ) : (
              <div className="p-4 text-center text-[10px] font-bold text-gray-400 italic">
                No results found
              </div>
            )}
          </div>

          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-slate-800/50">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                {value.length} selected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
