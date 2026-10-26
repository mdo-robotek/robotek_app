'use client';

import React, { useState, useEffect, useRef } from 'react';
import { read, utils } from 'xlsx';
import { parsePunchMachineSheet, type PunchParseResult } from '@/lib/utils/punchMachineParser';
import { ensureSessionId } from '@/utils/session';
import { useToast } from '@/components/ToastProvider';
import CustomDateTimePicker from '@/components/CustomDateTimePicker';
import SearchableSelect from '@/components/SearchableSelect';
import ConfirmModal from '@/components/ConfirmModal';
import { getIstDateString, formatDateMMM, isWeeklyOffIstToday, isWeeklyOffForUser, getWeeklyOffLabel } from '@/lib/dateUtils';
import { calculateDistance, calculateBearing, getCompassDirection, parseLatLong, getShortestDistance } from '@/lib/locationUtils';
import { 
    CalendarIcon as CalendarBtnIcon, 
    UserIcon as UserBtnIcon, 
    ChatBubbleLeftRightIcon as CommentBtnIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    MapPinIcon,
    ArrowPathIcon,
    ArrowRightCircleIcon,
    PencilSquareIcon,
    TrashIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    SunIcon,
    ClipboardDocumentListIcon,
    UsersIcon,
    XMarkIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';

// Icons (Using local SVG / Lucide pattern from project)
const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'Approved') return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    if (status === 'Rejected') return <XCircleIcon className="w-4 h-4 text-red-500" />;
    return <ClockIcon className="w-4 h-4 text-amber-500" />;
};

export default function AttendancePage() {
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'ATTENDANCE_MASTER' | 'REPORT' | 'LATECOMERS'>('ATTENDANCE');
    const [reportSearch, setReportSearch] = useState('');
    const [reportView, setReportView] = useState<'STATUS' | 'TIME'>('STATUS');
    const [user, setUser] = useState<any>(null);
    const SHIFT_START_TIME = "09:30";
    const [isPageLoading, setIsPageLoading] = useState(false);

    // Derived role helpers (recalculated whenever user changes)
    const userRoleUpper = (user?.role || '').toUpperCase();
    const isAdminOrEA = userRoleUpper === 'ADMIN' || userRoleUpper === 'EA';

    // Attendance State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [latecomersDate, setLatecomersDate] = useState(new Date());
    const [history, setHistory] = useState<any[]>([]);
    const [currentStatus, setCurrentStatus] = useState<'IDLE' | 'CHECKED_IN' | 'COMPLETED'>('IDLE');
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [checkInTime, setCheckInTime] = useState<Date | null>(null);
    const [showCameraMode, setShowCameraMode] = useState<'CHECK_IN' | 'CHECK_OUT' | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    

    // Admin State
    
    
    
    
    const [masterData, setMasterData] = useState<{ users: any[], attendance: any[], leaves: any[] } | null>(null);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    // Real-time Location State
    const [liveLocation, setLiveLocation] = useState<{ lat: number, lng: number, accuracy?: number } | null>(null);
    const [liveAddress, setLiveAddress] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isApple, setIsApple] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [submitTarget, setSubmitTarget] = useState<'IN' | 'OUT' | null>(null);
    const [masterSearch, setMasterSearch] = useState('');
    const [reportViewMode, setReportViewMode] = useState<'STATUS' | 'TIME' | 'INFO'>('STATUS');
    const [importPreview, setImportPreview] = useState<PunchParseResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importFileName, setImportFileName] = useState('');
    const [importProgress, setImportProgress] = useState(0);
    const [importLogs, setImportLogs] = useState<string[]>([]);
    const [importPhase, setImportPhase] = useState<'preview' | 'scanning' | 'uploading' | 'done'>('preview');
    const punchImportInputRef = useRef<HTMLInputElement>(null);
    const importLogRef = useRef<HTMLDivElement>(null);

    // Dual Scrollbar Logic
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const dummyDivRef = useRef<HTMLDivElement>(null);

    const handleTopScroll = () => {
        if (tableScrollRef.current && topScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleTableScroll = () => {
        if (topScrollRef.current && tableScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
            if (dummyDivRef.current && dummyDivRef.current.style.width !== `${tableScrollRef.current.scrollWidth}px`) {
                dummyDivRef.current.style.width = `${tableScrollRef.current.scrollWidth}px`;
            }
        }
    };
    
    // Ensure initial width is set after data loads
    useEffect(() => {
        if (tableScrollRef.current && dummyDivRef.current) {
            dummyDivRef.current.style.width = `${tableScrollRef.current.scrollWidth}px`;
        }
    }, [masterData, reportViewMode]);

    useEffect(() => {
        if (importLogRef.current) {
            importLogRef.current.scrollTop = importLogRef.current.scrollHeight;
        }
    }, [importLogs]);

    useEffect(() => {
        const ua = navigator.userAgent;
        setIsApple(/iPad|iPhone|iPod|Macintosh/.test(ua));
        setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua));
    }, []);

    // Derived Location Metrics
    const registeredPoints = parseLatLong(user?.late_long);
    const distanceInfo = liveLocation && registeredPoints
        ? getShortestDistance(liveLocation.lat, liveLocation.lng, registeredPoints)
        : null;

    const distance = distanceInfo?.distance || null;
    const closestPoint = distanceInfo?.point || null;

    // Dynamic Range: 10m for mobile, 20m for desktop
    const rangeThreshold = isMobile ? 10 : 20;
    const isInRange = distance !== null && distance <= rangeThreshold;

    const bearing = liveLocation && closestPoint
        ? calculateBearing(liveLocation.lat, liveLocation.lng, closestPoint.lat, closestPoint.long)
        : null;

    const refreshLocationManual = () => {
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLiveLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                success("Location updated successfully");
            },
            (err) => {
                const msg = err.code === 1 ? "Permission denied" : "Lookup failed";
                error(`Location refresh failed: ${msg}`);
                setLocationError(err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        const init = async () => {
            try {
                // Read tab query param
                const searchParams = new URLSearchParams(window.location.search);
                const tabParam = searchParams.get('tab');
                if (tabParam === 'ATTENDANCE_MASTER' || tabParam === 'REPORT' || tabParam === 'LATECOMERS') {
                    setActiveTab(tabParam as 'ATTENDANCE' | 'ATTENDANCE_MASTER' | 'REPORT' | 'LATECOMERS');
                }

                const authRes = await fetch('/api/auth/session');
                const session = await authRes.json();
                
                if (session?.user) {
                    const sessionUser = session.user;
                    
                    // Fetch full user list to get late_long and other fields not in session
                    let fullUser = sessionUser;
                    try {
                        const usersRes = await fetch('/api/users');
                        if (usersRes.ok) {
                            const allUsers = await usersRes.json();
                            const matched = allUsers.find((u: any) => 
                                String(u.id) === String(sessionUser.id) || 
                                u.username === sessionUser.username
                            );
                            if (matched) {
                                fullUser = { ...sessionUser, ...matched, role: sessionUser.role };
                            }
                        }
                    } catch (e) {
                        console.warn('Could not fetch full user profile:', e);
                    }

                    setUser(fullUser);
                    await Promise.all([
                        fetchAttendance(fullUser.id),
                        fetchMasterData()
                    ]);
                }
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, []);

    // Real-time location watcher
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setLiveLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                setLocationError(null);
            },
            (err) => {
                console.warn('Location watch error:', err.message);
                let msg = err.message;
                if (err.code === 1) msg = "Location access denied. Please enable 'Location Services' in Settings.";
                if (err.code === 3) msg = "Location lookup timed out.";
                setLocationError(msg);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Reverse Geocoding
    useEffect(() => {
        if (!liveLocation) return;
        
        const timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${liveLocation.lat}&lon=${liveLocation.lng}&zoom=18&addressdetails=1`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.display_name) {
                        setLiveAddress(data.display_name);
                    }
                }
            } catch (err) {
                console.error("Reverse geocoding failed", err);
            }
        }, 1500);

        return () => clearTimeout(timeoutId);
    }, [liveLocation?.lat, liveLocation?.lng]);

    // Timer Logic 
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (currentStatus === 'CHECKED_IN' && checkInTime) {
            interval = setInterval(() => {
                const now = new Date();
                const diff = now.getTime() - checkInTime.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [currentStatus, checkInTime]);

    useEffect(() => {
        if (showCameraMode) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
                .then(stream => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch(err => {
                    error("Camera access denied or failed");
                    setShowCameraMode(null);
                });
        } else {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
        }
    }, [showCameraMode]);

    const capturePhotoAndSubmit = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                const photoData = canvasRef.current.toDataURL('image/jpeg', 0.8);
                
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                
                handleAction(showCameraMode!, photoData);
                setShowCameraMode(null);
            }
        }
    };

    const fetchAttendance = async (userId: string) => {
        const res = await fetch(`/api/attendance?userId=${userId}`);
        const data = await res.json();
        if (data.history) setHistory(data.history);
        if (data.currentStatus) {
            setCurrentStatus(data.currentStatus);
            if (data.lastCheckIn) setCheckInTime(new Date(data.lastCheckIn));
        }
    };

    

    

    const fetchMasterData = async () => {
        try {
            const res = await fetch('/api/attendance/master');
            const data = await res.json();
            const resLeaves = await fetch('/api/leave?role=ADMIN');
            const dataLeaves = await resLeaves.json();
            if (data.users) setMasterData(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAction = async (action: 'CHECK_IN' | 'CHECK_OUT', photoData?: string) => {
        if (action === 'CHECK_IN' && isWeeklyOffIstToday(user?.office)) {
            error(`Check-in is not allowed on ${getWeeklyOffLabel(user?.office)} weekly off days`);
            return;
        }
        setIsPageLoading(true);
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                body: JSON.stringify({
                    action,
                    userId: user.id,
                    userName: user.username,
                    latitude: liveLocation?.lat,
                    longitude: liveLocation?.lng,
                    address: liveAddress,
                    photo: photoData
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Action failed');
            }

            await fetchAttendance(user.id);
            success(action === 'CHECK_IN' ? 'Checked in successfully!' : 'Checked out successfully!');
        } catch (e: any) {
            error(e.message || 'Failed to update attendance');
        } finally {
            setIsPageLoading(false);
        }
    };

    

    

    

    

    

    

    

    const formatDateIST = (dateStr: string) => {
        if (!dateStr) return "-";
        
        // Handle DD/MM/YYYY
        let parsedStr = dateStr;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [dd, mm, yyyy] = dateStr.split('/');
            parsedStr = `${yyyy}-${mm}-${dd}`;
        }
        
        const d = new Date(parsedStr);
        if (isNaN(d.getTime())) return "Invalid Date";
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatTimeIST = (dateStr: string) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    const normalizeDateSheet = (dStr: string): string => {
        if (!dStr) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
            const [dd, mm, yyyy] = dStr.split('/');
            return `${yyyy}-${mm}-${dd}`;
        }
        return dStr.split('T')[0];
    };

    const handleExportCSV = () => {
        if (!masterData) return;

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = getIstDateString();

        const headers = ['Employee Name', 'Employee ID', 'Late Days', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))];
        const rows: string[][] = [headers];

        masterData.users
            .filter(u => isAdminOrEA || String(u.id) === String(user.id))
            .filter(u => (u.full_name || u.username)?.toLowerCase().includes(masterSearch.toLowerCase()) || String(u.id).toLowerCase().includes(masterSearch.toLowerCase()))
            .forEach(u => {
                const monthAtt = masterData.attendance.filter(a => String(a.userId) === String(u.id)) || [];
                const uLeaves = masterData.leaves?.filter((l:any) => String(l.userId) === String(u.id) && l.status === 'Approved') || [];
                
                let lateDaysCount = 0;
                const rowData = [u.full_name || u.username, String(u.id)];

                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isWeeklyOff = isWeeklyOffForUser(u.office, year, month, d);
                    const offLabel = getWeeklyOffLabel(u.office);

                    const record = monthAtt.find(h => normalizeDateSheet(h.date) === dateStr);
                    const leave = uLeaves.find((l:any) => {
                        const start = normalizeDateSheet(l.startDate);
                        const end = normalizeDateSheet(l.endDate);
                        return dateStr >= start && dateStr <= end;
                    });

                    let cellValue = '-';
                    if (isWeeklyOff) {
                        cellValue = offLabel;
                    } else if (leave) {
                        cellValue = 'L';
                    } else if (record?.inTime) {
                        const inIST = new Date(new Date(record.inTime).getTime() + 5.5 * 3600000);
                        const isLate = inIST.getUTCHours() > 9 || (inIST.getUTCHours() === 9 && inIST.getUTCMinutes() > 40);
                        if (isLate) lateDaysCount++;

                        let hours = 0;
                        if (record.outTime) {
                            hours = (new Date(record.outTime).getTime() - new Date(record.inTime).getTime()) / 3600000;
                        }
                        if (record.outTime && hours <= 4) {
                            cellValue = reportViewMode === 'TIME' ? `${formatTimeIST(record.inTime)} - ${formatTimeIST(record.outTime)}` : 'HD';
                        } else {
                            cellValue = reportViewMode === 'TIME' ? `${formatTimeIST(record.inTime)} - ${record.outTime ? formatTimeIST(record.outTime) : 'N/A'}` : 'P';
                        }
                    } else if (dateStr < todayStr) {
                        cellValue = 'A';
                    }
                    rowData.push(cellValue);
                }
                rowData.splice(2, 0, String(lateDaysCount));
                rows.push(rowData);
            });

        const csvContent = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Attendance_Report_${currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePunchImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const workbook = read(buffer);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false }) as unknown[][];
            const parsed = parsePunchMachineSheet(rows);

            setImportFileName(file.name);
            setImportPreview(parsed);
            setImportProgress(0);
            setImportLogs([]);
            setImportPhase('preview');

            if (parsed.records.length === 0) {
                error('No punch records found in the uploaded file.');
            }
        } catch (e) {
            console.error(e);
            error('Failed to read punch machine file.');
        } finally {
            if (punchImportInputRef.current) {
                punchImportInputRef.current.value = '';
            }
        }
    };

    const handleConfirmPunchImport = async () => {
        if (!importPreview || importPreview.records.length === 0) return;

        const records = importPreview.records;
        const totalRecords = records.length;

        setIsImporting(true);
        setImportProgress(0);
        setImportLogs([]);
        setImportPhase('scanning');

        const pushLog = (message: string) => {
            setImportLogs((prev) => [...prev.slice(-79), message]);
        };

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        pushLog(`[INIT] Loading ${importFileName}`);
        pushLog(`[INFO] Detected ${importPreview.employeeCount} employees across ${importPreview.monthHint || 'unknown month'}`);
        await wait(350);

        pushLog('[SCAN] Reading punch machine workbook structure...');
        await wait(300);

        const scanSteps = Math.min(totalRecords, 48);
        const stepSize = Math.max(1, Math.ceil(totalRecords / scanSteps));

        for (let index = 0; index < totalRecords; index += stepSize) {
            const batchEnd = Math.min(index + stepSize, totalRecords);
            for (let i = index; i < batchEnd; i++) {
                const record = records[i];
                pushLog(
                    `[SCAN] ${record.userCode} | ${record.userNameFromFile || 'Employee'} | ${record.date} | IN ${record.inTime || '--:--'} | OUT ${record.outTime || '--:--'}`
                );
            }

            const scanPercent = Math.min(78, Math.round((batchEnd / totalRecords) * 78));
            setImportProgress(scanPercent);
            await wait(70);
        }

        pushLog('[SCAN] Row validation complete');
        pushLog('[MATCH] Mapping user codes to employee database...');
        setImportProgress(82);
        await wait(450);

        setImportPhase('uploading');
        pushLog('[UPLOAD] Writing attendance records to Google Sheet...');
        setImportProgress(88);

        try {
            const res = await fetch('/api/attendance/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: importPreview.records }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Import failed');
            }

            setImportProgress(96);
            pushLog(`[SAVE] ${data.imported} new record(s) added`);
            pushLog(`[SAVE] ${data.updated} existing record(s) updated`);
            if (data.skipped) {
                pushLog(`[WARN] ${data.skipped} record(s) skipped`);
            }
            if (Array.isArray(data.errors) && data.errors.length > 0) {
                data.errors.slice(0, 5).forEach((entry: { userCode: string; date: string; reason: string }) => {
                    pushLog(`[SKIP] ${entry.userCode} | ${entry.date} | ${entry.reason}`);
                });
            }

            await fetchMasterData();
            setImportProgress(100);
            setImportPhase('done');
            pushLog('[DONE] Punch machine import completed successfully');
            await wait(900);

            setImportPreview(null);
            setImportFileName('');
            setImportProgress(0);
            setImportLogs([]);
            setImportPhase('preview');
            success(
                `Imported ${data.imported} new and updated ${data.updated} attendance record(s).` +
                (data.skipped ? ` Skipped ${data.skipped}.` : '')
            );
        } catch (e: any) {
            pushLog(`[ERROR] ${e.message || 'Import failed'}`);
            setImportPhase('preview');
            error(e.message || 'Failed to import punch attendance');
        } finally {
            setIsImporting(false);
        }
    };

    const resetImportModal = () => {
        if (isImporting) return;
        setImportPreview(null);
        setImportFileName('');
        setImportProgress(0);
        setImportLogs([]);
        setImportPhase('preview');
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="h-16 md:h-20 bg-gray-50/20 dark:bg-slate-900/10" />);

        const todayStr = getIstDateString();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isWeeklyOff = isWeeklyOffForUser(user?.office, year, month, d);
            const record = history.find(h => normalizeDateSheet(h.date) === dateStr);
            const isToday = dateStr === todayStr;
            const leave = masterData?.leaves?.find((l:any) => {
                const start = normalizeDateSheet(l.startDate);
                const end = normalizeDateSheet(l.endDate);
                return String(l.userId) === String(user.id) && dateStr >= start && dateStr <= end && l.status === 'Approved';
            });

            let color = 'bg-white/50 dark:bg-slate-800/30';
            if (isWeeklyOff) color = 'bg-gray-100 dark:bg-slate-900/50 opacity-40';
            else if (leave) color = 'bg-purple-500/80 text-white shadow-purple-500/30 border-2 border-purple-400';
            else if (record?.inTime) {
                let isHalfDay = false;
                if (record.outTime) {
                    const hours = (new Date(record.outTime).getTime() - new Date(record.inTime).getTime()) / (1000 * 60 * 60);
                    if (hours <= 4) isHalfDay = true;
                }
                if (isHalfDay) {
                    color = 'bg-orange-500/90 text-white shadow-orange-200';
                } else {
                    color = record.outTime ? 'bg-green-500/90 text-white shadow-green-200' : 'bg-[#2563EB] text-white shadow-amber-300';
                }
            } else if (dateStr < todayStr) color = 'bg-red-500/80 text-white opacity-90';
            else if (isToday) color = 'border-2 border-[#2563EB] dark:border-[#60A5FA] text-[#2563EB] dark:text-[#60A5FA]';

            // Active check-in blinking animation
            const isActiveCheckIn = record?.inTime && !record?.outTime;

            days.push(
                <div key={d} className="flex flex-col items-center pt-2 h-16 md:h-20 group border border-white/5 transition-all">
                    <div className="relative">
                        {isActiveCheckIn && (
                            <>
                                <div className="absolute inset-0 w-8 h-8 md:w-12 md:h-12 rounded-full bg-[#2563EB] animate-ping opacity-30" />
                                <div className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] md:inset-[-6px] md:w-[calc(100%+12px)] md:h-[calc(100%+12px)] rounded-full border-2 border-[#2563EB] animate-pulse opacity-50" />
                            </>
                        )}
                        <div className={`relative z-10 w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all transform group-hover:scale-110 ${color}`}>
                            {d}
                        </div>
                    </div>
                </div>
            );
        }
        return days;
    };

    if (!user) return <div className="p-8 text-center text-gray-400 font-bold">Initializing Attendance...</div>;

    return (
        <div className="space-y-6 relative">
            {isPageLoading && (
                <div className="fixed inset-0 z-[999] bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-[#2563EB]/20 border-t-[#2563EB] dark:border-[#60A5FA]/20 dark:border-t-[#60A5FA] rounded-full animate-spin mb-4"></div>
                    <div className="text-[#2563EB] dark:text-[#60A5FA] font-semibold text-sm animate-pulse">Processing...</div>
                </div>
            )}
            {/* Page Header with Integrated Pill Tabs */}
            <div className="flex flex-col lg:flex-row items-center gap-4 px-1">
                <div className="text-center lg:text-left shrink-0 min-w-0 font-serif">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate">Attendance & Leave</h1>
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400 tracking-wider">Operational Personnel Tracking</p>
                </div>

                <div className="flex-1 w-full flex justify-center lg:justify-end">
                    <div 
                        style={{ backgroundColor: 'var(--panel-card)' }}
                        className="rounded-full border-2 border-b-4 border-[#2563EB] dark:border-[#60A5FA] shadow-sm transition-all p-1 overflow-x-auto no-scrollbar max-w-full flex items-center gap-1.5"
                    >
                        {[
                            { id: 'ATTENDANCE', label: 'Dashboard', icon: CalendarBtnIcon },
                            { id: 'ATTENDANCE_MASTER', label: 'Attendance Master', icon: UserBtnIcon },
                            { id: 'REPORT', label: 'Attendance Report', icon: ClockIcon },
                            { id: 'LATECOMERS', label: 'Latecomers', icon: ClipboardDocumentListIcon }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    flex items-center gap-2 px-3 md:px-6 py-2 rounded-full text-[13px] md:text-[10px] font-semibold   transition-all whitespace-nowrap
                                    ${activeTab === tab.id 
                                        ? 'bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black shadow-sm' 
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}
                                `}
                            >
                                <tab.icon className="w-4 h-4 stroke-2" />
                                <span className="hidden md:block">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {activeTab === 'ATTENDANCE' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Calendar Section */}
                    <div 
                        style={{ backgroundColor: 'var(--panel-card)' }}
                        className="lg:col-span-3 rounded-[32px] shadow-xl border border-white/40 dark:border-white/5 overflow-hidden backdrop-blur-xl"
                    >
                        <div className="p-6 flex justify-between items-center border-b border-white/10">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronLeftIcon className="w-5 h-5" /></button>
                            <h2 className="text-lg font-bold text-[#2563EB] dark:text-[#60A5FA] tracking-tighter">
                                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronRightIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="grid grid-cols-7 py-4 text-center text-[13px] font-semibold text-gray-400 border-b border-gray-50/5">
                            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 border-separate">
                            {renderCalendar()}
                        </div>
                    </div>

                    {/* Action & Location Panel */}
                    <div 
                        style={{ backgroundColor: 'var(--panel-card)' }}
                        className="lg:col-span-2 rounded-[32px] shadow-2xl p-6 border border-white/40 dark:border-white/5 relative flex flex-col xl:flex-row gap-6 overflow-hidden"
                    >
                        <div className={`absolute top-0 left-0 w-full h-1 ${currentStatus === 'CHECKED_IN' ? 'bg-[#2563EB] animate-pulse' : 'bg-[#2563EB] dark:bg-[#60A5FA] opacity-30'}`}></div>
                        
                        {/* Global Work System (Left Half) */}
                        <div className="flex-1 flex flex-col text-center items-center justify-start relative xl:border-r border-gray-200 dark:border-white/10 xl:pr-6 pb-6 xl:pb-0 border-b xl:border-b-0">
                            <h3 className="text-[13px] font-semibold text-gray-400 mb-2 opacity-70">
                                {currentStatus === 'CHECKED_IN' ? 'Active Shift' : 'Global Work System'}
                            </h3>
                            {currentStatus === 'CHECKED_IN' && checkInTime && (
                                <div className="text-[13px] font-bold text-[#2563EB]/50 dark:text-[#60A5FA]/50 mb-2">
                                    Since {checkInTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                            <div className={`text-4xl xl:text-5xl font-semibold mb-8 tracking-tighter font-mono ${currentStatus === 'CHECKED_IN' ? 'text-[#2563EB]' : 'text-[#2563EB] dark:text-white'}`}>{elapsedTime}</div>
                            
                            {currentStatus === 'IDLE' ? (
                                isWeeklyOffIstToday(user?.office) ? (
                                    <div className="w-full p-6 bg-gray-100 dark:bg-slate-900/50 rounded-3xl border border-gray-200 dark:border-white/10 text-gray-500 font-semibold text-sm">
                                        Check-in closed on {getWeeklyOffLabel(user?.office)} weekly off
                                    </div>
                                ) : (
                                <div className="space-y-4 w-full">
                                    <button
                                        onClick={() => setShowCameraMode('CHECK_IN')}
                                        disabled={!isInRange || isPageLoading}
                                        className={`w-full py-5 rounded-[24px] font-semibold text-sm   transition-all ${isInRange ? 'bg-[#2563EB] hover:bg-[#002a58] text-white shadow-xl shadow-[#2563EB]/20 hover:-translate-y-1' : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'}`}
                                    >
                                        {isPageLoading ? 'Processing...' : 'Check In System'}
                                    </button>
                                    {!isInRange && (
                                        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-[13px] font-bold text-red-500 tracking-wider">
                                            {isMobile ? 'Mobile' : 'Desktop'}: Reach {rangeThreshold}m zone to unlock
                                        </div>
                                    )}
                                </div>
                                )
                            ) : currentStatus === 'CHECKED_IN' ? (
                                <button 
                                    onClick={() => setShowCameraMode('CHECK_OUT')} 
                                    disabled={!isInRange || isPageLoading}
                                    className={`w-full py-5 rounded-[24px] font-semibold text-sm   shadow-xl transition-all hover:-translate-y-1 text-white ${isInRange ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 shadow-none'}`}
                                >
                                    {isPageLoading ? 'Processing...' : '⏹ Check Out & End Shift'}
                                </button>
                            ) : (
                                <div className="w-full p-6 bg-green-500/10 rounded-3xl border border-green-500/20 text-green-600 font-semibold text-sm">Shift Completed ✅</div>
                            )}

                            <div className="w-full mt-6">
                                {/* Current Actual */}
                                {liveLocation && (
                                    <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-white/5 text-center shadow-inner mb-3">
                                        <div className="inline-flex items-center gap-2 mb-3 bg-green-500/10 px-3 py-1 rounded-full text-green-600 border border-green-500/20">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[13px] font-semibold">Live GPS Active</span>
                                        </div>
                                        {liveAddress && (
                                           <div className="mb-3 text-[14px] font-bold text-gray-500 dark:text-gray-400 w-full px-2 mx-auto leading-relaxed">
                                               <MapPinIcon className="w-3 h-3 inline mr-1 text-[#2563EB] dark:text-[#60A5FA]" />
                                               {liveAddress}
                                           </div>
                                        )}
                                        <div className="flex justify-center gap-6">
                                            <div className="text-[14px] font-mono font-bold text-gray-600 dark:text-gray-300">
                                                <span className="text-gray-400 mr-1">LAT</span> {liveLocation.lat.toFixed(5)}
                                            </div>
                                            <div className="text-[14px] font-mono font-bold text-gray-600 dark:text-gray-300">
                                                <span className="text-gray-400 mr-1">LNG</span> {liveLocation.lng.toFixed(5)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-3">
                                    <button onClick={refreshLocationManual} className="w-full py-3 bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/5 text-[14px] font-semibold text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2 transition-all shadow-sm">
                                        <ArrowPathIcon className="w-4 h-4" />
                                        Refresh GPS
                                    </button>
                                    
                                    {liveLocation && closestPoint && !isInRange && (
                                       <a 
                                           href={`https://www.google.com/maps/dir/?api=1&destination=${closestPoint.lat},${closestPoint.long}`} 
                                           target="_blank" 
                                           rel="noreferrer" 
                                           className="w-full py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-xl border border-blue-200 dark:border-blue-500/20 text-[14px] font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 transition-all shadow-sm"
                                       >
                                           <MapPinIcon className="w-4 h-4" />
                                           Find Gap
                                       </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Location Intelligence (Right Half) */}
                        <div className="flex-1 flex flex-col justify-start">
                             <h3 className="text-[13px] font-semibold mb-4 flex items-center justify-center xl:justify-start gap-2 text-gray-800 dark:text-white">
                                <MapPinIcon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" /> Location Intelligence
                             </h3>

                             {!user.late_long ? (
                                 <div className="flex-1 flex items-center justify-center opacity-40 italic text-[14px] font-bold text-gray-500">No HQ Registered</div>
                             ) : (
                                 <div className="flex-1 flex flex-col gap-3 overflow-y-auto no-scrollbar max-h-[450px]">
                                     {/* Registered Bases */}
                                     {registeredPoints && registeredPoints.length > 0 && (
                                         <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-white/5 space-y-2 shadow-inner">
                                             <div className="text-[13px] font-semibold text-gray-400 flex items-center justify-between pb-1">
                                                 <span>Registered Bases ({registeredPoints.length})</span>
                                                 {liveLocation && <span>Distance</span>}
                                             </div>
                                             {registeredPoints.map((pt, idx) => {
                                                 const ptDist = liveLocation ? calculateDistance(liveLocation.lat, liveLocation.lng, pt.lat, pt.long) : null;
                                                 const isNearest = closestPoint && pt.lat === closestPoint.lat && pt.long === closestPoint.long;
                                                 
                                                 return (
                                                     <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isNearest ? 'border-[#2563EB]/20 bg-[#2563EB]/5 dark:border-[#60A5FA]/20 dark:bg-[#60A5FA]/10 shadow-sm' : 'border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                                                         <div className="flex items-center gap-2">
                                                             <MapPinIcon className={`w-4 h-4 shrink-0 ${isNearest ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-gray-400'}`} />
                                                             <div>
                                                                 <div className={`text-[14px] font-bold  tracking-wider ${isNearest ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                     {pt.name || `Location ${idx + 1}`}
                                                                     {isNearest && <span className="ml-2 text-[13px] bg-[#2563EB] text-white dark:bg-[#60A5FA] dark:text-[#60A5FA] px-1.5 py-0.5 rounded font-semibold">Closest</span>}
                                                                 </div>
                                                             </div>
                                                         </div>
                                                         
                                                         {ptDist !== null && (
                                                             <div className={`text-[14px] font-semibold tracking-tighter ${ptDist <= rangeThreshold ? 'text-green-500' : 'text-gray-400'}`}>
                                                                 {Math.round(ptDist)}m
                                                             </div>
                                                         )}
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     )}

                                     {/* Big Distance Display */}
                                     <div className="text-center py-2 flex flex-col items-center justify-center mt-4">
                                         <div className="text-[12px] font-semibold text-gray-400 mb-1">Nearest Gap</div>
                                         <div className={`text-4xl font-semibold tracking-tighter ${isInRange ? 'text-green-500' : 'text-red-500'} drop-shadow-sm`}>
                                             {distance !== null ? `${Math.round(distance)}m` : '...'}
                                         </div>
                                         {isInRange && (
                                             <div className="text-[13px] font-semibold mt-1 py-1 px-3 rounded-full inline-block bg-green-500/10 text-green-600 border border-green-500/20">
                                                 In Range ✓
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            )}









            {/* MASTER LIST */}
            {activeTab === 'ATTENDANCE_MASTER' && (
                <div 
                    style={{ backgroundColor: 'var(--panel-card)' }}
                    className="rounded-[32px] p-4 md:p-8 shadow-xl border border-white/10 overflow-x-auto min-h-[600px]"
                >
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-white/5">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronLeftIcon className="w-5 h-5 text-gray-500" /></button>
                            <span className="text-sm font-semibold text-[#2563EB] dark:text-[#60A5FA] w-32 text-center">
                                {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronRightIcon className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <input 
                            type="text" 
                            placeholder="SEARCH EMPLOYEE..." 
                            value={masterSearch}
                            onChange={(e) => setMasterSearch(e.target.value)}
                            className="w-full md:w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2.5 text-[14px] font-semibold placeholder-gray-400 focus:outline-none focus:border-[#2563EB] transition-colors shadow-sm"
                        />
                    </div>
                    {!masterData ? (
                        <div className="text-gray-400 text-sm animate-pulse font-semibold text-center py-20">SYNCING DATA...</div>
                    ) : (
                        <table className="w-full text-left border-separate border-spacing-y-4 min-w-[1000px] font-serif">
                            <thead>
                                <tr className="text-sm font-medium text-gray-500 text-center">
                                    <th className="px-6 py-2 text-left">Employee Details</th>
                                    <th className="px-4 py-2">Presents</th>
                                    <th className="px-4 py-2">Absents</th>
                                    <th className="px-4 py-2">Leaves</th>
                                    <th className="px-4 py-2">Half Day</th>
                                    <th className="px-4 py-2">Total Hours</th>
                                    <th className="px-4 py-2">System Score</th>
                                    <th className="px-4 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {masterData.users
                                    .filter(u => isAdminOrEA || String(u.id) === String(user.id))
                                    .filter(u => (u.full_name || u.username)?.toLowerCase().includes(masterSearch.toLowerCase()) || String(u.id).toLowerCase().includes(masterSearch.toLowerCase()))
                                    .map(u => {
                                     const monthAtt = masterData?.attendance.filter(a => String(a.userId) === String(u.id)) || [];
                                     const uLeaves = masterData?.leaves?.filter((l:any) => String(l.userId) === String(u.id) && l.status === 'Approved') || [];
                                     
                                     // Quick summary logic for current month
                                     const year = currentDate.getFullYear();
                                     const month = currentDate.getMonth();
                                     const daysInMonth = new Date(year, month + 1, 0).getDate();
                                     const todayStr = getIstDateString();
                                     
                                     let presents = 0;
                                     let absents = 0;
                                     let leavesCount = 0;
                                     let halfDays = 0;
                                     let totalHours = 0;
                                     let totalWorkingDays = 0;

                                     // Generate day cells
                                     const dayCells = [];
                                     for (let d = 1; d <= daysInMonth; d++) {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const isWeeklyOff = isWeeklyOffForUser(u.office, year, month, d);
                                        const offLabel = getWeeklyOffLabel(u.office);
                                        
                                        if (!isWeeklyOff) totalWorkingDays++;

                                        const record = monthAtt.find(h => normalizeDateSheet(h.date) === dateStr);
                                        const leave = uLeaves.find((l:any) => {
                                            const start = normalizeDateSheet(l.startDate);
                                            const end = normalizeDateSheet(l.endDate);
                                            return dateStr >= start && dateStr <= end;
                                        });

                                        let statusChar = '-';
                                        let statusColor = 'text-gray-300';
                                        let dotColor = null;
                                        let dotText = '';

                                        let isLate = false;
                                        if (record?.inTime) {
                                            const inIST = new Date(new Date(record.inTime).getTime() + 5.5 * 3600000);
                                            isLate = inIST.getUTCHours() > 9 || (inIST.getUTCHours() === 9 && inIST.getUTCMinutes() > 40);
                                        }

                                        if (isWeeklyOff) {
                                            statusChar = offLabel;
                                            statusColor = 'text-gray-300 font-bold';
                                        } else if (leave) {
                                            leavesCount++;
                                            statusChar = 'L';
                                            statusColor = 'text-[#2563EB] font-semibold';
                                        } else if (record?.inTime) {
                                            let hours = 0;
                                            if (record.outTime) {
                                                hours = (new Date(record.outTime).getTime() - new Date(record.inTime).getTime()) / (1000 * 60 * 60);
                                                totalHours += hours;
                                            }
                                            
                                            // Half day occurs if checked out AND total logged time <= 4 hours
                                            if (record.outTime && hours <= 4) {
                                                halfDays++;
                                                statusChar = isLate ? 'HD(L)' : 'HD';
                                                statusColor = 'text-orange-500 font-semibold';
                                                dotColor = 'bg-orange-500';
                                                dotText = '0.5';
                                            } else {
                                                presents++;
                                                statusChar = isLate ? 'P(L)' : 'P';
                                                statusColor = 'text-green-500 font-semibold';
                                                dotColor = 'bg-green-500';
                                                dotText = '1';
                                            }
                                        } else if (dateStr < todayStr) {
                                            absents++;
                                            statusChar = 'A';
                                            statusColor = 'text-red-500 font-semibold';
                                            dotColor = 'bg-red-500';
                                            dotText = '-1';
                                        }

                                        dayCells.push({ d, statusChar, statusColor, dotColor, dotText, isLate });
                                     }

                                     const monthlyScore = (presents * 1) + (halfDays * 0.5) - (absents * 1);
                                     const cumulativePercent = totalWorkingDays > 0 ? ((monthlyScore / totalWorkingDays) * 100).toFixed(0) : 0;
                                     const isExpanded = expandedUserId === u.id;

                                     return (
                                        <React.Fragment key={u.id}>
                                            <tr className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm relative z-10 hover:shadow-md transition-shadow">
                                                <td className="px-6 py-4 rounded-l-[24px]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center font-semibold text-white shadow-sm overflow-hidden shrink-0">
                                                            {u.image_url ? <img src={u.image_url} alt="" className="w-full h-full object-cover" /> : <UserBtnIcon className="w-5 h-5 text-white" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-[#2563EB] dark:text-white tracking-tighter">{u.full_name || u.username}</div>
                                                            <div className="text-[13px] font-bold text-gray-400 mt-0.5">ID: {String(u.id).substring(0, 6)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="bg-green-100 text-green-600 dark:bg-green-500/20 px-4 py-2 rounded-full text-sm font-semibold">{presents}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="bg-red-100 text-red-600 dark:bg-red-500/20 px-4 py-2 rounded-full text-sm font-semibold">{absents}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 px-4 py-2 rounded-full text-sm font-semibold">{leavesCount}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="bg-orange-100 text-orange-600 dark:bg-orange-500/20 px-4 py-2 rounded-full text-sm font-semibold">{halfDays}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-sm font-semibold text-[#2563EB]">
                                                    {totalHours.toFixed(1)}h
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="bg-red-50 text-red-500 dark:bg-red-500/10 px-4 py-2 rounded-full text-sm font-semibold">{cumulativePercent}%</span>
                                                </td>
                                                <td className="px-4 py-4 text-center rounded-r-[24px]">
                                                    <button 
                                                        onClick={() => setExpandedUserId(isExpanded ? null : u.id)} 
                                                        className="w-8 h-8 rounded-[12px] bg-[#2563EB] hover:bg-[#e6c000] text-white dark:text-black flex items-center justify-center font-semibold text-xl transition-all mx-auto shadow-sm shadow-[#2563EB]/50 active:scale-95"
                                                    >
                                                        {isExpanded ? '-' : '+'}
                                                    </button>
                                                </td>
                                            </tr>
                                            
                                            {isExpanded && (
                                                <tr className="animate-in fade-in slide-in-from-top-4 duration-200">
                                                    <td colSpan={8} className="px-2 md:px-8 pb-8 pt-4">
                                                        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 md:p-8 border border-gray-100 dark:border-white/5 shadow-2xl">
                                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                                                <h4 className="text-[#2563EB] font-semibold flex items-center gap-3 tracking-tighter text-lg">
                                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                                    </svg>
                                                                    Performance Analysis
                                                                </h4>
                                                                <div className="flex gap-8 text-right bg-gray-50/50 dark:bg-slate-900/50 p-4 rounded-2xl w-full md:w-auto overflow-hidden">
                                                                    <div className="flex-1 md:flex-none">
                                                                        <div className="text-[13px] font-semibold text-gray-400 mb-1">Monthly Points</div>
                                                                        <div className="text-xl font-semibold text-[#2563EB] dark:text-white">{monthlyScore.toFixed(1)}</div>
                                                                    </div>
                                                                    <div className="w-[1px] bg-gray-200 dark:bg-white/10 shrink-0"></div>
                                                                    <div className="flex-1 md:flex-none">
                                                                        <div className="text-[13px] font-semibold text-gray-400 mb-1">Cumulative Score</div>
                                                                        <div className="text-xl font-semibold text-[#2563EB]">{cumulativePercent}%</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-3">
                                                                {dayCells.map((c, idx) => (
                                                                    <div key={idx} className={`relative ${c.isLate && c.statusChar.includes('HD') ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-500/30' : 'bg-gray-50/50 dark:bg-slate-900 border-gray-100 dark:border-white/5'} rounded-[20px] p-3 flex flex-col items-center justify-center min-h-[72px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow group`}>
                                                                        {c.dotColor && <div className={`absolute -top-2 -right-2 w-auto min-w-[22px] h-5 px-1.5 rounded-full ${c.dotColor} border-[3px] border-white dark:border-slate-800 text-[13px] text-white flex items-center justify-center font-semibold shadow-sm z-10 scale-105`}>{c.dotText}</div>}
                                                                        <div className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 mb-2 opacity-80">{c.d}</div>
                                                                        <div className={`text-[14px] font-semibold  tracking-wider ${c.statusColor}`}>{c.statusChar}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                     );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* REPORT LIST */}
            {activeTab === 'REPORT' && (
                <div className="bg-[#FCF9F0] dark:bg-slate-800 rounded-[32px] shadow-xl border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
                    {/* Header Top - Compact Controls */}
                    <div className="p-3 px-4 md:px-6 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 flex flex-wrap lg:flex-nowrap items-center justify-center gap-3 w-full">
                        <input 
                            type="text" 
                            placeholder="Search by name..." 
                            value={masterSearch}
                            onChange={(e) => setMasterSearch(e.target.value)}
                            className="w-full md:w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 text-[13px] font-semibold placeholder-gray-400 focus:outline-none focus:border-[#2563EB] shadow-sm shrink-0"
                        />
                        
                        {/* Toggle Mode */}
                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-full p-1 border border-gray-200 dark:border-white/10 shadow-sm shrink-0">
                            <button onClick={() => setReportViewMode('STATUS')} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${reportViewMode === 'STATUS' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Status</button>
                            <button onClick={() => setReportViewMode('TIME')} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${reportViewMode === 'TIME' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Time</button>
                            <button onClick={() => setReportViewMode('INFO')} className={`px-4 py-1 rounded-full text-[13px] font-semibold   transition-all ${reportViewMode === 'INFO' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Info</button>
                        </div>

                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-gray-100 dark:border-white/5 shrink-0">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronLeftIcon className="w-3 h-3 text-[#2563EB]" /></button>
                            <span className="text-[13px] font-semibold text-gray-800 dark:text-white tracking-tighter w-24 text-center">
                                {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronRightIcon className="w-3 h-3 text-[#2563EB]" /></button>
                        </div>

                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black px-4 py-1.5 rounded-full font-semibold text-[13px] shadow-lg shadow-[#2563EB]/20 hover:-translate-y-0.5 transition-all active:scale-95 shrink-0"
                        >
                            <ArrowDownTrayIcon className="w-3 h-3" />
                            Export
                        </button>

                        {isAdminOrEA && (
                            <>
                                <input
                                    ref={punchImportInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={handlePunchImportFile}
                                />
                                <button
                                    onClick={() => punchImportInputRef.current?.click()}
                                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-full font-semibold text-[13px] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-all active:scale-95 shrink-0"
                                >
                                    <ArrowUpTrayIcon className="w-3 h-3" />
                                    Import Punch Data
                                </button>
                            </>
                        )}
                    </div>

                    {!masterData ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse font-semibold">SYNCING DATA...</div>
                    ) : (
                        <>
                            {/* Dummy Top Scrollbar */}
                            <div 
                                ref={topScrollRef}
                                onScroll={handleTopScroll}
                                className="w-full overflow-x-auto custom-scrollbar border-b border-gray-100 dark:border-white/5"
                            >
                                <div ref={dummyDivRef} style={{ height: '1px' }} />
                            </div>

                            <div 
                               ref={tableScrollRef}
                               onScroll={handleTableScroll}
                               style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }}
                               className="flex-1 overflow-auto custom-scrollbar relative"
                             >
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr>
                                        <th 
                                          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--panel-border)' }}
                                          className="sticky top-0 left-0 z-50 p-4 min-w-[200px] border-b border-r text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                        >USER DETAILS / DAYS</th>
                                        {(() => {
                                            const year = currentDate.getFullYear();
                                            const month = currentDate.getMonth();
                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                            return Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                                                <th 
                                                  key={d} 
                                                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--panel-border)' }}
                                                  className="sticky top-0 z-40 p-3 border-b border-r text-center text-[14px] font-semibold text-gray-800 dark:text-white"
                                                >{d}</th>
                                            ));
                                        })()}
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterData.users
                                        .filter(u => isAdminOrEA || String(u.id) === String(user.id))
                                        .filter(u => (u.full_name || u.username)?.toLowerCase().includes(masterSearch.toLowerCase()) || String(u.id).toLowerCase().includes(masterSearch.toLowerCase()))
                                        .map(u => {
                                            const monthAtt = masterData?.attendance.filter(a => String(a.userId) === String(u.id)) || [];
                                            const uLeaves = masterData?.leaves?.filter((l:any) => String(l.userId) === String(u.id) && l.status === 'Approved') || [];
                                            
                                            const year = currentDate.getFullYear();
                                            const month = currentDate.getMonth();
                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                            const todayStr = getIstDateString();
                                            
                                            let presents = 0, absents = 0, leavesCount = 0, halfDays = 0, totalWorkingDays = 0;

                                            const dayCells = [];
                                            for (let d = 1; d <= daysInMonth; d++) {
                                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const isWeeklyOff = isWeeklyOffForUser(u.office, year, month, d);
                                                const offLabel = getWeeklyOffLabel(u.office);
                                                
                                                if (!isWeeklyOff) totalWorkingDays++;

                                                const record = monthAtt.find(h => normalizeDateSheet(h.date) === dateStr);
                                                const leave = uLeaves.find((l:any) => {
                                                    const start = normalizeDateSheet(l.startDate);
                                                    const end = normalizeDateSheet(l.endDate);
                                                    return dateStr >= start && dateStr <= end;
                                                });

                                                let statusChar = '-';
                                                let statusColor = 'text-gray-300';
                                                let dotText = '';
                                                let rawIn = record?.inTime;
                                                let rawOut = record?.outTime;
                                                let inPhoto = record?.inPhoto;
                                                let outPhoto = record?.outPhoto;
                                                let inLocation = record?.inLocation;
                                                let outLocation = record?.outLocation;

                                                let isLate = false;
                                                if (rawIn) {
                                                    const inIST = new Date(new Date(rawIn).getTime() + 5.5 * 3600000);
                                                    isLate = inIST.getUTCHours() > 9 || (inIST.getUTCHours() === 9 && inIST.getUTCMinutes() > 40);
                                                }

                                                if (isWeeklyOff) {
                                                    statusChar = offLabel;
                                                    statusColor = 'text-gray-800 dark:text-gray-200 font-bold';
                                                } else if (leave) {
                                                    leavesCount++;
                                                    statusChar = 'L';
                                                    statusColor = 'text-[#2563EB] font-semibold';
                                                } else if (rawIn) {
                                                    let hours = 0;
                                                    if (rawOut) hours = (new Date(rawOut).getTime() - new Date(rawIn).getTime()) / 3600000;
                                                    if (rawOut && hours <= 4) {
                                                        halfDays++;
                                                        statusChar = isLate ? 'HD(L)' : 'HD';
                                                        statusColor = 'text-orange-500 font-semibold';
                                                        dotText = '+0.5';
                                                    } else {
                                                        presents++;
                                                        statusChar = isLate ? 'P(L)' : 'P';
                                                        statusColor = 'text-green-500 font-semibold';
                                                        dotText = '+1';
                                                    }
                                                } else if (dateStr < todayStr) {
                                                    absents++;
                                                    statusChar = 'A';
                                                    statusColor = 'text-red-500 font-semibold';
                                                    dotText = '-1';
                                                }

                                                dayCells.push({ d, statusChar, statusColor, dotText, rawIn, rawOut, inPhoto, outPhoto, inLocation, outLocation, isLate, isWeeklyOff });
                                            }

                                            const monthlyScore = (presents * 1) + (halfDays * 0.5) - (absents * 1);
                                            const cumP = totalWorkingDays > 0 ? ((monthlyScore / totalWorkingDays) * 100).toFixed(0) : "0";

                                            return (
                                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td 
                                                      style={{ backgroundColor: 'white', borderColor: 'var(--panel-border)' }}
                                                      className="sticky left-0 z-30 p-4 border-b border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div 
                                                              style={{ borderColor: 'var(--panel-border)' }}
                                                              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border flex items-center justify-center font-semibold overflow-hidden shrink-0"
                                                            >
                                                                {u.image_url ? <img src={u.image_url} alt="" className="w-full h-full object-cover" /> : <UserBtnIcon className="w-5 h-5 text-[#2563EB]" />}
                                                            </div>
                                                            <div>
                                                                <div className="text-[14px] font-semibold text-gray-800 dark:text-white tracking-tighter truncate w-32">{u.full_name || u.username}</div>
                                                                <div className="text-[13px] font-bold text-[#2563EB] mt-0.5">{cumP}%</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {dayCells.map((c, idx) => (
                                                        <td 
                                                          key={idx} 
                                                          style={{ borderColor: 'var(--panel-border)' }}
                                                          className={`p-2 border-b border-r text-center min-w-[60px] align-middle ${c.isWeeklyOff ? 'bg-gray-50 dark:bg-slate-900/40' : ''} ${c.isLate && c.statusChar.includes('HD') ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}
                                                        >
                                                            {reportViewMode === 'STATUS' ? (
                                                                <div className="flex flex-col items-center justify-center gap-1">
                                                                    <div className={`text-[14px] font-semibold  tracking-tighter ${c.statusColor}`}>{c.statusChar}</div>
                                                                    {c.dotText && (
                                                                         <div className={`text-[13px] font-semibold ${c.statusChar === 'P' || c.statusChar === 'P(L)' ? 'text-green-500' : c.statusChar === 'HD' || c.statusChar === 'HD(L)' ? 'text-orange-500' : 'text-red-500'}`}>
                                                                            {c.dotText}
                                                                         </div>
                                                                    )}
                                                                </div>
                                                            ) : reportViewMode === 'TIME' ? (
                                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                                    {c.isWeeklyOff || c.statusChar === 'L' || c.statusChar === 'A' || c.statusChar === '-' ? (
                                                                        <div className={`text-[14px] font-semibold  tracking-tighter ${c.statusColor}`}>{c.statusChar}</div>
                                                                    ) : (
                                                                        <>
                                                                            <div className="text-[13px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">
                                                                                {c.rawIn ? (
                                                                                    c.inPhoto ? (
                                                                                        <a href={c.inPhoto.startsWith('http') ? c.inPhoto : `https://drive.google.com/file/d/${c.inPhoto}/view`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline decoration-blue-300 hover:decoration-blue-600 transition-colors" title="View Check-in Photo">
                                                                                            {formatTimeIST(c.rawIn)}
                                                                                        </a>
                                                                                    ) : (
                                                                                        formatTimeIST(c.rawIn)
                                                                                    )
                                                                                ) : '-'}
                                                                            </div>
                                                                            <div className="text-[13px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">
                                                                                {c.rawOut ? (
                                                                                    c.outPhoto ? (
                                                                                        <a href={c.outPhoto.startsWith('http') ? c.outPhoto : `https://drive.google.com/file/d/${c.outPhoto}/view`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline decoration-blue-300 hover:decoration-blue-600 transition-colors" title="View Check-out Photo">
                                                                                            {formatTimeIST(c.rawOut)}
                                                                                        </a>
                                                                                    ) : (
                                                                                        formatTimeIST(c.rawOut)
                                                                                    )
                                                                                ) : '-'}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center gap-1 min-w-[120px]">
                                                                    {c.isWeeklyOff || c.statusChar === 'L' || c.statusChar === 'A' || c.statusChar === '-' ? (
                                                                        <div className={`text-[14px] font-semibold  tracking-tighter ${c.statusColor}`}>{c.statusChar}</div>
                                                                    ) : (
                                                                        <>
                                                                            {c.rawIn && (
                                                                                <div className="flex items-start gap-2 max-w-[180px] bg-gray-50 dark:bg-slate-800/50 rounded-md p-1.5 border border-gray-100 dark:border-white/5 shadow-sm text-left">
                                                                                    {c.inPhoto && (
                                                                                        <a href={c.inPhoto.startsWith('http') ? c.inPhoto : `https://drive.google.com/file/d/${c.inPhoto}/view`} target="_blank" rel="noopener noreferrer" className="shrink-0 group mt-0.5">
                                                                                            <img src={c.inPhoto.startsWith('http') ? c.inPhoto : `https://drive.google.com/thumbnail?id=${c.inPhoto}&sz=w200-h200`} alt="In" className="w-6 h-6 rounded object-cover border border-gray-200 dark:border-white/20 group-hover:scale-[5] transition-transform origin-left z-10 relative shadow-sm" title="View Check-in Photo" />
                                                                                        </a>
                                                                                    )}
                                                                                    <div className="text-[13px] font-medium text-gray-600 dark:text-gray-300 leading-tight w-[130px] whitespace-normal break-words line-clamp-3" title={c.inLocation || 'Location unavailable'}>
                                                                                        <span className="font-semibold text-[#2563EB] dark:text-[#60A5FA] mr-1">(IN)</span>
                                                                                        {c.inLocation || 'N/A'}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {c.rawOut && (
                                                                                <div className="flex items-start gap-2 max-w-[180px] bg-gray-50 dark:bg-slate-800/50 rounded-md p-1.5 border border-gray-100 dark:border-white/5 shadow-sm text-left mt-0.5">
                                                                                    {c.outPhoto && (
                                                                                        <a href={c.outPhoto.startsWith('http') ? c.outPhoto : `https://drive.google.com/file/d/${c.outPhoto}/view`} target="_blank" rel="noopener noreferrer" className="shrink-0 group mt-0.5">
                                                                                            <img src={c.outPhoto.startsWith('http') ? c.outPhoto : `https://drive.google.com/thumbnail?id=${c.outPhoto}&sz=w200-h200`} alt="Out" className="w-6 h-6 rounded object-cover border border-gray-200 dark:border-white/20 group-hover:scale-[5] transition-transform origin-left z-10 relative shadow-sm" title="View Check-out Photo" />
                                                                                        </a>
                                                                                    )}
                                                                                    <div className="text-[13px] font-medium text-gray-600 dark:text-gray-300 leading-tight w-[130px] whitespace-normal break-words line-clamp-3" title={c.outLocation || 'Location unavailable'}>
                                                                                        <span className="font-semibold text-red-500 mr-1">(OUT)</span>
                                                                                        {c.outLocation || 'N/A'}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </div>
            )}

            {/* LATECOMERS LIST */}
            {activeTab === 'LATECOMERS' && (
                <div 
                    style={{ backgroundColor: 'var(--panel-card)' }}
                    className="rounded-[32px] p-4 md:p-8 shadow-xl border border-white/10 overflow-x-auto min-h-[600px]"
                >
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-white/5">
                            <button onClick={() => setLatecomersDate(new Date(new Date(latecomersDate).setDate(latecomersDate.getDate() - 1)))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronLeftIcon className="w-5 h-5 text-gray-500" /></button>
                            <span className="text-sm font-semibold text-[#2563EB] dark:text-[#60A5FA] w-32 text-center">
                                {latecomersDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => setLatecomersDate(new Date(new Date(latecomersDate).setDate(latecomersDate.getDate() + 1)))} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><ChevronRightIcon className="w-5 h-5 text-gray-500" /></button>
                        </div>
                    </div>
                    {!masterData ? (
                        <div className="text-gray-400 text-sm animate-pulse font-semibold text-center py-20">SYNCING DATA...</div>
                    ) : (
                        <table className="w-full text-left border-separate border-spacing-y-4 min-w-[800px] font-serif">
                            <thead>
                                <tr className="text-sm font-medium text-gray-500 text-center">
                                    <th className="px-6 py-2 text-left">Employee Details</th>
                                    <th className="px-4 py-2">In Time</th>
                                    <th className="px-4 py-2">Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                {masterData.users
                                    .filter(u => isAdminOrEA || String(u.id) === String(user.id))
                                    .map(u => {
                                        const dateStr = `${latecomersDate.getFullYear()}-${String(latecomersDate.getMonth() + 1).padStart(2, '0')}-${String(latecomersDate.getDate()).padStart(2, '0')}`;
                                        const record = masterData.attendance.find(a => String(a.userId) === String(u.id) && normalizeDateSheet(a.date) === dateStr);
                                        
                                        if (!record?.inTime) return null;
                                        
                                        const inIST = new Date(new Date(record.inTime).getTime() + 5.5 * 3600000);
                                        const isLate = inIST.getUTCHours() > 9 || (inIST.getUTCHours() === 9 && inIST.getUTCMinutes() > 40);
                                        
                                        if (!isLate) return null;

                                        return (
                                            <tr key={u.id} className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm relative z-10 hover:shadow-md transition-shadow">
                                                <td className="px-6 py-4 rounded-l-[24px]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center font-semibold text-white shadow-sm overflow-hidden shrink-0">
                                                            {u.image_url ? <img src={u.image_url} alt="" className="w-full h-full object-cover" /> : <UserBtnIcon className="w-5 h-5 text-white" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-[#2563EB] dark:text-white tracking-tighter">{u.full_name || u.username}</div>
                                                            <div className="text-[13px] font-bold text-gray-400 mt-0.5">ID: {String(u.id).substring(0, 6)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="bg-red-50 text-red-500 dark:bg-red-500/10 px-4 py-2 rounded-full text-sm font-semibold">{formatTimeIST(record.inTime)}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center rounded-r-[24px]">
                                                    <div className="text-[13px] font-medium text-gray-500 dark:text-gray-400 max-w-[250px] mx-auto truncate" title={record.inLocation || 'N/A'}>
                                                        {record.inLocation || 'N/A'}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {importPreview && (
                <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl max-h-[calc(100vh-1.5rem)] my-auto shadow-2xl border border-white/10 overflow-hidden flex flex-col">
                        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-[#2563EB] text-white">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold">Import Punch Data</h3>
                                    <p className="text-[13px] font-bold text-white/70 mt-1">{importFileName}</p>
                                </div>
                                {isImporting && (
                                    <div className="text-right">
                                        <p className="text-[13px] font-semibold text-emerald-200">
                                            {importPhase === 'scanning' ? 'Scanning File' : importPhase === 'uploading' ? 'Uploading Data' : 'Completed'}
                                        </p>
                                        <p className="text-2xl font-semibold text-white">{importProgress}%</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 shadow-inner">
                                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                                    <div className="flex items-center gap-2">
                                        <DocumentTextIcon className="w-4 h-4 text-emerald-400" />
                                        <span className="text-[13px] font-semibold text-slate-300">File Preview</span>
                                    </div>
                                    <span className="text-[13px] font-bold text-slate-500">XLSX</span>
                                </div>

                                <div className="relative h-28 sm:h-32 overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)]">
                                    <div className="absolute inset-0 opacity-30">
                                        {Array.from({ length: 8 }).map((_, rowIndex) => (
                                            <div key={rowIndex} className="grid grid-cols-6 gap-px px-3 py-1">
                                                {Array.from({ length: 6 }).map((__, colIndex) => (
                                                    <div key={colIndex} className="h-3 rounded-sm bg-slate-700/60" />
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="absolute inset-x-4 top-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                                        <p className="text-[13px] font-semibold text-emerald-300">Monthly Attendance Report</p>
                                        <p className="text-[13px] font-medium text-slate-400 mt-1 truncate">{importFileName}</p>
                                    </div>

                                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-400/10 to-transparent pointer-events-none" />

                                    {isImporting && (
                                        <>
                                            <div
                                                className="absolute inset-x-0 h-8 bg-gradient-to-b from-emerald-400/0 via-emerald-400/25 to-emerald-400/0 border-y border-emerald-300/40 shadow-[0_0_30px_rgba(52,211,153,0.35)] animate-punch-scan"
                                                style={{ top: `${Math.max(8, Math.min(78, importProgress * 0.75))}%` }}
                                            />
                                            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(16,185,129,0.04)_0px,rgba(16,185,129,0.04)_1px,transparent_1px,transparent_8px)] pointer-events-none" />
                                        </>
                                    )}
                                </div>
                            </div>

                            {isImporting && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[13px] font-semibold text-slate-500">
                                        <span>{importPhase === 'scanning' ? 'Scanning punch rows' : importPhase === 'uploading' ? 'Saving to attendance sheet' : 'Import complete'}</span>
                                        <span>{importProgress}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 ease-out"
                                            style={{ width: `${importProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isImporting && (
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-3 sm:p-4 text-center">
                                        <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">Employees</p>
                                        <p className="text-2xl font-semibold text-emerald-800 dark:text-emerald-200">{importPreview.employeeCount}</p>
                                    </div>
                                    <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 text-center">
                                        <p className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">Records</p>
                                        <p className="text-2xl font-semibold text-blue-800 dark:text-blue-200">{importPreview.records.length}</p>
                                    </div>
                                    <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4 text-center">
                                        <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">Month</p>
                                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mt-2">{importPreview.monthHint || 'N/A'}</p>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 overflow-hidden">
                                <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
                                    <div className="flex gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                                    </div>
                                    <span className="text-[13px] font-semibold text-slate-400">Import Console</span>
                                </div>
                                <div
                                    ref={importLogRef}
                                    className="h-28 sm:h-32 overflow-y-auto p-3 font-mono text-[13px] leading-5 text-emerald-300 bg-[#020617]"
                                >
                                    {importLogs.length === 0 ? (
                                        <p className="text-slate-500">Waiting to start import...</p>
                                    ) : (
                                        importLogs.map((log, index) => (
                                            <div key={`${log}-${index}`} className="whitespace-pre-wrap break-all">
                                                <span className="text-slate-500 mr-2">{String(index + 1).padStart(2, '0')}</span>
                                                {log}
                                            </div>
                                        ))
                                    )}
                                    {isImporting && (
                                        <div className="mt-1 text-emerald-400 animate-pulse">▮ processing...</div>
                                    )}
                                </div>
                            </div>

                            {!isImporting && importPreview.warnings.length > 0 && (
                                <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 max-h-32 overflow-y-auto">
                                    <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300 mb-2">Warnings</p>
                                    <ul className="space-y-1 text-[14px] font-medium text-amber-800 dark:text-amber-200">
                                        {importPreview.warnings.slice(0, 8).map((warning, index) => (
                                            <li key={index}>• {warning}</li>
                                        ))}
                                        {importPreview.warnings.length > 8 && (
                                            <li>• And {importPreview.warnings.length - 8} more...</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {!isImporting && (
                                <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
                                    Existing attendance for the same user and date will be overwritten with punch machine in/out times.
                                </p>
                            )}
                        </div>

                        <div className="shrink-0 px-5 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 flex justify-end gap-3">
                            <button
                                onClick={resetImportModal}
                                disabled={isImporting}
                                className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmPunchImport}
                                disabled={isImporting || importPreview.records.length === 0}
                                className="px-5 py-2.5 rounded-full bg-emerald-600 text-white text-[13px] font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {isImporting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowUpTrayIcon className="w-4 h-4" />}
                                {isImporting ? 'Processing...' : 'Confirm Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Modal */}
            {showCameraMode && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[32px] w-full max-w-sm flex flex-col items-center relative shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-lg font-semibold text-[#2563EB] dark:text-[#60A5FA] mb-4">
                            Selfie Verification Required
                        </h3>
                        <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden mb-6 shadow-inner border border-gray-100 dark:border-white/10">
                            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted autoPlay />
                            <div className="absolute inset-x-8 inset-y-16 border-2 border-white/30 rounded-[100px] border-dashed animate-pulse pointer-events-none" />
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                        <div className="flex gap-4 w-full">
                            <button 
                                onClick={() => setShowCameraMode(null)} 
                                className="flex-1 py-4 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-white rounded-2xl font-semibold text-[14px] transition hover:bg-gray-300 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={capturePhotoAndSubmit} 
                                className="flex-[2] py-4 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black rounded-2xl font-semibold text-[14px] transition shadow-lg hover:-translate-y-1"
                            >
                                📸 Capture
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
