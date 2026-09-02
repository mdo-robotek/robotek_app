import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { format, add, sub, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';

export type FilterPeriod = 'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

interface DateFilterBarProps {
  period: FilterPeriod;
  setPeriod: (p: FilterPeriod) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  startDate: Date | null;
  setStartDate: (d: Date | null) => void;
  endDate: Date | null;
  setEndDate: (d: Date | null) => void;
  theme?: 'blue' | 'orange' | 'purple' | 'emerald' | 'black';
  variant?: 'pills' | 'dropdown';
  className?: string;
}

export default function DateFilterBar({
  period,
  setPeriod,
  currentDate,
  setCurrentDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  theme = 'blue',
  variant = 'pills',
  className = '',
}: DateFilterBarProps) {
  
  const periods: FilterPeriod[] = ['ALL', 'DAY', 'WEEK', 'MONTH', 'QUARTERLY', 'YEARLY'];

  const periodLabels: Record<FilterPeriod, string> = {
    ALL: 'All Time',
    DAY: 'Day',
    WEEK: 'Week',
    MONTH: 'Month',
    QUARTERLY: 'Quarterly',
    YEARLY: 'Yearly',
    CUSTOM: 'Custom Range',
  };

  const accentText =
    theme === 'orange' ? 'text-orange-600' :
    theme === 'purple' ? 'text-purple-600' :
    theme === 'emerald' ? 'text-emerald-600' :
    theme === 'black' ? 'text-gray-900 dark:text-gray-300' :
    theme === 'blue' ? 'text-blue-600' :
    'text-[#003875]';

  const accentBg =
    theme === 'orange' ? 'bg-orange-600' :
    theme === 'purple' ? 'bg-purple-600' :
    theme === 'emerald' ? 'bg-emerald-600' :
    theme === 'black' ? 'bg-black dark:bg-white' :
    theme === 'blue' ? 'bg-blue-600' :
    'bg-[#00a86b]';

  const selectAccent =
    theme === 'orange' ? 'border-orange-200 focus:ring-orange-500 text-orange-700' :
    theme === 'purple' ? 'border-purple-200 focus:ring-purple-500 text-purple-700' :
    theme === 'emerald' ? 'border-emerald-200 focus:ring-emerald-500 text-emerald-700' :
    theme === 'black' ? 'border-gray-200 focus:ring-gray-500 text-gray-900 dark:text-gray-200' :
    theme === 'blue' ? 'border-blue-200 focus:ring-blue-500 text-blue-700' :
    'border-gray-200 focus:ring-[#003875] text-[#003875]';

  const handlePrev = () => {
    switch (period) {
      case 'DAY': setCurrentDate(sub(currentDate, { days: 1 })); break;
      case 'WEEK': setCurrentDate(sub(currentDate, { weeks: 1 })); break;
      case 'MONTH': setCurrentDate(sub(currentDate, { months: 1 })); break;
      case 'QUARTERLY': setCurrentDate(sub(currentDate, { months: 3 })); break;
      case 'YEARLY': setCurrentDate(sub(currentDate, { years: 1 })); break;
    }
  };

  const handleNext = () => {
    switch (period) {
      case 'DAY': setCurrentDate(add(currentDate, { days: 1 })); break;
      case 'WEEK': setCurrentDate(add(currentDate, { weeks: 1 })); break;
      case 'MONTH': setCurrentDate(add(currentDate, { months: 1 })); break;
      case 'QUARTERLY': setCurrentDate(add(currentDate, { months: 3 })); break;
      case 'YEARLY': setCurrentDate(add(currentDate, { years: 1 })); break;
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'ALL': return 'ALL TIME';
      case 'DAY': return format(currentDate, 'dd MMM yyyy').toUpperCase();
      case 'WEEK': {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`.toUpperCase();
      }
      case 'MONTH': return format(currentDate, 'MMM yyyy').toUpperCase();
      case 'QUARTERLY': return `Q${format(currentDate, 'q')} ${format(currentDate, 'yyyy')}`.toUpperCase();
      case 'YEARLY': return format(currentDate, 'yyyy').toUpperCase();
      case 'CUSTOM': return 'CUSTOM RANGE';
    }
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setPeriod('CUSTOM');
      setStartDate(new Date(e.target.value));
    }
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setPeriod('CUSTOM');
      setEndDate(new Date(e.target.value));
    }
  };

  const clearCustom = () => {
    setPeriod('ALL');
    setStartDate(null);
    setEndDate(null);
  };

  const handlePeriodChange = (p: FilterPeriod) => {
    setPeriod(p);
    if (p !== 'CUSTOM') {
      setStartDate(null);
      setEndDate(null);
    }
  };

  const navigationControls = period !== 'CUSTOM' && period !== 'ALL' && (
    <div className="flex items-center gap-1 bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-1.5 py-0.5 shrink-0 min-w-[160px] justify-between">
      <button onClick={handlePrev} className={`p-0.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors ${accentText}`}>
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <span className={`text-[10px] font-black uppercase tracking-wider px-1 whitespace-nowrap ${accentText}`}>
        {getPeriodLabel()}
      </span>
      <button onClick={handleNext} className={`p-0.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors ${accentText}`}>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );

  const customRangeControl = (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all shrink-0 ${
      period === 'CUSTOM'
        ? (theme === 'orange' ? 'border-orange-500 bg-orange-50' :
           theme === 'purple' ? 'border-purple-600 bg-purple-50' :
           theme === 'emerald' ? 'border-emerald-600 bg-emerald-50' :
           theme === 'black' ? 'border-gray-900 bg-gray-100 dark:bg-gray-800 dark:border-gray-700' :
           theme === 'blue' ? 'border-blue-600 bg-blue-50' :
           'border-[#00a86b] bg-[#00a86b]/5')
        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c]'
    }`}>
      <CalendarDaysIcon className={`w-3.5 h-3.5 shrink-0 ${accentText}`} />
      <input
        type="date"
        value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
        onChange={handleCustomStartChange}
        className={`bg-transparent text-[10px] font-black outline-none uppercase cursor-pointer w-[108px] ${accentText}`}
      />
      <span className="text-[9px] font-black text-gray-400">TO</span>
      <input
        type="date"
        value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
        onChange={handleCustomEndChange}
        className={`bg-transparent text-[10px] font-black outline-none uppercase cursor-pointer w-[108px] ${accentText}`}
      />
      {period === 'CUSTOM' && (
        <button onClick={clearCustom} className="p-0.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-500 transition-colors">
          <XMarkIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  if (variant === 'dropdown') {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl shadow-sm shrink-0 ${className}`}>
        <div className="relative shrink-0">
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value as FilterPeriod)}
            className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg border bg-gray-50 dark:bg-[#0a0f1c] text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 cursor-pointer ${selectAccent}`}
          >
            {periods.map((p) => (
              <option key={p} value={p}>{periodLabels[p]}</option>
            ))}
            {period === 'CUSTOM' && (
              <option value="CUSTOM">{periodLabels.CUSTOM}</option>
            )}
          </select>
          <ChevronDownIcon className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${accentText}`} />
        </div>
        {navigationControls}
        {customRangeControl}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl shadow-sm overflow-x-auto custom-scrollbar shrink-0 z-10 relative ${className}`}>
      {/* Period Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {periods.map(p => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
              period === p
                ? `${accentBg} text-white shadow-md`
                : (theme === 'orange' ? 'bg-white text-orange-600 border border-gray-200 hover:bg-orange-50' : 
                   theme === 'purple' ? 'bg-white text-purple-600 border border-gray-200 hover:bg-purple-50' :
                   theme === 'emerald' ? 'bg-white text-emerald-600 border border-gray-200 hover:bg-emerald-50' :
                   theme === 'black' ? 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-100 dark:bg-transparent dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800' :
                   theme === 'blue' ? 'bg-white text-blue-600 border border-gray-200 hover:bg-blue-50' :
                   'bg-white text-[#003875] border border-gray-200 hover:bg-gray-50')
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {navigationControls}

      {customRangeControl}
    </div>
  );
}
