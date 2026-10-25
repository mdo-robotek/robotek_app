"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSchedulerData } from "@/hooks/useSchedulerData";
import SchedulerHeader from "@/components/scheduler/SchedulerHeader";
import SchedulerCalendar from "@/components/scheduler/SchedulerCalendar";
import RecentActivity from "@/components/scheduler/RecentActivity";
import MeetingFormModal from "@/components/scheduler/MeetingFormModal";
import { CalendarEvent } from "@/types/calendar";
import { 
  XMarkIcon, 
  MapPinIcon, 
  UserIcon, 
  LinkIcon, 
  CalendarIcon, 
  ClockIcon,
  TagIcon,
  InformationCircleIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function SchedulerPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "USER";
  const isAdmin = userRole.toUpperCase() === 'ADMIN' || userRole.toUpperCase() === 'EA' || userRole.toUpperCase() === 'SALES' || userRole.toUpperCase() === 'CRM';
  const currentUsername = (session?.user as any)?.username || "";

  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [layout, setLayout] = useState<'calendar' | 'list'>('calendar');
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Modals state
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { allEvents, recentActivity, loading, refresh } = useSchedulerData();

  // Unified filtering logic
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      // 1. Role-based filtering
      if (!isAdmin) {
        // Regular users only see events where they are assignedTo or createdBy
        const isAssigned = typeof event.assignedTo === 'string' && event.assignedTo.includes(currentUsername);
        const isCreator = event.assignedBy === currentUsername;
        if (!isAssigned && !isCreator) return false;
      }

      // 2. Admin Search Query (Filter by User)
      if (isAdmin && searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        const assignedToMatch = typeof event.assignedTo === 'string' && event.assignedTo.toLowerCase().includes(queryLower);
        const assignedByMatch = typeof event.assignedBy === 'string' && event.assignedBy.toLowerCase().includes(queryLower);
        const titleMatch = typeof event.title === 'string' && (event.title || '').toLowerCase().includes(queryLower);
        if (!assignedToMatch && !assignedByMatch && !titleMatch) return false;
      }

      // 3. Type Filter
      if (typeFilter !== "All" && event.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [allEvents, isAdmin, currentUsername, searchQuery, typeFilter]);

  const filteredRecentActivity = useMemo(() => {
    return recentActivity.filter(event => {
      if (!isAdmin) {
        const isAssigned = typeof event.assignedTo === 'string' && event.assignedTo.includes(currentUsername);
        const isCreator = event.assignedBy === currentUsername;
        if (!isAssigned && !isCreator) return false;
      }
      return true;
    });
  }, [recentActivity, isAdmin, currentUsername]);

  const handleAddMeeting = () => {
    setEditingMeeting(null);
    setIsMeetingModalOpen(true);
  };

  const handleEditMeeting = (event: CalendarEvent) => {
    if (event.type === 'meeting') {
      setEditingMeeting(event.itemData);
      setSelectedEvent(null);
      setIsMeetingModalOpen(true);
    }
  };

  const confirmDeleteMeeting = (id: string) => {
    setMeetingToDelete(id);
  };

  const executeDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/scheduler/meetings?id=${meetingToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setMeetingToDelete(null);
        setSelectedEvent(null);
        refresh();
      } else {
        alert("Failed to delete meeting");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting meeting");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-4">
      <SchedulerHeader
        view={view}
        setView={setView}
        layout={layout}
        setLayout={setLayout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onAddMeeting={handleAddMeeting}
        isAdmin={isAdmin}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-12rem)] min-h-[700px] w-full">
        {/* Main Calendar Content */}
        <div className="lg:col-span-8 xl:col-span-9 h-full min-h-0 flex flex-col">
          {loading ? (
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-20 flex flex-col items-center justify-center min-h-[600px]">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">Compiling Scheduler Data...</p>
             </div>
          ) : (
            <SchedulerCalendar
              events={filteredEvents}
              view={view}
              layout={layout}
              onEventClick={setSelectedEvent}
            />
          )}
        </div>

        {/* Recent Activity Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 h-full min-h-0">
          <RecentActivity 

            activities={filteredRecentActivity} 
            onEventClick={setSelectedEvent}
          />
        </div>
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${
                    selectedEvent.type === 'meeting' ? 'bg-rose-500/10 text-rose-500' :
                    selectedEvent.type === 'delegation' ? 'bg-blue-500/10 text-blue-500' :
                    selectedEvent.type === 'checklist' ? 'bg-purple-500/10 text-purple-500' :
                    selectedEvent.type === 'ticket' ? 'bg-[#D97706]/10 text-[#D97706]' :
                    selectedEvent.type === 'scot' ? 'bg-indigo-500/10 text-indigo-500' :
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {selectedEvent.type === 'meeting' ? <CalendarIcon className="w-6 h-6" /> : <InformationCircleIcon className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight capitalize">
                      {selectedEvent.type} Details
                    </h2>
                    <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      Information & Context
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-2 text-[#5B6472] hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                   <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2 leading-tight">{selectedEvent.title}</h3>
                   <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{selectedEvent.description || "No description provided."}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472]">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Time
                      </div>
                      <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{format(selectedEvent.start, "hh:mm a")}</p>
                   </div>
                   <div className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5B6472]">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        Date
                      </div>
                      <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{format(selectedEvent.start, "MMM dd, yyyy")}</p>
                   </div>
                </div>

                <div className="space-y-3">
                   {selectedEvent.assignedTo && (
                     <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[13px] font-semibold text-[#5B6472] tracking-tighter leading-none mb-0.5">Assigned To</p>
                           <p className="truncate">{selectedEvent.assignedTo}</p>
                        </div>
                     </div>
                   )}
                   {selectedEvent.link && (
                     <a 
                      href={selectedEvent.link.startsWith('http') ? selectedEvent.link : `https://${selectedEvent.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center justify-center gap-2 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[14px] font-semibold shadow-lg hover:shadow-xl transition-all"
                     >
                        <LinkIcon className="w-4 h-4 stroke-[3]" />
                        Join Meeting Video Call
                     </a>
                   )}
                   {selectedEvent.status && (
                     <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <TagIcon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[13px] font-semibold text-[#5B6472] tracking-tighter leading-none mb-0.5">Status</p>
                           <p className="truncate">{selectedEvent.status}</p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="pt-6 flex gap-3">
                   {selectedEvent.type === 'meeting' && (isAdmin || selectedEvent.assignedBy === currentUsername) && (
                    <>
                      <button
                        onClick={() => handleEditMeeting(selectedEvent)}
                        className="flex-1 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-3xl text-[14px] font-semibold active:scale-95 transition-all"
                      >
                        Edit Meeting
                      </button>
                      <button
                        onClick={() => confirmDeleteMeeting(selectedEvent.id.replace('meet-', ''))}
                        className="flex-none px-6 py-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 rounded-3xl text-[14px] font-semibold active:scale-95 transition-all border border-rose-100 dark:border-rose-500/20"
                      >
                        Delete
                      </button>
                    </>
                   )}
                   <button
                    onClick={() => setSelectedEvent(null)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl text-[14px] font-semibold active:scale-95 transition-all"
                   >
                    Close
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {meetingToDelete && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setMeetingToDelete(null)}
              className="absolute inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-rose-100 dark:border-rose-500/20">
                <TrashIcon className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Delete Meeting?</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8">This action cannot be undone. This meeting and all associated references will be permanently removed.</p>
              
              <div className="flex gap-3">
                <button
                  disabled={isDeleting}
                  onClick={() => setMeetingToDelete(null)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-[14px] font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting}
                  onClick={executeDeleteMeeting}
                  className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[14px] font-semibold active:scale-95 transition-all shadow-lg hover:shadow-rose-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forms */}
      <MeetingFormModal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        onSuccess={refresh}
        initialData={editingMeeting}
        isAdmin={isAdmin}
      />
    </div>
  );
}
