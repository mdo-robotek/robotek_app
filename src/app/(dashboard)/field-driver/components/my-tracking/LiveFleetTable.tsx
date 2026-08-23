'use client';

import { useEffect, useState } from 'react';
import { getIstDateString } from '@/lib/dateUtils';
import { FieldCard } from '../FieldCard';

interface FleetRow {
  userId: string;
  userName: string;
  date: string;
  location: string;
  status: string;
}

export default function LiveFleetTable() {
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const date = getIstDateString();
        const res = await fetch(`/api/field-driver/all?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          const attendance = data.attendance || [];
          setRows(
            attendance.map((r: FleetRow & { inLocation?: string; outTime?: string; status?: string }) => ({
              userId: r.userId,
              userName: r.userName,
              date: r.date,
              location: r.inLocation || '-',
              status: r.outTime ? 'COMPLETED' : r.status === 'IN' ? 'CHECKED_IN' : 'IDLE',
            }))
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const statusClass = (s: string) => {
    if (s === 'CHECKED_IN') return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
    if (s === 'COMPLETED') return 'bg-gray-100 text-gray-600 dark:bg-gray-500/20';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
  };

  return (
    <FieldCard title="Live Tracking (All Users)" compact>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading fleet data...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No field movement recorded today</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10">
                {['User ID', 'Name', 'Date', 'Location', 'Status'].map((h) => (
                  <th key={h} className="py-2 px-2 font-black uppercase tracking-wider text-gray-400 text-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.userId}-${r.date}`} className="border-b border-gray-50 dark:border-white/5">
                  <td className="py-2.5 px-2 font-mono text-gray-500">{r.userId}</td>
                  <td className="py-2.5 px-2 font-bold uppercase">{r.userName}</td>
                  <td className="py-2.5 px-2">{r.date}</td>
                  <td className="py-2 px-2 max-w-[160px] text-gray-500 align-top">
                    <span className="block text-[11px] leading-snug line-clamp-2">{r.location}</span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusClass(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FieldCard>
  );
}
