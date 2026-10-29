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
import { useState, useEffect, type ComponentType } from "react";
import useSWR from "swr";
import type { AssetItem } from "@/types/asset";

const assetFetcher = (url: string) => fetch(url).then((res) => res.json());

// --- ROW 1 COMPONENTS ---

export function CompactWelcome({ firstName, role }: any) {
  // Calm card (Oct 26): was a dark blue gradient with the name in blue on
  // blue (unreadable), "SYSTEM ACTIVE" and "USER MODE".
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const r = String(role || "").toLowerCase();
  return (
    <div className="rounded-2xl bg-white dark:bg-navy-800 border border-[#E5E7EB] dark:border-white/5 p-5 min-h-[140px] flex flex-col justify-center">
      <p className="text-[14px] font-semibold text-[#5B6472] dark:text-gray-400">My day</p>
      <h1 className="mt-1 text-[22px] leading-tight font-semibold text-[#1A1D21] dark:text-white truncate">{firstName}</h1>
      <p suppressHydrationWarning className="mt-1 text-[14px] text-[#5B6472] dark:text-gray-400">{today}</p>
      {r && <p className="mt-0.5 text-[13px] text-[#5B6472] dark:text-gray-400 capitalize">{r}</p>}
    </div>
  );
}

export function CompactScore({ score, total, label, isNegative = false }: any) {
    // Plain number (Oct 26) instead of the rainbow gauge. Same value the
    // gauge showed: for "gap" scores, 0% is the target and below 0 is a miss.
    // Same rule as the old gauge: no tasks at all shows 0.
    const n = Number(score);
    const value = total === 0 || !Number.isFinite(n) ? 0 : Math.round(isNegative ? n - 100 : n);
    const tone = !isNegative ? "bg-transparent" : value >= 0 ? "bg-[#15803D]" : value >= -10 ? "bg-[#D97706]" : "bg-[#DC2626]";
    return (
        <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-[#E5E7EB] dark:border-white/5 flex flex-col justify-center min-h-[140px]">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[#5B6472] dark:text-gray-400">
                <span className={`w-2 h-2 rounded-full ${tone}`} />{label}
            </p>
            <p className="mt-1 text-[32px] leading-none font-semibold text-[#1A1D21] dark:text-white">{value < 0 ? `−${Math.abs(value)}` : value}%</p>
            {isNegative && <p className="mt-1.5 text-[13px] text-[#5B6472] dark:text-gray-400">Target 0%</p>}
        </div>
    );
}

export function CompactOccasionCard({ birthdays = [], anniversaries = [] }: any) {
  const [showAll, setShowAll] = useState(false);
  const totalCount = (birthdays?.length || 0) + (anniversaries?.length || 0);

  return (
    <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-[#E5E7EB] dark:border-white/5 relative h-full flex flex-col justify-center min-h-[140px]">
      <div>
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[#5B6472] dark:text-gray-400 mb-3">
          <span className="w-8 h-8 rounded-lg bg-[#EFF4FF] dark:bg-[#60A5FA]/10 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center"><CakeIcon className="w-4 h-4" /></span>
          Team occasions today
        </p>
        
        {totalCount > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-3 overflow-hidden cursor-pointer" onClick={() => setShowAll(true)}>
              {[...(birthdays || []), ...(anniversaries || [])].slice(0, 3).map((b: any, i: number) => (
                <div key={i} className="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-navy-800 bg-indigo-500 flex items-center justify-center text-sm font-semibold overflow-hidden bg-cover bg-center" style={b.image ? {backgroundImage: `url(${b.image})`} : {}}>
                  {!b.image && b.username.charAt(0)}
                </div>
              ))}
              {totalCount > 3 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-gray-800 text-[13px] font-semibold text-white">
                  +{totalCount - 3}
                </div>
              )}
            </div>
            <button onClick={() => setShowAll(true)} className="min-h-[36px] text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline">See all ({totalCount})</button>
          </div>
        ) : (
          <p className="text-[15px] text-[#1A1D21] dark:text-white">None today</p>
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
                className="bg-white dark:bg-navy-800 rounded-2xl w-full max-w-sm overflow-hidden border border-[#E5E7EB] dark:border-white/5"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-white dark:bg-navy-800 p-5 flex justify-between items-center text-[#1A1D21] dark:text-white border-b border-[#E5E7EB] dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-[#2563EB]" />
                        <h3 className="text-[18px] font-semibold">Celebrating today</h3>
                    </div>
                    <button onClick={() => setShowAll(false)} aria-label="Close" className="w-11 h-11 flex items-center justify-center hover:bg-[#F7F8FA] dark:hover:bg-white/10 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
                    {birthdays.map((b: any, i: number) => (
                        <div key={`b-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-[#E5E7EB] dark:border-white/5 shadow-sm">
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
                        <div key={`a-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-[#E5E7EB] dark:border-white/5 shadow-sm">
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
                <div className="p-4 bg-gray-50 dark:bg-navy-950/50 text-center border-t border-[#E5E7EB] dark:border-white/5">
                   <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">Team Robotek wishes you a great day!</p>
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
    <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-[#E5E7EB] dark:border-white/5 relative h-full flex flex-col justify-center min-h-[140px]">
      <div>
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[#5B6472] dark:text-gray-400 mb-3">
          <span className="w-8 h-8 rounded-lg bg-[#EFF4FF] dark:bg-[#60A5FA]/10 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center"><SparklesIcon className="w-4 h-4" /></span>
          Party occasions today
        </p>
        
        {totalCount > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-3 overflow-hidden cursor-pointer" onClick={() => setShowAll(true)}>
              {[...(partyBirthdays || []), ...(partyAnniversaries || [])].slice(0, 3).map((b: any, i: number) => (
                <div key={i} className={`inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-navy-800 flex items-center justify-center text-sm font-semibold overflow-hidden bg-cover bg-center text-white ${partyAnniversaries.some((pa: any) => pa.partyName === b.partyName) ? 'bg-rose-400' : 'bg-[#D97706]'}`}>
                  {b.partyName.charAt(0)}
                </div>
              ))}
              {totalCount > 3 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-gray-800 text-[13px] font-semibold text-white">
                  +{totalCount - 3}
                </div>
              )}
            </div>
            <button onClick={() => setShowAll(true)} className="min-h-[36px] text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline">See all ({totalCount})</button>
          </div>
        ) : (
          <p className="text-[15px] text-[#1A1D21] dark:text-white">None today</p>
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
                className="bg-white dark:bg-navy-800 rounded-2xl w-full max-w-sm overflow-hidden border border-[#E5E7EB] dark:border-white/5"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-white dark:bg-navy-800 p-5 flex justify-between items-center text-[#1A1D21] dark:text-white border-b border-[#E5E7EB] dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-[#2563EB]" />
                        <h3 className="text-[18px] font-semibold">Parties celebrating today</h3>
                    </div>
                    <button onClick={() => setShowAll(false)} aria-label="Close" className="w-11 h-11 flex items-center justify-center hover:bg-[#F7F8FA] dark:hover:bg-white/10 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
                    {partyBirthdays.map((b: any, i: number) => (
                        <div key={`pb-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-[#E5E7EB] dark:border-white/5 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-[#D97706] flex items-center justify-center text-white text-xl font-semibold overflow-hidden bg-cover bg-center ring-4 ring-[#2563EB]/20">
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
                        <div key={`pa-${i}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-[#E5E7EB] dark:border-white/5 shadow-sm">
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
                <div className="p-4 bg-gray-50 dark:bg-navy-950/50 text-center border-t border-[#E5E7EB] dark:border-white/5">
                   <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">Team Robotek wishes them a happy day!</p>
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
        <div className="bg-white dark:bg-navy-800 p-4 rounded-2xl border border-[#E5E7EB] dark:border-white/5 shadow-sm flex items-center justify-between group transition-all h-[90px]">
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
        <Link href={href} className="group flex flex-col items-center justify-center bg-white dark:bg-navy-800 p-3 rounded-2xl border border-[#E5E7EB] dark:border-white/5 hover:border-[#2563EB] dark:hover:border-[#60A5FA] transition-all h-[90px]">
            <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#60A5FA]/10 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center mb-1.5" data-color={color}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-[14px] font-semibold text-[#1A1D21] dark:text-white text-center leading-tight">{label}</span>
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
    <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-[#E5E7EB] dark:border-white/5 shadow-sm h-[302px] flex flex-col lg:flex-row gap-6">
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
                bgColor = 'bg-emerald-500 text-white shadow-emerald-500/20 scale-105';
                textColor = 'text-white';
              } else if (isOnLeave) {
                bgColor = 'bg-purple-600 text-white shadow-purple-600/30 scale-110';
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

      <div className="lg:w-32 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-[#E5E7EB] dark:border-white/5 pt-4 lg:pt-0 lg:pl-6 space-y-4">
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
            emptyLabel={isLoading || !username ? "Loading…" : "No assets assigned to you"}
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
                                    ? "bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400"
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

// One calm look for every table card (Oct 26). The old green / blue /
// orange-to-pink gradient headers broke the one-accent rule, and the blue
// theme had blue column titles on a blue bar — unreadable. Theme names are
// kept so existing callers don't change.
const CALM_TABLE_THEME = {
  cardHeader: "bg-white dark:bg-navy-800 border-[#E5E7EB] dark:border-white/5",
  thead: "bg-[#F7F8FA] dark:bg-navy-900",
  thText: "text-[#5B6472] dark:text-gray-400",
  rowBorder: "border-[#E5E7EB] dark:border-white/5",
  icon: "text-[#2563EB] dark:text-[#60A5FA]",
  title: "text-[#1A1D21] dark:text-white",
  link: "text-[#2563EB] dark:text-[#60A5FA]",
  linkHover: "hover:underline",
};
const COMPACT_TABLE_THEMES = {
  emerald: CALM_TABLE_THEME,
  blue: CALM_TABLE_THEME,
  amber: CALM_TABLE_THEME,
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
  emptyLabel = "Nothing here yet",
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
      <div className={`bg-white dark:bg-navy-800 rounded-2xl border border-[#E5E7EB] dark:border-white/5 overflow-hidden flex flex-col ${heightClass}`}>
            <div className={`p-4 border-b flex items-center justify-between ${theme.cardHeader}`}>
                <h3 className={`text-[15px] font-semibold flex items-center gap-2 ${theme.title}`}>
                    <Icon className={`w-5 h-5 ${theme.icon}`} />
                    {title}
                </h3>
                {linkHref && (
                    <Link href={linkHref} className={`text-[14px] font-semibold   transition-colors ${theme.link} ${theme.linkHover}`}>See all</Link>
                )}
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                <table className="w-full text-left">
                    <thead className={`sticky top-0 z-10 ${theme.thead}`}>
                        <tr className={`border-b ${theme.rowBorder}`}>
                            {columns.map((col: any, i: number) => (
                                <th key={i} className={`px-3 py-2.5 text-[13px] font-semibold ${theme.thText} ${col.className || ""}`}>{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="p-8 text-center text-[14px] text-[#5B6472]">{emptyLabel}</td>
                            </tr>
                        ) : rows.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/1 transition-colors group">
                            {columns.map((col: any, j: number) => (
                              <td key={j} className={`px-3 py-3 align-top text-[14px] text-[#1A1D21] dark:text-gray-200 whitespace-normal ${col.className || ""}`}>
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
                       <div className="mt-3 text-[14px] md:text-sm font-semibold text-[#2563EB] px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-[#2563EB]/30 z-10 w-full truncate max-w-[140px]">
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


