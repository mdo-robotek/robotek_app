"use client";

import { useState, useEffect, useRef } from "react";
import { PartyManagement } from "@/types/party-management";
import {
  XMarkIcon,
  TagIcon,
  UserIcon,
  BriefcaseIcon,
  Bars3BottomLeftIcon,
  IdentificationIcon,
  QueueListIcon,
  DocumentTextIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon
} from "@heroicons/react/24/outline";
import ActionStatusModal from "@/components/ActionStatusModal";
import PremiumDatePicker from "@/components/PremiumDatePicker";

// ─── Constants ──────────────────────────────────────────────────────────────────
export const CUSTOMER_TYPES = ["NEW", "OLD", "Factory Customer"] as const;
export type CustomerTypeValue = typeof CUSTOMER_TYPES[number];

export const PARTY_TYPE_OPTIONS = ["NBD Incoming", "NBD Outgoing", "Other"] as const;

export const FIRST_ORDER_ITEMS_OPTIONS = [
  "T Shirt",
  "Note Pad",
  "Pen",
  "Thele",
  "Tape Roll",
  "Posters",
  "Catalogue",
];

export const DETAILS_INSTRUCTIONS_OPTIONS = [
  "Whatsapp Catalogue shared",
  "Welcome Email & WhatsApp Message",
  "Support Team Info Shared",
  "Created Whats'App Group",
  "Added Customer in Busy and Goolge Sheet & GST details and Billing Details",
  "Cargo Details Updated in sheet",
  "Packing Instructions",
  "Disital Visiting Card",
  "Authorised Distributor Certificate creative",
  "Glow Shine Board",
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
export const parseChecked = (value: string | undefined): Set<string> =>
  new Set((value || "").split(",").map((s) => s.trim()).filter(Boolean));

export const setToString = (s: Set<string>): string => Array.from(s).join(", ");

export const parseItemsWithQuantity = (value: string | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!value) return result;
  const items = value.split(",").map(s => s.trim()).filter(Boolean);
  items.forEach(item => {
    const match = item.match(/(.*?)\s*\(Qty:\s*(.*?)\)/);
    if (match) {
      result[match[1].trim()] = match[2].trim();
    } else {
      result[item] = "1";
    }
  });
  return result;
};

export const itemsWithQuantityToString = (selected: Record<string, string>): string => {
  return Object.entries(selected)
    .map(([opt, qty]) => `${opt} (Qty: ${qty})`)
    .join(", ");
};

// ─── Checkbox Group ─────────────────────────────────────────────────────────────
function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: Set<string>;
  onChange: (updated: Set<string>) => void;
}) {
  const toggle = (option: string) => {
    const next = new Set(selected);
    next.has(option) ? next.delete(option) : next.add(option);
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
      {options.map((opt) => {
        const checked = selected.has(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 text-left transition-all text-[14px] font-bold w-full ${
              checked
                ? "bg-[#2563EB] border-[#2563EB] text-black shadow-sm"
                : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-[#2563EB]/60 hover:bg-[#2563EB]/5"
            }`}
          >
            <span
              className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                checked
                  ? "bg-black border-black"
                  : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600"
              }`}
            >
              {checked && (
                <svg className="w-2.5 h-2.5 text-[#2563EB]" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1.5 5L4 7.5L8.5 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="leading-tight">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Checkbox With Quantity Group ───────────────────────────────────────────────
function CheckboxWithQuantityGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: Record<string, string>;
  onChange: (updated: Record<string, string>) => void;
}) {
  const toggle = (option: string) => {
    const next = { ...selected };
    if (next[option] !== undefined) {
      delete next[option];
    } else {
      next[option] = "1";
    }
    onChange(next);
  };

  const updateQty = (option: string, qty: string) => {
    const next = { ...selected };
    next[option] = qty;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
      {options.map((opt) => {
        const checked = selected[opt] !== undefined;
        return (
          <div
            key={opt}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 text-left transition-all text-[14px] font-bold w-full ${
              checked
                ? "bg-[#2563EB] border-[#2563EB] text-black shadow-sm"
                : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-[#2563EB]/60 hover:bg-[#2563EB]/5"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(opt)}
              className="flex items-center gap-2.5 flex-1 text-left"
            >
              <span
                className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                  checked
                    ? "bg-black border-black"
                    : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600"
                }`}
              >
                {checked && (
                  <svg className="w-2.5 h-2.5 text-[#2563EB]" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5L4 7.5L8.5 2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="leading-tight">{opt}</span>
            </button>
            {checked && (
              <input
                type="number"
                min="1"
                value={selected[opt]}
                onChange={(e) => updateQty(opt, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className="w-16 px-2 py-1 text-[14px] font-bold bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
                placeholder="Qty"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Searchable Dropdown ─────────────────────────────────────────────────────────
function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--panel-border)' }}
        className="w-full px-3 py-1.5 rounded-lg border focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm flex items-center justify-between gap-2"
      >
        <span className={value ? "text-gray-800 dark:text-zinc-100" : "text-gray-400 dark:text-zinc-500"}>
          {value || placeholder || "Select..."}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div 
          style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
          className="absolute z-[100] mt-1 w-full border rounded-lg shadow-lg overflow-hidden"
        >
          <div 
            style={{ borderColor: 'var(--panel-border)' }}
            className="p-2 border-b"
          >
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 text-[14px] font-bold bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md outline-none focus:border-[#2563EB] text-gray-800 dark:text-zinc-100"
            />
          </div>
          <ul className="max-h-40 overflow-y-auto relative z-[100]">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-gray-400 font-bold">No results</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={`px-3 py-2 text-[14px] font-bold cursor-pointer transition-colors ${
                    value === opt
                      ? "bg-[#2563EB]/20 text-black dark:text-white"
                      : "hover:bg-[#2563EB]/10 text-gray-700 dark:text-zinc-300"
                  }`}
                >
                  {opt}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Party Form Component ───────────────────────────────────────────────────────
export interface PartyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (partyName: string, partyData?: Partial<PartyManagement>) => void;
  editingParty?: PartyManagement | null;
  salePersonName?: string; // current logged in user
  linkedOrderNo?: string; // order number to embed in customerType
  skipSubmit?: boolean; // if true, don't submit to API, only return data
}

export default function PartyFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingParty,
  salePersonName,
  linkedOrderNo,
  skipSubmit = false,
}: PartyFormModalProps) {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [allPartyNames, setAllPartyNames] = useState<string[]>([]);

  // Form UI state
  const [selectedCustomerType, setSelectedCustomerType] = useState<CustomerTypeValue>("NEW");
  const [selectedPartyType, setSelectedPartyType] = useState<string>("");
  const [customPartyType, setCustomPartyType] = useState<string>("");
  const [selectedFirstOrderItems, setSelectedFirstOrderItems] = useState<Record<string, string>>({});
  const [selectedDetailsInstructions, setSelectedDetailsInstructions] = useState<Set<string>>(new Set());
  const emptyForm: Partial<PartyManagement> = {
    id: "",
    customerType: "",
    partyName: "",
    dateOfBirth: "",
    partyType: "",
    salesFunnelUniqueNum: "",
    salePersonName: "",
    firstOrderItems: "",
    detailsAndInstructions: "",
    remarks: "",
    anniversary: "",
    filledBy: "",
    timestamp: "",
  };

  const [formData, setFormData] = useState<Partial<PartyManagement>>(emptyForm);
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingParty) {
        setFormData(editingParty);
        const ct = (editingParty.customerType || "NEW") as CustomerTypeValue;
        setSelectedCustomerType(CUSTOMER_TYPES.includes(ct) ? ct : "NEW");
        const pt = editingParty.partyType || "";
        if (pt === "NBD Incoming" || pt === "NBD Outgoing") {
          setSelectedPartyType(pt);
          setCustomPartyType("");
        } else if (pt) {
          setSelectedPartyType("Other");
          setCustomPartyType(pt);
        } else {
          setSelectedPartyType("");
          setCustomPartyType("");
        }
        setSelectedFirstOrderItems(parseItemsWithQuantity(editingParty.firstOrderItems));
        setSelectedDetailsInstructions(parseChecked(editingParty.detailsAndInstructions));
      } else {
        setFormData({
          ...emptyForm,
          filledBy: salePersonName || "",
          timestamp: new Date().toISOString()
        });
        setSelectedCustomerType("NEW");
        setSelectedPartyType("");
        setCustomPartyType("");
        setSelectedFirstOrderItems({});
        setSelectedDetailsInstructions(new Set());
      }
      fetchUsers();
      fetchParties();
    }
  }, [isOpen, editingParty, salePersonName]);

  const fetchParties = async () => {
    try {
      const res = await fetch("/api/party-management");
      const data = await res.json();
      if (Array.isArray(data)) {
        const names = data.map((p: any) => p.partyName).filter(Boolean);
        setAllPartyNames(names);
      }
    } catch (error) {
      console.error("Failed to fetch parties:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const names: string[] = (data as any[]).map((u: any) => u.username).filter(Boolean);
      setUsernames(names);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const isNewCustomer = selectedCustomerType === "NEW";

  const isDuplicateName = !!formData.partyName && 
    allPartyNames.some(name => 
      name.toLowerCase().trim() === formData.partyName?.toLowerCase().trim() && 
      (!editingParty || name.toLowerCase().trim() !== editingParty.partyName?.toLowerCase().trim())
    );

  const buildSubmitPayload = (): Partial<PartyManagement> => {
    // If this is a NEW party created from O2D, embed the order number in customerType
    const effectiveCustomerType =
      !editingParty && selectedCustomerType === "NEW" && linkedOrderNo
        ? `NEW (${linkedOrderNo})`
        : selectedCustomerType;
    return {
      ...formData,
      customerType: effectiveCustomerType,
      partyType: selectedPartyType === "Other" ? customPartyType : selectedPartyType,
      firstOrderItems: itemsWithQuantityToString(selectedFirstOrderItems),
      detailsAndInstructions: setToString(selectedDetailsInstructions),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionStatus("loading");
    setActionMessage(editingParty ? "Updating party details..." : "Creating new party...");
    setIsStatusModalOpen(true);

    const payload = buildSubmitPayload();
    const method = editingParty ? "PUT" : "POST";
    const url = editingParty ? `/api/party-management/${editingParty.id}` : "/api/party-management";

    if (skipSubmit) {
      setIsStatusModalOpen(false);
      onSuccess(payload.partyName || "", payload);
      return;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsStatusModalOpen(false);
        onSuccess(payload.partyName || "", payload);
      } else throw new Error("Failed");
    } catch {
      setIsStatusModalOpen(false);
      alert("Something went wrong while saving. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in duration-300"
      >
        <div 
          style={{ borderColor: 'var(--panel-border)' }}
          className="p-4 border-b flex items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{editingParty ? "Edit Party" : "Add New Party"}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-400 dark:text-slate-400 font-bold text-[12px]">Party Configuration</p>
              {editingParty && <span className="px-2 py-0.5 bg-orange-50 dark:bg-zinc-800 text-[12px] font-semibold text-gray-500 rounded border border-orange-100 dark:border-zinc-700">ID: {editingParty.id}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"><XMarkIcon className="w-8 h-8" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5 max-h-[80vh] overflow-y-auto bg-white dark:bg-navy-800/50">
          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
              <TagIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
              Customer Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {CUSTOMER_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedCustomerType(type)}
                  className={`px-4 py-1.5 rounded-full font-semibold text-[13px]   border-2 transition-all ${
                    selectedCustomerType === type
                      ? "bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black border-[#2563EB] dark:border-[#60A5FA] shadow-md"
                      : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-[#2563EB] dark:hover:border-[#60A5FA]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
              <UserIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
              Party Name
            </label>
            <input 
              type="text" 
              value={formData.partyName || ""} 
              onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
              style={{ backgroundColor: 'var(--input-bg)', borderColor: isDuplicateName ? '#DC2626' : 'var(--panel-border)' }}
              className={`w-full px-3 py-1.5 rounded-lg border focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm ${isDuplicateName ? 'ring-1 ring-red-500' : ''}`} 
              required 
            />
            {isDuplicateName && (
              <p className="mt-1.5 text-[13px] font-semibold text-[#DC2626] tracking-wider animate-pulse flex items-center gap-1">
                <XMarkIcon className="w-3 h-3" />
                This party name is already registered. Please use a different name.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumDatePicker 
              label="Date of Birth"
              value={formData.dateOfBirth || ""} 
              onChange={(val) => setFormData({ ...formData, dateOfBirth: val })}
              allowPast={true}
              allowSundays={true}
            />
            <PremiumDatePicker 
              label="Anniversary"
              value={formData.anniversary || ""} 
              onChange={(val) => setFormData({ ...formData, anniversary: val })}
              allowPast={true}
              allowSundays={true}
            />
          </div>

          {isNewCustomer && (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
                  <BriefcaseIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
                  Party Type
                </label>
                <div className="space-y-2">
                  {PARTY_TYPE_OPTIONS.map((opt) => {
                    const isSelected = selectedPartyType === opt;
                    return (
                      <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                        <span onClick={() => setSelectedPartyType(opt)}
                          className={`w-4 h-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-[#2563EB] dark:border-[#60A5FA]" : "border-gray-300 dark:border-zinc-600 group-hover:border-[#2563EB] dark:group-hover:border-[#60A5FA]"}`}>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />}
                        </span>
                        <span onClick={() => setSelectedPartyType(opt)}
                          className={`text-[14px] font-bold transition-colors ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-zinc-400 group-hover:text-gray-700 dark:group-hover:text-zinc-200"}`}>
                          {opt === "Other" ? "Other (Custom Input)" : opt}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedPartyType === "Other" && (
                  <input 
                    type="text" 
                    value={customPartyType} 
                    onChange={(e) => setCustomPartyType(e.target.value)} 
                    placeholder="Enter custom party type..."
                    style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--panel-border)' }}
                    className="mt-3 w-full px-3 py-1.5 rounded-lg border focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm" 
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
                    <Bars3BottomLeftIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
                    Sales Funnel Unique Num
                  </label>
                  <input 
                    type="text" 
                    value={formData.salesFunnelUniqueNum || ""} 
                    onChange={(e) => setFormData({ ...formData, salesFunnelUniqueNum: e.target.value })}
                    style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--panel-border)' }}
                    className="w-full px-3 py-1.5 rounded-lg border focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
                    <IdentificationIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
                    Sale Person Name
                  </label>
                  <SearchableDropdown
                    options={usernames}
                    value={formData.salePersonName || ""}
                    onChange={(val) => setFormData({ ...formData, salePersonName: val })}
                    placeholder="Select sales person..."
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
                  <QueueListIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
                  Add following items with First order :
                </label>
                <CheckboxWithQuantityGroup options={FIRST_ORDER_ITEMS_OPTIONS} selected={selectedFirstOrderItems} onChange={setSelectedFirstOrderItems} />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
                  <DocumentTextIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
                  Details and Instructions :
                </label>
                <CheckboxGroup options={DETAILS_INSTRUCTIONS_OPTIONS} selected={selectedDetailsInstructions} onChange={setSelectedDetailsInstructions} />
              </div>
            </>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 mb-2">
              <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-[#FFFFFF]" />
              Remarks
            </label>
            <textarea 
              value={formData.remarks || ""} 
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--panel-border)' }}
              className="w-full px-3 py-1.5 rounded-lg border focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm resize-y min-h-[60px]" 
            />
          </div>

          <div className="pt-2 border-t border-orange-100/50 dark:border-zinc-800 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all text-[13px]">Cancel</button>
            <button 
              type="submit" 
              disabled={isDuplicateName}
              className={`flex-1 bg-[#DC2626] hover:bg-[#8E161D] text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-lg active:scale-95   text-[13px] ${isDuplicateName ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
            >
              {editingParty ? "Save changes" : skipSubmit ? "Add to Order" : "Create party"}
            </button>
          </div>
        </form>
      </div>
      <ActionStatusModal isOpen={isStatusModalOpen} status={actionStatus} message={actionMessage} onClose={() => setIsStatusModalOpen(false)} />
    </div>
  );
}
