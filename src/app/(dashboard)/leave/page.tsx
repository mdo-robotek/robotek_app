'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ensureSessionId } from '@/utils/session';
import { useToast } from '@/components/ToastProvider';
import CustomDateTimePicker from '@/components/CustomDateTimePicker';
// SearchableSelect removed from this page — using native datalist inputs instead
import ConfirmModal from '@/components/ConfirmModal';
import { formatDateMMM } from '@/lib/dateUtils';
import { ownsLeaveFollowUp } from '@/lib/leave-access';
import { 
    CalendarIcon as CalendarBtnIcon, 
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    ClockIcon,
    PencilSquareIcon,
    TrashIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    SunIcon,
    MoonIcon,
    ClipboardDocumentListIcon,
    UsersIcon,
    UserIcon,
    XMarkIcon,
    DocumentTextIcon,
    BriefcaseIcon,
    CalendarDaysIcon,
    Square2StackIcon,
    MegaphoneIcon,
    ListBulletIcon,
    ArrowRightIcon,
    ArrowLongRightIcon,
    ChevronDownIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface Leave {
    id: string;
    userId: string;
    userName: string;
    userImage?: string;
    leaveType?: string;
    halfDaySession?: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
    responsibility1?: string;
    responsibility2?: string;
    responsibility3?: string;
    tasks1?: string;
    tasks2?: string;
    tasks3?: string;
    sharedTask?: string;
    acceptedBy?: string;
    acceptedBy1?: string;
    acceptedAt1?: string;
    acceptedBy2?: string;
    acceptedAt2?: string;
    acceptedBy3?: string;
    acceptedAt3?: string;
    updatedAt?: string;
    createdAt?: string;
}

interface Remark {
    id: string;
    leaveId: string;
    userName: string;
    comment: string;
    createdAt: string;
}

export default function LeavePage() {
    const { success, error } = useToast();
    const [user, setUser] = useState<any>(null);
    const [isPageLoading, setIsPageLoading] = useState(true);

    // Derived role helpers (recalculated whenever user changes)
    const userRoleUpper = (user?.role || '').toUpperCase();
    const isAdminOrEA = userRoleUpper === 'ADMIN' || userRoleUpper === 'EA';

    // Leave State
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const defaultForm = {
        leaveType: 'Full Day',
        halfDaySession: 'First Half',
        durationType: '1day',       // '1day' | 'multiday'
        startDate: '',
        endDate: '',
        reason: '',
        responsibility1: '',
        responsibility2: '',
        responsibility3: '',
        tasks1: '',
        tasks2: '',
        tasks3: '',
        sharedTask: '',
        taskMode: 'individual',     // 'individual' | 'shared'
    };
    const [leaveForm, setLeaveForm] = useState(defaultForm);
    const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveSearch, setLeaveSearch] = useState('');
    const [filterTab, setFilterTab] = useState<'All'|'Pending'|'Approved'|'Rejected'>('All');
    const [leavePage, setLeavePage] = useState(1);
    const LEAVES_PER_PAGE = 6;
    const [respInputs, setRespInputs] = useState<Record<string, string>>({});
    const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
    const [loadingAction, setLoadingAction] = useState<{ id?: string; type?: string } | null>(null);

    // Admin State
    const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
    const [remarks, setRemarks] = useState<Remark[]>([]);
    const [newRemark, setNewRemark] = useState('');
    const [loadingRemarks, setLoadingRemarks] = useState(false);
    const [masterData, setMasterData] = useState<{ users: any[] } | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [highlightLeaveId, setHighlightLeaveId] = useState<string | null>(null);
    const highlightLeaveRef = useRef<HTMLDivElement>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const myMasterUser = masterData?.users?.find(
      (u: any) => String(u.id) === String(user?.id) || String(u.username || '').toLowerCase() === String(user?.username || '').toLowerCase()
    );
    const isLeavePC = ownsLeaveFollowUp({
      username: user?.username,
      role: user?.role,
      designation: myMasterUser?.designation,
    });
    // PC (e.g. Vandana on User role) sees all org leaves for follow-up
    const canViewAllLeaves = isAdminOrEA || isLeavePC;

    useEffect(() => {
        const init = async () => {
            const sid = ensureSessionId();
            try {
                const res = await fetch('/api/auth/session');
                const session = await res.json();
                if (session?.user) {
                    setUser(session.user);
                    await Promise.all([
                        fetchLeaves(session.user),
                        fetchMasterData()
                    ]);
                }
            } catch (e) {
                console.error("Failed to load session", e);
            } finally {
                setIsPageLoading(false);
            }
        };
        init();
        const interval = setInterval(() => {
            if (user) fetchLeaves(user);
        }, 120000);
        return () => clearInterval(interval);
    }, []);

    const searchParams = useSearchParams();
    useEffect(() => {
        if (searchParams?.get('open') === 'apply') {
            setEditingLeave(null);
            setLeaveForm(defaultForm);
            setShowLeaveModal(true);
        }

        const leaveId = searchParams?.get('id');
        if (leaveId) {
            setHighlightLeaveId(leaveId);
            setFilterTab('All');
            setLeaveSearch('');
            setLeavePage(1);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!highlightLeaveId || leaves.length === 0 || isPageLoading) return;

        const idx = leaves.findIndex((lv) => String(lv.id) === String(highlightLeaveId));
        if (idx === -1) return;

        const page = Math.floor(idx / LEAVES_PER_PAGE) + 1;
        if (page !== leavePage) {
            setLeavePage(page);
            return;
        }

        const timer = window.setTimeout(() => {
            highlightLeaveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
        return () => window.clearTimeout(timer);
    }, [highlightLeaveId, leaves, isPageLoading, leavePage]);

    useEffect(() => {
        // Keep input text synced to selected IDs when master data or form changes
        [1, 2, 3].forEach(num => {
            const key = `responsibility${num}` as keyof typeof leaveForm;
            const id = (leaveForm as any)[key];
            if (id) {
                const u = masterData?.users?.find((us: any) => String(us.id) === String(id));
                if (u) setRespInputs(prev => ({ ...prev, [key]: u.full_name || u.username }));
            }
        });
    }, [leaveForm, masterData]);

    async function fetchLeaves(sessionUser: any, designation?: string) {
        try {
            const params = new URLSearchParams({
                userId: String(sessionUser?.id || ''),
                role: String(sessionUser?.role || ''),
                username: String(sessionUser?.username || ''),
            });
            if (designation) params.set('designation', designation);
            const res = await fetch(`/api/leave?${params.toString()}`);
            const data = await res.json();
            if (data.leaves) {
                setLeaves(data.leaves.sort((a: any, b: any) => {
                    const aDate = new Date(a.updatedAt || a.createdAt || a.startDate).getTime();
                    const bDate = new Date(b.updatedAt || b.createdAt || b.startDate).getTime();
                    return bDate - aDate;
                }));
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchRemarks(leaveId: string) {
        setLoadingRemarks(true);
        const res = await fetch(`/api/leave?type=remarks&leaveId=${leaveId}`);
        const data = await res.json();
        if (data.remarks) setRemarks(data.remarks);
        setLoadingRemarks(false);
    }

    async function fetchMasterData() {
        try {
            const res = await fetch('/api/attendance/master');
            const data = await res.json();
            if (data.users) setMasterData(data);
        } catch (e) {
            console.error(e);
        }
    }

    // If PC is identified via designation (not only username), refresh full org leave list
    useEffect(() => {
        if (!user || !myMasterUser?.designation) return;
        if (!ownsLeaveFollowUp({ username: user.username, role: user.role, designation: myMasterUser.designation })) return;
        fetchLeaves(user, myMasterUser.designation);
    }, [user?.id, myMasterUser?.designation]);

    const handleLeaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Unique person check
        const selected = [leaveForm.responsibility1, leaveForm.responsibility2, leaveForm.responsibility3].filter(Boolean);
        if (new Set(selected).size !== selected.length) {
            error("Please select different persons for each responsibility slot");
            return;
        }

        // For 1-day / half-day, endDate = startDate
        const isOneDayOrHalf = leaveForm.leaveType === 'Half Day' || leaveForm.durationType === '1day';
        const endDate = isOneDayOrHalf ? leaveForm.startDate : leaveForm.endDate;

        // clearing previous action state for submit
        setIsPageLoading(true);
        try {
            const method = editingLeave ? 'PUT' : 'POST';
            const body = editingLeave 
                ? { leaveId: editingLeave.id, ...leaveForm, endDate }
                : { userId: user.id, userName: user.username, ...leaveForm, endDate };

            const res = await fetch('/api/leave', {
                method,
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error('Failed');

            const emptyForm = { leaveType: 'Full Day', halfDaySession: 'First Half', durationType: '1day', startDate: '', endDate: '', reason: '', responsibility1: '', responsibility2: '', responsibility3: '', tasks1: '', tasks2: '', tasks3: '', sharedTask: '', taskMode: 'individual' };
            setLeaveForm(emptyForm);
            setEditingLeave(null);
            setShowLeaveModal(false);
            await fetchLeaves(user);
            success(editingLeave ? 'Leave updated!' : 'Leave request submitted!');
        } catch (e) {
            error('Failed to process leave');
        } finally {
            setIsPageLoading(false);
        }
    };

    const handleLeaveDelete = async (leaveId: string) => {
        setPendingDeleteId(leaveId);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        setLoadingAction({ id: pendingDeleteId, type: 'delete' });
        setIsPageLoading(true);
        try {
            const res = await fetch(`/api/leave?leaveId=${pendingDeleteId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            await fetchLeaves(user);
            success('Leave deleted successfully');
        } catch (e) {
            error('Failed to delete leave');
        } finally {
            setLoadingAction(null);
            setIsPageLoading(false);
            setPendingDeleteId(null);
            setIsConfirmOpen(false);
        }
    };

    const handleAcceptResponsibility = async (leaveId: string, which?: number) => {
        setLoadingAction({ id: leaveId, type: 'accept' });
        setIsPageLoading(true);
        try {
            const payload: any = { action: 'ACCEPT_RESPONSIBILITY', leaveId, acceptedBy: user.username };
            if (which) payload.which = which; // 1 | 2 | 3
            const res = await fetch('/api/leave', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed');
            await fetchLeaves(user);
            success('You have accepted responsibility for this leave');
        } catch (e) {
            error('Failed to accept responsibility');
        } finally {
            setLoadingAction(null);
            setIsPageLoading(false);
        }
    };

    const handleStatusUpdate = async (status: 'Approved' | 'Rejected', leaveId?: string) => {
        const targetId = leaveId || selectedLeave?.id;
        if (!targetId) return;
        setIsPageLoading(true);
        try {
            const res = await fetch('/api/leave', {
                method: 'POST',
                body: JSON.stringify({ action: 'UPDATE_STATUS', leaveId: targetId, status })
            });
            if (!res.ok) throw new Error('Failed');

            await fetchLeaves(user);
            if (selectedLeave) setSelectedLeave(null);
            success(`Leave request ${status}`);
        } catch (e) {
            error('Failed to update status');
        } finally {
            setLoadingAction(null);
            setIsPageLoading(false);
        }
    };

    const handleAddRemark = async () => {
        if (!newRemark.trim() || !selectedLeave) return;
        setIsPageLoading(true);
        try {
            const res = await fetch('/api/leave', {
                method: 'POST',
                body: JSON.stringify({ action: 'ADD_REMARK', leaveId: selectedLeave.id, userName: user.username, comment: newRemark })
            });
            if (!res.ok) throw new Error('Failed');

            setNewRemark('');
            await fetchRemarks(selectedLeave.id);
            success('Comment added!');
        } catch (e) {
            error('Failed to add comment');
        } finally {
            setIsPageLoading(false);
        }
    };

    if (isPageLoading && !user) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-[#FFD500] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const emptyForm = { leaveType: 'Full Day', halfDaySession: 'First Half', durationType: '1day', startDate: '', endDate: '', reason: '', responsibility1: '', responsibility2: '', responsibility3: '', tasks1: '', tasks2: '', tasks3: '', sharedTask: '', taskMode: 'individual' };

    const filteredLeaves = leaves.filter(lv => {
        const q = leaveSearch.toLowerCase();
        if (filterTab !== 'All' && lv.status !== filterTab) return false;
        if (!q) return true;
        return (
            lv.userName?.toLowerCase().includes(q) ||
            lv.reason?.toLowerCase().includes(q) ||
            lv.status?.toLowerCase().includes(q) ||
            (lv.leaveType || '').toLowerCase().includes(q)
        );
    });
    const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / LEAVES_PER_PAGE));
    const pagedLeaves = filteredLeaves.slice((leavePage - 1) * LEAVES_PER_PAGE, leavePage * LEAVES_PER_PAGE);

    const respLabels = ['Primary', 'Secondary', 'Tertiary'];
    const respColors = [
        'text-purple-700 dark:text-purple-300',
        'text-blue-700 dark:text-blue-300',
        'text-orange-700 dark:text-orange-300',
    ];

    return (
        <div className="min-h-screen flex flex-col h-[calc(100vh-4rem)] p-6 gap-6 bg-gradient-to-b from-sky-50 via-white to-white">
            <div className="flex-1 overflow-hidden">
                <div className="flex flex-col gap-3 h-full">
                    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-lg px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-[#003875] dark:bg-[#FFD500] rounded-3xl flex items-center justify-center shadow-xl shadow-[#003875]/10 dark:shadow-[#FFD500]/20 text-white dark:text-black">
                                <CalendarBtnIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Leave Management</h1>
                                <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.35em] mt-1">
                                    {canViewAllLeaves
                                      ? (isLeavePC && !isAdminOrEA ? 'PC Leave Follow-up — All Org Leaves' : 'Manage Org Leaves')
                                      : 'My Leave Requests'}
                                </p>
                            </div>
                        </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    title="How Leave Management works"
                                    onClick={() => setShowInfoModal(true)}
                                    className="p-2 rounded-full bg-[#003875]/10 hover:bg-[#003875]/20 text-[#003875] dark:bg-[#FFD500]/15 dark:hover:bg-[#FFD500]/25 dark:text-[#FFD500] transition-colors"
                                >
                                    <InformationCircleIcon className="w-5 h-5" />
                                </button>
                                <div className="relative hidden md:block">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, reason, status..."
                                        value={leaveSearch}
                                        onChange={e => { setLeaveSearch(e.target.value); setLeavePage(1); }}
                                        className="w-80 pl-10 pr-4 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a84ff] transition-all"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setEditingLeave(null);
                                        setLeaveForm(emptyForm);
                                        setShowLeaveModal(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-5 py-3 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg transition-transform active:scale-95 transform-gpu bg-gradient-to-r from-[#0a84ff] to-[#0066ff] hover:from-[#0066ff] hover:to-[#0050d4]"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    Apply Leave
                                </button>
                            </div>
                    </div>

                    <div className="flex flex-col gap-3 flex-1 min-h-0">
                        {/* Status tabs */}
                        <div className="flex items-end gap-4 shrink-0 border-b border-transparent">
                            {(['All','Pending','Approved','Rejected'] as const).map(tab => {
                                const count = tab === 'All' ? leaves.length : leaves.filter(l => l.status === tab).length;
                                const active = filterTab === tab;
                                const IconComp = tab === 'All' ? Square2StackIcon : tab === 'Pending' ? ClockIcon : tab === 'Approved' ? CheckCircleIcon : XMarkIcon;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => { setFilterTab(tab); setLeavePage(1); }}
                                        className={`flex items-center gap-2 px-3 py-2 text-sm font-black transition-all ${active ? 'border-b-2 border-[#003875] text-[#003875]' : 'text-gray-600 hover:text-gray-800'}`}
                                    >
                                        <IconComp className={`w-4 h-4 ${active ? 'text-[#003875]' : 'text-gray-500'}`} />
                                        <span className="uppercase tracking-wider text-xs">{tab}</span>
                                        <span className={`ml-1 inline-flex items-center justify-center w-5 h-5 text-[11px] font-black rounded-full ${active ? 'bg-[#003875] text-white' : 'bg-gray-100 text-gray-700'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="space-y-2 overflow-auto custom-scrollbar pr-1 flex-1 min-h-0">
                            {pagedLeaves.length === 0 ? (
                                <div style={{backgroundColor:'var(--panel-card)',borderColor:'var(--panel-border)'}} className="border rounded-2xl p-10 text-center">
                                    <ClipboardDocumentListIcon className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No leave records found</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {pagedLeaves.map(lv => {
                                        const isRequester = String(lv.userId) === String(user.id);
                                        const isListedColleague = [lv.responsibility1, lv.responsibility2, lv.responsibility3].some(id => String(id) === String(user.id));
                                        // removed simple hasAccepted declaration — computed below
                                        const isHalfDay = (lv.leaveType || 'Full Day') === 'Half Day';
                                        const respList = [
                                            { id: lv.responsibility1, tasks: lv.tasks1, accepted: lv.acceptedBy1, slot: 1 },
                                            { id: lv.responsibility2, tasks: lv.tasks2, accepted: lv.acceptedBy2, slot: 2 },
                                            { id: lv.responsibility3, tasks: lv.tasks3, accepted: lv.acceptedBy3, slot: 3 },
                                        ].filter(r => r.id);

                                        const r1 = masterData?.users?.find((u:any) => String(u.id) === String(lv.responsibility1));
                                        const r2 = masterData?.users?.find((u:any) => String(u.id) === String(lv.responsibility2));
                                        const r3 = masterData?.users?.find((u:any) => String(u.id) === String(lv.responsibility3));

                                        const statusClr = lv.status === 'Approved' ? '#34C759' : lv.status === 'Rejected' ? '#FF3B30' : '#FFCC00';

                                        // acceptance checks
                                        const isSharedTask = Boolean(lv.sharedTask && lv.sharedTask.trim());
                                        const hasTasks = respList.some(r => r.tasks && String(r.tasks).trim() !== '');
                                        const myRespIndex = [lv.responsibility1, lv.responsibility2, lv.responsibility3].findIndex(id => String(id) === String(user.id));
                                        const myAcceptedField = myRespIndex >= 0 ? (lv as any)[`acceptedBy${myRespIndex+1}`] : null;
                                        const acceptedAny = Boolean(lv.acceptedBy1 || lv.acceptedBy2 || lv.acceptedBy3);
                                        // acceptedAll: shared/no-task → any 1 acceptance; individual tasks → each slot with a task must accept
                                        const acceptedAll = hasTasks && !isSharedTask
                                            ? respList.every(r => !(r.tasks && String(r.tasks).trim() !== '') || Boolean((lv as any)[`acceptedBy${r.slot}`]))
                                            : acceptedAny || respList.length === 0;
                                        // I'll Accept visibility rules:
                                        // • sharedTask mode  → hide for ALL once anyone has accepted (1 acceptance = covered)
                                        // • individual tasks → show only to MY slot if MY slot has a task AND I haven't accepted yet
                                        // • no tasks         → show to any listed person until anyone accepts
                                        const canIAccept = isListedColleague && myRespIndex >= 0 && lv.status === 'Pending' && (() => {
                                            if (isSharedTask) return !acceptedAny; // shared: hide for all once 1 accepts
                                            if (hasTasks) return !myAcceptedField && Boolean(respList.find(r => r.slot === myRespIndex+1)?.tasks); // individual: only my slot
                                            return !myAcceptedField; // no tasks: any listed person until they accept
                                        })();
                                        const editFill = () => { setEditingLeave(lv); setLeaveForm({ leaveType: lv.leaveType||'Full Day', halfDaySession: lv.halfDaySession||'First Half', durationType: (lv.startDate===lv.endDate||!lv.endDate||lv.leaveType==='Half Day')?'1day':'multiday', startDate:lv.startDate, endDate:lv.endDate, reason:lv.reason, responsibility1:lv.responsibility1||'', responsibility2:lv.responsibility2||'', responsibility3:lv.responsibility3||'', tasks1:lv.tasks1||'', tasks2:lv.tasks2||'', tasks3:lv.tasks3||'', sharedTask:lv.sharedTask||'', taskMode:(lv.sharedTask&&lv.sharedTask.trim())?'shared':'individual' }); setShowLeaveModal(true); };
                                        const statusBg = lv.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : lv.status === 'Rejected' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700';
                                        const leaveTypeBg = isHalfDay ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700';
                                        return (
                                            <div
                                                key={lv.id}
                                                ref={highlightLeaveId && String(lv.id) === String(highlightLeaveId) ? highlightLeaveRef : undefined}
                                                className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 transform-gpu hover:-translate-y-0.5 ${
                                                    highlightLeaveId && String(lv.id) === String(highlightLeaveId)
                                                        ? 'border-[#0a84ff] ring-2 ring-[#0a84ff]/40 dark:ring-[#FFD500]/40'
                                                        : 'border-gray-100 dark:border-white/5'
                                                }`}
                                                style={{borderLeft:`4px solid ${statusClr}`}}
                                            >
                                                <div className="flex flex-col md:flex-row min-h-0">
                                                    {/* ── LEFT COLUMN ── */}
                                                    <div className="w-full md:w-1/2 min-w-0 px-5 py-4 flex flex-col gap-3 relative">
                                                        {/* Row 1: Avatar + Name + Badges + Actions */}
                                                        <div className="flex items-start gap-3">
                                                            {/* Avatar */}
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0 shadow-md" style={{background:`linear-gradient(135deg,#003875,#0060cc)`}}>
                                                                {lv.userName?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            {/* Name + badges */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Requester</span>
                                                                        <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{lv.userName}</span>
                                                                    </div>
                                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${leaveTypeBg}`}>
                                                                        {isHalfDay ? <ClockIcon className="w-3 h-3"/> : <BriefcaseIcon className="w-3 h-3"/>}
                                                                        {isHalfDay ? (lv.halfDaySession||'Half Day') : 'Full Day'}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusBg}`}>
                                                                        {lv.status === 'Approved' ? <CheckCircleIcon className="w-3 h-3"/> : lv.status === 'Rejected' ? <XMarkIcon className="w-3 h-3"/> : <ClockIcon className="w-3 h-3"/>}
                                                                        {lv.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {/* Actions — top-right of left column */}
                                                            <div className="flex items-center gap-2 shrink-0 md:absolute md:top-4 md:right-4">
                                                                {canIAccept && (
                                                                    <button onClick={() => handleAcceptResponsibility(lv.id, myRespIndex+1)} disabled={loadingAction?.id===lv.id} className={`px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-600 transition-all shadow-sm ${loadingAction?.id===lv.id ? 'opacity-60 pointer-events-none' : ''}`}>
                                                                        {loadingAction?.id===lv.id && loadingAction?.type==='accept' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : "I'll Accept"}
                                                                    </button>
                                                                )}
                                                                {isRequester && lv.status==='Pending' && <>
                                                                    <button onClick={editFill} disabled={loadingAction?.id===lv.id} className={`p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-800 dark:hover:text-blue-300 transition-all ${loadingAction?.id===lv.id ? 'opacity-50 pointer-events-none' : ''}`}><PencilSquareIcon className="w-4 h-4"/></button>
                                                                    <button onClick={()=>handleLeaveDelete(lv.id)} disabled={loadingAction?.id===lv.id} className={`p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:text-rose-700 dark:hover:text-rose-300 transition-all ${loadingAction?.id===lv.id ? 'opacity-50 pointer-events-none' : ''}`}><TrashIcon className="w-4 h-4"/></button>
                                                                </>}
                                                                {isAdminOrEA && lv.status==='Pending' && acceptedAll && <>
                                                                    <button onClick={()=>handleStatusUpdate('Approved',lv.id)} disabled={loadingAction?.id===lv.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#34C759] text-white text-xs font-black uppercase tracking-wider hover:bg-[#28a745] transition-all shadow-sm ${loadingAction?.id===lv.id ? 'opacity-60 pointer-events-none' : ''}`}>
                                                                        {loadingAction?.id===lv.id && loadingAction?.type==='approve' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircleIcon className="w-4 h-4"/>}
                                                                        {loadingAction?.id===lv.id && loadingAction?.type==='approve' ? 'Approving' : 'Approve'}
                                                                    </button>
                                                                    <button onClick={()=>handleStatusUpdate('Rejected',lv.id)} disabled={loadingAction?.id===lv.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF3B30] text-white text-xs font-black uppercase tracking-wider hover:bg-[#dc3545] transition-all shadow-sm ${loadingAction?.id===lv.id ? 'opacity-60 pointer-events-none' : ''}`}>
                                                                        {loadingAction?.id===lv.id && loadingAction?.type==='reject' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <XMarkIcon className="w-4 h-4"/>}
                                                                        {loadingAction?.id===lv.id && loadingAction?.type==='reject' ? 'Rejecting' : 'Reject'}
                                                                    </button>
                                                                </>}
                                                            </div>
                                                        </div>
                                                        {/* Row 2: Info chips */}
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</span>
                                                                <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                                                                    <CalendarDaysIcon className="w-3.5 h-3.5 text-[#003875]" />
                                                                    {formatDateMMM(lv.startDate)}{lv.endDate && lv.endDate !== lv.startDate ? ` → ${formatDateMMM(lv.endDate)}` : ''}
                                                                </div>
                                                            </div>
                                                            <div className="w-px h-7 bg-gray-200 dark:bg-white/10" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Emp ID</span>
                                                                <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                                                                    <UserIcon className="w-3.5 h-3.5 text-[#003875]" />
                                                                    {lv.userId}
                                                                </div>
                                                            </div>
                                                            {respList.length > 0 && <div className="w-px h-7 bg-gray-200 dark:bg-white/10" />}
                                                            {respList.length > 0 && (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Coverage Status</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {respList.map(r => {
                                                                            const usr = masterData?.users?.find((u:any) => String(u.id) === String(r.id));
                                                                            const name = usr ? (usr.full_name || usr.username) : 'Unknown';
                                                                            const acceptedBy = (lv as any)[`acceptedBy${r.slot}`];
                                                                            const acceptedAt = (lv as any)[`acceptedAt${r.slot}`];
                                                                            const accepted = Boolean(acceptedBy);
                                                                            const slotColors = ['bg-purple-50 border-purple-200 text-purple-700','bg-blue-50 border-blue-200 text-blue-700','bg-orange-50 border-orange-200 text-orange-700'];
                                                                            const acceptedTime = acceptedAt ? new Date(acceptedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true }) : '';
                                                                            return (
                                                                                <div key={r.slot} className={`inline-flex flex-col px-2 py-1 rounded-xl border text-[10px] font-black ${accepted ? 'bg-emerald-50 border-emerald-200' : slotColors[r.slot-1]}`}>
                                                                                    <span className={`inline-flex items-center gap-1 ${accepted ? 'text-emerald-700' : ''}`}>
                                                                                        {accepted ? <CheckCircleIcon className="w-3 h-3" /> : <ClockIcon className="w-3 h-3" />}
                                                                                        {name}
                                                                                    </span>
                                                                                    {accepted
                                                                                        ? <span className="text-[8px] font-semibold text-emerald-600 mt-0.5">✓ {acceptedBy} · {acceptedTime}</span>
                                                                                        : <span className="text-[8px] font-semibold text-gray-400 mt-0.5">Awaiting acceptance</span>
                                                                                    }
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* ── VERTICAL DIVIDER ── */}
                                                    {(lv.reason || lv.sharedTask || lv.tasks1 || lv.tasks2 || lv.tasks3) && (
                                                        <>
                                                            <div className="w-px bg-gray-100 dark:bg-white/5 self-stretch my-3 hidden md:block" />
                                                            <div className="h-px bg-gray-100 dark:bg-white/5 w-full my-3 md:hidden" />
                                                        </>
                                                    )}

                                                    {/* ── RIGHT COLUMN ── */}
                                                    {(lv.reason || lv.sharedTask || lv.tasks1 || lv.tasks2 || lv.tasks3) && (
                                                        <div className="w-full md:w-1/2 px-4 py-4 flex flex-col gap-3">
                                                            {/* Reason */}
                                                            {lv.reason && (
                                                                <div>
                                                                    <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                                                        <DocumentTextIcon className="w-3 h-3" /> Reason for Leave
                                                                    </span>
                                                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 leading-relaxed">{lv.reason}</p>
                                                                </div>
                                                            )}
                                                            {/* Task Assignments */}
                                                            {(lv.sharedTask || lv.tasks1 || lv.tasks2 || lv.tasks3) && (
                                                                <div className={lv.reason ? 'pt-3 border-t border-gray-100 dark:border-white/5' : ''}>
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                                                                        <ClipboardDocumentListIcon className="w-3 h-3" /> Task Assignments
                                                                    </span>
                                                                    <div className="flex flex-col gap-1.5">
                                                                        {lv.sharedTask && (
                                                                            <div className="flex items-start gap-2">
                                                                                <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 text-[9px] font-black uppercase rounded-full">
                                                                                    <UsersIcon className="w-2.5 h-2.5" /> All
                                                                                </span>
                                                                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{lv.sharedTask}</span>
                                                                            </div>
                                                                        )}
                                                                        {lv.tasks1 && r1 && (
                                                                            <div className="flex items-start gap-2">
                                                                                <div className="flex flex-col shrink-0 gap-0.5">
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-black uppercase rounded-full">① {r1.full_name || r1.username}</span>
                                                                                    {(lv as any).acceptedBy1 ? <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600 uppercase"><CheckCircleIcon className="w-2.5 h-2.5" />Accepted</span> : <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-amber-500 uppercase"><ClockIcon className="w-2.5 h-2.5" />Pending</span>}
                                                                                </div>
                                                                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{lv.tasks1}</span>
                                                                            </div>
                                                                        )}
                                                                        {lv.tasks2 && r2 && (
                                                                            <div className="flex items-start gap-2">
                                                                                <div className="flex flex-col shrink-0 gap-0.5">
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-black uppercase rounded-full">② {r2.full_name || r2.username}</span>
                                                                                    {(lv as any).acceptedBy2 ? <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600 uppercase"><CheckCircleIcon className="w-2.5 h-2.5" />Accepted</span> : <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-amber-500 uppercase"><ClockIcon className="w-2.5 h-2.5" />Pending</span>}
                                                                                </div>
                                                                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{lv.tasks2}</span>
                                                                            </div>
                                                                        )}
                                                                        {lv.tasks3 && r3 && (
                                                                            <div className="flex items-start gap-2">
                                                                                <div className="flex flex-col shrink-0 gap-0.5">
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 text-[9px] font-black uppercase rounded-full">③ {r3.full_name || r3.username}</span>
                                                                                    {(lv as any).acceptedBy3 ? <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600 uppercase"><CheckCircleIcon className="w-2.5 h-2.5" />Accepted</span> : <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-amber-500 uppercase"><ClockIcon className="w-2.5 h-2.5" />Pending</span>}
                                                                                </div>
                                                                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{lv.tasks3}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <button
                                onClick={() => setLeavePage(p => Math.max(1, p - 1))}
                                disabled={leavePage === 1}
                                className="p-3 rounded-full border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setLeavePage(p)}
                                    className={`w-10 h-10 rounded-full text-[11px] font-black transition-all ${leavePage === p ? 'bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black shadow-sm' : 'border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500'}`}
                                >{p}</button>
                            ))}
                            <button
                                onClick={() => setLeavePage(p => Math.min(totalPages, p + 1))}
                                disabled={leavePage === totalPages}
                                className="p-3 rounded-full border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showLeaveModal && (
                <div className="fixed inset-0 z-[10000] flex items-end justify-center" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="w-full max-w-4xl rounded-t-[32px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#003875] dark:bg-[#FFD500] flex items-center justify-center shadow-lg">
                                    <CalendarBtnIcon className="w-5 h-5 text-white dark:text-black" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">
                                        {editingLeave ? 'Edit Leave Request' : 'Apply for Leave'}
                                    </h2>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Leave Application System</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowLeaveModal(false); setEditingLeave(null); }}
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-gray-400 hover:text-gray-700 dark:hover:text-white"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <form onSubmit={handleLeaveSubmit} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    {/* Leave type toggle */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <SunIcon className="w-3.5 h-3.5" />
                                            Leave Duration
                                        </label>
                                        <div className="flex gap-2">
                                            {['Full Day', 'Half Day'].map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                        setLeaveForm(prev => ({
                                                            ...prev,
                                                            leaveType: t,
                                                            // Half Day always forces single date
                                                            durationType: t === 'Half Day' ? '1day' : prev.durationType,
                                                            endDate: t === 'Half Day' ? prev.startDate : prev.endDate,
                                                        }));
                                                    }}
                                                    className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${leaveForm.leaveType === t ? 'bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black border-[#003875] dark:border-[#FFD500] shadow-md' : 'bg-white dark:bg-slate-900 text-gray-500 border-gray-200 dark:border-white/10 hover:border-[#003875] dark:hover:border-[#FFD500]'}`}
                                                >
                                                    {t === 'Full Day' ? (
                                                        <span className="inline-flex items-center gap-2 justify-center"><CalendarDaysIcon className="w-4 h-4" /> Full Day</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-2 justify-center"><ClockIcon className="w-4 h-4" /> Half Day</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Half-day session picker */}
                                        {leaveForm.leaveType === 'Half Day' && (
                                            <div className="mt-2 flex gap-2">
                                                {['First Half', 'Second Half'].map(session => (
                                                    <button
                                                        key={session}
                                                        type="button"
                                                        onClick={() => setLeaveForm(prev => ({ ...prev, halfDaySession: session }))}
                                                        className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${
                                                            leaveForm.halfDaySession === session
                                                                ? 'bg-[#FF9500]/20 border-[#FF9500] text-[#FF9500]'
                                                                : 'bg-white dark:bg-slate-900 text-gray-400 border-gray-200 dark:border-white/10 hover:border-[#FF9500]/60'
                                                        }`}
                                                    >
                                                        {session === 'First Half' ? (<span className="inline-flex items-center gap-2"><SunIcon className="w-4 h-4" /> Morning</span>) : (<span className="inline-flex items-center gap-2"><MoonIcon className="w-4 h-4" /> Afternoon</span>)}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Multi-day toggle (Full Day only) */}
                                        {leaveForm.leaveType === 'Full Day' && (
                                            <div className="mt-2 flex gap-2">
                                                {[{ val: '1day', label: 'Single Day', icon: CalendarBtnIcon }, { val: 'multiday', label: 'Multiple Days', icon: CalendarDaysIcon }].map(({ val, label, icon: IconComp }) => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setLeaveForm(prev => ({
                                                            ...prev,
                                                            durationType: val,
                                                            endDate: val === '1day' ? prev.startDate : prev.endDate,
                                                        }))}
                                                        className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${
                                                            leaveForm.durationType === val
                                                                ? 'bg-[#5856D6]/15 border-[#5856D6] text-[#5856D6]'
                                                                : 'bg-white dark:bg-slate-900 text-gray-400 border-gray-200 dark:border-white/10 hover:border-[#5856D6]/60'
                                                        }`}
                                                    >
                                                        <span className="inline-flex items-center gap-2"><IconComp className="w-4 h-4" /> {label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Dates */}
                                    {(leaveForm.leaveType === 'Half Day' || leaveForm.durationType === '1day') ? (
                                        // Single date input
                                        <div className="mt-4">
                                            <label className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                                <CalendarBtnIcon className="w-3.5 h-3.5" />
                                                {leaveForm.leaveType === 'Half Day' ? 'Leave Date' : 'Date'}
                                            </label>
                                            <CustomDateTimePicker
                                                label=""
                                                dateOnly
                                                value={leaveForm.startDate}
                                                onChange={v => setLeaveForm(prev => ({ ...prev, startDate: v, endDate: v }))}
                                                required
                                            />
                                        </div>
                                    ) : (
                                        // Two date inputs for multi-day
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                                    <CalendarBtnIcon className="w-3.5 h-3.5" />
                                                    From Date
                                                </label>
                                                <CustomDateTimePicker label="" dateOnly value={leaveForm.startDate} onChange={v => setLeaveForm(prev => ({ ...prev, startDate: v }))} required />
                                            </div>
                                            <div>
                                                <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                                    <CalendarBtnIcon className="w-3.5 h-3.5" />
                                                    To Date
                                                </label>
                                                <CustomDateTimePicker label="" dateOnly value={leaveForm.endDate} onChange={v => setLeaveForm(prev => ({ ...prev, endDate: v }))} required />
                                            </div>
                                        </div>
                                    )}

                                    {/* Reason */}
                                    <div className="mt-4">
                                        <label className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <DocumentTextIcon className="w-3.5 h-3.5" />
                                            Reason for Leave
                                        </label>
                                        <textarea
                                            className="w-full h-20 px-3 py-2.5 rounded-lg border border-orange-100 dark:border-zinc-800 bg-[#FFFBF0] dark:bg-zinc-900 focus:border-[#FFD500] focus:bg-white dark:focus:bg-zinc-900 outline-none text-sm font-medium transition-all resize-none text-gray-800 dark:text-zinc-100 shadow-sm"
                                            value={leaveForm.reason}
                                            onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                            required
                                            placeholder="Enter detailed reason here..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    {/* Responsibilities + tasks */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                                            <UsersIcon className="w-3.5 h-3.5" />
                                            Responsibility Assignment & Tasks
                                        </label>

                                        {/* Task mode toggle */}
                                        <div className="flex gap-2 mb-3">
                                            {[{ val: 'individual', label: 'Per-Person Tasks', icon: UsersIcon }, { val: 'shared', label: 'Shared Task (All)', icon: MegaphoneIcon }].map(({ val, label, icon: IconComp }) => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setLeaveForm(prev => ({ ...prev, taskMode: val }))}
                                                    className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${
                                                        leaveForm.taskMode === val
                                                            ? 'bg-[#34C759]/15 border-[#34C759] text-[#34C759]'
                                                            : 'bg-white dark:bg-slate-900 text-gray-400 border-gray-200 dark:border-white/10 hover:border-[#34C759]/60'
                                                    }`}
                                                >
                                                        <span className="inline-flex items-center gap-2"><IconComp className="w-4 h-4" /> {label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Shared task textarea */}
                                        {leaveForm.taskMode === 'shared' && (
                                            <div className="mb-3 rounded-2xl border border-[#34C759]/30 bg-[#34C759]/5 p-3.5">
                                                <label className="text-xs font-black uppercase tracking-widest text-[#34C759] mb-1.5 block">
                                                    <span className="inline-flex items-center gap-2"><ClipboardDocumentListIcon className="w-4 h-4" /> Common Task — shared with everyone who accepts</span>
                                                </label>
                                                <textarea
                                                    className="w-full h-20 px-3 py-2.5 rounded-lg border border-orange-100 dark:border-zinc-800 bg-[#FFFBF0] dark:bg-zinc-900 focus:border-[#FFD500] focus:bg-white dark:focus:bg-zinc-900 outline-none text-sm font-medium transition-all resize-none text-gray-800 dark:text-zinc-100 shadow-sm"
                                                    value={leaveForm.sharedTask}
                                                    onChange={e => setLeaveForm(prev => ({ ...prev, sharedTask: e.target.value }))}
                                                    placeholder="Describe the task(s) to be handled in your absence..."
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {[1, 2, 3].map(num => {
                                                const respKey = `responsibility${num}` as keyof typeof leaveForm;
                                                const taskKey = `tasks${num}` as keyof typeof leaveForm;
                                                const colors = [
                                                    'border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5',
                                                    'border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5',
                                                    'border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5',
                                                ];
                                                return (
                                                    <div key={num} className={`rounded-2xl border p-3.5 space-y-2.5 ${colors[num - 1]}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
                                                                {num === 1 ? '① Primary' : num === 2 ? '② Secondary' : '③ Tertiary'} Responsibility
                                                            </span>
                                                            {num === 1
                                                                ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 uppercase tracking-wider">Required</span>
                                                                : <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 uppercase tracking-wider">Optional</span>
                                                            }
                                                        </div>
                                                        <div>
                                                            <input
                                                                list={`resp-options-${num}`}
                                                                value={respInputs[respKey] ?? ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    setRespInputs(prev => ({ ...prev, [respKey]: val }));
                                                                    if (!val) {
                                                                        setLeaveForm(prev => ({ ...prev, [respKey]: '' }));
                                                                    } else {
                                                                        const match = masterData?.users?.find((u: any) => ((u.full_name || u.username) || '').toLowerCase() === val.toLowerCase());
                                                                        if (match) setLeaveForm(prev => ({ ...prev, [respKey]: match.id }));
                                                                    }
                                                                }}
                                                                placeholder={`Select ${num === 1 ? 'primary' : num === 2 ? 'secondary' : 'tertiary'} person...`}
                                                                className="w-full bg-[#FFFBF0] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-zinc-800 focus:border-[#FFD500] outline-none font-bold text-xs text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                                                            />
                                                            <datalist id={`resp-options-${num}`}>
                                                                {masterData?.users
                                                                    ?.filter((u: any) => String(u.id) !== String(user.id))
                                                                    .map((u: any) => (
                                                                        <option key={u.id} value={u.full_name || u.username} />
                                                                    ))}
                                                            </datalist>
                                                        </div>
                                                        {/* Show per-person task only in individual mode */}
                                                        {leaveForm.taskMode === 'individual' && (leaveForm as any)[respKey] && (
                                                            <div>
                                                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                                                    <span className="inline-flex items-center gap-2"><ClipboardDocumentListIcon className="w-4 h-4" /> Tasks for this person</span>
                                                                </label>
                                                                <textarea
                                                                    className="mt-1.5 w-full h-16 px-3 py-2 rounded-lg border border-orange-100 dark:border-zinc-800 bg-[#FFFBF0] dark:bg-zinc-900 focus:border-[#FFD500] focus:bg-white dark:focus:bg-zinc-900 outline-none text-sm font-medium transition-all resize-none text-gray-800 dark:text-zinc-100 shadow-sm"
                                                                    value={(leaveForm as any)[taskKey]}
                                                                    onChange={e => setLeaveForm(prev => ({ ...prev, [taskKey]: e.target.value }))}
                                                                    placeholder={`List tasks for ${num === 1 ? 'primary' : num === 2 ? 'secondary' : 'tertiary'} person...`}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit row */}
                            <div className="flex gap-3 pt-2 pb-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowLeaveModal(false); setEditingLeave(null); }}
                                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPageLoading}
                                    className="flex-1 py-3 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95 disabled:opacity-60 bg-gradient-to-r from-[#0a84ff] to-[#0066ff]"
                                >
                                    {isPageLoading ? 'Processing...' : editingLeave ? 'Update Leave' : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Discussion Modal */}
            {selectedLeave && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLeave(null)} />
                    <div style={{ backgroundColor: 'var(--panel-card)', borderColor: 'var(--panel-border)' }} className="relative w-full max-w-md rounded-3xl shadow-2xl border flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Discussion</h3>
                            <button onClick={() => setSelectedLeave(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            {loadingRemarks ? (
                                <div className="flex justify-center p-4"><div className="w-5 h-5 border-2 border-[#FFD500] border-t-transparent rounded-full animate-spin"></div></div>
                            ) : remarks.length > 0 ? (
                                remarks.map((r) => (
                                    <div key={r.id} className={`flex flex-col ${r.userName === user?.username ? 'items-end' : 'items-start'}`}>
                                        <div className="text-xs font-black uppercase text-gray-400 mb-1">{r.userName}</div>
                                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-xs font-medium ${r.userName === user?.username ? 'bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black rounded-br-none' : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-none'}`}>
                                            {r.comment}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-xs font-bold text-gray-400 mt-4">No discussion yet</p>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-white/5 flex gap-2">
                            <input
                                type="text"
                                value={newRemark}
                                onChange={e => setNewRemark(e.target.value)}
                                placeholder="Type a message..."
                                onKeyPress={e => e.key === 'Enter' && handleAddRemark()}
                                className="flex-1 bg-[#FFFBF0] dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-full px-4 text-sm font-medium focus:outline-none focus:border-[#FFD500] text-gray-800 dark:text-zinc-100 shadow-sm"
                            />
                            <button
                                onClick={handleAddRemark}
                                disabled={isPageLoading || !newRemark.trim()}
                                className="w-10 h-10 rounded-full bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black flex items-center justify-center disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showInfoModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowInfoModal(false)}
                >
                    <div
                        className="w-full max-w-3xl bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-[#003875] shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <InformationCircleIcon className="w-5 h-5 text-[#FFD500] shrink-0" />
                                <h3 className="text-sm font-black text-white uppercase tracking-widest truncate">
                                    Leave Management — Full Process Guide
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInfoModal(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
                            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 px-4 py-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">End-to-End Flow</p>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
                                    Apply Leave → Coverage persons accept responsibility → Admin/EA Approve or Reject → WhatsApp alerts at every step (with ERP deep link).
                                </p>
                            </div>

                            {/* Visibility */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">1. Who Can See What (Visibility)</h4>
                                <div className="rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p><span className="font-black">ADMIN / EA:</span> See all organisation leave requests. Subtitle shows “Manage Org Leaves”.</p>
                                    <p><span className="font-black">Normal User:</span> Sees only (a) their own leaves, OR (b) leaves where they are listed as Coverage person 1 / 2 / 3. Subtitle shows “My Leave Requests”.</p>
                                    <p><span className="font-black">API filter:</span> <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">role ≠ ADMIN/EA</code> → filter by <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">userId</code> match on requester or responsibility slots.</p>
                                </div>
                            </section>

                            {/* Create */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">2. Create Leave (Apply Leave)</h4>
                                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p><span className="font-black">Who:</span> Any logged-in user via “+ Apply Leave” (or deep link <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">/leave?open=apply</code>).</p>
                                    <p><span className="font-black">Leave types:</span></p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><span className="font-black">Full Day — 1 Day:</span> single date (endDate = startDate).</li>
                                        <li><span className="font-black">Full Day — Multi Day:</span> startDate → endDate range.</li>
                                        <li><span className="font-black">Half Day:</span> one date + session First Half / Second Half.</li>
                                    </ul>
                                    <p><span className="font-black">Coverage (optional, up to 3 people):</span> responsibility1 / 2 / 3. Each person must be different (duplicate check on submit).</p>
                                    <p><span className="font-black">Task modes:</span></p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><span className="font-black">Individual:</span> separate tasks1 / tasks2 / tasks3 per coverage person.</li>
                                        <li><span className="font-black">Shared:</span> one sharedTask for all coverage people.</li>
                                    </ul>
                                    <p><span className="font-black">Required fields:</span> userId, startDate, endDate, reason.</p>
                                    <p><span className="font-black">Initial status:</span> Pending. ID format <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">LV-{'{timestamp}'}</code>.</p>
                                    <p><span className="font-black">WhatsApp:</span> CREATE → HR numbers + applicant + each coverage person (with their task details).</p>
                                </div>
                            </section>

                            {/* Edit / Delete */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">3. Edit & Delete</h4>
                                <div className="rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p><span className="font-black">Edit (pencil icon):</span> Visible only when <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">isRequester && status === Pending</code>.</p>
                                    <p>Opens Apply modal pre-filled. Same validation as create (unique coverage people). Saves via PUT.</p>
                                    <p><span className="font-black">Delete (trash icon):</span> Same visibility: requester + Pending only. Confirm modal → DELETE API. Also deletes related remarks.</p>
                                    <p><span className="font-black">WhatsApp:</span> UPDATE / DELETE → HR + applicant + coverage persons.</p>
                                    <p className="text-amber-800 dark:text-amber-300 font-bold">Note: Admin/EA currently do not get Edit/Delete buttons on other users’ leaves (only Approve/Reject when conditions met).</p>
                                </div>
                            </section>

                            {/* Coverage accept */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">4. Accept Coverage (&quot;I&apos;ll Accept&quot;)</h4>
                                <div className="rounded-2xl border border-purple-100 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-900/10 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p><span className="font-black">Base condition:</span> You are listed as responsibility1/2/3 AND leave status is Pending.</p>
                                    <p><span className="font-black">Button visibility rules (canIAccept):</span></p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><span className="font-black">Shared task mode:</span> Show to all listed people until ANYONE accepts → then hide for everyone (1 acceptance covers shared work).</li>
                                        <li><span className="font-black">Individual tasks:</span> Show only for YOUR slot if your slot has a task AND you have not accepted yet.</li>
                                        <li><span className="font-black">No tasks assigned:</span> Show to any listed person until that person accepts.</li>
                                    </ul>
                                    <p><span className="font-black">On accept:</span> Sets <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">acceptedByN</code> + <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">acceptedAtN</code> for that slot. Status stays Pending.</p>
                                    <p><span className="font-black">WhatsApp:</span> ACCEPT_RESPONSIBILITY → HR, applicant, and other coverage people (message differs for the acceptor vs others).</p>
                                </div>
                            </section>

                            {/* Approve / Reject */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">5. Approve & Reject</h4>
                                <div className="rounded-2xl border border-rose-100 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-900/10 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p><span className="font-black">Who:</span> ADMIN or EA only.</p>
                                    <p><span className="font-black">Buttons show when:</span> <code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">isAdminOrEA && status === Pending && acceptedAll</code></p>
                                    <p><span className="font-black">acceptedAll meaning:</span></p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><span className="font-black">Individual + tasks:</span> every coverage slot that has a task must have accepted.</li>
                                        <li><span className="font-black">Shared task OR no tasks:</span> at least one acceptance is enough (or no coverage people listed).</li>
                                    </ul>
                                    <p>Until coverage is complete, Approve/Reject stay hidden — Admin cannot finalise early.</p>
                                    <p><span className="font-black">WhatsApp:</span> UPDATE_STATUS → HR + applicant + coverage (status = Approved / Rejected).</p>
                                </div>
                            </section>

                            {/* Remarks */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">6. Discussion / Remarks</h4>
                                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p>Users can add remarks on a leave (Discussion modal). Saved as REM-{'{timestamp}'} linked to leaveId.</p>
                                    <p><span className="font-black">WhatsApp:</span> ADD_REMARK → HR + applicant + coverage with the remark text.</p>
                                </div>
                            </section>

                            {/* WhatsApp */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">7. WhatsApp Messaging Process</h4>
                                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                    <p><span className="font-black">Transport:</span> Maytapi WhatsApp API (<code className="text-[10px] bg-white/70 dark:bg-black/30 px-1 rounded">sendWhatsAppMessage</code>).</p>
                                    <p><span className="font-black">Recipients:</span> Fixed HR phone numbers + phones looked up from Users sheet for applicant and coverage persons (duplicate phones skipped).</p>
                                    <p><span className="font-black">Actions that send messages:</span> CREATE, ACCEPT_RESPONSIBILITY, UPDATE_STATUS (Approve/Reject), ADD_REMARK, UPDATE (edit), DELETE.</p>
                                    <p><span className="font-black">ERP deep link (every message):</span></p>
                                    <p className="font-mono text-[10px] bg-white/70 dark:bg-black/30 px-2 py-1.5 rounded-lg break-all">
                                        {'{APP_URL}'}/leave?id={'{leaveId}'}
                                    </p>
                                    <p>Footer text: <span className="font-black">👉 Open in ERP:</span> + URL. Opening the link highlights & scrolls to that leave card on this page.</p>
                                    <p><span className="font-black">Base URL:</span> NEXTAUTH_URL / AUTH_URL / NEXT_PUBLIC_APP_URL (same helper as Payment Vendor Approval).</p>
                                </div>
                            </section>

                            {/* Permission matrix */}
                            <section className="space-y-2">
                                <h4 className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-widest">8. Action Permission Matrix</h4>
                                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-[#003875] text-white">
                                            <tr>
                                                <th className="px-3 py-2 font-black uppercase tracking-wider">Action</th>
                                                <th className="px-3 py-2 font-black uppercase tracking-wider">Who</th>
                                                <th className="px-3 py-2 font-black uppercase tracking-wider">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-gray-300">
                                            <tr className="bg-white dark:bg-transparent"><td className="px-3 py-2 font-bold">Apply / Create</td><td className="px-3 py-2">Any user</td><td className="px-3 py-2">Logged in</td></tr>
                                            <tr className="bg-gray-50/80 dark:bg-white/[0.02]"><td className="px-3 py-2 font-bold">Edit</td><td className="px-3 py-2">Requester only</td><td className="px-3 py-2">status = Pending</td></tr>
                                            <tr className="bg-white dark:bg-transparent"><td className="px-3 py-2 font-bold">Delete</td><td className="px-3 py-2">Requester only</td><td className="px-3 py-2">status = Pending</td></tr>
                                            <tr className="bg-gray-50/80 dark:bg-white/[0.02]"><td className="px-3 py-2 font-bold">I&apos;ll Accept</td><td className="px-3 py-2">Coverage person</td><td className="px-3 py-2">Pending + slot rules (shared / individual / no-task)</td></tr>
                                            <tr className="bg-white dark:bg-transparent"><td className="px-3 py-2 font-bold">Approve</td><td className="px-3 py-2">ADMIN / EA</td><td className="px-3 py-2">Pending + acceptedAll = true</td></tr>
                                            <tr className="bg-gray-50/80 dark:bg-white/[0.02]"><td className="px-3 py-2 font-bold">Reject</td><td className="px-3 py-2">ADMIN / EA</td><td className="px-3 py-2">Pending + acceptedAll = true</td></tr>
                                            <tr className="bg-white dark:bg-transparent"><td className="px-3 py-2 font-bold">View all leaves</td><td className="px-3 py-2">ADMIN / EA</td><td className="px-3 py-2">Role check on API</td></tr>
                                            <tr className="bg-gray-50/80 dark:bg-white/[0.02]"><td className="px-3 py-2 font-bold">View own / coverage</td><td className="px-3 py-2">Normal user</td><td className="px-3 py-2">Requester or responsibility1/2/3</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/20 px-4 py-3 text-[11px] text-gray-500 dark:text-gray-400">
                                <p className="font-black uppercase tracking-widest text-gray-400 mb-1">For developers & clients</p>
                                <p className="leading-relaxed">
                                    This modal mirrors the live UI conditions in <code className="text-[10px]">leave/page.tsx</code> and API rules in <code className="text-[10px]">api/leave/route.ts</code> + WhatsApp in <code className="text-[10px]">leave-notifications.ts</code>.
                                    If something feels missing (e.g. Admin edit/delete, approve without coverage, MD role), use this checklist to decide what to add next.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={isConfirmOpen}
                title="Delete Leave Request"
                message="Are you sure you want to delete this leave request? This action cannot be undone."
                onConfirm={confirmDelete}
                onClose={() => { setIsConfirmOpen(false); setPendingDeleteId(null); }}
                type="danger"
            />
        </div>
    );
}
