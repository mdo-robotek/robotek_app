"use client";

import { useState, useMemo } from "react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday,
  startOfDay,
  addWeeks,
  subWeeks,
  differenceInMinutes,
  setHours,
  setMinutes
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ClockIcon,
  CalendarIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  TicketIcon,
  TruckIcon,
  PhoneIcon
} from "@heroicons/react/24/outline";
import { CalendarEvent, CalendarEventType } from "@/types/calendar";

interface SchedulerCalendarProps {
  events: CalendarEvent[];
  view: 'month' | 'week' | 'day';
  layout: 'calendar' | 'list';
  onEventClick: (event: CalendarEvent) => void;
}

export default function SchedulerCalendar({ 
  events, 
  view, 
  layout,
  onEventClick 
}: SchedulerCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const categoryColors: Record<CalendarEventType, string> = {
    delegation: "bg-blue-500",
    checklist: "bg-purple-500",
    ticket: "bg-[#D97706]",
    o2d: "bg-emerald-500",
    meeting: "bg-rose-500",
    scot: "bg-indigo-500"
  };

  const categoryIcons: Record<CalendarEventType, any> = {
    meeting: CalendarIcon,
    delegation: UserGroupIcon,
    checklist: ClipboardDocumentCheckIcon,
    ticket: TicketIcon,
    o2d: TruckIcon,
    scot: PhoneIcon
  };

  const nextDate = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prevDate = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const subDays = (date: Date, amount: number) => addDays(date, -amount);

  // Helper for computing parallel side-by-side simultaneous layouts
  const getSimultaneousLayouts = (dayEvents: CalendarEvent[]) => {
    const sortedEvents = [...dayEvents].sort((a,b) => a.start.getTime() - b.start.getTime());
    const layouts = sortedEvents.map(e => {
      const startMins = e.start.getHours() * 60 + e.start.getMinutes();
      const endMins = e.end ? (e.end.getHours() * 60 + e.end.getMinutes()) : startMins + 60;
      return { event: e, startMins, endMins, duration: Math.max(30, endMins - startMins), col: 0, maxCols: 1 };
    });

    let clusters: (typeof layouts)[] = [];
    let currentCluster: typeof layouts = [];
    let maxEnd = -1;

    layouts.forEach(layout => {
      if (currentCluster.length === 0) {
        currentCluster.push(layout);
        maxEnd = layout.endMins;
      } else if (layout.startMins < maxEnd) {
        currentCluster.push(layout);
        maxEnd = Math.max(maxEnd, layout.endMins);
      } else {
        clusters.push(currentCluster);
        currentCluster = [layout];
        maxEnd = layout.endMins;
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    clusters.forEach(cluster => {
        let columns: number[] = []; 
        cluster.forEach(layout => {
          let placed = false;
          for (let i = 0; i < columns.length; i++) {
            if (columns[i] <= layout.startMins) {
              columns[i] = layout.endMins;
              layout.col = i;
              placed = true;
              break;
            }
          }
          if (!placed) {
            layout.col = columns.length;
            columns.push(layout.endMins);
          }
        });
        cluster.forEach(layout => layout.maxCols = columns.length);
    });

    return layouts;
  };

  // --- MONTH VIEW ---
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const d = day;
        const dayEvents = events.filter(e => isSameDay(e.start, d));
        
        days.push(
          <div
            key={d.toString()}
            style={{ borderColor: 'var(--panel-border)' }}
            className={`min-h-[120px] p-2 border-r border-b transition-colors ${!isSameMonth(d, monthStart) ? 'bg-slate-50/50 dark:bg-slate-900/50 opacity-40' : ''}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[14px] font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday(d) ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>
                {format(d, "d")}
              </span>
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 4).map(e => (
                <div
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className={`px-1.5 py-0.5 rounded-lg text-[13px] font-semibold text-white truncate cursor-pointer hover:brightness-110 active:scale-95 transition-all ${categoryColors[e.type]}`}
                >
                  {e.title}
                </div>
              ))}
              {dayEvents.length > 4 && (
                <div className="text-[13px] font-semibold text-[#5B6472] pl-1">
                  +{dayEvents.length - 4} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 border-l border-slate-100 dark:border-slate-800">
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div 
        style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
        className="rounded-3xl border overflow-hidden shadow-sm flex flex-col h-full"
      >
        <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-3 text-center text-[13px] font-semibold text-slate-500 dark:text-slate-400">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto invisible-scrollbar">
          {rows}
        </div>
      </div>
    );
  };

  // --- WEEK VIEW ---
  const renderWeekView = () => {
    const start = startOfWeek(currentDate);
    const days = eachDayOfInterval({ start, end: addDays(start, 6) });
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div 
        style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
        className="rounded-3xl border overflow-hidden shadow-sm flex flex-col h-full"
      >
        <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shrink-0">
          <div className="py-3 border-r border-slate-200 dark:border-slate-700"></div>
          {days.map(d => (
            <div key={d.toString()} className="py-3 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0">
              <div className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{format(d, "EEE")}</div>
              <div className={`inline-flex items-center justify-center w-8 h-8 text-sm font-semibold rounded-full ${isToday(d) ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 dark:text-slate-200'}`}>{format(d, "d")}</div>
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] h-[1200px]">
             {/* Time labels */}
             <div className="border-r border-slate-100 dark:border-slate-800">
              {hours.map(h => (
                <div key={h} className="h-[50px] text-[13px] font-semibold text-[#5B6472] text-center pt-2 leading-none">
                  {format(setHours(new Date(), h), "h aa")}
                </div>
              ))}
            </div>

            {/* Grid cells and events */}
            {days.map((d, dayIdx) => (
              <div key={d.toString()} className="relative border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                {hours.map(h => (
                  <div key={h} className="h-[50px] border-b border-slate-100 dark:border-slate-800/10"></div>
                ))}
                
                {/* Events for this day */}
                {getSimultaneousLayouts(events.filter(e => isSameDay(e.start, d))).map(({ event: e, startMins, duration, col, maxCols }) => {
                  const chunkWidth = 100 / maxCols;
                  const leftPos = col * chunkWidth;
                  
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => onEventClick(e)}
                      style={{
                        top: `${(startMins / 60) * 50}px`,
                        height: `${(duration / 60) * 50}px`,
                        width: `calc(${chunkWidth}% - 4px)`,
                        left: `calc(${leftPos}% + 2px)`,
                      }}
                      className={`absolute rounded-xl p-2 border-l-4 shadow-sm z-20 cursor-pointer overflow-hidden ${categoryColors[e.type]} bg-opacity-90 dark:bg-opacity-80 border-black/10`}
                    >
                      <div className="text-[13px] font-semibold text-white leading-tight mb-1 truncate">{e.title}</div>
                      <div className="flex items-center gap-1 text-[12px] font-bold text-white opacity-90">
                        <ClockIcon className="w-3 h-3" />
                        {format(e.start, "h:mm aa")}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- DAY VIEW ---
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = events.filter(e => isSameDay(e.start, currentDate));
    const layouts = getSimultaneousLayouts(dayEvents);

    return (
      <div 
        style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
        className="rounded-[2.5rem] border overflow-hidden shadow-sm flex flex-col h-full"
      >
        <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center ${isToday(currentDate) ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'}`}>
              <span className="text-[14px] font-semibold tracking-tighter opacity-70 leading-none mb-1">{format(currentDate, "EEE")}</span>
              <span className="text-2xl font-semibold leading-none">{format(currentDate, "d")}</span>
            </div>
            <div>
               <h3 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">{format(currentDate, "MMMM yyyy")}</h3>
               <p className="text-[14px] font-bold text-slate-500 dark:text-slate-400">Daily breakdown of your schedules</p>
            </div>
          </div>
          <div className="flex bg-white dark:bg-slate-700 p-1.5 rounded-2xl shadow-inner">
            <button onClick={prevDate} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-[14px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-all">Today</button>
            <button onClick={nextDate} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="relative">
            {hours.map(h => (
              <div key={h} className="h-16 border-t border-slate-100 dark:border-slate-800 flex items-start pt-2 gap-4">
                <span className="text-[13px] font-semibold text-[#5B6472] w-12 text-right tracking-tighter">{format(setHours(new Date(), h), "h aa")}</span>
                <div className="flex-1 border-t border-slate-50 dark:border-slate-800/50 mt-1.5"></div>
              </div>
            ))}

            <div className="absolute top-0 left-16 right-0 bottom-0 pointer-events-none">
                {layouts.map(({ event: e, startMins, duration, col, maxCols }) => {
                  const baseWidth = 95;
                  const baseLeft = 2;
                  
                  // Parallel Side-by-Side computation
                  const chunkWidth = baseWidth / maxCols;
                  const actualWidth = chunkWidth - 1; // gap between siblings
                  const offsetLeft = baseLeft + (col * chunkWidth);

                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => onEventClick(e)}
                      style={{
                        top: `${(startMins / 60) * 64}px`,
                        height: `${(duration / 60) * 64}px`,
                        width: `${Math.max(5, actualWidth)}%`,
                        left: `${offsetLeft}%`,
                      }}
                      className={`absolute rounded-2xl p-4 border-l-[6px] shadow-sm pointer-events-auto cursor-pointer flex flex-col transition-all hover:scale-[1.02] active:scale-95 ${categoryColors[e.type]} bg-opacity-95 dark:bg-opacity-90 border-black/20`}
                    >
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[14px] font-semibold text-white/90 bg-black/20 px-2 py-0.5 rounded-full">{format(e.start, "hh:mm a")}</span>
                         <span className="text-[13px] font-semibold text-white/90 px-2 border border-white/20 rounded">{e.type}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-1 leading-tight">{e.title}</h4>
                      {e.description && <p className="text-[14px] font-bold text-white/70 line-clamp-1">{e.description}</p>}
                    </motion.div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- LIST VIEW (TILES) ---
  const renderListView = () => {
    let currentEvents = events;
    let titleScope = "";
    if (view === 'month') {
      currentEvents = events.filter(e => isSameMonth(e.start, currentDate));
      titleScope = format(currentDate, "MMMM yyyy");
    } else if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      currentEvents = events.filter(e => e.start >= start && e.start <= end);
      titleScope = `Week of ${format(start, "MMM dd, yyyy")}`;
    } else {
      currentEvents = events.filter(e => isSameDay(e.start, currentDate));
      titleScope = format(currentDate, "MMMM dd, yyyy");
    }

    currentEvents = currentEvents.sort((a,b) => a.start.getTime() - b.start.getTime());

    return (
      <div 
        style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
        className="rounded-[2.5rem] border overflow-hidden shadow-sm flex flex-col h-full"
      >
        <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
               <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 capitalize hover:rotate-12 transition-all">{view}</span>
             </div>
             <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight capitalize">{view} List</h3>
                <p className="text-[14px] font-bold text-slate-500 dark:text-slate-400">All tasks for {titleScope}</p>
             </div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-xl text-[14px] font-semibold text-slate-600 dark:text-slate-300">
            {currentEvents.length} Total Events
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 invisible-scrollbar">
          {currentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#5B6472] dark:text-slate-500">
               <span className="text-4xl mb-4 opacity-50">📋</span>
               <p className="text-sm font-bold">No tasks scheduled in this timeframe.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {currentEvents.map((e, idx) => {
                const Icon = categoryIcons[e.type] || CalendarIcon;
                
                // Safe lookup for icon colors to bypass tailwind compiler stripping
                const iconBgClass = 
                  e.type === 'meeting' ? 'bg-rose-500/10 border-rose-500/20' :
                  e.type === 'delegation' ? 'bg-blue-500/10 border-blue-500/20' :
                  e.type === 'checklist' ? 'bg-purple-500/10 border-purple-500/20' :
                  e.type === 'ticket' ? 'bg-[#D97706]/10 border-[#E5E7EB]' :
                  e.type === 'scot' ? 'bg-indigo-500/10 border-indigo-500/20' :
                  'bg-emerald-500/10 border-emerald-500/20';

                const iconTextClass = 
                  e.type === 'meeting' ? 'text-rose-500' :
                  e.type === 'delegation' ? 'text-blue-500' :
                  e.type === 'checklist' ? 'text-purple-500' :
                  e.type === 'ticket' ? 'text-[#D97706]' :
                  e.type === 'scot' ? 'text-indigo-500' :
                  'text-emerald-500';

                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min((idx % 15) * 0.03, 0.4) }}
                    onClick={() => onEventClick(e)}
                    className="p-3 md:p-4 rounded-3xl border cursor-pointer hover:shadow-md transition-all shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 active:scale-95 flex flex-col md:flex-row gap-4 w-full items-start md:items-center"
                  >
                    <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                      <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center shadow-inner border ${iconBgClass}`}>
                         <Icon className={`w-6 h-6 stroke-[2.5] ${iconTextClass}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[13px] font-semibold   ${iconTextClass}`}>
                             {e.type}
                          </span>
                          <span className="text-[13px] font-bold text-[#5B6472] dark:text-slate-600">•</span>
                          <div className="flex items-center gap-1 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                             <ClockIcon className="w-3 h-3" />
                             {format(e.start, "EEEE, MMM dd • hh:mm a")}
                          </div>
                        </div>
                        <h4 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white truncate pr-4">{e.title}</h4>
                        {e.description && (
                           <p className="text-[14px] font-bold text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 max-w-2xl">{e.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0 w-full md:w-auto shrink-0 justify-start md:justify-end">
                      {e.assignedTo && typeof e.assignedTo === 'string' && (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700">
                           <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 text-[13px] font-semibold shadow-sm">
                             {e.assignedTo.substring(0, 2).toUpperCase()}
                           </div>
                           <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                             {e.assignedTo.split(',')[0]}
                           </span>
                        </div>
                      )}
                      
                      {e.status && (
                        <span className={`text-[13px] font-semibold px-4 py-2 rounded-full whitespace-nowrap shadow-sm border border-transparent
                          ${e.status.toLowerCase().includes('pending') ? 'bg-[#D97706]/10 text-[#D97706] dark:text-[#D97706]' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}
                        `}>
                          Status: {e.status}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Mini Controls for Month/Week (Day has its own) */}
      {view !== 'day' && layout !== 'list' && (
        <div className="flex items-center justify-between mb-2 shrink-0">

           <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
             {format(currentDate, "MMMM yyyy")}
           </h2>
           <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm">
            <button onClick={prevDate} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><ChevronLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-[14px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Today</button>
            <button onClick={nextDate} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><ChevronRightIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${view}-${layout}-${currentDate.toISOString()}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full overflow-hidden"
        >
          {layout === 'list' ? renderListView() : (
            <>
              {view === 'month' && renderMonthView()}
              {view === 'week' && renderWeekView()}
              {view === 'day' && renderDayView()}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>

  );
}
