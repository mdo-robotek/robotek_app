'use client';

import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { FieldCard } from '../FieldCard';
import type { FieldDriverRecord } from '../../types/field-driver';
export default function TodayRecord({ todayRecord }: { todayRecord: FieldDriverRecord | null }) {
  const today = new Date();
  const dateLabel = `${today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} (${today.toLocaleDateString('en-GB', { weekday: 'short' })})`;

  const checkIns = todayRecord?.inTime ? 1 : 0;
  const checkOuts = todayRecord?.outTime ? 1 : 0;
  const km =
    todayRecord?.totalKm && parseFloat(todayRecord.totalKm) > 0
      ? parseFloat(todayRecord.totalKm).toFixed(1)
      : '0';

  return (
    <FieldCard
      title="Today's Record"
      compact
      icon={<CalendarDaysIcon className="w-3.5 h-3.5 text-[#062B6F] dark:text-[#FFD500]" />}
      headerRight={
        <span className="text-[9px] font-bold text-gray-400">{dateLabel}</span>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20">
          <p className="text-xl font-black text-green-600">{checkIns}</p>
          <p className="text-[9px] font-black uppercase text-gray-500 mt-0.5">Check-in</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
          <p className="text-xl font-black text-blue-600">{checkOuts}</p>
          <p className="text-[9px] font-black uppercase text-gray-500 mt-0.5">Check-out</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-pink-50 dark:bg-pink-500/10 border border-pink-100 dark:border-pink-500/20">
          <p className="text-xl font-black text-pink-600">{km}</p>
          <p className="text-[9px] font-black uppercase text-gray-500 mt-0.5">km</p>
        </div>
      </div>
    </FieldCard>
  );
}
