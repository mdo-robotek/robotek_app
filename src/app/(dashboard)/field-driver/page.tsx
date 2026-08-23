'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import FieldTrackingGuideModal from './FieldTrackingGuideModal';
import FieldHeader from './components/FieldHeader';
import FieldTabs from './components/FieldTabs';
import MyTrackingView from './components/my-tracking/MyTrackingView';
import AdminMapView from './components/admin-map/AdminMapView';
import AdminLogsView from './components/admin-logs/AdminLogsView';
import AdminReportView from './components/admin-report/AdminReportView';
import { useFieldStatus } from './hooks/useFieldStatus';
import { useLiveLocation } from './hooks/useLiveLocation';
import { useLiveSync } from './hooks/useLiveSync';
import { useJourneyTimer } from './hooks/useJourneyTimer';
import type { FieldTab } from './types/field-driver';

export default function FieldDriverPage() {
  const {
    user,
    isPageLoading,
    currentStatus,
    checkInTime,
    odometerInValue,
    todayRecord,
    fetchAttendanceStatus,
    isAdmin,
  } = useFieldStatus();

  const { liveLocation, liveAddress, locationError, retryLocation } = useLiveLocation();
  useLiveSync(currentStatus, user, liveLocation);
  const elapsedTime = useJourneyTimer(currentStatus, checkInTime);

  const [activeTab, setActiveTab] = useState<FieldTab>('TRACKING');
  const [showGuide, setShowGuide] = useState(false);

  if (isPageLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 -m-1 md:-m-2">
        <p className="text-gray-400 font-bold text-sm">Loading Field Tracking...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-[#F8FAFC] -m-1 md:-m-2">
        <p className="text-red-500 font-bold text-sm">Unauthorized. Please log in.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-slate-950 -m-1 md:-m-2 p-2 md:p-3 space-y-2">
      <FieldHeader
        onOpenGuide={() => setShowGuide(true)}
        gpsOk={!!liveLocation && !locationError}
      />

      <FieldTabs active={activeTab} onChange={setActiveTab} isAdmin={isAdmin} />

      {locationError && activeTab === 'TRACKING' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-red-600">GPS Error</p>
            <p className="text-xs text-red-500 mt-1">{locationError}</p>
          </div>
          <button
            type="button"
            onClick={retryLocation}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-black uppercase"
          >
            Retry
          </button>
        </div>
      )}

      {activeTab === 'TRACKING' && (
        <MyTrackingView
          user={user}
          currentStatus={currentStatus}
          elapsedTime={elapsedTime}
          checkInTime={checkInTime}
          odometerInValue={odometerInValue}
          todayRecord={todayRecord}
          liveLocation={liveLocation}
          liveAddress={liveAddress}
          fetchAttendanceStatus={fetchAttendanceStatus}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === 'ADMIN_MAP' && isAdmin && (
        <div className="h-[calc(100vh-220px)] min-h-[560px] rounded-2xl overflow-hidden border border-gray-200/80 shadow-sm bg-white">
          <AdminMapView />
        </div>
      )}

      {activeTab === 'ADMIN_TABLE' && isAdmin && <AdminLogsView />}

      {activeTab === 'ADMIN_REPORT' && isAdmin && (
        <div className="h-[calc(100vh-220px)] min-h-[560px] rounded-2xl overflow-hidden border border-gray-200/80 shadow-sm">
          <AdminReportView />
        </div>
      )}

      <FieldTrackingGuideModal open={showGuide} onClose={() => setShowGuide(false)} isAdmin={isAdmin} />
    </div>
  );
}
