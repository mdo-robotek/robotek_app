"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentArrowUpIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserCircleIcon,
  TagIcon,
  UserIcon,
  ChevronDownIcon,
  TicketIcon,
  FireIcon,
  CalendarIcon,
  MicrophoneIcon,
  StopCircleIcon,
  PlayIcon,
  PauseIcon,
  PaperClipIcon,
  AdjustmentsHorizontalIcon,
  PencilSquareIcon,
  ChatBubbleBottomCenterTextIcon,
  FaceSmileIcon,
  UserGroupIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { ShieldCheckIcon, LockClosedIcon, BoltIcon } from "@heroicons/react/24/solid";
import PremiumDatePicker from "@/components/PremiumDatePicker";
import ConfirmModal from "@/components/ConfirmModal";
import Portal from "@/components/Portal";
import useSWR from "swr";
import { useSSE } from "@/hooks/useSSE";
import { applyIncrementalUpdate } from "@/lib/utils/swr-sync";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  raised_by: string;
  solver_person: string;
  planned_resolution: string;
  status: string;
  created_at: string;
  updated_at: string;
  attachment_url: string;
  voice_note: string;
  latest_comment?: {
    text: string;
    actor: string;
    created_at: string;
  };
}

interface TicketHistory {
  id: string;
  ticket_id: string;
  action_type: string;
  actor_username: string;
  old_status: string;
  new_status: string;
  comment_text: string;
  created_at: string;
  attachment_url: string;
  voice_note: string;
}

export default function TicketsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'USER';
  const currentUser = (session?.user as any)?.username || "";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const { data: swrTickets, mutate: mutateTickets } = useSWR<Ticket[]>("/api/tickets", fetcher, {
    refreshInterval: 0,        // No background polling — SSE handles change detection
    revalidateOnFocus: false,
    revalidateOnMount: true,   // Refetch on page load
  });

  // SSE: incrementally update local cache when a change is detected
  useSSE({ 
    modules: ['tickets'], 
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === 'tickets');
      if (updates) {
        mutateTickets((current) => applyIncrementalUpdate(current, updates.upserts, updates.currentIds), false);
      }
    } 
  });

  useEffect(() => {
    if (swrTickets) {
      setTickets(swrTickets);
    }
  }, [swrTickets]);

  const [usersList, setUsersList] = useState<{ username: string; image_url?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatusFilters, setActiveStatusFilters] = useState<string[]>([]);
  const [assignmentFilters, setAssignmentFilters] = useState<string[]>([]);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Modals & States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketHistory, setTicketHistory] = useState<TicketHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Form States
  const [newTicket, setNewTicket] = useState({
    title: "", description: "", category: "Software", priority: "Medium", solver_person: "", planned_resolution: ""
  });
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [refDocFile, setRefDocFile] = useState<File | null>(null);

  // Media Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null);

  // Audio Playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Searchable Dropdowns States
  const [assignedToSearch, setAssignedToSearch] = useState("");
  const [assignedToOpen, setAssignedToOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  const categories = ["Software", "Hardware/IT", "HR / Admin", "Finance", "Other"];

  useEffect(() => {
    fetchUsers();

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('action') === 'new') {
        setIsNewModalOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!swrTickets && tickets.length === 0) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [swrTickets, tickets]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const fetchTickets = async () => {
    mutateTickets();
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsersList(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id}/history`);
      if (res.ok) setTicketHistory(await res.json());
    } catch (e) { console.error(e); } finally { setHistoryLoading(false); }
  };

  const openTicketDetails = (t: Ticket) => {
    setSelectedTicket(t);
    setPendingStatus(t.status);
    fetchHistory(t.id);
  };

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setIsStatusModalOpen(true);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        setVoiceNoteFile(file);
      };

      setAudioChunks([]);
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      alert("Microphone access denied or not available");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleAudio = (voiceNote: string, id: string) => {
    // Non-http URLs are treated as Google Drive IDs and proxied through our API
    const url = voiceNote?.startsWith("http") ? voiceNote : `/api/audio/${voiceNote}`;

    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.load();
        audioRef.current.play().catch(err => {
          console.error("Audio play error:", err);
          alert("Could not play voice note. Format may be unsupported or file unavailable.");
        });
        audioRef.current.onended = () => setPlayingAudioId(null);
      } else {
        const audio = new Audio(url);
        audio.onended = () => setPlayingAudioId(null);
        audio.play().catch(err => {
          console.error("Audio play error:", err);
          alert("Could not play voice note.");
        });
        audioRef.current = audio;
      }
      setPlayingAudioId(id);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    showStatus("Creating Ticket...");

    try {
      const payload = new FormData();
      const ticketData = { ...newTicket, raised_by: currentUser, status: 'Open' };
      payload.append("ticketData", JSON.stringify(ticketData));

      if (voiceNoteFile) payload.append("voice_note", voiceNoteFile);
      if (refDocFile) payload.append("reference_doc", refDocFile);

      const res = await fetch("/api/tickets", { method: "POST", body: payload });

      if (res.ok) {
        setIsNewModalOpen(false);
        setNewTicket({ title: "", description: "", category: "Software", priority: "Medium", solver_person: "", planned_resolution: "" });
        setVoiceNoteFile(null);
        setRefDocFile(null);
        setIsStatusModalOpen(false);
        mutateTickets();
      } else throw new Error();
    } catch {
      setIsStatusModalOpen(false);
      alert("Failed to create ticket.");
    } finally { setSubmitting(false); }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    setSubmitting(true);
    showStatus("Saving Changes...");

    try {
      const payload = new FormData();
      payload.append("ticketData", JSON.stringify(editingTicket));

      if (voiceNoteFile) payload.append("voice_note", voiceNoteFile);
      if (refDocFile) payload.append("reference_doc", refDocFile);

      const res = await fetch(`/api/tickets/${editingTicket.id}`, {
        method: "PUT",
        body: payload,
      });

      if (res.ok) {
        setEditingTicket(null);
        setVoiceNoteFile(null);
        setRefDocFile(null);
        setIsStatusModalOpen(false);
        mutateTickets();
      } else throw new Error();
    } catch {
      setIsStatusModalOpen(false);
      alert("Failed to update ticket.");
    } finally { setSubmitting(false); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasStatusChange = pendingStatus && pendingStatus !== selectedTicket?.status;
    const hasCommentOrFile = newComment.trim() || voiceNoteFile || refDocFile;

    if (!selectedTicket || (!hasStatusChange && !hasCommentOrFile)) return;
    setSubmitting(true);

    try {
      let finalHistoryRecord = null;

      // 1. Update Ticket Status if changed
      if (hasStatusChange && pendingStatus) {
        const updatedTicket = { ...selectedTicket, status: pendingStatus, updated_at: new Date().toISOString() };

        // API Update for Ticket
        await fetch(`/api/tickets/${selectedTicket.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedTicket)
        });
        mutateTickets();
      }

      // 2. Submit History Entry (Merged if both exist)
      const payload = new FormData();
      const historyData: any = {
        actor_username: currentUser,
        action_type: hasStatusChange ? "STATUS_CHANGE" : "COMMENT",
        comment_text: newComment
      };

      if (hasStatusChange && pendingStatus) {
        historyData.old_status = selectedTicket.status;
        historyData.new_status = pendingStatus;
      }

      payload.append("historyData", JSON.stringify(historyData));
      if (voiceNoteFile) payload.append("voice_note", voiceNoteFile);
      if (refDocFile) payload.append("reference_doc", refDocFile);

      const res = await fetch(`/api/tickets/${selectedTicket.id}/history`, { method: "POST", body: payload });

      if (res.ok) {
        const result = await res.json();
        setTicketHistory(prev => [result.history, ...prev]);
        setNewComment("");
        setVoiceNoteFile(null);
        setRefDocFile(null);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to process update");
    } finally { setSubmitting(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket || selectedTicket.status === newStatus) return;

    const oldStatus = selectedTicket.status;
    const updatedTicket = { ...selectedTicket, status: newStatus, updated_at: new Date().toISOString() };

    setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
    setSelectedTicket(updatedTicket);

    try {
      const payload = new FormData();
      const historyData = { action_type: "STATUS_CHANGE", actor_username: currentUser, old_status: oldStatus, new_status: newStatus };
      payload.append("historyData", JSON.stringify(historyData));

      await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedTicket)
      });
      const historyRes = await fetch(`/api/tickets/${selectedTicket.id}/history`, { method: "POST", body: payload });

      if (historyRes.ok) {
        const hr = await historyRes.json();
        setTicketHistory([hr.history, ...ticketHistory]);
        mutateTickets();
      }
    } catch {
      alert("Failed to update status");
      setTickets(tickets.map(t => t.id === selectedTicket.id ? selectedTicket : t));
      setSelectedTicket(selectedTicket);
    }
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;

    setSubmitting(true);
    showStatus("Removing Ticket...");

    try {
      const res = await fetch(`/api/tickets/${pendingDeleteId}`, { method: "DELETE" });
      if (res.ok) {
        mutateTickets();
        setIsStatusModalOpen(false);
      } else throw new Error();
    } catch {
      setIsStatusModalOpen(false);
      alert("Failed to delete ticket.");
    } finally {
      setSubmitting(false);
      setPendingDeleteId(null);
    }
  };

  const getDisplayStatus = (t: Ticket) => {
    const s = t.status;
    if (s === 'Resolved') return s;
    if (!t.planned_resolution) return s || 'Open';
    const due = new Date(t.planned_resolution);
    if (!isNaN(due.getTime()) && due < new Date() && s !== 'Resolved') return 'Overdue';
    return s || 'Open';
  };

  const isRegularUser = userRole?.toUpperCase() === 'USER' || userRole?.toUpperCase() === 'SALES' || userRole?.toUpperCase() === 'CRM';
  const baseTickets = isRegularUser
    ? tickets.filter(t => t.raised_by === currentUser || t.solver_person === currentUser)
    : tickets;

  const filteredTickets = baseTickets.filter(t => {
    const matchesSearch = Object.values(t).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = activeStatusFilters.length === 0 || activeStatusFilters.includes(getDisplayStatus(t));

    let matchesAssignment = true;
    if (!isRegularUser && assignmentFilters.length > 0) {
      matchesAssignment = false;
      if (assignmentFilters.includes('ToMe') && t.solver_person === currentUser) matchesAssignment = true;
      if (assignmentFilters.includes('ByMe') && t.raised_by === currentUser) matchesAssignment = true;
    }

    return matchesSearch && matchesStatus && matchesAssignment;
  });

  const getPriorityColor = (p: string) => {
    if (p === 'Critical') return 'bg-red-600 text-white border-red-700 shadow-sm';
    if (p === 'High') return 'bg-orange-500 text-white border-orange-600 shadow-sm';
    if (p === 'Medium') return 'bg-amber-500 text-white border-amber-600 shadow-sm';
    return 'bg-blue-500 text-white border-blue-600 shadow-sm';
  };

  const getStatusColor = (s: string) => {
    if (s === 'Open') return 'bg-blue-600 text-white border-blue-700 shadow-md';
    if (s === 'In Progress') return 'bg-amber-500 text-white border-amber-600 shadow-md';
    if (s === 'Pending Info') return 'bg-purple-600 text-white border-purple-700 shadow-md';
    if (s === 'Resolved') return 'bg-emerald-600 text-white border-emerald-700 shadow-md';
    if (s === 'Overdue') return 'bg-rose-600 text-white border-rose-700 shadow-md';
    return 'bg-gray-500 text-white border-gray-600 shadow-md';
  };

  const renderUserAvatar = (username: string) => {
    if (!username || username === "System" || username === "Unassigned") {
      return (
        <div className="w-7 h-7 rounded-full shrink-0 bg-gray-100 dark:bg-navy-800 text-gray-400 flex items-center justify-center shadow-sm border border-gray-200 dark:border-navy-700">
          <UserIcon className="w-3.5 h-3.5" />
        </div>
      );
    }
    const user = usersList.find((u) => u.username === username);
    if (user?.image_url) {
      return (
        <img src={user.image_url} alt={username} className="w-7 h-7 rounded-full object-cover shrink-0 border border-gray-200 dark:border-white/10 shadow-sm" />
      );
    }
    return (
      <div className="w-7 h-7 rounded-full shrink-0 bg-gradient-to-br from-[#003875] to-[#002855] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
        {username.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sticky Top Header & Filters */}
      <div className="space-y-4 mb-2">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row items-center gap-4 px-1">
          <div className="w-full lg:w-1/3 text-center lg:text-left min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">Help Tickets</h1>
            <p className="text-gray-500 dark:text-slate-300 font-bold text-[8px] md:text-[10px] uppercase tracking-wider">Support Ticketing System</p>
          </div>

          <div className="w-full lg:w-1/3 flex justify-center flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 rounded-full border-2 border-b-4 border-[#003875] dark:border-[#FFD500] bg-white dark:bg-navy-800 shadow-sm transition-all active:translate-y-[2px] active:border-b-2 p-1 overflow-x-auto no-scrollbar max-w-full">
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="flex items-center gap-2 px-3 md:px-5 py-1.5 font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all rounded-full whitespace-nowrap bg-[#003875] text-white hover:bg-[#002a5a] shadow-sm"
              >
                <PlusIcon className="w-4 h-4 ml-[-4px]" />
                New Ticket
              </button>
            </div>
          </div>
          <div className="hidden lg:block lg:w-1/3"></div>
        </div>

        {/* Status Tiles Layout */}
        <div className="rounded-2xl border border-gray-100 dark:border-navy-700 overflow-hidden shadow-sm transition-all duration-500 w-full bg-white dark:bg-navy-800">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 p-3 bg-gray-50/50 dark:bg-navy-900/30">
            {[
              { label: 'All', icon: <AdjustmentsHorizontalIcon className="w-3 h-3" />, color: 'bg-white text-gray-700 border-gray-300 dark:bg-navy-800 dark:text-gray-300 dark:border-navy-600' },
              { label: 'Open', icon: <DocumentArrowUpIcon className="w-3 h-3" />, color: 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
              { label: 'In Progress', icon: <ArrowPathIcon className="w-3 h-3" />, color: 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
              { label: 'Pending Info', icon: <ChatBubbleLeftRightIcon className="w-3 h-3" />, color: 'bg-purple-50 text-purple-600 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700' },
              { label: 'Resolved', icon: <CheckCircleIcon className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' },
              { label: 'Overdue', icon: <ExclamationCircleIcon className="w-3 h-3" />, color: 'bg-red-50 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
            ].map(tile => {
              const count = tile.label === 'All' ? baseTickets.length : baseTickets.filter(t => getDisplayStatus(t) === tile.label).length;
              const isActive = tile.label === 'All' ? activeStatusFilters.length === 0 : activeStatusFilters.includes(tile.label);

              const handleToggle = () => {
                if (tile.label === 'All') {
                  setActiveStatusFilters([]);
                } else {
                  setActiveStatusFilters(prev =>
                    prev.includes(tile.label)
                      ? prev.filter(s => s !== tile.label)
                      : [...prev, tile.label]
                  );
                }
              };

              return (
                <button key={tile.label} onClick={handleToggle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black border-[#003875] dark:border-[#FFD500] shadow-md scale-105' : `${tile.color} hover:scale-[1.02] hover:shadow-sm`
                    }`}
                >
                  {tile.icon} {tile.label}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20 dark:bg-black/20' : 'bg-black/5 dark:bg-white/10'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div
            style={{ backgroundColor: 'var(--panel-card)', borderTop: '1px solid var(--panel-border)' }}
            className="p-3"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="relative group flex-1 min-w-0">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#FFD500] transition-colors" />
                <input type="text" placeholder="Search database..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-gray-50 dark:bg-navy-900 border-2 border-gray-100 dark:border-navy-700/50 rounded-xl focus:border-[#FFD500] outline-none font-bold text-[10px] text-gray-700 dark:text-white transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center bg-gray-50 dark:bg-navy-900 p-0.5 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm shrink-0">
                {[
                  { label: 'To', full: 'To Me', value: 'ToMe', count: baseTickets.filter(t => t.solver_person === currentUser).length },
                  { label: 'By', full: 'By Me', value: 'ByMe', count: baseTickets.filter(t => t.raised_by === currentUser).length }
                ].map(btn => {
                  const isActive = assignmentFilters.includes(btn.value);
                  return (
                    <button key={btn.value}
                      onClick={() => setAssignmentFilters(prev =>
                        prev.includes(btn.value) ? prev.filter(v => v !== btn.value) : [...prev, btn.value]
                      )}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${isActive ? 'bg-[#003875] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                      title={btn.full}
                    >
                      <span className="hidden sm:inline">{btn.full}</span>
                      <span className="sm:hidden">{btn.label}</span>
                      <span className={`px-1 rounded-md text-[8px] ${isActive ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'}`}>
                        {btn.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center"><ArrowPathIcon className="w-8 h-8 text-[#003875] dark:text-[#FFD500] animate-spin" /></div>
        ) : filteredTickets.length === 0 ? (
          <div className="col-span-full py-20 text-center flex flex-col items-center">
            <TicketIcon className="w-16 h-16 text-gray-300 dark:text-navy-700 mb-4" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white">No tickets found</h3>
            <p className="text-sm font-bold text-gray-500 mt-2 tracking-widest uppercase">Try adjusting your filters</p>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const displayStatus = getDisplayStatus(ticket);
            const statusColors: Record<string, string> = {
              'Open': 'border-blue-300 dark:border-blue-500/30 hover:to-blue-50/20',
              'In Progress': 'border-amber-300 dark:border-amber-500/30 hover:to-amber-50/20',
              'Pending Info': 'border-purple-300 dark:border-purple-500/30 hover:to-purple-50/20',
              'Resolved': 'border-emerald-300 dark:border-emerald-500/30 hover:to-emerald-50/20',
              'Overdue': 'border-rose-300 dark:border-rose-500/30 hover:to-rose-50/20'
            };
            const themeStyle = statusColors[displayStatus] || 'border-gray-300 dark:border-gray-500/30 hover:to-gray-50/20';
            const borderColor = themeStyle.split(' ')[0];
            const hoverGradient = themeStyle.split(' ').pop();

            return (
              <div key={ticket.id}
                className={`group bg-white dark:bg-navy-900 rounded-2xl border-[4px] ${borderColor} shadow-sm hover:shadow-xl hover:translate-y-[-2px] hover:bg-gradient-to-br from-white ${hoverGradient} dark:from-navy-900 dark:to-navy-800 transition-all duration-500 overflow-hidden flex flex-col`}
              >
                {/* Card Header: Slim with Top Right Actions */}
                <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-2 bg-gray-50/30 dark:bg-white/5">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="font-mono text-[9px] font-black text-white bg-[#003875] dark:bg-[#FFD500] dark:text-black px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                      TKT-{ticket.id.split('-').pop()}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 shadow-sm ${getStatusColor(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </div>
                  </div>

                  {/* Top Right Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-1.5 bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-all border border-emerald-200 dark:border-emerald-800/30"
                      title="Follow Up"
                    >
                      <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                    </button>

                    {(['ADMIN', 'EA'].includes(userRole?.toUpperCase()) || ticket.raised_by === currentUser) && (
                      <>
                        <button
                          onClick={() => setEditingTicket(ticket)}
                          className="p-1.5 bg-[#003875]/10 text-[#003875] dark:bg-[#FFD500]/10 dark:text-[#FFD500] hover:bg-[#003875] hover:text-white dark:hover:bg-[#FFD500] dark:hover:text-black rounded-lg transition-all border border-[#003875]/20 dark:border-[#FFD500]/20"
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(ticket.id)}
                          className="p-1.5 bg-[#CE2029]/10 text-[#CE2029] hover:bg-[#CE2029] hover:text-white rounded-lg transition-all border border-[#CE2029]/20"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Body: Split and Compact */}
                <div className="p-3.5 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-black text-[14px] text-gray-900 dark:text-white leading-tight line-clamp-1 uppercase tracking-tight group-hover:text-[#003875] dark:group-hover:text-[#FFD500] transition-colors">
                      {ticket.title}
                    </h3>
                    {/* Description: Clamped 2 lines */}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug italic border-l-2 border-gray-100 dark:border-navy-700 pl-2">
                      {ticket.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderUserAvatar(ticket.raised_by || "System")}
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-blue-400 dark:text-blue-500 uppercase tracking-widest leading-none mb-0.5">Raised By</p>
                        <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate">{ticket.raised_by || "System"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      {renderUserAvatar(ticket.solver_person || "Unassigned")}
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-emerald-400 dark:text-emerald-500 uppercase tracking-widest leading-none mb-0.5">Assignee</p>
                        <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate">{ticket.solver_person || "Unassigned"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400 border border-amber-100/50 dark:border-amber-800/30 shrink-0">
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-amber-400 dark:text-amber-500 uppercase tracking-widest leading-none mb-0.5">Due Date</p>
                        <p className="text-[11px] font-bold text-gray-800 dark:text-slate-200 truncate">
                          {ticket.planned_resolution ? new Date(ticket.planned_resolution).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-800/30 shrink-0">
                        <TagIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-purple-400 dark:text-purple-500 uppercase tracking-widest leading-none mb-0.5">Category</p>
                        <p className="text-[11px] font-black text-[#003875] dark:text-[#FFD500] truncate">{ticket.category}</p>
                      </div>
                    </div>
                  </div>

                  {/* Latest Comment Snippet */}
                  {ticket.latest_comment && (
                    <div className="mt-1 pt-3 border-t border-gray-100 dark:border-navy-700/50 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate flex gap-1.5 items-center">
                          <span>Latest Comment By {ticket.latest_comment.actor}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                          <span>{new Date(ticket.latest_comment.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed bg-gray-50/50 dark:bg-navy-900 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-navy-800 italic">
                        "{ticket.latest_comment.text}"
                      </p>
                    </div>
                  )}

                </div>
              </div>
            )
          })
        )}
      </div>

      {/* New / Edit Ticket Modal */}
      {(isNewModalOpen || editingTicket) && (
        <Portal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsNewModalOpen(false); setEditingTicket(null); }} />
          <div className="relative bg-[#FFFBF0] dark:bg-navy-900 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300 border border-orange-100/50 dark:border-navy-700 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-orange-100/50 dark:border-navy-800 flex justify-between items-center bg-[#003875] dark:bg-navy-900 text-white">
              <div>
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2 uppercase">
                  <TicketIcon className="w-5 h-5 text-[#FFD500]" /> {editingTicket ? "Edit Ticket" : "New Ticket"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[#FFD500] dark:text-slate-400 font-bold text-[8px] uppercase tracking-widest">Support Configuration</p>
                  {editingTicket && (
                    <span className="px-2 py-0.5 bg-white/10 text-[8px] font-black text-[#FFD500] rounded border border-white/20">
                      ID: {editingTicket.id}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { setIsNewModalOpen(false); setEditingTicket(null); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingTicket ? handleUpdateTicket : handleCreateTicket} className="p-6 overflow-y-auto space-y-6 custom-scrollbar bg-white dark:bg-navy-800/50">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#FFD500] uppercase tracking-widest mb-1.5 px-1">
                    Title <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                  </label>
                  <input required aria-required="true" type="text" value={editingTicket ? editingTicket.title : newTicket.title} onChange={e => editingTicket ? setEditingTicket({ ...editingTicket, title: e.target.value }) : setNewTicket({ ...newTicket, title: e.target.value })} className="w-full bg-[#FFFBF0] dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-orange-100 dark:border-navy-700 focus:border-[#FFD500] focus:bg-white dark:focus:bg-navy-900 outline-none font-black text-xs text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Issue summary" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                    Description <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                  </label>
                  <textarea required aria-required="true" rows={3} value={editingTicket ? editingTicket.description : newTicket.description} onChange={e => editingTicket ? setEditingTicket({ ...editingTicket, description: e.target.value }) : setNewTicket({ ...newTicket, description: e.target.value })} className="w-full bg-[#FFFBF0] dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-orange-100 dark:border-navy-700 focus:border-[#FFD500] focus:bg-white dark:focus:bg-navy-900 outline-none font-bold text-xs text-gray-800 dark:text-zinc-100 transition-all shadow-sm resize-none min-h-[80px]" placeholder="Provide details..." />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-orange-50 dark:border-navy-800/50">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black text-[#FFD500] uppercase tracking-[0.2em]">Attachments</p>
                  {editingTicket && (editingTicket.attachment_url || editingTicket.voice_note) && (
                    <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded">Existing Files Preserved</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Voice Note Upload / Record */}
                  <div className={`p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 relative overflow-hidden ${isRecording
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                      : 'border-dashed border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900/50'
                    }`}>
                    {/* Recording Waveform Animation */}
                    {isRecording && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none gap-1">
                        {[...Array(20)].map((_, i) => (
                          <div key={i} className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: `${Math.random() * 60 + 20}px`, animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${0.5 + Math.random() * 0.5}s` }} />
                        ))}
                      </div>
                    )}

                    <div className="relative z-10 flex flex-col items-center text-center w-full">
                      {isRecording ? (
                        <>
                          <button type="button" onClick={stopRecording} className="p-4 bg-red-500 rounded-full text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-105 active:scale-95 animate-pulse">
                            <StopCircleIcon className="w-8 h-8" />
                          </button>
                          <p className="mt-3 font-black text-red-600 dark:text-red-400 font-mono text-lg tracking-widest">{formatDuration(recordingDuration)}</p>
                          <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest mt-1 animate-pulse">Recording Live...</p>
                        </>
                      ) : (
                        <div className="flex w-full items-center gap-3">
                          <div className="relative">
                            <button type="button" onClick={startRecording} className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white transition-all shadow-sm flex-shrink-0 group" title="Start Recording">
                              <MicrophoneIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            </button>
                            {editingTicket?.voice_note && !voiceNoteFile && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-navy-950" title="Existing voice note" />}
                          </div>

                          <div className="flex-1 text-left border-l-2 border-gray-200 dark:border-navy-700 pl-3 h-full flex flex-col justify-center min-w-0">
                            <p className="text-sm font-black text-gray-800 dark:text-zinc-200 truncate">{voiceNoteFile ? "New Voice Note" : editingTicket?.voice_note ? "Keep Existing" : "Record Live"}</p>
                            <p className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">{voiceNoteFile ? voiceNoteFile.name : editingTicket?.voice_note ? "Original file preserved" : "Click mic to start"}</p>
                          </div>

                          <label className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-navy-800 px-2.5 py-1.5 rounded border border-gray-200 dark:border-navy-700 shadow-sm hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors flex-shrink-0">
                            <PaperClipIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Upload</span>
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setVoiceNoteFile(e.target.files[0]); }} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reference Document Upload */}
                  <div className="p-4 bg-gray-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-gray-300 dark:border-navy-700 flex flex-col justify-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative p-3 bg-white dark:bg-navy-800 rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                        <PaperClipIcon className="w-5 h-5 text-gray-400 group-hover:text-[#003875] dark:group-hover:text-[#FFD500] transition-colors" />
                        {editingTicket?.attachment_url && !refDocFile && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-navy-950" title="Existing document" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-gray-800 dark:text-zinc-200">{refDocFile ? "New Document" : editingTicket?.attachment_url ? "Keep Existing" : "Reference Doc"}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate">{refDocFile ? refDocFile.name : editingTicket?.attachment_url ? "Original file preserved" : "Click to upload document"}</p>
                      </div>
                      <input type="file" className="hidden" onChange={(e) => setRefDocFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Searchable Category Dropdown */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 px-1">Category</label>
                  <div className="w-full bg-[#FFFBF0] dark:bg-navy-900 border border-orange-100 dark:border-navy-700 rounded-xl shadow-sm cursor-pointer" onClick={() => { setCategoryOpen(!categoryOpen); setAssignedToOpen(false); }}>
                    <div className="px-3 py-2.5 font-bold text-xs text-gray-800 dark:text-zinc-100 flex justify-between items-center transition-colors">
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{(editingTicket ? editingTicket.category : newTicket.category) || "Select Category..."}</span>
                      </div>
                      <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                  {categoryOpen && (
                    <div className="absolute z-[10000] w-full mt-1 bg-white dark:bg-navy-900 border border-orange-100 dark:border-navy-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-2 border-b border-orange-50 dark:border-navy-800">
                        <input type="text" placeholder="Search categories..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full bg-gray-50 dark:bg-navy-900 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-navy-800 outline-none text-[10px] font-bold text-gray-700 dark:text-gray-300" />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {categories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                          <div key={c} className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 cursor-pointer" onClick={() => { editingTicket ? setEditingTicket({ ...editingTicket, category: c }) : setNewTicket({ ...newTicket, category: c }); setCategoryOpen(false); setCategorySearch(""); }}>{c}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Priority Buttons */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 px-1">Priority</label>
                  <div className="flex bg-gray-100 dark:bg-navy-900/50 p-1 rounded-xl gap-1">
                    {(['Low', 'Medium', 'High', 'Critical'] as const).map((pri) => (
                      <button key={pri} type="button" onClick={() => editingTicket ? setEditingTicket({ ...editingTicket, priority: pri }) : setNewTicket({ ...newTicket, priority: pri })} className={`flex-1 py-2 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${(editingTicket ? editingTicket.priority : newTicket.priority) === pri
                          ? pri === 'Low' ? 'bg-green-500 text-white shadow-md'
                            : pri === 'Medium' ? 'bg-yellow-500 text-white shadow-md'
                              : pri === 'High' ? 'bg-orange-500 text-white shadow-md'
                                : 'bg-red-600 text-white shadow-md'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-navy-800 hover:text-gray-900 dark:hover:text-white'
                        }`}>{pri}</button>
                    ))}
                  </div>
                </div>

                {/* Searchable Assign To Dropdown */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 px-1">Assign To</label>
                  <div className="w-full bg-[#FFFBF0] dark:bg-navy-900 border border-orange-100 dark:border-navy-700 rounded-xl shadow-sm cursor-pointer" onClick={() => { setAssignedToOpen(!assignedToOpen); setCategoryOpen(false); }}>
                    <div className="px-3 py-2.5 font-bold text-xs text-gray-800 dark:text-zinc-100 flex justify-between items-center transition-colors">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{(editingTicket ? editingTicket.solver_person : newTicket.solver_person) || "Select Staff..."}</span>
                      </div>
                      <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                  {assignedToOpen && (
                    <div className="absolute z-[10000] w-full mt-1 bg-white dark:bg-navy-900 border border-orange-100 dark:border-navy-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-2 border-b border-orange-50 dark:border-navy-800">
                        <input type="text" placeholder="Search staff..." value={assignedToSearch} onChange={(e) => setAssignedToSearch(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full bg-gray-50 dark:bg-navy-900 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-navy-800 outline-none text-[10px] font-bold text-gray-700 dark:text-gray-300" />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {usersList.filter(u => u.username.toLowerCase().includes(assignedToSearch.toLowerCase())).map(u => (
                          <div key={u.username} className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 cursor-pointer" onClick={() => { editingTicket ? setEditingTicket({ ...editingTicket, solver_person: u.username }) : setNewTicket({ ...newTicket, solver_person: u.username }); setAssignedToOpen(false); setAssignedToSearch(""); }}>{u.username}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <PremiumDatePicker
                    label="Planned Resolution"
                    value={editingTicket ? (editingTicket.planned_resolution ? editingTicket.planned_resolution.split('T')[0] : '') : (newTicket.planned_resolution ? newTicket.planned_resolution.split('T')[0] : '')}
                    onChange={(val) => {
                      const isoVal = val ? new Date(val).toISOString() : "";
                      editingTicket
                        ? setEditingTicket({ ...editingTicket, planned_resolution: isoVal })
                        : setNewTicket({ ...newTicket, planned_resolution: isoVal });
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-orange-100/50 dark:border-navy-800 flex gap-3">
                <button type="button" onClick={() => { setIsNewModalOpen(false); setEditingTicket(null); }} className="flex-1 px-4 py-2.5 rounded-xl font-black text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-navy-800 transition-all uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#CE2029] hover:bg-[#8E161D] text-white px-4 py-2.5 rounded-xl font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : editingTicket ? <ShieldCheckIcon className="w-4 h-4" /> : <FireIcon className="w-4 h-4" />} {editingTicket ? "Save Changes" : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* Ticket Details Right Sidebar */}
      {selectedTicket && (
        <Portal>
        <div className="fixed inset-0 z-[99999] flex justify-end overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTicket(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-navy-900 shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.3)] flex flex-col animate-in slide-in-from-right duration-500 border-l border-gray-200 dark:border-navy-700">
            {/* Header */}
            <div className="bg-[#CE2029] py-3 px-5 flex items-start justify-between text-white shrink-0 shadow-md">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20 shrink-0 mt-0.5">
                  <TicketIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 text-[9px] font-black uppercase tracking-widest mb-1 opacity-90">
                    <span className="bg-white/20 px-1.5 py-0.5 rounded border border-white/10 shrink-0">#{selectedTicket.id.split('-').pop()}</span>
                    <span>{selectedTicket.priority}</span>
                  </div>
                  <h2 className="text-sm font-black tracking-tight leading-snug break-words">{selectedTicket.title}</h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-all shrink-0 ml-2"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6 custom-scrollbar space-y-4">
              {/* Description Block */}
              <div className="bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/30">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                {(selectedTicket.voice_note || selectedTicket.attachment_url) && (
                  <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-red-200/50">
                    {selectedTicket.voice_note && (
                      <button onClick={() => toggleAudio(selectedTicket.voice_note, `main-${selectedTicket.id}`)} className="flex items-center gap-2 bg-white dark:bg-navy-800 text-[#CE2029] dark:text-red-400 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 shadow-sm transition-all hover:bg-red-50 dark:hover:bg-navy-700 text-[9px] font-black uppercase tracking-widest">
                        {playingAudioId === `main-${selectedTicket.id}` ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5" />} Voice Note
                      </button>
                    )}
                    {selectedTicket.attachment_url && (
                      <a 
                        href={selectedTicket.attachment_url.startsWith("http") ? selectedTicket.attachment_url : `https://drive.google.com/file/d/${selectedTicket.attachment_url}/view?usp=sharing`} 
                        target="_blank" 
                        className="flex items-center gap-2 bg-white dark:bg-navy-800 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/50 shadow-sm transition-all hover:bg-blue-50 dark:hover:bg-navy-700 text-[9px] font-black uppercase tracking-widest no-underline"
                      >
                        <PaperClipIcon className="w-3.5 h-3.5" /> Document
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Ticket Details Metadata */}
              <div className="grid grid-cols-2 gap-3 px-1">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block px-0.5">Raised By</span>
                  <div className="flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-900/10 px-2 py-1 rounded-lg border border-blue-100/50 dark:border-blue-800/20">
                    <UserIcon className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 truncate">{selectedTicket.raised_by}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block px-0.5">Assigned To</span>
                  <div className="flex items-center gap-1.5 bg-purple-50/50 dark:bg-purple-900/10 px-2 py-1 rounded-lg border border-purple-100/50 dark:border-purple-800/20">
                    <UserGroupIcon className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 truncate">{selectedTicket.solver_person || 'Unassigned'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block px-0.5">Due Date</span>
                  <div className="flex items-center gap-1.5 bg-amber-50/50 dark:bg-amber-900/10 px-2 py-1 rounded-lg border border-amber-100/50 dark:border-amber-800/20">
                    <CalendarIcon className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 truncate">
                      {selectedTicket.planned_resolution ? new Date(selectedTicket.planned_resolution).toLocaleDateString([], { day: '2-digit', month: 'short' }) : 'No Date'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block px-0.5">Category</span>
                  <div className="flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-900/10 px-2 py-1 rounded-lg border border-emerald-100/50 dark:border-emerald-800/20">
                    <TagIcon className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 truncate">{selectedTicket.category}</span>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="bg-white dark:bg-navy-800 rounded-xl p-3 border border-gray-100 dark:border-navy-700 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Update State</span>
                  {submitting && <ArrowPathIcon className="w-3 h-3 animate-spin text-[#003875]" />}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {['Open', 'In Progress', 'Pending Info', 'Resolved'].map(s => (
                    <button
                      key={s}
                      disabled={submitting}
                      onClick={() => setPendingStatus(s)}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border-2 ${pendingStatus === s
                          ? `${getStatusColor(s)} scale-105 shadow-lg z-10`
                          : 'bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-navy-700 hover:border-gray-400'
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread History */}
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 pb-2 border-b border-gray-100 dark:border-navy-700">
                  <ClockIcon className="w-3.5 h-3.5" /> Action Log
                </h3>

                {historyLoading ? (
                  <div className="flex justify-center p-6"><ArrowPathIcon className="w-5 h-5 text-[#003875] animate-spin" /></div>
                ) : ticketHistory.length === 0 ? (
                  <p className="text-center text-[10px] uppercase font-black tracking-widest text-gray-400 py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[17px] before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-navy-700 before:to-transparent">
                    {ticketHistory.map((log) => (
                      <div key={log.id} className="relative flex items-start gap-3">
                        <div className="flex items-center justify-center w-[34px] h-[34px] rounded-full border-[3px] border-white dark:border-navy-900 bg-[#003875] text-white shadow-sm shrink-0 z-10">
                          {log.action_type === 'STATUS_CHANGE' ? <ArrowPathIcon className="w-3 h-3" /> : <ChatBubbleLeftRightIcon className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 p-2.5 rounded-xl bg-gray-50 dark:bg-navy-800 border border-gray-100 dark:border-navy-700 shadow-sm z-10">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[9px] font-black text-[#003875] dark:text-[#FFD500] uppercase">{log.actor_username}</span>
                            <span className="text-[8px] font-bold text-gray-400">{new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
                          </div>
                          {log.action_type === 'STATUS_CHANGE' && (
                            <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                              <span className="opacity-60">Status:</span>
                              <span className="line-through opacity-40">{log.old_status}</span>
                              <span className="text-[#CE2029] dark:text-red-400">➡️ {log.new_status}</span>
                            </p>
                          )}

                          {(log.comment_text || log.voice_note || log.attachment_url) && (
                            <div className="space-y-2 pt-1 border-t border-gray-100/50 dark:border-navy-700/50">
                              {log.comment_text && <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{log.comment_text}</p>}
                              {log.voice_note && (
                                <button onClick={() => toggleAudio(log.voice_note, log.id)} className="flex items-center gap-1.5 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-600 px-2 py-1 rounded text-[#003875] dark:text-[#FFD500] text-[9px] font-black uppercase tracking-widest shadow-sm">
                                  {playingAudioId === log.id ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3" />} Play Voice
                                </button>
                              )}
                              {log.attachment_url && (
                                <a 
                                  href={log.attachment_url.startsWith("http") ? log.attachment_url : `https://drive.google.com/file/d/${log.attachment_url}/view?usp=sharing`} 
                                  target="_blank" 
                                  className="flex items-center gap-1 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:underline"
                                >
                                  <PaperClipIcon className="w-3 h-3" /> View Attachment
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Box Footer */}
            <div className="bg-white dark:bg-navy-800 border-t border-gray-200 dark:border-navy-700 p-3 sticky bottom-0 z-20 shrink-0">
              {/* Reply Mini voice recorder */}
              {!isRecording && !voiceNoteFile && !refDocFile && (
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={startRecording} className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 dark:bg-navy-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 py-1.5 rounded-lg border border-gray-200 dark:border-navy-700 text-[9px] font-black uppercase tracking-widest transition-colors"><MicrophoneIcon className="w-3.5 h-3.5" /> Mic</button>
                  <input type="file" id="commentDoc" className="hidden" onChange={e => setRefDocFile(e.target.files?.[0] || null)} />
                  <label htmlFor="commentDoc" className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 dark:bg-navy-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 py-1.5 rounded-lg border border-gray-200 dark:border-navy-700 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer"><PaperClipIcon className="w-3.5 h-3.5" /> Doc</label>
                </div>
              )}
              {isRecording && (
                <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 mb-2">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span className="text-red-600 text-[10px] font-bold">{formatDuration(recordingDuration)}</span></div>
                  <button onClick={stopRecording} className="text-red-600"><StopCircleIcon className="w-4 h-4" /></button>
                </div>
              )}
              {voiceNoteFile && !isRecording && (
                <div className="flex items-center justify-between bg-green-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-green-200 dark:border-emerald-900/50 mb-2">
                  <span className="text-green-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Audio attached</span>
                  <button onClick={() => setVoiceNoteFile(null)} className="text-green-700"><XMarkIcon className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {refDocFile && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/50 mb-2">
                  <span className="text-blue-700 dark:text-blue-400 text-[10px] font-bold flex items-center gap-1 truncate max-w-[200px]"><PaperClipIcon className="w-3 h-3 shrink-0" /> {refDocFile.name}</span>
                  <button onClick={() => setRefDocFile(null)} className="text-blue-700"><XMarkIcon className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <form onSubmit={handleAddComment} className="flex gap-2 relative">
                <input required={!(voiceNoteFile || refDocFile || (pendingStatus && pendingStatus !== selectedTicket?.status))} type="text" placeholder="Type a remark..." value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl px-3 py-2 outline-none focus:border-[#003875] font-bold text-xs shadow-inner" />
                <button type="submit" disabled={submitting || (!newComment.trim() && !voiceNoteFile && !refDocFile && pendingStatus === selectedTicket?.status)} className="bg-[#003875] hover:bg-[#002a5a] text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-md">
                  {submitting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : "Post"}
                </button>
              </form>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Action Status Modal */}
      {isStatusModalOpen && (
        <Portal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl shadow-2xl relative z-10 max-w-xs w-full flex flex-col items-center text-center animate-in zoom-in-95 border border-gray-100 dark:border-navy-700">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3 border border-blue-100 dark:border-blue-800/50">
              <ArrowPathIcon className="w-6 h-6 text-[#003875] dark:text-[#FFD500] animate-spin" />
            </div>
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">Processing</h3>
            <p className="text-xs text-gray-500 font-bold">{statusMessage}</p>
          </div>
        </div>
        </Portal>
      )}

      {/* Confirmation Modal */}
      <Portal>
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={performDelete}
        title="Delete Ticket"
        message="Are you sure you want to permanently delete this ticket? This action cannot be undone."
        confirmLabel="Delete"
        type="danger"
      />
      </Portal>
    </div>
  );
}
