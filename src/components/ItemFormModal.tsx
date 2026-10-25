"use client";

import { useState } from "react";
import {
  XMarkIcon,
  ArchiveBoxIcon,
  CurrencyRupeeIcon,
  TagIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { useEffect } from "react";
import ActionStatusModal from "@/components/ActionStatusModal";

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (itemName: string, itemPrice: string) => void;
}

export default function ItemFormModal({
  isOpen,
  onClose,
  onSuccess,
}: ItemFormModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [gst, setGst] = useState("18");
  const [finalPrice, setFinalPrice] = useState("");
  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Auto-calculate final price
  useEffect(() => {
    const basePrice = parseFloat(price);
    const gstRate = parseFloat(gst);
    if (!isNaN(basePrice) && !isNaN(gstRate)) {
      const calculation = basePrice * (1 + gstRate / 100);
      setFinalPrice(calculation.toFixed(2));
    } else if (!isNaN(basePrice)) {
      setFinalPrice(basePrice.toFixed(2));
    } else {
      setFinalPrice("");
    }
  }, [price, gst]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setActionStatus("loading");
    setActionMessage("Adding new item...");
    setIsStatusModalOpen(true);

    try {
      const res = await fetch("/api/o2d?type=item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          price, 
          gst: gst ? `${gst}%` : "0%", 
          finalPrice 
        }),
      });

      if (res.ok) {
        setActionStatus("success");
        setActionMessage("Item added successfully!");
        setTimeout(() => {
          setIsStatusModalOpen(false);
          onSuccess(name, finalPrice);
          setName("");
          setPrice("");
          setGst("18");
          onClose();
        }, 1500);
      } else {
        throw new Error("Failed to add item");
      }
    } catch (error) {
      setActionStatus("error");
      setActionMessage("Something went wrong. Please try again.");
      setTimeout(() => setIsStatusModalOpen(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-md" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 bg-white dark:bg-navy-900">
        <div className="p-5 border-b border-[#E5E7EB] dark:border-navy-700 flex items-center justify-between shrink-0 bg-[#EFF4FF] dark:bg-navy-800">
          <div>
            <h2 className="text-lg font-semibold text-[#2563EB] dark:text-[#60A5FA] italic">
              Add New Item
            </h2>
            <p className="text-[13px] font-semibold text-[#5B6472] mt-0.5">
              Nomenclature & Pricing
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5B6472] hover:text-red-500 transition-all"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472] mb-2">
              <ArchiveBoxIcon className="w-3.5 h-3.5" />
              Item Name (Nomenclature)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Iron Rod, 10mm"
              className="w-full bg-[#EFF4FF] dark:bg-black px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 outline-none focus:border-[#2563EB] font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472] mb-2">
              <CurrencyRupeeIcon className="w-3.5 h-3.5" />
              Default Price
            </label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 500.00"
              className="w-full bg-[#EFF4FF] dark:bg-black px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 outline-none focus:border-[#2563EB] font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472] mb-2">
                <TagIcon className="w-3.5 h-3.5" />
                GST (%)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={gst}
                  onChange={(e) => setGst(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="18"
                  className="w-full bg-[#EFF4FF] dark:bg-black pl-4 pr-8 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 outline-none focus:border-[#2563EB] font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#5B6472]">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472] mb-2">
                <CheckBadgeIcon className="w-3.5 h-3.5" />
                Final Amount
              </label>
              <input
                type="text"
                readOnly
                value={finalPrice}
                placeholder="0.00"
                className="w-full bg-[#2563EB]/5 dark:bg-[#60A5FA]/5 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700 outline-none font-semibold text-[14px] text-[#2563EB] dark:text-[#60A5FA] transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl font-semibold text-[#5B6472] hover:text-gray-600 dark:hover:text-white transition-all text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] bg-[#DC2626] hover:bg-[#8E161D] text-white py-3 rounded-2xl font-semibold transition-all shadow-lg active:scale-95 text-[13px]"
            >
              Save Item
            </button>
          </div>
        </form>
      </div>
      <ActionStatusModal 
        isOpen={isStatusModalOpen} 
        status={actionStatus} 
        message={actionMessage} 
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
}
