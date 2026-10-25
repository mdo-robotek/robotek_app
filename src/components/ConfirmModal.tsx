"use client";

import { 
  ExclamationTriangleIcon,
  XMarkIcon 
} from "@heroicons/react/24/outline";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'info';
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = "Confirm", 
  cancelLabel = "Cancel",
  type = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div 
        style={{ borderColor: 'var(--panel-border)' }}
        className="relative bg-white dark:bg-navy-900 rounded-3xl shadow-2xl w-full max-w-[360px] overflow-hidden animate-in fade-in zoom-in duration-300 border dark:border-navy-700"
      >
        <div className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`p-4 rounded-full ${type === 'danger' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-[#F7F8FA] dark:bg-[#60A5FA]/10 text-[#2563EB]'}`}>
              <ExclamationTriangleIcon className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <p className="text-[14px] font-bold text-gray-500 dark:text-slate-400 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-[#5B6472] hover:text-gray-600 hover:bg-gray-50 transition-all text-[13px] border border-gray-100"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 text-white py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95   text-[13px] ${type === 'danger' ? 'bg-[#DC2626] hover:bg-[#8E161D]' : 'bg-[#2563EB] hover:bg-[#1D4ED8]'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
