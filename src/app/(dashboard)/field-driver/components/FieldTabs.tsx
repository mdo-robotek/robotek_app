'use client';

import {
  UserIcon,
  MapIcon,
  TableCellsIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';
import type { FieldTab } from '../types/field-driver';

const TABS: { id: FieldTab; label: string; icon: typeof UserIcon; adminOnly?: boolean }[] = [
  { id: 'TRACKING', label: 'My Tracking', icon: UserIcon },
  { id: 'ADMIN_MAP', label: 'Admin Map', icon: MapIcon, adminOnly: true },
  { id: 'ADMIN_TABLE', label: 'Admin Logs', icon: TableCellsIcon, adminOnly: true },
  { id: 'ADMIN_REPORT', label: 'Admin Report', icon: DocumentChartBarIcon, adminOnly: true },
];

export default function FieldTabs({
  active,
  onChange,
  isAdmin,
}: {
  active: FieldTab;
  onChange: (tab: FieldTab) => void;
  isAdmin: boolean;
}) {
  const visible = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 dark:border-white/10 pb-2">
      {visible.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              isActive
                ? 'bg-[#062B6F] text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
