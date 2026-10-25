"use client";

import { motion } from "framer-motion";
import { 
  BellIcon, 
  ClockIcon, 
  ExclamationCircleIcon,
  CheckCircleIcon,
  MapPinIcon,
  VideoCameraIcon
} from "@heroicons/react/24/outline";
import { CalendarEvent } from "@/types/calendar";
import { format } from "date-fns";

interface RecentActivityProps {
  activities: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export default function RecentActivity({ activities, onEventClick }: RecentActivityProps) {
  const now = new Date();
  
  const getBadgeColor = (type: string) => {
    switch (type) {
      case "delegation": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30";
      case "checklist": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30";
      case "ticket": return "bg-[#D97706]/10 text-[#D97706] dark:text-[#D97706] border-[#E5E7EB] dark:border-[#E5E7EB]";
      case "o2d": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30";
      case "meeting": return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30";
      default: return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-900/30";
    }
  };

  const isOverdue = (date: Date, status?: string) => {
    if (['Completed', 'Closed', 'Approved', 'Done', 'Yes'].includes(status || "")) return false;
    return date < now;
  };

  return (
    <div 
      style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
      className="rounded-[2.5rem] border shadow-sm p-6 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#D97706]/10 flex items-center justify-center">
            <BellIcon className="w-5 h-5 text-[#D97706]" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-[13px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
          Today & Tomorrow
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 invisible-scrollbar">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#5B6472] dark:text-slate-600">
            <CheckCircleIcon className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm font-bold">No pending activities</p>
          </div>
        ) : (
          activities.slice(0, 10).map((activity, idx) => {
            const overdue = isOverdue(activity.start, activity.status);
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onEventClick(activity)}
                className={`
                  p-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.98]
                  ${overdue 
                    ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/20 hover:border-rose-300 dark:hover:border-rose-800 shadow-sm' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/30' }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[13px] font-semibold px-1.5 py-0.5 rounded border ${getBadgeColor(activity.type)}  tracking-tighter`}>
                          {activity.type}
                        </span>
                        {overdue && (
                          <span className="flex items-center gap-0.5 text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                            <ExclamationCircleIcon className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">
                      {activity.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 items-center text-[13px] font-bold text-slate-500 dark:text-slate-400">
                      {activity.link && (
                        <div className="flex items-center gap-0.5 text-blue-500">
                          <VideoCameraIcon className="w-3 h-3" /> Link
                        </div>
                      )}
                      {activity.assignedTo && typeof activity.assignedTo === 'string' && (
                        <div className="flex items-center gap-0.5">
                          <MapPinIcon className="w-3 h-3" /> {activity.assignedTo.split(',')[0]}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Date/Time */}
                  <div className="shrink-0 flex flex-col items-end gap-0.5 pl-3 border-l border-slate-200 dark:border-slate-800">
                    <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      {format(activity.start, "MMM dd")}
                    </div>
                    <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <ClockIcon className="w-3 h-3 text-blue-500" />
                      {format(activity.start, "hh:mm a")}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
        <button className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2">
          View full summary
        </button>
      </div>
    </div>
  );
}
