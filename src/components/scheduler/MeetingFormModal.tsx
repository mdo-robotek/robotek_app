"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, VideoCameraIcon, UsersIcon, DocumentTextIcon, CalendarIcon } from "@heroicons/react/24/outline";
import CustomDateTimePicker from "@/components/CustomDateTimePicker";
import { Meeting } from "@/types/meeting";
import { motion, AnimatePresence } from "framer-motion";
import { addMinutes, setHours, setMinutes, formatISO } from "date-fns";

interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Meeting | null;
  isAdmin: boolean;
}

export default function MeetingFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  isAdmin,
}: MeetingFormModalProps) {
  const [formData, setFormData] = useState<Partial<Meeting>>({
    title: "",
    description: "",
    attendees: "",
    meeting_link: "",
    start_time: "",
    end_time: "",
  });
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (initialData) {
        setFormData(initialData);
        setSelectedUsers(initialData.attendees.split(",").map(u => u.trim()).filter(Boolean));
      } else {
        setFormData({
          title: "",
          description: "",
          attendees: "",
          meeting_link: "",
          start_time: "",
          end_time: "",
        });
        setSelectedUsers([]);
      }
      setUserSearch("");
    }
  }, [isOpen, initialData]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleToggleUser = (username: string) => {
    setSelectedUsers(prev => 
      prev.includes(username) 
        ? prev.filter(u => u !== username) 
        : [...prev, username]
    );
  };

  const shiftTime = (minutes: number) => {
    if (formData.start_time) {
      const newStart = addMinutes(new Date(formData.start_time), minutes);
      let newEnd = formData.end_time ? addMinutes(new Date(formData.end_time), minutes) : addMinutes(newStart, 60);
      setFormData({ 
        ...formData, 
        start_time: formatISO(newStart).substring(0, 16), 
        end_time: formatISO(newEnd).substring(0, 16) 
      });
    }
  };

  const setToMorning = () => {
    const d = formData.start_time ? new Date(formData.start_time) : new Date();
    const start = setMinutes(setHours(d, 10), 0); // 10:00 AM
    const end = setMinutes(setHours(d, 11), 30); // 11:30 AM
    setFormData({ 
      ...formData, 
      start_time: formatISO(start).substring(0, 16), 
      end_time: formatISO(end).substring(0, 16) 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        attendees: selectedUsers.join(", "),
      };

      const res = await fetch("/api/scheduler/meetings", {
        method: initialData ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        alert("Failed to save meeting");
      }
    } catch (error) {
      console.error("Error saving meeting:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-2xl">
              <VideoCameraIcon className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">
                {initialData ? "Edit Meeting" : "Schedule Meeting"}
              </h2>
              <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                Meeting Details & Attendees
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#5B6472] hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto invisible-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#5B6472] dark:text-slate-500 pl-1">Meeting Title</label>
                <div className="relative group">
                   <DocumentTextIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5B6472] group-focus-within:text-blue-500 transition-colors" />
                   <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none transition-all"
                    placeholder="E.g. Project Sync-up"
                  />
                </div>
              </div>

              {/* Times */}
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/30 p-5 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20"></div>
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 pl-1">Schedule Timing</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => shiftTime(30)} className="text-[13px] font-semibold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.02)] active:scale-95 transition-all outline-none border border-black/5 hover:bg-slate-50">+ 30 MIN</button>
                    <button type="button" onClick={() => shiftTime(60)} className="text-[13px] font-semibold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.02)] active:scale-95 transition-all outline-none border border-black/5 hover:bg-slate-50">+ 1 HR</button>
                    <button type="button" onClick={setToMorning} className="text-[13px] font-semibold bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all outline-none hover:shadow-md">🌅 10:00 AM</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <CustomDateTimePicker
                    label="From"
                    value={formData.start_time || ""}
                    onChange={(val) => setFormData({ ...formData, start_time: val })}
                    required
                  />
                  <CustomDateTimePicker
                    label="Until"
                    value={formData.end_time || ""}
                    onChange={(val) => setFormData({ ...formData, end_time: val })}
                    required
                  />
                </div>
              </div>

              {/* Link */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#5B6472] dark:text-slate-500 pl-1">Meeting Link (Optional)</label>
                <div className="relative group">
                   <VideoCameraIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5B6472] group-focus-within:text-rose-500 transition-colors" />
                   <input
                    type="url"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-rose-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none transition-all"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#5B6472] dark:text-slate-500 pl-1">Description / Agenda</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none transition-all resize-none h-[120px]"
                  placeholder="What is this meeting about?"
                />
              </div>

              {/* Attendees */}
              <div className="space-y-3 relative">
                <label className="flex items-center justify-between text-[13px] font-semibold text-[#5B6472] dark:text-slate-500 pl-1">
                  <span>Attendees ({selectedUsers.length})</span>
                </label>
                
                {/* Search Input */}
                <div className="relative group shadow-sm rounded-2xl overflow-hidden">
                   <UsersIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5B6472] group-focus-within:text-blue-500 transition-colors" />
                   <input
                    type="text"
                    value={userSearch}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400"
                    placeholder="Search people to add..."
                  />
                </div>

                {/* Selected Badges */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-b from-blue-50 to-blue-50/50 dark:from-blue-900/10 dark:to-blue-900/5 rounded-[1.5rem] border border-blue-100 dark:border-blue-800/50 min-h-[60px] shadow-inner">
                    {selectedUsers.map(u => (
                       <span key={u} className="flex items-center gap-1.5 pl-3 pr-1 py-1 text-[14px] font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.05)] border border-blue-100/50 animate-fade-in group/badge">
                          {u}
                          <button type="button" onClick={() => handleToggleUser(u)} className="p-1 hover:bg-rose-500 text-[#5B6472] hover:text-white rounded-full transition-colors flex items-center justify-center">
                             <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                       </span>
                    ))}
                  </div>
                )}

                {/* Dropdown List */}
                {isSearchFocused && (
                  <div className="absolute top-[80px] left-0 right-0 z-10 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl max-h-56 overflow-y-auto invisible-scrollbar">
                     {users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()) && !selectedUsers.includes(u.username)).length === 0 ? (
                       <div className="p-6 flex flex-col items-center justify-center text-[#5B6472]">
                         <UsersIcon className="w-8 h-8 mb-2 opacity-20" />
                         <span className="text-[14px] font-bold text-slate-500">No matching users found</span>
                       </div>
                     ) : (
                       users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()) && !selectedUsers.includes(u.username)).map((user) => (
                         <button
                          key={user.id}
                          type="button"
                          onClick={() => { handleToggleUser(user.username); setUserSearch(""); }}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-700/50 text-left group"
                         >
                           <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{user.username}</span>
                           <span className="text-[13px] font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">Add</span>
                         </button>
                       ))
                     )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl text-sm font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 px-6 bg-[#DC2626] hover:bg-[#A31820] text-white rounded-3xl text-sm font-semibold transition-all shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Saving..." : initialData ? "Update Meeting" : "Schedule Meeting"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
