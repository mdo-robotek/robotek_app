"use client";

import { useState, useRef, useEffect } from "react";
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CalendarIcon 
} from "@heroicons/react/24/outline";

interface PremiumDatePickerProps {
  value: string; // YYYY-MM-DD or comma-separated YYYY-MM-DD,YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  multiSelect?: boolean;
  allowPast?: boolean;
  allowSundays?: boolean;
}

export default function PremiumDatePicker({ 
  value, 
  onChange, 
  label, 
  multiSelect = false,
  allowPast = false,
  allowSundays = false
}: PremiumDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse initial date(s)
  const getInitialDates = (val: string) => {
    if (!val) return [];
    return val.split(',').map(v => v.trim()).filter(Boolean);
  };

  const [selectedDates, setSelectedDates] = useState<string[]>(getInitialDates(value));
  const [viewDate, setViewDate] = useState(value ? new Date(value.split(',')[0]) : new Date());

  useEffect(() => {
    setSelectedDates(getInitialDates(value));
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    
    // Check constraints
    const today = new Date();
    today.setHours(0,0,0,0);
    if (!allowPast && newDate < today) return;
    if (!allowSundays && newDate.getDay() === 0) return;

    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(newDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;

    if (multiSelect) {
      const isAlreadySelected = selectedDates.includes(dateStr);
      let newSelectedDates;
      if (isAlreadySelected) {
        newSelectedDates = selectedDates.filter(d => d !== dateStr);
      } else {
        newSelectedDates = [...selectedDates, dateStr].sort();
      }
      setSelectedDates(newSelectedDates);
      onChange(newSelectedDates.join(','));
    } else {
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const numDays = daysInMonth(currentYear, currentMonth);
  const firstDay = firstDayOfMonth(currentYear, currentMonth);

  const days = Array.from({ length: numDays }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div>
      {label && (
        <label className="text-[13px] font-semibold text-gray-400 block mb-2">
          {label}
        </label>
      )}
      <div 
        onClick={() => setIsOpen(true)}
        className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-navy-700 focus-within:border-[#2563EB] cursor-pointer flex items-center justify-between gap-4 group transition-all shadow-sm"
      >
        <div className="flex-1 min-w-0">
          <span className="font-bold text-[14px] text-gray-800 dark:text-zinc-100 block">
            {value ? new Date(value.split(',')[0]).toLocaleDateString('en-GB') : "Select Date"}
          </span>
        </div>

        {multiSelect && selectedDates.length > 1 && (
          <div className="flex-1 min-w-0 border-l border-orange-100 dark:border-navy-800 pl-3 py-0.5 max-h-[40px] overflow-y-auto custom-scrollbar no-scrollbar">
            <span className="text-[13px] text-gray-400 font-bold block leading-relaxed">
              {selectedDates.slice(1).map(d => {
                const [y, m, day] = d.split('-').map(Number);
                return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
              }).join(', ')}
            </span>
          </div>
        )}

        <CalendarIcon className="w-4 h-4 text-gray-400 group-hover:text-[#DC2626] dark:group-hover:text-[#60A5FA] flex-shrink-0 transition-colors" />
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" 
            onClick={() => setIsOpen(false)} 
          />
          <div 
            ref={containerRef}
            className="relative bg-white dark:bg-navy-900 border border-orange-100 dark:border-navy-700 rounded-2xl shadow-2xl p-4 w-full max-w-[320px] animate-in fade-in zoom-in duration-200"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button 
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-all"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="flex gap-1">
                <button 
                  type="button"
                  onClick={() => {
                    setShowMonthPicker(!showMonthPicker);
                    setShowYearPicker(false);
                  }}
                  className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-wider hover:bg-gray-50 dark:hover:bg-white/5 px-2 py-1 rounded-md transition-all"
                >
                  {monthNames[currentMonth]}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowYearPicker(!showYearPicker);
                    setShowMonthPicker(false);
                  }}
                  className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-wider hover:bg-gray-50 dark:hover:bg-white/5 px-2 py-1 rounded-md transition-all"
                >
                  {currentYear}
                </button>
              </div>
              <button 
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-all"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Month/Year Selection Overlays */}
            {showMonthPicker && (
              <div className="absolute inset-x-4 top-16 bottom-4 bg-white dark:bg-navy-900 z-10 grid grid-cols-3 gap-2 overflow-y-auto p-1">
                {monthNames.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setViewDate(new Date(currentYear, i, 1));
                      setShowMonthPicker(false);
                    }}
                    className={`text-[13px] font-semibold  p-2 rounded-lg transition-all ${i === currentMonth ? 'bg-[#DC2626] text-white' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500'}`}
                  >
                    {name.substring(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {showYearPicker && (
              <div className="absolute inset-x-4 top-16 bottom-4 bg-white dark:bg-navy-900 z-10 grid grid-cols-3 gap-2 overflow-y-auto p-1 custom-scrollbar">
                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 80 + i).map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewDate(new Date(year, currentMonth, 1));
                      setShowYearPicker(false);
                    }}
                    className={`text-[13px] font-bold p-2 rounded-lg transition-all ${year === currentYear ? 'bg-[#2563EB] text-black' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500'}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}

            {/* Weekdays */}
            <div className="grid grid-cols-7 mb-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                <div key={day} className="text-center text-[13px] font-semibold text-gray-300 dark:text-gray-600">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {blanks.map(b => (
                <div key={`blank-${b}`} className="h-8" />
              ))}
              {days.map(d => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dateObj = new Date(currentYear, currentMonth, d);
                const isSelected = selectedDates.includes(dateStr);
                const localToday = new Date();
                const todayStr = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
                const isToday = todayStr === dateStr;
                
                const todayObj = new Date();
                todayObj.setHours(0,0,0,0);
                const isPast = dateObj < todayObj;
                const isSunday = dateObj.getDay() === 0;
                const isDisabled = (!allowPast && isPast) || (!allowSundays && isSunday);

                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDateSelect(d)}
                    className={`
                      h-8 flex items-center justify-center rounded-lg text-[14px] font-bold transition-all
                      ${isSelected 
                        ? "bg-[#DC2626] text-white shadow-lg scale-105" 
                        : isToday 
                          ? "bg-[#2563EB]/20 text-[#DC2626] dark:text-[#60A5FA] border border-[#2563EB]/30" 
                          : isDisabled
                            ? "opacity-20 cursor-not-allowed grayscale"
                            : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5"
                      }
                    `}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Quick Shortcuts */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  onChange(today);
                  setIsOpen(false);
                }}
                className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
              >
                Today
              </button>
              <button 
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="text-[13px] font-semibold text-gray-400 hover:underline text-right"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
