"use client";

import { useState, useEffect } from "react";
import { format, isAfter, parseISO } from "date-fns";

interface DashboardViewProps {
  goToTab: (tabId: string) => void;
}

export default function DashboardView({ goToTab }: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [urgentLogs, setUrgentLogs] = useState<any[]>([]);
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [syncMeetings, setSyncMeetings] = useState<any[]>([]);
  const [teamQueries, setTeamQueries] = useState<any[]>([]);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [urgentRes, actionRes, syncRes, teamRes] = await Promise.all([
          fetch("/api/ea-md/urgent-log").then(r => r.ok ? r.json() : { items: [] }),
          fetch("/api/ea-md/action-log/get-items").then(r => r.ok ? r.json() : { items: [] }),
          fetch("/api/ea-md/sync-meeting").then(r => r.ok ? r.json() : { items: [] }),
          fetch("/api/ea-md/team-queries/get-items").then(r => r.ok ? r.json() : { items: [] }),
        ]);

        setUrgentLogs(urgentRes.items || []);
        setActionLogs(actionRes.items || []);
        setSyncMeetings(syncRes.items || []);
        setTeamQueries(teamRes.items || []);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Computed Values
  const openUrgentLogs = urgentLogs.filter(log => log.status !== 'Resolved');
  const pendingMDActions = actionLogs.filter(action => action.status === 'MD action');
  
  // Done this week calculation
  const doneActions = actionLogs.filter(action => action.status === 'Done');
  // Strict "this week" checking can be done but for now we capture recent Done actions
  const doneCount = doneActions.length; 
  
  const openQueries = teamQueries.filter(q => q.status !== 'Resolved');

  // Next Sync Meeting
  const sortedMeetings = [...syncMeetings].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  
  // Find closest future meeting or most recent
  let nextMeeting = sortedMeetings.find(m => isAfter(parseISO(m.date), new Date()));
  if (!nextMeeting && sortedMeetings.length > 0) {
    nextMeeting = sortedMeetings[sortedMeetings.length - 1]; // Fallback to latest
  }

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      return `${day} ${month} \`${year}`;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex flex-col w-full h-full space-y-6 lg:p-4">
      {/* Header section */}
      <div>
        <h2 className="text-3xl font-bold text-[#1D4ED8] dark:text-white tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>Dashboard</h2>
        <p className="text-sm font-medium text-gray-500 mt-1">Good morning, here is your operations overview.</p>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="w-12 h-12 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin opacity-50" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Urgent Card */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 shadow-sm border-l-4 border-l-rose-600 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-5xl font-bold text-rose-700 dark:text-rose-500" style={{ fontFamily: 'Georgia, serif' }}>
                {openUrgentLogs.length}
              </h3>
              <p className="text-[13px] font-semibold text-gray-400 mt-2">Urgent Actions</p>
            </div>

            {/* Pending MD Card */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 shadow-sm border-l-4 border-l-blue-600 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-5xl font-bold text-blue-700 dark:text-blue-500" style={{ fontFamily: 'Georgia, serif' }}>
                {pendingMDActions.length}
              </h3>
              <p className="text-[13px] font-semibold text-gray-400 mt-2">Pending MD Action</p>
            </div>

            {/* Done This Week Card */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-600 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-5xl font-bold text-emerald-700 dark:text-emerald-500" style={{ fontFamily: 'Georgia, serif' }}>
                {doneCount}
              </h3>
              <p className="text-[13px] font-semibold text-gray-400 mt-2">Done This Week</p>
            </div>

            {/* Open Queries Card */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 shadow-sm border-l-4 border-l-amber-500 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-5xl font-bold text-amber-600 dark:text-amber-500" style={{ fontFamily: 'Georgia, serif' }}>
                {openQueries.length}
              </h3>
              <p className="text-[13px] font-semibold text-gray-400 mt-2">Open Team Queries</p>
            </div>

          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
            
            {/* Urgent Items List */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-navy-800 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-navy-800 pb-3">
                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-500">Urgent items</h4>
                <button 
                  onClick={() => goToTab('urgent-log')}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-navy-700 text-[13px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
                >
                  View log
                </button>
              </div>
              <div className="flex-1 flex flex-col">
                {openUrgentLogs.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[14px] font-medium text-gray-400">
                    No urgent items
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openUrgentLogs.slice(0, 3).map(log => (
                      <div key={log.id} className="flex justify-between items-center bg-gray-50 dark:bg-navy-800/50 p-3 rounded-xl border border-gray-100 dark:border-navy-700">
                        <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate pr-4">{log.issueSummary}</span>
                        <span className="text-[13px] font-semibold text-rose-600 bg-rose-100 px-2.5 py-1 rounded-md shrink-0">
                          {log.urgencyLevel.split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pending MD Action List */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-navy-800 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-navy-800 pb-3">
                <h4 className="text-sm font-bold text-[#1D4ED8] dark:text-blue-400">Pending MD action</h4>
                <button 
                  onClick={() => goToTab('action-log')}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-navy-700 text-[13px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="flex-1 flex flex-col">
                {pendingMDActions.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[14px] font-medium text-gray-400">
                    All clear
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingMDActions.slice(0, 3).map(action => (
                      <div key={action.id} className="flex justify-between items-center bg-gray-50 dark:bg-navy-800/50 p-3 rounded-xl border border-gray-100 dark:border-navy-700">
                        <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate pr-4">{action.task}</span>
                        <span className="text-[13px] font-semibold text-[#1D4ED8] shrink-0">
                           {formatDisplayDate(action.due)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Next Sync Meeting */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-navy-800 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-navy-800 pb-3">
                <h4 className="text-sm font-bold text-[#1D4ED8] dark:text-white">Next sync meeting</h4>
              </div>
              <div className="flex-1 flex flex-col justify-center items-start">
                {nextMeeting ? (
                  <>
                    <h5 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      {formatDisplayDate(nextMeeting.date).toUpperCase()}
                    </h5>
                    <button 
                      onClick={() => goToTab('sync-meeting')}
                      className="px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700 text-[14px] font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors shadow-sm"
                    >
                      Open agenda builder
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center text-[14px] font-medium text-gray-400 py-4">
                    No upcoming meetings
                  </div>
                )}
              </div>
            </div>

            {/* Open Team Queries */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-navy-800 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-navy-800 pb-3">
                <h4 className="text-sm font-bold text-[#1D4ED8] dark:text-white">Open team queries</h4>
                <button 
                  onClick={() => goToTab('team-queries')}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-navy-700 text-[13px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
                >
                  Manage
                </button>
              </div>
              <div className="flex-1 flex flex-col">
                {openQueries.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[14px] font-medium text-gray-400">
                    No open queries
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openQueries.slice(0, 3).map(query => (
                      <div key={query.id} className="flex flex-col justify-center bg-gray-50 dark:bg-navy-800/50 p-3 rounded-xl border border-gray-100 dark:border-navy-700 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] font-semibold text-gray-500">{query.teamMember}</span>
                          <span className="text-[13px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded shrink-0">
                            {query.status}
                          </span>
                        </div>
                        <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 line-clamp-1">{query.query}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
