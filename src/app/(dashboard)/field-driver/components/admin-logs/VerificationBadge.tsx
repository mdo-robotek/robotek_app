import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import type { VerificationStatus } from '../../types/field-driver';

export default function VerificationBadge({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { label: string; className: string; icon?: ReactNode }> = {
    VERIFIED: {
      label: 'Verified',
      className: 'bg-green-500/10 text-green-600 border-green-500/20',
      icon: <CheckCircleIcon className="w-3.5 h-3.5" />,
    },
    LOW_GPS: {
      label: 'GPS Drop',
      className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      icon: <ExclamationTriangleIcon className="w-3.5 h-3.5" />,
    },
    SUSPICIOUS_ODO: {
      label: 'Review ODO',
      className: 'bg-red-500/10 text-red-600 border-red-500/20',
      icon: <ExclamationTriangleIcon className="w-3.5 h-3.5" />,
    },
    PENDING: {
      label: 'Active Now',
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    NO_MOVEMENT: {
      label: '0 KM',
      className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    },
  };

  const cfg = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
