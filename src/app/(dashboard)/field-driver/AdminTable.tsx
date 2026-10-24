'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { PhotoIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Haversine formula to calculate distance in KM between two lat/lng points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
}

function calculateTotalGpsDistance(pathDataJSON: string) {
    try {
        const points = JSON.parse(pathDataJSON);
        if (!Array.isArray(points) || points.length < 2) return 0;
        
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i-1];
            const p2 = points[i];
            total += calculateDistance(
                parseFloat(p1.lat), parseFloat(p1.lng),
                parseFloat(p2.lat), parseFloat(p2.lng)
            );
        }
        return total;
    } catch (e) {
        return 0;
    }
}

export default function AdminTable() {
    const [dateStr, setDateStr] = useState('');
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
        setCurrentPage(1); // Reset page on date change
    }, [dateStr]);

    const formatTime = (isoString: string) => {
        if (!isoString || isoString === '-') return '-';
        try {
            return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return isoString;
        }
    };

    // Merge records with GPS data
    const enrichedRecords = records.map(record => {
        const userGpsRecord = liveTracking.find(lt => String(lt.userId) === String(record.userId));
        const gpsKm = userGpsRecord ? calculateTotalGpsDistance(userGpsRecord.pathData) : 0;
        const odoKm = parseFloat(record.totalKm) || 0;
        
        let verificationStatus = 'PENDING'; // Not checked out yet
        if (record.status === 'COMPLETED' || record.outTime) {
            // Check if GPS is within 25% of Odometer
            // Odometer will usually be higher because GPS cuts corners.
            if (odoKm === 0 && gpsKm === 0) {
                verificationStatus = 'NO_MOVEMENT';
            } else {
                const diff = Math.abs(odoKm - gpsKm);
                const percentDiff = odoKm > 0 ? (diff / odoKm) : 1;
                
                if (percentDiff <= 0.25) {
                    verificationStatus = 'VERIFIED';
                } else if (gpsKm > odoKm) {
                    // Very suspicious - GPS travelled further than Odometer? (Odometer tampering likely)
                    verificationStatus = 'SUSPICIOUS_ODO'; 
                } else {
                    // GPS is much lower than Odometer. 
                    // Could be valid (tunnels/lost signal) or user disabled GPS.
                    verificationStatus = 'LOW_GPS';
                }
            }
        }

        return { ...record, gpsKm, odoKm, verificationStatus };
    });

    // Pagination Logic
    const totalPages = Math.ceil(enrichedRecords.length / itemsPerPage);
    const paginatedRecords = enrichedRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden border border-gray-200 dark:border-white/10 shadow-2xl relative">
            
            {/* Header / Filter */}
            <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-[#2563EB] dark:text-[#60A5FA]">Attendance & Verification Logs</h2>
                    <p className="text-[14px] font-bold text-gray-500">Cross-reference Odometer readings with Live GPS data</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-[14px] font-semibold text-gray-400">Date Filter</label>
                    <input 
                        type="date" 
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-bold outline-none focus:border-[#2563EB] shadow-sm"
                    />
                </div>
            </div>
            
            {/* Pagination Controls */}
            {enrichedRecords.length > 0 && (
                <div className="px-6 py-3 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-white dark:bg-slate-900">
                    <div className="text-[14px] font-bold text-gray-500">
                        Showing <span className="text-gray-900 dark:text-white">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, enrichedRecords.length)}</span> of <span className="text-gray-900 dark:text-white">{enrichedRecords.length}</span> entries
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <div className="px-3 py-1.5 text-[14px] font-semibold bg-gray-100 dark:bg-slate-800 rounded-lg">
                            Page {currentPage} of {totalPages}
                        </div>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-[#2563EB] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-[14px] font-bold text-gray-400">Loading Logs...</div>
                    </div>
                ) : enrichedRecords.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm font-bold">
                        No check-ins found for this date.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 text-[13px] font-semibold text-gray-400 border-b border-gray-200 dark:border-white/10">Driver</th>
                                <th className="p-4 text-[13px] font-semibold text-gray-400 border-b border-gray-200 dark:border-white/10">Date</th>
                                <th className="p-4 text-[13px] font-semibold text-gray-400 border-b border-gray-200 dark:border-white/10">Timeline</th>
                                <th className="p-4 text-[13px] font-semibold text-gray-400 border-b border-gray-200 dark:border-white/10">Odometer Proof</th>
                                <th className="p-4 text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] border-b border-gray-200 dark:border-white/10 text-right">Odometer KM</th>
                                <th className="p-4 text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] border-b border-gray-200 dark:border-white/10 text-right">GPS KM</th>
                                <th className="p-4 text-[13px] font-semibold text-gray-400 border-b border-gray-200 dark:border-white/10 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {paginatedRecords.map((r, idx) => (
                                <tr key={r.id || idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4 align-top">
                                        <div className="font-semibold text-sm text-gray-900 dark:text-white">{r.userName}</div>
                                        <div className="text-[13px] font-bold text-gray-400">{r.userId}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="text-[14px] font-bold text-gray-500">
                                            {r.date}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top min-w-[200px]">
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    <span className="text-[14px] font-bold text-gray-600 dark:text-gray-300">In: {formatTime(r.inTime)}</span>
                                                </div>
                                                {r.inLocation && <div className="text-[13px] font-medium text-gray-400 pl-3.5 leading-tight">{r.inLocation}</div>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                    <span className="text-[14px] font-bold text-gray-600 dark:text-gray-300">Out: {formatTime(r.outTime)}</span>
                                                </div>
                                                {r.outLocation && <div className="text-[13px] font-medium text-gray-400 pl-3.5 leading-tight">{r.outLocation}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="flex gap-2">
                                            {r.odometerPhotoIn && (
                                                <button onClick={() => setSelectedPhoto(r.odometerPhotoIn)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-[14px] font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                                                    <PhotoIcon className="w-4 h-4 text-green-600" /> IN
                                                </button>
                                            )}
                                            {r.odometerPhotoOut && (
                                                <button onClick={() => setSelectedPhoto(r.odometerPhotoOut)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-[14px] font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                                                    <PhotoIcon className="w-4 h-4 text-red-600" /> OUT
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[13px] font-bold text-gray-400 mt-2">
                                            {r.odometerIn} → {r.odometerOut || '...'}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top text-right">
                                        <div className="text-xl font-semibold font-mono text-gray-900 dark:text-white">
                                            {r.status === 'COMPLETED' ? r.odoKm.toFixed(1) : '--'}
                                        </div>
                                        <div className="text-[13px] font-bold text-gray-400">Recorded</div>
                                    </td>
                                    <td className="p-4 align-top text-right">
                                        <div className="text-xl font-semibold font-mono text-[#2563EB] dark:text-[#60A5FA]">
                                            {r.gpsKm.toFixed(1)}
                                        </div>
                                        <div className="text-[13px] font-bold text-gray-400">Tracked</div>
                                    </td>
                                    <td className="p-4 align-top text-center">
                                        {r.verificationStatus === 'VERIFIED' && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 border border-green-500/20 rounded-full text-[13px] font-semibold">
                                                <CheckCircleIcon className="w-4 h-4" /> Verified
                                            </div>
                                        )}
                                        {r.verificationStatus === 'LOW_GPS' && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 text-orange-600 border border-orange-500/20 rounded-full text-[13px] font-semibold">
                                                <ExclamationTriangleIcon className="w-4 h-4" /> GPS Drop
                                            </div>
                                        )}
                                        {r.verificationStatus === 'SUSPICIOUS_ODO' && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 border border-red-500/20 rounded-full text-[13px] font-semibold">
                                                <ExclamationTriangleIcon className="w-4 h-4" /> Review ODO
                                            </div>
                                        )}
                                        {r.verificationStatus === 'PENDING' && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-full text-[13px] font-semibold">
                                                Active Now
                                            </div>
                                        )}
                                        {r.verificationStatus === 'NO_MOVEMENT' && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500/10 text-gray-500 border border-gray-500/20 rounded-full text-[13px] font-semibold">
                                                0 KM
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Photo Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
                    <div className="relative max-w-3xl w-full">
                        <img src={selectedPhoto} alt="Odometer" className="w-full h-auto rounded-2xl shadow-2xl" />
                        <button 
                            className="absolute -top-4 -right-4 w-10 h-10 bg-white text-black font-semibold rounded-full shadow-lg border-2 border-black flex items-center justify-center hover:scale-110 transition-transform"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
