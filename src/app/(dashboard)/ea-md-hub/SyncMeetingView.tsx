"use client";

import { useState, useEffect } from 'react';
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  XMarkIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  PencilSquareIcon,
  TrashIcon,
  PrinterIcon,
  ClockIcon as HistoryIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ToastProvider';
import Portal from '@/components/Portal';

interface AgendaItem {
  id: string;
  duration: string;
  title: string;
  owner: 'EA' | 'MD' | 'Both';
}

interface ActionLogItem {
  id: string;
  task: string;
}

interface SyncMeeting {
  id: string;
  date: string;
  time: string;
  location: string;
  agenda: AgendaItem[];
  decisions: string;
  actionItems: ActionLogItem[];
  notes: string;
}

export default function SyncMeetingView() {
  const toast = useToast();

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
  };

  // Primary State
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('Office / ERP room');

  const [agenda, setAgenda] = useState<AgendaItem[]>([]);

  const [decisions, setDecisions] = useState('');
  const [actionItems, setActionItems] = useState<ActionLogItem[]>([]);
  const [notes, setNotes] = useState('');

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<SyncMeeting[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/ea-md/sync-meeting");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || []);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      id: Date.now().toString(),
      duration: '0-5 min',
      title: '',
      owner: 'Both'
    };
    setAgenda([...agenda, newItem]);
  };

  const updateAgendaItem = (id: string, updates: Partial<AgendaItem>) => {
    setAgenda(agenda.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeAgendaItem = (id: string) => {
    setAgenda(agenda.filter(item => item.id !== id));
  };

  const addActionItem = () => {
    const newItem: ActionLogItem = {
      id: Date.now().toString(),
      task: ''
    };
    setActionItems([...actionItems, newItem]);
  };

  const updateActionItem = (id: string, task: string) => {
    setActionItems(actionItems.map(item => item.id === id ? { ...item, task } : item));
  };

  const removeActionItem = (id: string) => {
    setActionItems(actionItems.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload = {
      date,
      time,
      location,
      agenda,
      decisions,
      actionItems,
      notes
    };

    try {
      const method = meetingId ? 'PUT' : 'POST';
      const url = meetingId ? `/api/ea-md/sync-meeting?id=${meetingId}` : '/api/ea-md/sync-meeting';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Meeting record saved successfully!");
        const data = await res.json();
        if (!meetingId) setMeetingId(data.id);
        loadHistory();
        setIsModalOpen(false); // Close modal on save
      } else {
        toast.error("Failed to save meeting.");
      }
    } catch (err) {
      toast.error("Error connecting to server.");
    } finally {
      setIsSaving(false);
    }
  };

  const loadMeeting = (meeting: SyncMeeting) => {
    setMeetingId(meeting.id);
    setDate(meeting.date);
    setTime(meeting.time);
    setLocation(meeting.location);
    setAgenda(meeting.agenda);
    setDecisions(meeting.decisions);
    setActionItems(meeting.actionItems);
    setNotes(meeting.notes);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setMeetingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setTime('');
    setLocation('Office / ERP room');
    setAgenda([]);
    setDecisions('');
    setActionItems([]);
    setNotes('');
  };

  const openNewMeetingModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col w-full space-y-6 h-[calc(100vh-8rem)]">
      {/* Header Actions */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-[#1D4ED8] dark:text-white tracking-tight">Sync Meetings</h2>
          <p className="text-[13px] font-bold text-gray-500">Meeting History & Log</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={openNewMeetingModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1D4ED8] text-white rounded-xl text-[13px] font-semibold hover:bg-blue-800 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <PlusIcon className="w-4 h-4 stroke-[3]" /> Create New Meeting
          </button>
        </div>
      </div>

      {/* Main List View */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-6 pl-1">
        {history.length === 0 ? (
          <div className="bg-white dark:bg-navy-800 rounded-3xl border border-dashed border-gray-200 dark:border-navy-700 p-12 text-center h-full flex flex-col items-center justify-center">
            <ClipboardDocumentCheckIcon className="w-12 h-12 text-[#5B6472] mx-auto mb-4" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-1">No Meetings Found</h3>
            <p className="text-gray-500 text-[14px] font-bold">Click the button above to create your first sync meeting.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {history.map(m => (
              <button
                key={m.id}
                onClick={() => loadMeeting(m)}
                className="text-left bg-white dark:bg-navy-800 p-4 rounded-3xl border border-gray-100 dark:border-navy-700 shadow-sm hover:shadow-md hover:border-blue-500 transition-all group relative overflow-hidden flex flex-col"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 w-full pl-2">
                  <span className="text-[14px] font-semibold text-blue-600 flex items-center gap-1.5 transition-colors">
                    <CalendarDaysIcon className="w-4 h-4" /> {formatDisplayDate(m.date)}
                  </span>
                  <span className="text-[14px] font-semibold text-gray-500 flex items-center gap-1.5">
                    <ClockIcon className="w-4 h-4" /> {m.time || '--:--'}
                  </span>
                  <span className="text-[14px] font-semibold text-gray-500 flex items-center gap-1.5">
                    <MapPinIcon className="w-4 h-4" /> {m.location || 'No location set'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full bg-gray-50 dark:bg-navy-900/30 p-3 rounded-2xl mx-1 border border-gray-100 dark:border-navy-700/50">
                  <div>
                    <h5 className="text-[13px] font-semibold text-[#5B6472] mb-1 flex items-center gap-1.5">
                        <CheckBadgeIcon className="w-3.5 h-3.5" /> Decisions Made
                    </h5>
                    <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                      {m.decisions || <span className="text-[#5B6472] italic font-normal">No decisions recorded</span>}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-[13px] font-semibold text-[#5B6472] mb-1 flex items-center gap-1.5">
                        <PencilSquareIcon className="w-3.5 h-3.5" /> Meeting Notes
                    </h5>
                    <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2">
                      {m.notes || <span className="text-[#5B6472] italic font-normal">No notes added</span>}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 flex justify-end gap-6 w-full pr-2">
                  <span className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1">
                    <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                    {m.agenda?.length || 0} Topics
                  </span>
                  <span className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-1">
                    <CheckBadgeIcon className="w-3.5 h-3.5" />
                    {m.actionItems?.length || 0} Actions
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#1D4ED8]/40 backdrop-blur-sm"
                onClick={() => setIsModalOpen(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20"
              >
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-navy-800 flex items-center justify-between sticky top-0 z-10 shrink-0 bg-[#FFFFFF] dark:bg-navy-900">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        {meetingId ? 'Edit Meeting Record' : 'New Meeting Record'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[#5B6472] dark:text-slate-400 font-bold text-[12px]">EA-MD Hub</p>
                      <span className="px-2 py-0.5 bg-[#F7F8FA] dark:bg-navy-800 text-[12px] font-semibold text-[#2563EB] dark:text-[#60A5FA] rounded border border-[#E5E7EB] dark:border-navy-700">
                        Sync Meeting
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                      {meetingId && (
                         <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-navy-900 text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-navy-700 text-[13px] font-semibold hover:bg-white transition-all shadow-sm">
                            <PrinterIcon className="w-4 h-4" /> Print
                        </button>
                      )}
                      <button 
                        onClick={() => setIsModalOpen(false)} 
                        className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-full transition-all"
                      >
                        <XMarkIcon className="w-5 h-5 stroke-[3]" />
                      </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar pb-10 bg-white dark:bg-navy-800/50">
                  
                  {/* Meeting Details Section */}
                  <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm">
                    <h3 className="text-[13px] font-semibold text-[#5B6472] mb-3 flex items-center gap-2">
                      <CalendarDaysIcon className="w-4 h-4" /> Meeting details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[13px] font-semibold text-gray-500 px-1">Date</label>
                        <div className="relative group/date">
                          <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472] pointer-events-none group-focus-within/date:text-[#1D4ED8]" />
                          <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full bg-[#FFFFFF] dark:bg-navy-900 pr-10 pl-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 outline-none text-[14px] font-bold text-gray-800 dark:text-white transition-all focus:ring-2 focus:ring-[#1D4ED8]/20 shadow-sm" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[13px] font-semibold text-gray-500 px-1">Time</label>
                        <div className="relative group">
                          <input type="time" value={time} onChange={e => setTime(e.target.value)}
                            className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 outline-none text-[14px] font-bold text-gray-800 dark:text-white transition-all focus:ring-2 focus:ring-[#1D4ED8]/20 shadow-sm" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[13px] font-semibold text-gray-500 px-1">Location</label>
                        <div className="relative group">
                          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Where?"
                            className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 outline-none text-[14px] font-bold text-gray-800 dark:text-white transition-all focus:ring-2 focus:ring-[#1D4ED8]/20 shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agenda Section */}
                  <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-2">
                        <ClipboardDocumentCheckIcon className="w-4 h-4" /> Agenda
                      </h3>
                      <button
                        onClick={addAgendaItem}
                        className="bg-[#1D4ED8] text-white px-3 py-1.5 rounded-lg text-[13px] font-semibold flex items-center gap-1 hover:scale-105 transition-all shadow-sm active:scale-95"
                      >
                        <PlusIcon className="w-3 h-3 stroke-[3]" /> Add item
                      </button>
                    </div>

                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {agenda.map((item) => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-navy-900/50 rounded-xl group border border-transparent hover:border-blue-100 dark:hover:border-navy-600 transition-all shadow-sm"
                          >
                            <input
                              type="text"
                              value={item.duration}
                              onChange={e => updateAgendaItem(item.id, { duration: e.target.value })}
                              placeholder="0 min"
                              className="w-16 bg-white dark:bg-navy-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-navy-700 text-[13px] font-semibold text-blue-600 text-center outline-none shrink-0"
                            />
                            <input
                              type="text"
                              value={item.title}
                              onChange={e => updateAgendaItem(item.id, { title: e.target.value })}
                              placeholder="Topic name..."
                              className="flex-1 w-full bg-transparent border-none outline-none text-[14px] font-bold text-gray-800 dark:text-gray-200 placeholder:text-gray-400 pl-2"
                            />
                            <div className="flex items-center bg-white dark:bg-navy-800 p-0.5 rounded-lg border border-gray-200 dark:border-navy-700 shrink-0">
                              {(['EA', 'MD', 'Both'] as const).map(o => (
                                <button
                                  key={o}
                                  onClick={() => updateAgendaItem(item.id, { owner: o })}
                                  className={`px-2 py-1 rounded-md text-[12px] font-semibold  transition-all ${item.owner === o ? 'bg-[#1D4ED8] text-white shadow-sm scale-105' : 'text-[#5B6472] hover:text-gray-600'
                                    }`}
                                >
                                  {o}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => removeAgendaItem(item.id)}
                              className="p-1 px-1.5 text-[#5B6472] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              <XMarkIcon className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Decisions & Actions Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-navy-800 p-6 rounded-3xl border border-gray-100 dark:border-navy-700 shadow-sm flex flex-col">
                      <h3 className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-2 mb-4">
                        <CheckBadgeIcon className="w-4 h-4" /> Decisions Made
                      </h3>
                      <textarea
                        value={decisions}
                        onChange={e => setDecisions(e.target.value)}
                        placeholder="Record key decisions..."
                        className="flex-1 w-full bg-[#FFFFFF] dark:bg-navy-900 p-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 outline-none text-[14px] font-bold text-gray-800 dark:text-white transition-all focus:ring-2 focus:ring-blue-100 min-h-[100px] resize-none custom-scrollbar shadow-sm"
                      />
                    </div>

                    <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[13px] font-semibold text-[#5B6472] flex items-center gap-2">
                          <CheckBadgeIcon className="w-4 h-4" /> New Action Items
                        </h3>
                        <button
                          onClick={addActionItem}
                          className="bg-[#1D4ED8] text-white px-3 py-1.5 rounded-lg text-[13px] font-semibold flex items-center gap-1 hover:scale-105 transition-all shadow-sm active:scale-95"
                        >
                          <PlusIcon className="w-3 h-3 stroke-[3]" /> Add
                        </button>
                      </div>

                      <div className="flex-1 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {actionItems.length === 0 ? (
                          <div className="bg-gray-50 dark:bg-navy-900/50 rounded-xl p-4 text-center border border-dashed border-gray-200 dark:border-navy-700">
                            <p className="text-[13px] font-bold text-[#5B6472]">No action items</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {actionItems.map(item => (
                              <div key={item.id} className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-navy-900/50 rounded-xl group border border-transparent hover:border-blue-100 dark:hover:border-navy-600 transition-all shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <input
                                  type="text"
                                  value={item.task}
                                  onChange={e => updateActionItem(item.id, e.target.value)}
                                  placeholder="What needs to be done?"
                                  className="flex-1 bg-transparent border-none outline-none text-[14px] font-bold text-gray-800 dark:text-white placeholder:text-gray-400"
                                />
                                <button
                                  onClick={() => removeActionItem(item.id)}
                                  className="p-1 opacity-0 group-hover:opacity-100 text-[#5B6472] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <XMarkIcon className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meeting Notes Section */}
                  <div className="bg-white dark:bg-navy-800 p-5 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm">
                    <h3 className="text-[13px] font-semibold text-[#5B6472] mb-3 flex items-center gap-2">
                      <PencilSquareIcon className="w-4 h-4" /> Meeting notes
                    </h3>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="General notes, details, context..."
                      className="w-full bg-[#FFFFFF] dark:bg-navy-900 p-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 outline-none text-[14px] font-bold text-gray-800 dark:text-white transition-all focus:ring-2 focus:ring-blue-100 min-h-[80px] resize-none custom-scrollbar shadow-sm"
                    />
                  </div>
                </div>

                {/* Modal Footer (Save Action) */}
                <div className="bg-[#FFFFFF] dark:bg-navy-900 px-8 py-4 border-t border-gray-100 dark:border-navy-800 flex items-center justify-between shrink-0">
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 text-[#5B6472] hover:text-gray-900 dark:hover:text-white font-semibold text-[13px] transition-colors"
                  >
                    Reset Form
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={handleSave}
                    className="px-12 py-3 rounded-xl text-[14px] font-semibold text-white bg-[#2563EB] dark:bg-[#60A5FA] dark:text-black hover:shadow-xl transition-all active:scale-95 shadow-lg border-b-4 border-black/20 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <ClipboardDocumentCheckIcon className="w-4 h-4" />
                    )}
                    {meetingId ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.05);
        }
      `}</style>
    </div>
  );
}
