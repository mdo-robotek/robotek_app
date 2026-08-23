'use client';

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { FieldCard } from '../FieldCard';

const LEGEND = [
  { color: 'bg-green-500', label: 'CHECKED_IN', desc: 'Journey in progress' },
  { color: 'bg-blue-500', label: 'IDLE', desc: 'Ready for check-in' },
  { color: 'bg-gray-400', label: 'COMPLETED', desc: 'Journey finished' },
];

export default function StatusLegend() {
  return (
    <FieldCard title="Status Legend" compact>
      <div className="space-y-3">
        {LEGEND.map(({ color, label, desc }) => (
          <div key={label} className="flex items-start gap-2">
            <span className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${color}`} />
            <div>
              <p className="text-xs font-black uppercase text-gray-800 dark:text-white">{label}</p>
              <p className="text-[10px] text-gray-500">{desc}</p>
            </div>
          </div>
        ))}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 flex items-center gap-2 text-green-600">
          <CheckCircleIcon className="w-4 h-4" />
          <span className="text-[10px] font-bold">All data synced in real-time</span>
        </div>
      </div>
    </FieldCard>
  );
}
