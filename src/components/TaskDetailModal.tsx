import React from 'react';
import { XMarkIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Task {
  id: string;
  title: string;
  plannedDate: string | null;
  actualDate: string | null;
  status: string;
  isLate: boolean;
}

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tasks: Task[];
  type: string;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, title, tasks, type }) => {
  if (!isOpen) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div 
        style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
        className="relative w-full max-w-4xl max-h-[85vh] rounded-[2rem] border-4 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div 
          style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
          className="px-8 py-4 border-b flex items-center justify-between"
        >
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h2>
            <p className="text-[13px] font-bold text-gray-400">Detailed Task Breakdown</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <XMarkIcon className="w-8 h-8 text-gray-400" />
          </button>
        </div>

        {/* Task List */}
        <div 
          style={{ backgroundColor: 'var(--panel-card)' }}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          <div className="grid grid-cols-1 gap-3">
            {tasks.length === 0 ? (
              <div className="py-20 text-center text-gray-400 italic font-bold">No tasks found for this period</div>
            ) : (
              tasks.map((task, idx) => (
                <div 
                  key={idx} 
                  style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
                  className={`p-4 rounded-xl border-2 shadow-sm flex items-center justify-between gap-4 border-l-[6px] ${
                    task.isLate ? 'border-l-rose-500' : task.actualDate ? 'border-l-emerald-500' : 'border-l-amber-500'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-[14px] truncate mb-1">{task.title}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                        <ClockIcon className="w-3 h-3 text-blue-400" />
                        <span>Planned: <span className="font-bold text-gray-700 dark:text-slate-300">{formatDate(task.plannedDate)}</span></span>
                      </div>
                      {task.actualDate && (
                        <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                          <CheckCircleIcon className="w-3 h-3 text-emerald-400" />
                          <span>Actual: <span className="font-bold text-gray-700 dark:text-slate-300">{formatDate(task.actualDate)}</span></span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center">
                    <span className={`text-[13px] font-semibold px-3 py-1 rounded-full  ${
                      task.isLate ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 
                      task.actualDate ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20' : 
                      'bg-amber-50 text-amber-500 dark:bg-amber-900/20'
                    }`}>
                      {task.isLate ? 'Delayed' : task.actualDate ? 'On Time' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div 
          style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
          className="px-8 py-4 border-t flex justify-between"
        >
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-gray-400">Total</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tasks.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-gray-400">Late</p>
              <p className="text-sm font-semibold text-rose-500">{tasks.filter(t => t.isLate).length}</p>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-gray-400">Success</p>
              <p className="text-sm font-semibold text-emerald-500">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.actualDate && !t.isLate).length / tasks.length) * 100) : 0}%
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-navy-800 text-white rounded-xl text-[14px] font-semibold hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
