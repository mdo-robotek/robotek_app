'use client';

import type { ReactNode } from 'react';
import { CheckCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { FieldCard } from '../FieldCard';
import type { ActivityEvent } from '../../types/field-driver';

const ICONS: Record<ActivityEvent['type'], ReactNode> = {
  check_in: <CheckCircleIcon className="w-4 h-4 text-green-500" />,
  live_location: <MapPinIcon className="w-4 h-4 text-blue-500" />,
  journey_started: <span className="w-4 h-4 rounded-full border-2 border-gray-400 block" />,
  check_out: <CheckCircleIcon className="w-4 h-4 text-red-500" />,
};

export default function RecentActivity({
  events,
  className = '',
}: {
  events: ActivityEvent[];
  className?: string;
}) {
  return (
    <FieldCard
      title="Recent Activity"
      compact
      icon={<span className="text-sm">📋</span>}
      className={className}
      headerRight={
        events.length > 0 ? (
          <button type="button" className="text-[10px] font-black uppercase text-[#2563EB] hover:underline">
            View All
          </button>
        ) : undefined
      }
    >
      {events.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No activity yet today</p>
      ) : (
        <div className="space-y-0">
          {events.map((ev, i) => (
            <div key={ev.id} className="flex gap-2 relative pb-3 last:pb-0">
              {i < events.length - 1 && (
                <div className="absolute left-[7px] top-6 bottom-0 w-px bg-gray-200 dark:bg-white/10" />
              )}
              <div className="shrink-0 mt-0.5 z-10 bg-white dark:bg-slate-900">{ICONS[ev.type]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{ev.title}</p>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">{ev.time}</p>
                {ev.detail && (
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{ev.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </FieldCard>
  );
}
