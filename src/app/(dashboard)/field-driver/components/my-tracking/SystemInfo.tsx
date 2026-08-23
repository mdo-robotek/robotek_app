'use client';

import { FieldCard } from '../FieldCard';

export default function SystemInfo({ gpsOk }: { gpsOk: boolean }) {
  const rows = [
    { label: 'Node.js', value: 'v20.x' },
    { label: 'Next.js', value: '16.x' },
    { label: 'React', value: '19.x' },
    { label: 'Database', value: 'Google Sheets' },
    { label: 'Timezone', value: 'IST (UTC+5:30)' },
    { label: 'GPS', value: gpsOk ? 'Active' : 'Inactive' },
  ];

  return (
    <FieldCard title="System Info" compact>
      <dl className="space-y-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-4 text-xs">
            <dt className="font-bold text-gray-500">{label}</dt>
            <dd className="font-black text-[#062B6F] dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </FieldCard>
  );
}
