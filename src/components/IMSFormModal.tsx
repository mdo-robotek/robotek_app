"use client";

import React, { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { IMS } from "@/types/ims";
import ActionStatusModal from "@/components/ActionStatusModal";
import { mutate } from "swr";

interface IMSFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newItem: IMS) => void;
  existingCategories?: string[];
}

export default function IMSFormModal({
  isOpen,
  onClose,
  onSuccess,
  existingCategories = [],
}: IMSFormModalProps) {
  const [formData, setFormData] = useState<Partial<IMS>>({
    id: "",
    item_name: "",
    est_amount_item: "",
    gst: "",
    final_amount: "",
    category: "",
  });

  const [actionStatus, setActionStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const calcFinalAmount = (est: string, gst: string): string => {
    const estNum = parseFloat(est);
    const gstNum = parseFloat(gst);
    if (!isNaN(estNum) && !isNaN(gstNum)) {
      return (estNum * (1 + gstNum / 100)).toFixed(3);
    }
    return "";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "est_amount_item" || name === "gst") {
        updated.final_amount = calcFinalAmount(
          name === "est_amount_item" ? value : prev.est_amount_item || "",
          name === "gst" ? value : prev.gst || ""
        );
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!formData.item_name || !formData.est_amount_item || !formData.gst) {
      setActionStatus("error");
      setActionMessage("Please fill in all required fields");
      setIsStatusModalOpen(true);
      return;
    }

    setActionStatus("loading");
    setActionMessage("Adding item...");
    setIsStatusModalOpen(true);

    try {
      const response = await fetch("/api/ims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        mutate("/api/ims");
        const newItem: IMS = {
          ...formData,
        } as IMS;

        setActionStatus("success");
        setActionMessage("Item added successfully!");
        
        setTimeout(() => {
          setIsStatusModalOpen(false);
          if (onSuccess) onSuccess(newItem);
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setActionStatus("error");
        setActionMessage(errorData.error || "Failed to save item");
      }
    } catch (error) {
      setActionStatus("error");
      setActionMessage("Error saving item");
      console.error(error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1300] p-4">
        <div className="relative bg-white dark:bg-navy-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="p-6 pb-4 bg-[#FFFFFF] dark:bg-navy-950 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2563EB] dark:text-white tracking-wider">
              Add New Item to IMS
            </h2>
            <button
              onClick={onClose}
              className="text-[#5B6472] dark:text-navy-700 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mb-1.5">
                Item Name *
              </label>
              <input
                type="text"
                name="item_name"
                value={formData.item_name || ""}
                onChange={handleInputChange}
                placeholder="Enter item name"
                className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mb-1.5">
                  Est. Amount/Item *
                </label>
                <input
                  type="text"
                  name="est_amount_item"
                  value={formData.est_amount_item || ""}
                  onChange={handleInputChange}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mb-1.5">
                  GST (%) *
                </label>
                <input
                  type="number"
                  name="gst"
                  value={formData.gst || ""}
                  onChange={handleInputChange}
                  placeholder="e.g. 18"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mb-1.5">
                Final Amount <span className="text-[#5B6472] normal-case font-semibold">(auto-calculated)</span>
              </label>
              <input
                type="text"
                name="final_amount"
                value={formData.final_amount || ""}
                readOnly
                placeholder="Calculated from amount + GST"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-900/50 border border-slate-100 dark:border-navy-800 rounded-xl font-bold text-sm text-[#5B6472] dark:text-navy-700 cursor-not-allowed outline-none shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mb-1.5">
                Category
              </label>
              <input
                type="text"
                name="category"
                list="ims-category-list"
                value={formData.category || ""}
                onChange={handleInputChange}
                placeholder="Enter or select category"
                className="w-full px-4 py-3 bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-all shadow-sm"
              />
              <datalist id="ims-category-list">
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 py-4 bg-[#FFFFFF] dark:bg-navy-950 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-navy-400 rounded-xl font-semibold text-[14px] hover:bg-slate-50 dark:hover:bg-navy-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-navy-950 rounded-xl font-semibold text-[14px] hover:bg-[#1D4ED8] dark:hover:bg-[#1D4ED8] transition-all shadow-lg active:scale-95"
            >
              Add Item
            </button>
          </div>
        </div>
      </div>

      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={actionStatus}
        message={actionMessage}
      />
    </>
  );
}
