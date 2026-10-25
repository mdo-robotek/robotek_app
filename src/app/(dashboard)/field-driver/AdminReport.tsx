'use client';

import React, { useEffect, useState } from 'react';
import { getIstDateString } from '@/lib/dateUtils';
import { ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function AdminReport() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    
    // We fetch all records, then filter by month on the client side for speed
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/field-driver/all`);
                if (res.ok) {
                    const data = await res.json();
                    setRecords(data.attendance || []);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getIstDateString();

    // Extract unique users who have used the Field Driver system
    const uniqueUsers = Array.from(new Map(records.map(r => [r.userId, { id: r.userId, name: r.userName }])).values());
    
    // Sort users alphabetically
    uniqueUsers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const formatTime = (isoString: string) => {
        if (!isoString || isoString === '-') return '-';
        try {
            return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return isoString;
        }
    };

    const handleExportCSV = () => {
        const headers = ['Driver Name', 'Driver ID', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))];
        const rows: string[][] = [headers];

        uniqueUsers.forEach(u => {
            const rowData = [u.name, String(u.id)];

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isSunday = new Date(year, month, d).getDay() === 0;
                const record = records.find(r => String(r.userId) === String(u.id) && r.date === dateStr);

                let cellValue = '-';
                if (isSunday) {
                    cellValue = 'SUN';
                } else if (record?.inTime) {
                    const inPart = `IN ${formatTime(record.inTime)}`;
                    const outPart = record.outTime ? ` OUT ${formatTime(record.outTime)}` : '';
                    cellValue = `${inPart}${outPart}`;
                } else if (dateStr < todayStr) {
                    cellValue = 'A';
                }
                rowData.push(cellValue);
            }
            rows.push(rowData);
        });

        const csvContent = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Field_Driver_Report_${currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-200/80 dark:border-white/10 shadow-sm relative">
            
            {/* Header / Filter */}
            <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">Monthly Field Report</h2>
                    <p className="text-[14px] font-bold text-gray-500">Grid view of all active field drivers</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Month Picker */}
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-full border border-gray-200 dark:border-white/10 shadow-sm p-1">
                        <button 
                            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} 
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <div className="px-4 text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] w-32 text-center">
                            {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                        </div>
                        <button 
                            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} 
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={handleExportCSV}
                        disabled={uniqueUsers.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1D4ED8] dark:bg-[#60A5FA] text-white dark:text-black rounded-xl text-[14px] font-semibold shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 stroke-2" /> Export
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-gray-50/30 dark:bg-slate-900/50">
                {isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-[#2563EB] dark:border-[#60A5FA] border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-[14px] font-bold text-[#5B6472]">Loading Report...</div>
                    </div>
                ) : uniqueUsers.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#5B6472] text-sm font-bold">
                        No field drivers found.
                    </div>
                ) : (
                    <table className="w-full border-collapse border-spacing-0 text-left">
                        <thead className="bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-4 text-[13px] font-semibold text-[#5B6472] border-b border-gray-200 dark:border-white/10 border-r min-w-[200px] sticky left-0 z-30 bg-white dark:bg-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    Driver Name
                                </th>
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const d = i + 1;
                                    const isSunday = new Date(year, month, d).getDay() === 0;
                                    const isToday = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` === todayStr;
                                    return (
                                        <th key={d} className={`p-2 text-center text-[13px] font-semibold   border-b border-r border-gray-200 dark:border-white/10 min-w-[60px]
                                            ${isSunday ? 'bg-red-500/10 text-red-500' : 'text-[#5B6472]'}
                                            ${isToday ? 'border-b-2 border-b-[#2563EB] dark:border-b-[#60A5FA] bg-[#2563EB]/5 dark:bg-[#60A5FA]/10 text-white dark:text-[#60A5FA]' : ''}
                                        `}>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[14px] opacity-70">
                                                    {new Date(year, month, d).toLocaleString('default', { weekday: 'short' })}
                                                </span>
                                                <span className="text-sm">{d}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                            {uniqueUsers.map((u, idx) => (
                                <tr key={u.id} className="hover:bg-white dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-3 border-r border-gray-200 dark:border-white/10 sticky left-0 z-10 bg-gray-50/95 dark:bg-slate-900/95 group-hover:bg-white dark:group-hover:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] backdrop-blur-sm">
                                        <div className="font-semibold text-[14px] text-gray-900 dark:text-white truncate" title={u.name}>{u.name}</div>
                                        <div className="text-[13px] font-bold text-[#5B6472]">{u.id}</div>
                                    </td>
                                    
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                        const d = i + 1;
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const isSunday = new Date(year, month, d).getDay() === 0;
                                        const record = records.find(r => String(r.userId) === String(u.id) && r.date === dateStr);
                                        const isToday = dateStr === todayStr;
                                        
                                        let cellContent = <span className="text-[#5B6472] dark:text-gray-600">-</span>;
                                        let cellBg = '';

                                        if (isSunday) {
                                            cellContent = <span className="text-red-400 opacity-50">S</span>;
                                            cellBg = 'bg-red-500/5';
                                        } else if (record?.inTime) {
                                            cellContent = (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[14px] font-semibold text-[#5B6472] leading-none">IN</span>
                                                        <span className="text-green-600 dark:text-green-400 font-semibold text-[13px] leading-none">{formatTime(record.inTime)}</span>
                                                    </div>
                                                    {record.outTime && (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[14px] font-semibold text-[#5B6472] leading-none">OUT</span>
                                                            <span className="text-red-600 dark:text-red-400 font-semibold text-[13px] leading-none">{formatTime(record.outTime)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                            cellBg = 'bg-green-500/10';
                                        } else if (dateStr < todayStr) {
                                            cellContent = <span className="text-red-600 dark:text-red-400 font-semibold">A</span>;
                                            cellBg = 'bg-red-500/10';
                                        }

                                        return (
                                            <td key={d} className={`p-0 border-r border-gray-200 dark:border-white/10 ${cellBg} ${isToday ? 'bg-[#2563EB]/5 dark:bg-[#60A5FA]/10 border-r-[#2563EB]/20 dark:border-r-[#60A5FA]/20' : ''}`}>
                                                <div className="w-full h-full min-h-[48px] flex items-center justify-center text-[14px]">
                                                    {cellContent}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
