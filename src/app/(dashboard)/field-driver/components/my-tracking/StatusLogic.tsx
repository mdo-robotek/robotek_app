'use client';

import { FieldCard } from '../FieldCard';

const STEPS = [
  { status: 'IDLE', desc: 'Can Check-in', color: 'bg-blue-500' },
  { status: 'CHECKED_IN', desc: 'Timer Running', color: 'bg-green-500' },
  { status: 'COMPLETED', desc: 'Journey Done', color: 'bg-gray-400' },
];

export default function StatusLogic({ fillHeight = false }: { fillHeight?: boolean }) {
  return (
    <FieldCard title="Status Logic" icon={<span className="text-sm">📊</span>} compact className={fillHeight ? 'h-full' : ''}>
      <div className={`grid grid-cols-3 gap-2 ${fillHeight ? 'h-full items-stretch' : ''}`}>
        {STEPS.map(({ status, desc, color }) => (
          <div
            key={status}
            className={`flex flex-col items-center justify-center text-center gap-1 p-2 rounded-xl bg-green-50/80 dark:bg-green-500/5 border border-green-100 dark:border-green-500/20 ${
              fillHeight ? 'h-full' : ''
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <p className="text-[10px] font-black uppercase text-gray-800 dark:text-white leading-tight">
              {status.replace('_', ' ')}
            </p>
            <p className="text-[9px] text-gray-500 leading-tight">{desc}</p>
          </div>
        ))}
      </div>
    </FieldCard>
  );
}
