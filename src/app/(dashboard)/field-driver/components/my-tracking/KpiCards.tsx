'use client';

import {
  SignalIcon,
  ClockIcon,
  MapIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import type { FieldDriverRecord, FieldStatus } from '../../types/field-driver';

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof SignalIcon;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-white/10 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className={`p-2 rounded-xl ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-3">{label}</p>
      <p className="text-xl font-black text-[#062B6F] dark:text-white mt-1 font-mono">{value}</p>
      {sub && <p className="text-[10px] font-bold text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function KpiCards({
  currentStatus,
  elapsedTime,
  todayRecord,
}: {
  currentStatus: FieldStatus;
  elapsedTime: string;
  todayRecord: FieldDriverRecord | null;
}) {
  const distance =
    todayRecord?.totalKm && parseFloat(todayRecord.totalKm) > 0
      ? `${parseFloat(todayRecord.totalKm).toFixed(1)} KM`
      : '0 KM';

  const checkIns = todayRecord?.inTime ? 1 : 0;
  const checkOuts = todayRecord?.outTime ? 1 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={SignalIcon}
        label="Current Status"
        value={currentStatus.replace('_', ' ')}
        accent="bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
      />
      <KpiCard
        icon={ClockIcon}
        label="Live Timer"
        value={elapsedTime}
        sub="HH:MM:SS"
        accent="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
      />
      <KpiCard
        icon={MapIcon}
        label="Today's Distance"
        value={distance}
        accent="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
      />
      <KpiCard
        icon={CalendarDaysIcon}
        label="Today's Record"
        value={`${checkIns} In / ${checkOuts} Out`}
        sub={distance}
        accent="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
      />
    </div>
  );
}
