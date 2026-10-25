"use client";

interface ActionStatusModalProps {
  isOpen: boolean;
  status: 'loading' | 'success' | 'error';
  message: string;
  onClose?: () => void;
}

import { CheckCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function ActionStatusModal({ isOpen, status, message, onClose }: ActionStatusModalProps) {
  if (!isOpen) return null;

  const isError = status === 'error';
  const isSuccess = status === 'success';
  const isLoading = status === 'loading';

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={!isLoading ? onClose : undefined} />
      <div 
        style={{ borderColor: 'var(--panel-border)' }}
        className="relative bg-white dark:bg-navy-900 rounded-3xl shadow-2xl p-8 w-full max-w-[320px] text-center animate-in fade-in zoom-in duration-300 border dark:border-navy-700"
      >
        {!isLoading && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-[#5B6472] hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center gap-4">
          {isLoading ? (
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-[#2563EB]/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isSuccess ? (
            <CheckCircleIcon className="w-16 h-16 text-green-500" />
          ) : (
            <XCircleIcon className="w-16 h-16 text-red-500" />
          )
          }
          
          <div className="space-y-1">
            <h3 className={`text-[13px] font-semibold   ${isError ? 'text-red-500' : isSuccess ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
              {isLoading ? "Processing" : isSuccess ? "Success" : "Validation Error"}
            </h3>
            <p className="text-[14px] font-bold text-gray-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
              {message}
            </p>
          </div>

          {!isLoading && (
            <button
               onClick={onClose}
               className="mt-2 px-6 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-[13px] font-semibold transition-all"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
