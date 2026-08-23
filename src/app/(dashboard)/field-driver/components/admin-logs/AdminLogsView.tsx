'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PhotoIcon } from '@heroicons/react/24/outline';
import {
  calculateTotalGpsDistanceKm,
  drivePhotoUrl,
  getVerificationStatus,
} from '../../lib/verification';
import VerificationBadge from './VerificationBadge';
import PhotoModal from './PhotoModal';

export default function AdminLogsView() {
  const [dateStr, setDateStr] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [liveTracking, setLiveTracking] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/field-driver/all?date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(data.attendance || []);
          setLiveTracking(data.liveTracking || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    setCurrentPage(1);
  }, [dateStr]);

  const formatTime = (iso: string) => {
    if (!iso || iso === '-') return '-';
    try {
      return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const enrichedRecords = useMemo(() => {
    return records.map((record) => {
      const userGpsRecord = liveTracking.find((lt) => String(lt.userId) === String(record.userId));
      const gpsKm = userGpsRecord ? calculateTotalGpsDistanceKm(userGpsRecord.pathData) : 0;
      const odoKm = parseFloat(record.totalKm) || 0;
      const { status: verificationStatus, percentDiff } = getVerificationStatus(record, gpsKm);
      return { ...record, gpsKm, odoKm, verificationStatus, percentDiff };
    });
  }, [records, liveTracking]);

  const filtered = enrichedRecords.filter(
    (r) =>
      !search ||
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      String(r.userId).includes(search)
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[560px] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-200/80 dark:border-white/10 shadow-sm">
      <div className="p-5 border-b border-gray-100 dark:border-white/10 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black uppercase text-[#062B6F] dark:text-[#FFD500]">
            Attendance & Verification Logs
          </h2>
          <p className="text-xs font-bold text-gray-500">Cross-reference Odometer readings with Live GPS data</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-[#2563EB] w-40"
          />
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-[#2563EB]"
          />
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="px-5 py-2 border-b border-gray-100 flex justify-between items-center text-xs">
          <span className="text-gray-500 font-bold">
            {filtered.length} entries
          </span>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border disabled:opacity-30"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="font-black">Page {currentPage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border disabled:opacity-30"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-bold">Loading Logs...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-bold">No check-ins found</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
              <tr>
                {['Driver', 'Date', 'Timeline', 'ODO Proof', 'ODO KM', 'GPS KM', 'Diff %', 'Status'].map((h) => (
                  <th key={h} className="p-3 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((r, idx) => (
                <tr key={r.id || idx} className="hover:bg-gray-50/50">
                  <td className="p-3">
                    <div className="font-black text-xs uppercase">{r.userName}</div>
                    <div className="text-[10px] text-gray-400">{r.userId}</div>
                  </td>
                  <td className="p-3 text-xs font-bold">{r.date}</td>
                  <td className="p-3 text-xs min-w-[160px]">
                    <div>In: {formatTime(r.inTime)}</div>
                    <div>Out: {formatTime(r.outTime)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {r.odometerPhotoIn && (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(drivePhotoUrl(r.odometerPhotoIn))}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-bold"
                        >
                          <PhotoIcon className="w-3 h-3 text-green-600" /> IN
                        </button>
                      )}
                      {r.odometerPhotoOut && (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(drivePhotoUrl(r.odometerPhotoOut))}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-bold"
                        >
                          <PhotoIcon className="w-3 h-3 text-red-600" /> OUT
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono font-black">
                    {r.status === 'COMPLETED' ? r.odoKm.toFixed(1) : '--'}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-[#062B6F] dark:text-[#FFD500]">
                    {r.gpsKm.toFixed(1)}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    {r.percentDiff != null ? `${r.percentDiff.toFixed(1)}%` : '--'}
                  </td>
                  <td className="p-3 text-center">
                    <VerificationBadge status={r.verificationStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PhotoModal url={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
    </div>
  );
}
