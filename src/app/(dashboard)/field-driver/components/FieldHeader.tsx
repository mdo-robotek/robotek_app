'use client';

import { InformationCircleIcon } from '@heroicons/react/24/outline';
import ScooterIcon from './ScooterIcon';

export default function FieldHeader({
  onOpenGuide,
  gpsOk,
}: {
  onOpenGuide: () => void;
  gpsOk: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <ScooterIcon className="w-10 h-10 shrink-0" color="#062B6F" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base md:text-lg font-black uppercase tracking-tight text-[#062B6F] dark:text-white">
            Field Tracking
          </h1>
          <button
            type="button"
            onClick={onOpenGuide}
            className="shrink-0 text-gray-400 hover:text-[#062B6F] dark:hover:text-white transition-colors"
            title="How Field Tracking works"
            aria-label="Open guide"
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          {gpsOk ? 'Connected · ' : ''}Live Location · Check-in · Journey History
        </p>
      </div>
    </div>
  );
}
