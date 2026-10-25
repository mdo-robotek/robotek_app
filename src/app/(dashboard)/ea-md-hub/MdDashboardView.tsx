"use client";

import { useState, useEffect } from "react";
import { isAfter, parseISO } from "date-fns";

export default function MdDashboardView() {
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
        console.error("Failed to load MD dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Computed Values
  const openUrgentLogs = urgentLogs.filter(log => log.status !== 'Resolved');
  const pendingMDActions = actionLogs.filter(action => action.status === 'MD action');
  const doneActions = actionLogs.filter(action => action.status === 'Done');
  const openQueries = teamQueries.filter(q => q.status !== 'Resolved');

  // Next Sync Meeting
  const sortedMeetings = [...syncMeetings].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  
  let nextMeeting = sortedMeetings.find(m => isAfter(parseISO(m.date), new Date()));
  if (!nextMeeting && sortedMeetings.length > 0) {
    nextMeeting = sortedMeetings[sortedMeetings.length - 1]; 
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
    <div className="flex flex-col w-full h-full space-y-8 animate-in fade-in zoom-in-95 duration-300">
      {/* Header section */}
      <div>
        <h2 className="text-3xl font-bold text-[#1D4ED8] dark:text-white tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>Good morning</h2>
        <p className="text-[13px] font-bold text-[#5B6472] mt-1">Good morning - here is your operations summary prepared by EA.</p>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin opacity-50" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top KPI Cards (Identical style to the screenshot) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Urgent Card */}
            <div className="bg-white dark:bg-navy-900 rounded-lg p-5 shadow-sm border-l-4 border-l-rose-600 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-4xl font-bold text-rose-700 dark:text-rose-500" style={{ fontFamily: 'Georgia, serif' }}>
                {openUrgentLogs.length}
              </h3>
              <p className="text-[13px] font-semibold text-[#5B6472] mt-2">Require your action</p>
            </div>

            {/* Pending MD Card */}
            <div className="bg-white dark:bg-navy-900 rounded-lg p-5 shadow-sm border-l-4 border-l-blue-600 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-4xl font-bold text-blue-700 dark:text-blue-500" style={{ fontFamily: 'Georgia, serif' }}>
                {pendingMDActions.length}
              </h3>
              <p className="text-[13px] font-semibold text-[#5B6472] mt-2">Pending your decision</p>
            </div>

            {/* Done This Week Card */}
            <div className="bg-white dark:bg-navy-900 rounded-lg p-5 shadow-sm border-l-4 border-l-emerald-600 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-4xl font-bold text-emerald-700 dark:text-emerald-500" style={{ fontFamily: 'Georgia, serif' }}>
                {doneActions.length}
              </h3>
              <p className="text-[13px] font-semibold text-[#5B6472] mt-2">Completed this week</p>
            </div>

            {/* Open Queries Card */}
            <div className="bg-white dark:bg-navy-900 rounded-lg p-5 shadow-sm border-l-4 border-l-amber-500 border border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-navy-800 dark:border-r-navy-800 dark:border-b-navy-800 flex flex-col justify-between">
              <h3 className="text-4xl font-bold text-amber-600 dark:text-amber-500" style={{ fontFamily: 'Georgia, serif' }}>
                {openQueries.length}
              </h3>
              <p className="text-[13px] font-semibold text-[#5B6472] mt-2">Team queries open</p>
            </div>

          </div>

          {/* Stacked Report Sections */}
          <div className="flex flex-col space-y-6 pt-2">
            
            {/* Requires your immediate attention */}
            <section className="flex flex-col space-y-3 pb-6 border-b border-gray-200 dark:border-navy-700">
              <h4 className="text-sm font-bold text-rose-600 dark:text-rose-500" style={{ fontFamily: 'Georgia, serif' }}>Requires your immediate attention</h4>
              {openUrgentLogs.length === 0 ? (
                <p className="text-[14px] font-medium text-[#5B6472] py-4 text-center">No urgent items - all clear</p>
              ) : (
                <div className="flex flex-col space-y-2">
                  {openUrgentLogs.map(log => (
                    <div key={log.id} className="flex gap-4 items-center py-2 px-3 hover:bg-white/50 dark:hover:bg-navy-800/50 rounded-md transition-colors">
                       <span className="text-[13px] font-semibold text-rose-600 bg-rose-100/50 px-2.5 py-1 rounded-md shrink-0 w-24 text-center">
                          {log.urgencyLevel.split(' ')[0]}
                       </span>
                       <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{log.issueSummary}</span>
                       <span className="ml-auto text-[13px] font-semibold text-[#5B6472]">{log.channelUsed?.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pending your decision or approval */}
            <section className="flex flex-col space-y-3 pb-6 border-b border-gray-200 dark:border-navy-700">
              <h4 className="text-sm font-bold text-[#1D4ED8] dark:text-blue-400" style={{ fontFamily: 'Georgia, serif' }}>Pending your decision or approval</h4>
              {pendingMDActions.length === 0 ? (
                <p className="text-[14px] font-medium text-[#5B6472] py-4 text-center">Nothing pending</p>
              ) : (
                <div className="flex flex-col space-y-2">
                  {pendingMDActions.map(action => (
                    <div key={action.id} className="flex gap-4 items-center py-2 px-3 hover:bg-white/50 dark:hover:bg-navy-800/50 rounded-md transition-colors">
                       <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 flex-1">{action.task}</span>
                       <span className="text-[13px] font-semibold text-[#1D4ED8]">{formatDisplayDate(action.due)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Team queries awaiting your response */}
            <section className="flex flex-col space-y-3 pb-6 border-b border-gray-200 dark:border-navy-700">
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-500" style={{ fontFamily: 'Georgia, serif' }}>Team queries awaiting your response</h4>
              {openQueries.length === 0 ? (
                <p className="text-[14px] font-medium text-[#5B6472] py-4 text-center">No open team queries</p>
              ) : (
                <div className="flex flex-col space-y-2">
                  {openQueries.map(query => (
                    <div key={query.id} className="flex gap-4 items-center py-2 px-3 hover:bg-white/50 dark:hover:bg-navy-800/50 rounded-md transition-colors">
                       <span className="text-[13px] font-semibold text-amber-600 w-24">{query.teamMember}</span>
                       <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 flex-1">{query.query}</span>
                       <span className="text-[13px] font-semibold text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded text-center">
                            {query.status}
                       </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Completed this week */}
            <section className="flex flex-col space-y-3 pb-6 border-b border-gray-200 dark:border-navy-700">
              <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-500" style={{ fontFamily: 'Georgia, serif' }}>Completed this week</h4>
              {doneActions.length === 0 ? (
                <p className="text-[14px] font-medium text-[#5B6472] py-4 text-center">No completed items yet</p>
              ) : (
                <div className="flex flex-col space-y-2">
                  {doneActions.map(action => (
                    <div key={action.id} className="flex gap-4 items-center py-2 px-3 hover:bg-white/50 dark:hover:bg-navy-800/50 rounded-md transition-colors">
                       <span className="text-[13px] text-gray-500 dark:text-gray-400 line-through flex-1">{action.task}</span>
                       <span className="text-[13px] font-semibold text-emerald-600">Done</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Next sync meeting */}
            <section className="flex flex-col space-y-3 pb-6">
              <h4 className="text-sm font-bold text-[#1D4ED8] dark:text-white" style={{ fontFamily: 'Georgia, serif' }}>Next sync meeting</h4>
              <div className="bg-blue-50 dark:bg-[#1D4ED8]/40 border-l-2 border-[#1D4ED8] p-4 rounded-r-xl mt-2 max-w-sm">
                 {nextMeeting ? (
                   <>
                     <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-blue-400 mb-1">Scheduled</p>
                     <p className="text-sm font-semibold text-[#1D4ED8] dark:text-white">
                       {formatDisplayDate(nextMeeting.date).toUpperCase()}
                     </p>
                   </>
                 ) : (
                   <p className="text-[14px] font-medium text-gray-500 py-2">No sync meeting scheduled.</p>
                 )}
              </div>
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
