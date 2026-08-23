'use client';

import {
  MapPinIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { FieldCard } from '../FieldCard';
import ScooterIcon from '../ScooterIcon';
import { JourneyFormSection } from './JourneyForm';
import type { FieldDriverRecord, FieldStatus, FormAction } from '../../types/field-driver';

function InfoBox({
  icon,
  label,
  value,
  valueLine2,
  className = '',
  compact = false,
  multiline = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueLine2?: string;
  className?: string;
  compact?: boolean;
  multiline?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 min-w-0 ${
        compact ? 'p-2' : 'p-2.5'
      } rounded-lg bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-sky-800/40 ${className}`}
    >
      <div className="w-7 h-7 rounded-md bg-sky-50 dark:bg-sky-950/50 border border-sky-100 dark:border-sky-800/30 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
        {valueLine2 ? (
          <div className="mt-0.5">
            <p className="text-[11px] font-black text-[#062B6F] dark:text-white leading-snug">{value}</p>
            <p className="text-[11px] font-black text-[#062B6F] dark:text-white leading-snug">{valueLine2}</p>
          </div>
        ) : (
          <p
            className={`${
              compact || multiline ? 'text-[11px]' : 'text-sm'
            } font-black text-[#062B6F] dark:text-white mt-0.5 leading-snug ${
              multiline ? 'line-clamp-2' : ''
            }`}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

export default function JourneyStatus({
  currentStatus,
  elapsedTime,
  checkInTime,
  liveAddress,
  odometerInValue,
  todayRecord,
  liveLocationReady,
  onStartCheckIn,
  onEndJourney,
  formAction,
  odometerReading,
  capturedImage,
  isCameraActive,
  cameraFacingMode,
  isSubmitting,
  onOdometerChange,
  onOpenCamera,
  onCapture,
  onRetake,
  onFlipCamera,
  onCancelCamera,
  onCancelForm,
  onSubmit,
  onCameraError,
}: {
  currentStatus: FieldStatus;
  elapsedTime: string;
  checkInTime: Date | null;
  liveAddress: string | null;
  odometerInValue: string;
  todayRecord: FieldDriverRecord | null;
  liveLocationReady: boolean;
  onStartCheckIn: () => void;
  onEndJourney: () => void;
  formAction: FormAction | null;
  odometerReading: string;
  capturedImage: string | null;
  isCameraActive: boolean;
  cameraFacingMode: 'user' | 'environment';
  isSubmitting: boolean;
  onOdometerChange: (v: string) => void;
  onOpenCamera: () => void;
  onCapture: (data: string) => void;
  onRetake: () => void;
  onFlipCamera: () => void;
  onCancelCamera: () => void;
  onCancelForm: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCameraError: (msg: string) => void;
}) {
  const locationText = liveAddress || todayRecord?.inLocation || '';
  const odometerText = odometerInValue || todayRecord?.odometerIn;
  const checkInDate = checkInTime
    ? checkInTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const checkInTimeOnly = checkInTime
    ? checkInTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <FieldCard
      title="Journey Status"
      icon={<ScooterIcon className="w-5 h-5" color="#2563EB" />}
      compact
      className="h-full"
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="space-y-2 shrink-0">
          {currentStatus === 'CHECKED_IN' && (
            <>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 min-w-0">
                <div className="shrink-0 w-12 h-12 flex items-center justify-center">
                  <ScooterIcon className="w-11 h-11" color="#062B6F" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <span className="text-[11px] font-black uppercase text-[#062B6F] dark:text-white whitespace-nowrap">
                      Checked In
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">Field journey in progress</p>
                </div>
                <div className="shrink-0 text-center px-2 py-1 rounded-lg bg-sky-100 dark:bg-sky-900/40 border border-sky-200">
                  <p className="font-mono font-black text-sm text-[#062B6F] dark:text-white leading-none">
                    {elapsedTime.slice(0, 5)}
                  </p>
                  <p className="text-[7px] font-bold text-gray-400 uppercase mt-0.5">HH:MM</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-[#FEF9C3] border border-[#FDE047] rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span className="text-[9px] font-black uppercase text-gray-800">Field Check-in Active</span>
              </div>
            </>
          )}

          {currentStatus === 'IDLE' && (
            <div className="flex items-center gap-3">
              <ScooterIcon className="w-12 h-12 shrink-0" color="#E11D48" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                  <span className="text-xs font-black uppercase text-[#2563EB]">Idle</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Ready for your field journey</p>
              </div>
            </div>
          )}

          {currentStatus === 'COMPLETED' && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10">
              <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase text-gray-600">Completed</p>
                <p className="text-[10px] text-gray-500">Journey completed for today</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {locationText && (
              <InfoBox
                icon={<MapPinIcon className="w-3.5 h-3.5 text-[#2563EB]" />}
                label="Live Location"
                value={locationText}
                multiline
              />
            )}

            {currentStatus === 'CHECKED_IN' && (checkInDate || odometerText) && (
              <div className="flex gap-1.5 min-w-0">
                {checkInDate && (
                  <InfoBox
                    compact
                    className="flex-1 min-w-0"
                    icon={<CalendarDaysIcon className="w-3.5 h-3.5 text-[#2563EB]" />}
                    label="Check-in Time"
                    value={checkInDate}
                    valueLine2={checkInTimeOnly}
                  />
                )}
                {odometerText && (
                  <InfoBox
                    compact
                    className="flex-1 min-w-0"
                    icon={<span className="text-xs">⏱</span>}
                    label="Odometer In"
                    value={`${odometerText} KM`}
                  />
                )}
              </div>
            )}
          </div>

          {currentStatus === 'IDLE' && (
            <button
              type="button"
              onClick={onStartCheckIn}
              disabled={!liveLocationReady}
              className="w-full py-2.5 rounded-lg bg-[#062B6F] hover:bg-[#051d4d] text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              Start Field Check-in
            </button>
          )}

          {currentStatus === 'CHECKED_IN' && (
            <button
              type="button"
              onClick={onEndJourney}
              className="w-full py-2.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
            >
              <span>🏁</span>
              End Journey
            </button>
          )}
        </div>

        <div className="mt-auto">
          <JourneyFormSection
            formAction={formAction}
            odometerReading={odometerReading}
            odometerInValue={odometerInValue}
            capturedImage={capturedImage}
            isCameraActive={isCameraActive}
            cameraFacingMode={cameraFacingMode}
            isSubmitting={isSubmitting}
            checkedInOdometer={currentStatus === 'CHECKED_IN' ? odometerInValue : undefined}
            onOdometerChange={onOdometerChange}
            onOpenCamera={onOpenCamera}
            onCapture={onCapture}
            onRetake={onRetake}
            onFlipCamera={onFlipCamera}
            onCancelCamera={onCancelCamera}
            onCancelForm={onCancelForm}
            onSubmit={onSubmit}
            onCameraError={onCameraError}
          />
        </div>
      </div>
    </FieldCard>
  );
}
