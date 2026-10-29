"use client";

import { useState } from "react";
import { 
  Squares2X2Icon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ExclamationCircleIcon
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import WeeklyUpdateView from "./WeeklyUpdateView";
import ActionLogView from "./ActionLogView";
import TeamQueriesView from "./TeamQueriesView";
import SyncMeetingView from "./SyncMeetingView";
import UrgentLogView from "./UrgentLogView";
import DashboardView from "./DashboardView";
import MdDashboardView from "./MdDashboardView";

export default function EaMdHubPage() {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <Squares2X2Icon className="w-3 h-3" /> },
    { id: "weekly-update", label: "Weekly Update", icon: <CalendarDaysIcon className="w-3 h-3" /> },
    { id: "action-log", label: "Action Log", icon: <ClipboardDocumentListIcon className="w-3 h-3" /> },
    { id: "team-queries", label: "Team Queries", icon: <ChatBubbleLeftRightIcon className="w-3 h-3" /> },
    { id: "sync-meeting", label: "Sync Meeting", icon: <UsersIcon className="w-3 h-3" /> },
    { id: "urgent-log", label: "Urgent Log", icon: <ExclamationCircleIcon className="w-3 h-3" /> },
  ];

  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [viewMode, setViewMode] = useState<'EA' | 'MD'>('EA');

  return (
    <div className="space-y-2 flex flex-col h-full w-full">
      {/* Sticky Top Header & Filters */}
      <div className="space-y-2 mb-2 shrink-0">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-1 pb-2">
          <div className="text-center lg:text-left min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight truncate">EA–MD Hub</h1>
            <p className="text-gray-500 dark:text-slate-300 font-bold text-[14px] md:text-[10px] tracking-wider">Executive Assistant & Managing Director Workspace</p>
          </div>
          <div className="flex bg-gray-100 dark:bg-navy-900 rounded-full p-1 border border-gray-200 dark:border-navy-700/50 shadow-inner shrink-0">
            <button onClick={() => setViewMode('EA')} className={`px-4 py-1.5 rounded-full text-[13px] font-semibold   transition-all ${viewMode === 'EA' ? 'bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>EA Workspace</button>
            <button onClick={() => setViewMode('MD')} className={`px-4 py-1.5 rounded-full text-[13px] font-semibold   transition-all ${viewMode === 'MD' ? 'bg-white dark:bg-navy-800 text-[#2563EB] dark:text-[#60A5FA] shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>MD View</button>
          </div>
        </div>

        {/* Tabs Layout */}
        {viewMode === 'EA' && (
        <div className="rounded-2xl border border-gray-100 dark:border-navy-700 overflow-hidden shadow-sm transition-all duration-500 w-full bg-white dark:bg-navy-800">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 p-3 bg-gray-50/50 dark:bg-navy-900/30">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold   transition-all whitespace-nowrap ${isActive ? 'bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black border-[#2563EB] dark:border-[#60A5FA] shadow-md scale-105' : 'bg-white text-gray-700 border-gray-300 dark:bg-navy-800 dark:text-gray-300 dark:border-navy-600 hover:scale-[1.02] hover:shadow-sm'
                    }`}
                >
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {viewMode === 'EA' ? (
        <div 
          className="flex-1 flex flex-col min-h-[500px]"
        >
          <AnimatePresence mode="wait">
            <motion.div
             key={activeTab}
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 1.02 }}
             transition={{ duration: 0.2 }}
             className="flex-1 flex flex-col items-center justify-start py-2 px-1"
          >
             {/* Dynamic Content based on activeTab */}
             {tabs.map(tab => (
               activeTab === tab.id && (
                  tab.id === 'weekly-update' ? (
                    <div key={tab.id} className="w-full h-full text-left">
                       <WeeklyUpdateView />
                    </div>
                  ) : tab.id === 'action-log' ? (
                    <div key={tab.id} className="w-full h-full text-left">
                       <ActionLogView />
                    </div>
                  ) : tab.id === 'team-queries' ? (
                    <div key={tab.id} className="w-full h-full text-left">
                       <TeamQueriesView />
                    </div>
                  ) : tab.id === 'sync-meeting' ? (
                    <div key={tab.id} className="w-full h-full text-left">
                       <SyncMeetingView />
                    </div>
                  ) : tab.id === 'urgent-log' ? (
                    <div key={tab.id} className="w-full h-full text-left">
                       <UrgentLogView />
                    </div>
                  ) : tab.id === 'dashboard' ? (
                    <div key={tab.id} className="w-full h-full text-left">
                       <DashboardView goToTab={setActiveTab} />
                    </div>
                  ) : (
                    <div key={tab.id} className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-20">
                       <div className="scale-[3] mb-8 text-[#5B6472]">{tab.icon}</div>
                       <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">{tab.label}</h2>
                       <p className="text-[14px] font-bold text-gray-500 mt-2">Workspace Module in Development</p>
                    </div>
                  )
               )
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto w-full px-1 scroll-smooth">
          <MdDashboardView />
        </div>
      )}
    </div>
  );
}
