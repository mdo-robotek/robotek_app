import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export interface DrillDownColumn {
  key: string;
  label: string;
  render?: (item: any) => React.ReactNode;
}

export interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: DrillDownColumn[];
  data: any[];
}

export default function DrillDownModal({ isOpen, onClose, title, columns, data }: DrillDownModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-navy-900 w-full max-w-4xl max-h-[85vh] rounded-[2rem] shadow-2xl relative z-10 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10"
        >
          {/* Header */}
          <div className="p-6 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <p className="text-[14px] font-bold text-gray-400 mt-1">
                {data.length} Items Total
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-full transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-navy-900">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-[14px] font-semibold text-gray-900 dark:text-white outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition-colors"
              />
            </div>
          </div>
          
          {/* Body */}
          <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-white dark:bg-navy-900">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 dark:bg-navy-800 z-10 shadow-sm">
                <tr className="text-[13px] font-semibold text-gray-400 border-b border-gray-100 dark:border-white/5">
                  {columns.map((col, idx) => (
                    <th key={col.key} className={`py-4 px-6 ${idx === 0 ? 'w-32' : ''}`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-12 text-center text-gray-400 font-bold text-sm">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      {columns.map((col) => (
                        <td key={col.key} className="py-4 px-6 text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                          {col.render ? col.render(item) : item[col.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
