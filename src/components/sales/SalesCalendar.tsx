import { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { FollowUp } from '@/types/sales';

interface SalesCalendarProps {
  followUps: FollowUp[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

export default function SalesCalendar({ followUps, selectedDate, onSelectDate }: SalesCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const toLocalDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const highlightedDates = useMemo(() => {
    // Get the most recent follow-up for each lead to only count their latest scheduled date
    const latestFollowUpsByLead = new Map<string, FollowUp>();
    followUps.forEach(fu => {
      const existing = latestFollowUpsByLead.get(fu.lead_id);
      if (!existing || new Date(fu.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        latestFollowUpsByLead.set(fu.lead_id, fu);
      }
    });

    const dates = new Map<string, number>();
    latestFollowUpsByLead.forEach(fu => {
      if (fu.next_follow_up_date) {
        const d = new Date(fu.next_follow_up_date);
        if (!isNaN(d.getTime())) {
          const dateStr = toLocalDateString(d);
          dates.set(dateStr, (dates.get(dateStr) || 0) + 1);
        }
      }
    });
    return dates;
  }, [followUps]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    const dateStr = toLocalDateString(d);
    const count = highlightedDates.get(dateStr) || 0;
    const isHighlighted = count > 0;
    const isSelected = selectedDate ? toLocalDateString(selectedDate) === dateStr : false;

    days.push(
      <div key={i} className="relative w-8 h-8 flex items-center justify-center">
        <button
          onClick={() => {
            if (isSelected) {
              onSelectDate(null); // toggle off
            } else {
              onSelectDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
            }
          }}
          className={`h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${
            isSelected
              ? 'bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black shadow-md'
              : isHighlighted
              ? 'bg-[#F7F8FA] text-[#D97706] dark:bg-yellow-500/20 dark:text-yellow-400 border border-[#E5E7EB] dark:border-yellow-500/50 hover:bg-[#FEF3C7]'
              : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
          }`}
        >
          {i}
        </button>
        {isHighlighted && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[14px] font-semibold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-sm">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>
    );
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-[#FFFFFF] dark:bg-navy-900 rounded-2xl p-4 shadow-[inset_0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] border border-[#E5E7EB] dark:border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-gray-500">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded transition-colors text-gray-500">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="h-6 flex items-center justify-center text-[14px] font-semibold text-[#5B6472]">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1 justify-items-center">
        {days}
      </div>

      <div className="mt-4 pt-4 border-t border-[#E5E7EB] dark:border-white/5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#F7F8FA] border border-[#E5E7EB] dark:bg-yellow-500/20 dark:border-yellow-500/50" />
          <span className="text-[13px] font-bold text-gray-500">Follow Up Scheduled</span>
        </div>
        {selectedDate && (
          <button onClick={() => onSelectDate(null)} className="text-[13px] font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline ml-auto">
            Clear Filter
          </button>
        )}
      </div>
    </div>
  );
}
