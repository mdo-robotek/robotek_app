"use client";

import { 
  CalendarIcon, 
  ViewColumnsIcon, 
  TableCellsIcon, 
  PlusIcon,
  MagnifyingGlassIcon,
  Bars3BottomLeftIcon,
  InformationCircleIcon,
  ListBulletIcon,
  QueueListIcon,
  ChevronDownIcon
} from "@heroicons/react/24/outline";
import { useState, useRef, useEffect } from "react";

interface SchedulerHeaderProps {
  view: 'month' | 'week' | 'day';
  setView: (view: 'month' | 'week' | 'day') => void;
  layout: 'calendar' | 'list';
  setLayout: (layout: 'calendar' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  onAddMeeting: () => void;
  isAdmin: boolean;
}

export default function SchedulerHeader({
  view,
  setView,
  layout,
  setLayout,
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  onAddMeeting,
  isAdmin,
}: SchedulerHeaderProps) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const typeOptions = [
    { value: 'All', label: 'All Tasks', colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200' },
    { value: 'delegation', label: 'Delegation', colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    { value: 'checklist', label: 'Checklist', colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
    { value: 'ticket', label: 'Help Ticket', colorClass: 'bg-[#D97706]/10 text-[#D97706] dark:text-[#D97706] border-[#E5E7EB]' },
    { value: 'o2d', label: 'O2D', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { value: 'meeting', label: 'Meeting', colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
    { value: 'scot', label: 'Scot Calls', colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' }
  ];

  const bgMap: Record<string, string> = {
    'delegation': 'bg-blue-500',
    'checklist': 'bg-purple-500',
    'ticket': 'bg-[#D97706]',
    'o2d': 'bg-emerald-500',
    'meeting': 'bg-rose-500',
    'scot': 'bg-indigo-500',
    'All': 'bg-slate-400 dark:bg-slate-500'
  };

  return (
    <div 
      style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 md:p-4 rounded-2xl shadow-sm border transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-500/10 rounded-2xl">
          <CalendarIcon className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">Robotek Scheduler</h1>
          <p className="text-[14px] font-bold text-slate-500 dark:text-slate-400 capitalize">{view} View</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* View Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mr-2">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${view === 'month' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <TableCellsIcon className="w-4 h-4" />
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${view === 'week' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <ViewColumnsIcon className="w-4 h-4" />
            Week
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${view === 'day' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Bars3BottomLeftIcon className="w-4 h-4" />
            Day
          </button>
        </div>

        {/* Layout Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mr-2">
          <button
            onClick={() => setLayout('calendar')}
            className={`px-3 py-1.5 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${layout === 'calendar' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setLayout('list')}
            className={`px-3 py-1.5 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-1.5 ${layout === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <QueueListIcon className="w-4 h-4" />
            List
          </button>
        </div>

        {/* Type Filter & Legend Combine */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-[14px] font-semibold transition-all border shadow-sm hover:shadow-md ${typeOptions.find(o => o.value === typeFilter)?.colorClass}`}
          >
             <div className={`w-2.5 h-2.5 rounded shadow-sm ${bgMap[typeFilter]}`}></div>
             {typeOptions.find(o => o.value === typeFilter)?.label}
             <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ml-1 ${showTypeDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showTypeDropdown && (
            <div className="absolute top-[calc(100%+8px)] mt-0 right-0 md:left-0 md:right-auto w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 overflow-hidden flex flex-col gap-1">
               <div className="text-[13px] font-semibold text-[#5B6472] mb-1 px-3 mt-1">Filter & Legend</div>
               {typeOptions.map(option => (
                 <button
                   key={option.value}
                   onClick={() => { setTypeFilter(option.value); setShowTypeDropdown(false); }}
                   className={`flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-xl transition-all ${typeFilter === option.value ? option.colorClass : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-transparent'} text-sm font-bold border`}
                 >
                    <div className={`w-3 h-3 rounded shadow-sm ${bgMap[option.value]}`}></div>
                    {option.label}
                 </button>
               ))}
            </div>
          )}
        </div>

        {/* User Search (Admin Only) */}
        {isAdmin && (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472]" />
            <input
              type="text"
              placeholder="Filter by user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-[14px] font-bold text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 w-40 md:w-56 transition-all"
            />
          </div>
        )}

        <button
          onClick={onAddMeeting}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-2xl text-[14px] font-semibold shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4 stroke-[3]" />
          Add Meeting
        </button>
      </div>
    </div>
  );
}
