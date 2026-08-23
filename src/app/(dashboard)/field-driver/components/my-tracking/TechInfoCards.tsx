'use client';

import { FieldCard } from '../FieldCard';

const CARDS = [
  {
    title: 'Technologies & Services',
    icon: '⚙',
    items: ['Next.js App Router', 'Leaflet + React Leaflet', 'Google Sheets', 'Google Drive', 'Browser Geolocation'],
  },
  {
    title: 'Storage & APIs',
    icon: '🗄',
    items: ['Google Sheets OAuth2', 'Google Drive', 'OpenStreetMap / CARTO', 'Field Driver API', 'Live Tracking API'],
  },
  {
    title: 'Verification',
    icon: '🛡',
    items: ['Live GPS Tracking', 'Photo Capture', 'Odometer Validation', 'Haversine Calculation', '25% Tolerance Rule'],
  },
];

export default function TechInfoCards({ compact = false, fillHeight = false }: { compact?: boolean; fillHeight?: boolean }) {
  return (
    <div
      className={`grid gap-2 h-full items-stretch ${
        compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 md:grid-cols-3'
      }`}
    >
      {CARDS.map((card) => (
        <FieldCard key={card.title} title={card.title} icon={<span>{card.icon}</span>} compact className={fillHeight ? 'h-full' : ''}>
          <ul className="space-y-0.5">
            {card.items.slice(0, compact ? 4 : undefined).map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </FieldCard>
      ))}
    </div>
  );
}
