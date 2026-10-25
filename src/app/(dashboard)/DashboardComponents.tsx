"use client";

import { 
  UsersIcon, 
  UserMinusIcon, 
  MapPinIcon, 
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  CakeIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
  XMarkIcon,
  HeartIcon,
  ComputerDesktopIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import SemiCircleGauge from "@/components/SemiCircleGauge";
import { useState, useEffect, type ComponentType } from "react";
import useSWR from "swr";
import type { AssetItem } from "@/types/asset";

const assetFetcher = (url: string) => fetch(url).then((res) => res.json());

// --- ROW 1 COMPONENTS ---

export function CompactWelcome({ firstName, role }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2563EB] to-[#011a35] p-5 text-white shadow-xl min-h-[140px] flex flex-col justify-center border-b-4 border-[#2563EB]/20"
    >
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#2563EB]/10 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-[#2563EB] text-white px-2 py-0.5 rounded-full text-[12px] font-semibold flex items-center gap-1">
            <SparklesIcon className="w-2 h-2" /> System Active
          </span>
          <span className="text-[12px] font-bold text-blue-200/60">Robotek ERP</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tighter leading-none mb-1">
          WELCOME,<br/>
          <span className="text-[#2563EB]">{firstName}</span>
        </h1>
        <p className="text-[13px] font-extrabold text-[#2563EB] opacity-80 mt-1">{role} MODE</p>
      </div>
    </motion.div>
  );
}

export function CompactScore({ score, total, label, isNegative = false }: any) {
    // If negative, display = score - 100
    const displayValue = isNegative ? score - 100 : score;
    
    return (
        <div className="bg-white dark:bg-navy-800 p-2 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center justify-center min-h-[140px] overflow-hidden">
            <p className="text-[13px] font-semibold text-[#5B6472] mb-1 text-center whitespace-nowrap">{label}</p>
            <div className="w-full h-24 mt-[-10px]">
                <SemiCircleGauge value={score} isNegative={isNegative} total={total} label="" />
            </div>
            {/* Override the display value if needed, but SemiCircleGauge handles it now */}
        </div>
    );
}

export function CompactOccasionCard({ birthdays = [], anniversaries = [] }: any) {
  const [showAll, setShowAll] = useState(false);
  const totalCount = (birthdays?.length || 0) + (anniversaries?.length || 0);

  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-4 rounded-[2rem] shadow-lg border border-white/10 relative overflow-hidden h-full flex flex-col justify-center text-white min-h-[140px]">
      <div className="absolute top-0 right-0 p-2 opacity-10 transform rotate-12 scale-125">
        <CakeIcon className="w-16 h-16" />
      </div>
      <div className="relative z-10">
        <p className="text-[12px] font-semibold text-white/50 mb-3">Today's Occasions</p>
        
        {totalCount > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-3 overflow-hidden cursor-pointer" onClick={() => setShowAll(true)}>
              {[...(birthdays || []), ...(anniversaries || [])].slice(0, 3).map((b: any, i: number) => (
                <div key={i} className="inline-block h-10 w-10 rounded-full ring-2 ring-white/20 bg-indigo-500 flex items-center justify-center text-sm font-semibold overflow-hidden bg-cover bg-center" style={b.image ? {backgroundImage: `url(${b.image})`} : {}}>
                  {!b.image && b.username.charAt(0)}
                </div>
              ))}
              {totalCount > 3 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-gray-800 text-[13px] font-semibold text-white">
                  +{totalCount - 3}
                </div>
              )}
            </div>
            <button onClick={() => setShowAll(true)} className="text-[12px] font-semibold text-[#2563EB] hover:underline animate-pulse">Celebration List ({totalCount})</button>
          </div>
        ) : (
          <p className="text-[13px] font-bold text-white/70">No occasions today</p>
        )}
      </div>

      <AnimatePresence>
        {showAll && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAll(false)}
          >
            <motion.div 
                className="bg-white dark:bg-navy-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-white/5"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-8 h-8 animate-bounce" />
                        <h3 className="text-xl font-semibold tracking-tighter">Celebrants Today!</h3>
                    </div>
                    <button onClick={() => setShowAll(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
                    {birthdays.map((b: any, i: number) => (
                        <div key={`b-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl font-semibold overflow-hidden bg-cover bg-center ring-4 ring-[#2563EB]/20" style={b.image ? {backgroundImage: `url(${b.image})`} : {}}>
                                {!b.image && b.username.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white leading-none">{b.username}</p>
                                <p className="text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mt-1">{b.role}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="p-2 bg-pink-50 dark:bg-pink-950/30 text-pink-500 rounded-full flex items-center justify-center" title="Birthday">🎂</span>
                            </div>
                        </div>
                    ))}
                    {anniversaries.map((b: any, i: number) => (
                        <div key={`a-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center text-white text-xl font-semibold overflow-hidden bg-cover bg-center ring-4 ring-[#2563EB]/20" style={b.image ? {backgroundImage: `url(${b.image})`} : {}}>
                                {!b.image && b.username.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white leading-none">{b.username}</p>
                                <p className="text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mt-1">{b.role}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center" title="Work Anniversary">💍</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-navy-950/50 text-center border-t border-gray-100 dark:border-white/5">
                   <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] animate-pulse">Team Robotek Wishes You A Great Day!</p>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CompactPartyCelebrationCard({ partyBirthdays = [], partyAnniversaries = [] }: any) {
  const [showAll, setShowAll] = useState(false);
  const totalCount = (partyBirthdays?.length || 0) + (partyAnniversaries?.length || 0);

  return (
    <div className="bg-[#2563EB] p-4 rounded-[2rem] shadow-lg border border-white/10 relative overflow-hidden h-full flex flex-col justify-center text-white min-h-[140px]">
      <div className="absolute top-0 right-0 p-2 opacity-10 transform -rotate-12 scale-125">
        <SparklesIcon className="w-16 h-16" />
      </div>
      <div className="relative z-10">
        <p className="text-[12px] font-semibold text-white/50 mb-3">Party Celebrations</p>
        
        {totalCount > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-3 overflow-hidden cursor-pointer" onClick={() => setShowAll(true)}>
              {[...(partyBirthdays || []), ...(partyAnniversaries || [])].slice(0, 3).map((b: any, i: number) => (
                <div key={i} className={`inline-block h-10 w-10 rounded-full ring-2 ring-white/20 flex items-center justify-center text-sm font-semibold overflow-hidden bg-cover bg-center text-white ${partyAnniversaries.some((pa: any) => pa.partyName === b.partyName) ? 'bg-rose-400' : 'bg-[#FEF3C7]'}`}>
                  {b.partyName.charAt(0)}
                </div>
              ))}
              {totalCount > 3 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-gray-800 text-[13px] font-semibold text-white">
                  +{totalCount - 3}
                </div>
              )}
            </div>
            <button onClick={() => setShowAll(true)} className="text-[12px] font-semibold text-[#2563EB] hover:underline animate-pulse">Celebration List ({totalCount})</button>
          </div>
        ) : (
          <p className="text-[13px] font-bold text-white/70">No occasions today</p>
        )}
      </div>

      <AnimatePresence>
        {showAll && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAll(false)}
          >
            <motion.div 
                className="bg-white dark:bg-navy-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-white/5"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-[#2563EB] p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-8 h-8 animate-bounce" />
                        <h3 className="text-xl font-semibold tracking-tighter">Party Celebrants!</h3>
                    </div>
                    <button onClick={() => setShowAll(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
                    {partyBirthdays.map((b: any, i: number) => (
                        <div key={`pb-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-white text-xl font-semibold overflow-hidden bg-cover bg-center ring-4 ring-[#2563EB]/20">
                                {b.partyName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white leading-none">{b.partyName}</p>
                                <p className="text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mt-1">{b.partyType}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-full flex items-center justify-center" title="Party Birthday">🎂</span>
                            </div>
                        </div>
                    ))}
                    {partyAnniversaries.map((b: any, i: number) => (
                        <div key={`pa-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-rose-400 flex items-center justify-center text-white text-xl font-semibold overflow-hidden bg-cover bg-center ring-4 ring-[#2563EB]/20">
                                {b.partyName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white leading-none">{b.partyName}</p>
                                <p className="text-[13px] font-semibold text-[#5B6472] dark:text-gray-500 mt-1">{b.partyType}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center" title="Party Anniversary">💍</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-navy-950/50 text-center border-t border-gray-100 dark:border-white/5">
                   <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] animate-pulse">Team Robotek Wishes A Happy Day!</p>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- ROW 2 COMPONENTS ---

export function StatusTile({ label, value, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-white dark:bg-navy-800 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all h-[90px]">
            <div>
                <p className="text-[12px] font-semibold text-[#5B6472] mb-0.5">{label}</p>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tighter">{value}</h3>
            </div>
            <div className={`${bg} ${color} p-2 rounded-xl group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
}

export function QuickActionSquare({ label, href, icon: Icon, color }: any) {
    return (
        <Link href={href} className="group flex flex-col items-center justify-center bg-white dark:bg-navy-800 p-3 rounded-[1.5rem] border border-gray-100 dark:border-white/5 hover:border-[#2563EB] dark:hover:border-[#60A5FA] transition-all hover:shadow-md h-[90px]">
            <div className={`${color} p-2.5 rounded-xl text-white mb-1.5 group-hover:scale-110 transition-transform shadow-lg`}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight text-center leading-none">{label}</span>
        </Link>
    );
}

export function HighightedCalendar({ history, leaveDates = [], avgIn, avgOut }: { history: any[], leaveDates?: string[], avgIn: string, avgOut: string }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();

  const normalizeDate = (dStr: string) => {
    if (!dStr) return '';
    return dStr.split('T')[0];
  };

  const todayStr = today.toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-navy-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm h-[302px] flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div>
                <h3 className="text-[13px] font-semibold text-[#5B6472] mb-1">Personal Presence</h3>
                <span className="text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">{today.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1 gap-x-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="flex justify-center items-center h-7 w-7 text-[13px] font-semibold text-[#5B6472]">{d}</div>
            ))}
            {Array.from({ length: 42 }).map((_, i) => {
              const day = i - startDay + 1;
              const isCurrentMonth = day > 0 && day <= daysInMonth;
              if (!isCurrentMonth) return <div key={i} className="h-7 w-7" />;
              
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = history?.find(h => normalizeDate(h.date) === dateStr);
              const isOnLeave = leaveDates.includes(dateStr);
              const isToday = dateStr === todayStr;
              
              let bgColor = 'hover:bg-gray-100 dark:hover:bg-white/5';
              let textColor = 'text-gray-600 dark:text-gray-400';
              
              if (record?.inTime) {
                bgColor = 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105';
                textColor = 'text-white';
              } else if (isOnLeave) {
                bgColor = 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-110';
                textColor = 'text-white';
              } else if (dateStr < todayStr && (new Date(dateStr).getDay() !== 0)) {
                bgColor = 'bg-rose-500/80 text-white';
                textColor = 'text-white';
              }

              if (isToday && !record?.inTime && !isOnLeave) {
                 bgColor = 'border-2 border-[#2563EB] dark:border-[#60A5FA] text-[#2563EB] dark:text-[#60A5FA]';
              }

              return (
                <div key={i} className="flex justify-center items-center h-7 w-7">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[13px] font-semibold transition-all ${bgColor} ${textColor}`}>
                      {day}
                    </div>
                </div>
              );
            })}
          </div>
      </div>

      <div className="lg:w-32 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-white/5 pt-4 lg:pt-0 lg:pl-6 space-y-4">
            <div className="text-center lg:text-left">
                <p className="text-[12px] font-semibold text-[#5B6472] mb-1 opacity-60">Success Rates</p>
                <div>
                   <p className="text-[12px] font-semibold text-emerald-500 mb-0.5">Avg In</p>
                   <p className="text-lg font-semibold text-emerald-500 tracking-tighter leading-none">{avgIn || '--:--'}</p>
                </div>
            </div>
            <div className="text-center lg:text-left">
                <div>
                   <p className="text-[12px] font-semibold text-rose-500 mb-0.5">Avg Out</p>
                   <p className="text-lg font-semibold text-rose-500 tracking-tighter leading-none">{avgOut || '--:--'}</p>
                </div>
            </div>
            <div className="flex gap-2 justify-center lg:justify-start pt-2 border-t border-gray-50 dark:border-white/5">
                <div className="flex items-center gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   <span className="text-[6px] font-bold text-[#5B6472]">Work</span>
                </div>
                <div className="flex items-center gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                   <span className="text-[6px] font-bold text-[#5B6472]">Leave</span>
                </div>
            </div>
      </div>
    </div>
  );
}

// --- ROW 3 COMPONENTS ---

export function UserAssetsPanel({ username }: { username?: string }) {
    const { data: assets, isLoading } = useSWR<AssetItem[]>(
        username ? "/api/assets" : null,
        assetFetcher,
        { refreshInterval: 300000 }
    );

    const myAssets = (assets || []).filter(
        (a) => (a.assigned_to || "").trim().toLowerCase() === (username || "").trim().toLowerCase()
    );

    return (
        <CompactTable
            title="My Assets"
            icon={ComputerDesktopIcon}
            headerTheme="blue"
            heightClass="h-[302px]"
            emptyLabel={isLoading || !username ? "Loading Assets..." : "No Assets Assigned"}
            data={isLoading || !username ? [] : myAssets}
            linkHref="/asset-management"
            columns={[
                {
                    label: "Asset",
                    key: "asset_name",
                    render: (row: AssetItem) => (
                        <div className="flex flex-col">
                            <span className="block font-semibold text-gray-900 dark:text-white leading-tight text-[14px] break-words">
                                {row.asset_name || "Unnamed Asset"}
                            </span>
                            <span className="text-[13px] text-[#5B6472] font-mono italic mt-0.5">
                                {row.asset_id || "—"}
                            </span>
                        </div>
                    ),
                },
                {
                    label: "Category",
                    key: "category",
                    render: (row: AssetItem) => (
                        <span className="text-[14px] font-bold text-gray-600 dark:text-gray-300">
                            {row.category || "—"}
                        </span>
                    ),
                },
                {
                    label: "Status",
                    key: "status",
                    className: "text-right",
                    render: (row: AssetItem) => (
                        <span
                            className={`px-2 py-0.5 rounded-full text-[13px]  font-semibold ${
                                row.status === "Available"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : row.status === "In Use"
                                    ? "bg-[#2563EB]/10 text-white dark:bg-blue-500/10 dark:text-blue-400"
                                    : row.status === "Maintenance"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-gray-500/10 text-gray-500"
                            }`}
                        >
                            {row.status || "—"}
                        </span>
                    ),
                },
            ]}
        />
    );
}

// --- ROW 4 COMPONENTS ---

const COMPACT_TABLE_THEMES = {
  emerald: {
    cardHeader:
      "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 border-emerald-400/40 shadow-inner",
    thead: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500",
    thText: "text-white drop-shadow-sm",
    rowBorder: "border-white/25",
    icon: "text-white",
    title: "text-white drop-shadow-sm",
    link: "text-white/70",
    linkHover: "hover:text-white",
  },
  blue: {
    cardHeader:
      "bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0066cc] border-[#2563EB]/30 shadow-inner",
    thead: "bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0055aa]",
    thText: "text-[#2563EB] drop-shadow-sm",
    rowBorder: "border-[#2563EB]/25",
    icon: "text-[#2563EB]",
    title: "text-white drop-shadow-sm",
    link: "text-white/60",
    linkHover: "hover:text-[#2563EB]",
  },
  amber: {
    cardHeader:
      "bg-gradient-to-r from-amber-500 via-[#F7F8FA] to-rose-500 border-[#E5E7EB] shadow-inner",
    thead: "bg-gradient-to-r from-amber-400 via-[#F7F8FA] to-[#F7F8FA]",
    thText: "text-white drop-shadow-sm",
    rowBorder: "border-white/25",
    icon: "text-white",
    title: "text-white drop-shadow-sm",
    link: "text-white/70",
    linkHover: "hover:text-white",
  },
} as const;

type CompactTableTheme = keyof typeof COMPACT_TABLE_THEMES;

export function CompactTable({
  title,
  icon: Icon,
  data = [],
  columns,
  linkHref,
  headerTheme = "blue",
  heightClass = "h-[340px]",
  emptyLabel = "Synchronization Pending...",
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  data?: any[];
  columns: any[];
  linkHref?: string;
  headerTheme?: CompactTableTheme;
  heightClass?: string;
  emptyLabel?: string;
}) {
    const theme = COMPACT_TABLE_THEMES[headerTheme];
    const rows = data ?? [];

    return (
      <div className={`bg-white dark:bg-navy-800 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-lg overflow-hidden flex flex-col ${heightClass}`}>
            <div className={`p-4 border-b flex items-center justify-between ${theme.cardHeader}`}>
                <h3 className={`text-sm font-semibold   flex items-center gap-2 ${theme.title}`}>
                    <Icon className={`w-5 h-5 ${theme.icon}`} />
                    {title}
                </h3>
                {linkHref && (
                    <Link href={linkHref} className={`text-[14px] font-semibold   transition-colors ${theme.link} ${theme.linkHover}`}>Master View</Link>
                )}
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                <table className="w-full text-left">
                    <thead className={`sticky top-0 z-10 shadow-sm ${theme.thead}`}>
                        <tr className={`border-b ${theme.rowBorder}`}>
                            {columns.map((col: any, i: number) => (
                                <th key={i} className={`px-3 py-3.5 text-[14px] font-semibold  tracking-wider ${theme.thText} ${col.className || ""}`}>{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="p-8 text-center text-[14px] font-bold text-[#5B6472] italic">{emptyLabel}</td>
                            </tr>
                        ) : rows.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/1 transition-colors group">
                            {columns.map((col: any, j: number) => (
                              <td key={j} className={`p-4 align-top text-[14px] font-bold text-gray-700 dark:text-gray-300 whitespace-normal ${col.className}`}>
                                {col.render ? col.render(row) : row[col.key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// --- ROW 4 COMPONENTS (MODALS & OVERLAYS) ---

export function BirthdayCelebrationModal({ birthdays = [], anniversaries = [], partyBirthdays = [], partyAnniversaries = [], currentUser }: { birthdays?: any[], anniversaries?: any[], partyBirthdays?: any[], partyAnniversaries?: any[], currentUser: string }) {
  const [show, setShow] = useState(false);

  const allCelebrants = [
    ...(birthdays || []).map((b: any) => ({ ...b, type: 'user', subType: 'birthday' })),
    ...(anniversaries || []).map((a: any) => ({ ...a, type: 'user', subType: 'anniversary' })),
    ...(partyBirthdays || []).map((p: any) => ({ username: p.partyName, role: p.partyType, image: null, type: 'party', subType: 'birthday' })),
    ...(partyAnniversaries || []).map((p: any) => ({ username: p.partyName, role: p.partyType, image: null, type: 'party', subType: 'anniversary' }))
  ];

  useEffect(() => {
    if (allCelebrants.length > 0) {
      setShow(true);
    }
  }, [birthdays, anniversaries, partyBirthdays, partyAnniversaries]);

  const handleClose = () => {
    setShow(false);
  };

  const isMyBirthday = birthdays?.some((b: any) => b.username === currentUser);
  const isMyAnniversary = anniversaries?.some((a: any) => a.username === currentUser);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
           onClick={handleClose}
        >
           {/* Bottom Screen Firecrackers */}
           <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
              {[...Array(35)].map((_, i) => {
                  const startX = `${Math.random() * 120 - 60}vw`;
                  const peakY = `-${Math.random() * 30 + 10}vh`;
                  const endX = `${Math.random() * 120 - 60}vw`;
                  return (
                    <motion.div 
                      key={i}
                      initial={{ y: "110vh", x: startX, scale: Math.random() * 0.6 + 0.4 }}
                      animate={{ 
                         y: ["110vh", peakY, "110vh"], 
                         x: [startX, endX, endX],
                         rotate: [0, Math.random() * 1080 - 540] 
                      }}
                      transition={{ 
                         duration: 3.5 + Math.random() * 3, 
                         ease: "easeOut", 
                         delay: Math.random() * 1.5, 
                         repeat: Infinity, 
                         repeatDelay: Math.random() * 2 
                      }}
                      className="absolute bottom-0 text-5xl md:text-7xl select-none"
                    >
                      {["🎈", "🎊", "🎉", "✨", "💥", "🥳", "🙌", "👏"][Math.floor(Math.random() * 8)]}
                    </motion.div>
                  );
              })}
           </div>

           <motion.div
             initial={{ scale: 0.5, y: 50, opacity: 0 }}
             animate={{ scale: 1, y: 0, opacity: 1 }}
             exit={{ scale: 0.8, y: 20, opacity: 0 }}
             transition={{ type: "spring", damping: 15, stiffness: 100 }}
             onClick={e => e.stopPropagation()}
             className="relative bg-transparent p-4 md:p-8 max-w-4xl w-full text-center flex flex-col items-center z-10 max-h-[95vh] overflow-y-auto invisible-scrollbar"
           >
              <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-6 mt-2">
                 {allCelebrants.map((b, i) => (
                    <motion.div 
                      key={i} 
                      className="flex flex-col items-center group relative"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                    >
                       <div className="absolute inset-0 bg-[#2563EB] blur-3xl opacity-20 rounded-full"></div>
                       {/* Avatar: orange tint for party, indigo for users, rose for anniversary */}
                       <div 
                         className={`w-24 h-24 md:w-36 md:h-36 rounded-full border-[3px] border-[#2563EB] shadow-[0_0_40px_rgba(255,213,0,0.4)] flex items-center justify-center text-white text-4xl md:text-5xl font-semibold overflow-hidden bg-cover bg-center z-10 ${b.type === 'party' ? 'bg-[#D97706]' : (b.subType === 'anniversary' ? 'bg-rose-500' : 'bg-indigo-500')}`}
                         style={b.image ? {backgroundImage: `url(${b.image})`} : {}}
                       >
                            {!b.image && b.username.charAt(0)}
                       </div>
                       <div className="mt-3 text-[14px] md:text-sm font-semibold text-[#2563EB] px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full shadow-xl border border-[#2563EB]/30 z-10 w-full truncate max-w-[140px]">
                           {b.username}
                       </div>
                       {/* Badge */}
                       <div className={`mt-1 text-[12px] font-semibold   px-2 py-0.5 rounded-full border ${
                         b.type === 'party' 
                           ? 'text-[#D97706] bg-[#D97706]/20 border-[#E5E7EB]' 
                           : (b.subType === 'anniversary' 
                               ? 'text-rose-300 bg-rose-500/20 border-rose-400/30' 
                               : 'text-indigo-300 bg-indigo-500/20 border-indigo-400/30')
                       }`}>
                         {b.type === 'party' ? 'Party 🎉' : (b.subType === 'anniversary' ? 'Anniversary 💍' : 'Birthday 🎂')}
                       </div>
                    </motion.div>
                 ))}
              </div>

              <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tighter mb-3 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] whitespace-pre-line leading-tight">
                 {isMyBirthday || isMyAnniversary
                    ? (allCelebrants.length > 1 ? `CONGRATULATIONS,\n${currentUser} & TEAM!` : `CONGRATULATIONS,\n${currentUser}!`)
                    : "LET'S CELEBRATE! 🎉"}
              </h2>
              
              <p className="text-[#2563EB] font-semibold text-sm md:text-xl mb-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed max-w-lg mx-auto px-4 whitespace-pre-line">
                 {isMyBirthday || isMyAnniversary
                   ? (allCelebrants.length > 1 
                      ? "Wishing you an amazing day ahead! 🎈💥\n\nAlso, don't forget to wish the other celebrants a great day too! ✨🎊" 
                      : "Wishing you an amazing day ahead from the entire Robotek Team! 🎈💥")
                   : `It's time to wish ${allCelebrants.length} celebrant${allCelebrants.length > 1 ? 's' : ''} a very happy day today! ✨🎊`}
              </p>

              <button 
                onClick={handleClose}
                className="px-12 py-5 bg-[#2563EB] text-white rounded-full font-semibold text-sm md:text-base hover:scale-110 transition-all shadow-[0_0_30px_rgba(255,213,0,0.4)] hover:shadow-[0_0_50px_rgba(255,213,0,0.6)] relative z-10 active:scale-95 border-2 border-transparent hover:border-white"
              >
                Let's Go!
              </button>
           </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


