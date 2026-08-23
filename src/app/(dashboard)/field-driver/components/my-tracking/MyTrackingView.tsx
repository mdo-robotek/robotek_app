'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { getIstDateString } from '@/lib/dateUtils';
import { buildActivityEvents } from '../../lib/field-activity';
import type { FieldDriverRecord, FieldStatus, FieldUser, FormAction, LiveCoords, LivePing } from '../../types/field-driver';
import JourneyStatus from './JourneyStatus';
import TodayRecord from './TodayRecord';
import RecentActivity from './RecentActivity';
import TechInfoCards from './TechInfoCards';
import LiveFleetTable from './LiveFleetTable';
import SystemInfo from './SystemInfo';
import StatusLegend from './StatusLegend';
import StatusLogic from './StatusLogic';

const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false });

export default function MyTrackingView({
  user,
  currentStatus,
  elapsedTime,
  checkInTime,
  odometerInValue,
  todayRecord,
  liveLocation,
  liveAddress,
  fetchAttendanceStatus,
  isAdmin,
}: {
  user: FieldUser;
  currentStatus: FieldStatus;
  elapsedTime: string;
  checkInTime: Date | null;
  odometerInValue: string;
  todayRecord: FieldDriverRecord | null;
  liveLocation: LiveCoords | null;
  liveAddress: string | null;
  fetchAttendanceStatus: (userId: string) => Promise<void>;
  isAdmin: boolean;
}) {
  const { success, error } = useToast();
  const [showForm, setShowForm] = useState<FormAction | null>(null);
  const [odometerReading, setOdometerReading] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pathPings, setPathPings] = useState<LivePing[]>([]);

  useEffect(() => {
    const loadPath = async () => {
      try {
        const res = await fetch(`/api/field-driver/live?date=${getIstDateString()}`);
        if (res.ok) {
          const data = await res.json();
          const record = (data.records || []).find(
            (r: { userId: string }) => String(r.userId) === String(user.id)
          );
          if (record?.pathData) setPathPings(JSON.parse(record.pathData || '[]'));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadPath();
    const interval = setInterval(loadPath, 60000);
    return () => clearInterval(interval);
  }, [user.id, currentStatus]);

  const activityEvents = buildActivityEvents(todayRecord, liveLocation, liveAddress, pathPings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showForm || !liveLocation) {
      error('Live location is required. Ensure GPS is enabled.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/field-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: showForm,
          userId: user.id,
          userName: user.username,
          latitude: liveLocation.lat,
          longitude: liveLocation.lng,
          address: liveAddress,
          odometer: odometerReading,
          photo: capturedImage,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Action failed');
      }
      const data = await res.json();
      setShowForm(null);
      setOdometerReading('');
      setCapturedImage(null);
      await fetchAttendanceStatus(user.id);
      if (showForm === 'CHECK_IN') {
        success('Field check-in successful! Tracking active.');
      } else {
        success(`Field check-out successful! Total KM: ${data.totalKm || 'Calculated'}`);
      }
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to update field attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 items-stretch">
        <div className="xl:col-span-3 flex flex-col min-h-0">
          <JourneyStatus
            currentStatus={currentStatus}
            elapsedTime={elapsedTime}
            checkInTime={checkInTime}
            liveAddress={liveAddress}
            odometerInValue={odometerInValue}
            todayRecord={todayRecord}
            liveLocationReady={!!liveLocation}
            onStartCheckIn={() => setShowForm('CHECK_IN')}
            onEndJourney={() => setShowForm('CHECK_OUT')}
            formAction={showForm}
            odometerReading={odometerReading}
            capturedImage={capturedImage}
            isCameraActive={isCameraActive}
            cameraFacingMode={cameraFacingMode}
            isSubmitting={isSubmitting}
            onOdometerChange={setOdometerReading}
            onOpenCamera={() => setIsCameraActive(true)}
            onCapture={(data: string) => {
              setCapturedImage(data);
              setIsCameraActive(false);
            }}
            onRetake={() => {
              setCapturedImage(null);
              setIsCameraActive(true);
            }}
            onFlipCamera={() => setCameraFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))}
            onCancelCamera={() => setIsCameraActive(false)}
            onCancelForm={() => {
              setShowForm(null);
              setCapturedImage(null);
              setOdometerReading('');
              setIsCameraActive(false);
            }}
            onSubmit={handleSubmit}
            onCameraError={(msg: string) => error(msg)}
          />
        </div>

        <div className="xl:col-span-5 flex flex-col gap-2 min-h-0">
          <LiveMap userId={user.id} liveLocation={liveLocation} tall />
          <div className="flex-1 flex flex-col min-h-0">
            <TechInfoCards compact fillHeight />
          </div>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-2 min-h-0">
          <TodayRecord todayRecord={todayRecord} />
          <RecentActivity events={activityEvents} />
          <div className="flex-1 flex flex-col min-h-0">
            <StatusLogic fillHeight />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 items-start">
        {isAdmin && (
          <div className="xl:col-span-6 min-w-0">
            <LiveFleetTable />
          </div>
        )}
        <div className={`min-w-0 ${isAdmin ? 'xl:col-span-3' : 'xl:col-span-6'}`}>
          <SystemInfo gpsOk={!!liveLocation} />
        </div>
        <div className={`min-w-0 ${isAdmin ? 'xl:col-span-3' : 'xl:col-span-6'}`}>
          <StatusLegend />
        </div>
      </div>
    </div>
  );
}
