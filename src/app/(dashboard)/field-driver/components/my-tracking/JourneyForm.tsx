'use client';

import { useEffect, useRef } from 'react';
import { CameraIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { FormAction } from '../../types/field-driver';

function FormShell({
  title,
  children,
  fillHeight = false,
}: {
  title: string;
  children: React.ReactNode;
  fillHeight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-sky-200 bg-sky-50/60 dark:from-sky-950/40 dark:to-sky-950/20 dark:border-sky-800/50 overflow-hidden ${
        fillHeight ? 'h-full flex flex-col' : ''
      }`}
    >
      <div className="px-3 py-2 border-b border-sky-200/80 dark:border-sky-800/50 flex items-center gap-2 bg-sky-100/50 dark:bg-sky-900/30 shrink-0">
        <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 flex items-center justify-center">
          <CameraIcon className="w-3.5 h-3.5 text-[#2563EB]" />
        </div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2563EB]">{title}</h3>
      </div>
      <div className={`p-3 ${fillHeight ? 'flex-1 flex flex-col' : ''}`}>{children}</div>
    </div>
  );
}

function FormButtons({
  onOpenCamera,
  onRetake,
  onCancel,
  isSubmitting,
  formAction,
  showRetake,
  disabled,
  showSubmit = true,
}: {
  onOpenCamera: () => void;
  onRetake?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  formAction?: FormAction;
  showRetake?: boolean;
  disabled?: boolean;
  showSubmit?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        type="button"
        onClick={disabled ? undefined : onOpenCamera}
        disabled={disabled}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900 border border-sky-300 dark:border-sky-700 text-[#2563EB] rounded-xl font-black text-[10px] uppercase shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CameraIcon className="w-4 h-4" />
        Open Camera
      </button>
      {showSubmit && !disabled ? (
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl font-black text-[10px] uppercase shadow-sm disabled:opacity-50"
        >
          <CheckIcon className="w-4 h-4" />
          {isSubmitting ? 'Uploading...' : formAction === 'CHECK_IN' ? 'Submit Check-in' : 'Submit Checkout'}
        </button>
      ) : (
        <span className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563EB]/50 text-white rounded-xl font-black text-[10px] uppercase opacity-70">
          <CheckIcon className="w-4 h-4" />
          Submit Check-in
        </span>
      )}
      {showRetake && onRetake ? (
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-[#2563EB] rounded-xl font-black text-[10px] uppercase"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Retake
        </button>
      ) : disabled ? (
        <span className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-400 rounded-xl font-black text-[10px] uppercase opacity-60">
          <ArrowPathIcon className="w-4 h-4" />
          Retake
        </span>
      ) : null}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-gray-500 font-bold text-[10px] uppercase"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export default function CameraCapture({
  capturedImage,
  isCameraActive,
  cameraFacingMode,
  onOpenCamera,
  onCapture,
  onRetake,
  onFlip,
  onCancel,
  onCameraError,
}: {
  capturedImage: string | null;
  isCameraActive: boolean;
  cameraFacingMode: 'user' | 'environment';
  onOpenCamera: () => void;
  onCapture: (data: string) => void;
  onRetake: () => void;
  onFlip: () => void;
  onCancel: () => void;
  onCameraError: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isCameraActive) {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: cameraFacingMode } })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {
          onCameraError('Camera access denied or failed. Please allow camera permissions.');
          onCancel();
        });
    } else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [isCameraActive, cameraFacingMode, onCameraError, onCancel]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        onCapture(canvasRef.current.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  if (!capturedImage && !isCameraActive) return null;

  if (isCameraActive) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mt-3">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
        <button
          type="button"
          onClick={handleCapture}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-4 border-gray-300"
          aria-label="Capture"
        />
        <button
          type="button"
          onClick={onFlip}
          className="absolute bottom-4 left-4 p-2 bg-black/50 text-white rounded-full"
          title="Flip Camera"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-2 right-2 px-3 py-1 bg-black/50 text-white text-[10px] font-bold rounded-full"
        >
          Cancel
        </button>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden mt-3">
      <img src={capturedImage!} alt="Odometer" className="w-full h-auto" />
      <button
        type="button"
        onClick={onRetake}
        className="absolute top-2 right-2 px-3 py-1 bg-black/50 text-white text-[10px] font-bold rounded-full flex items-center gap-1"
      >
        <ArrowPathIcon className="w-3 h-3" /> Retake
      </button>
    </div>
  );
}

export function JourneyFormSection({
  formAction,
  odometerReading,
  odometerInValue,
  capturedImage,
  isCameraActive,
  cameraFacingMode,
  isSubmitting,
  checkedInOdometer,
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
  formAction: FormAction | null;
  odometerReading: string;
  odometerInValue: string;
  capturedImage: string | null;
  isCameraActive: boolean;
  cameraFacingMode: 'user' | 'environment';
  isSubmitting: boolean;
  checkedInOdometer?: string;
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
  const formTitle =
    formAction === 'CHECK_OUT' ? 'Check-out Form' : 'Check-in Form';

  const renderFields = (readOnlyOdometer?: string) => (
    <div className="space-y-2">
      {formAction === 'CHECK_OUT' && odometerInValue && (
        <p className="text-[10px] font-bold text-gray-500">Starting Odometer: {odometerInValue} KM</p>
      )}
      <div>
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
          Odometer Reading
        </label>
        <div className="flex gap-1.5 mt-1">
          <input
            type={readOnlyOdometer ? 'text' : 'number'}
            readOnly={!!readOnlyOdometer}
            value={readOnlyOdometer ?? odometerReading}
            onChange={readOnlyOdometer ? undefined : (e) => onOdometerChange(e.target.value)}
            className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-[11px] font-bold text-[#062B6F] dark:text-white outline-none focus:border-[#2563EB]"
            placeholder="e.g. 12540"
          />
          {!readOnlyOdometer && !capturedImage && !isCameraActive && (
            <button
              type="button"
              onClick={onOpenCamera}
              className="shrink-0 flex items-center gap-1 px-2 py-2 border border-sky-300 text-[#2563EB] rounded-lg font-black text-[9px] uppercase"
            >
              <CameraIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {!readOnlyOdometer && (
        <>
          <CameraCapture
            capturedImage={capturedImage}
            isCameraActive={isCameraActive}
            cameraFacingMode={cameraFacingMode}
            onOpenCamera={onOpenCamera}
            onCapture={onCapture}
            onRetake={onRetake}
            onFlip={onFlipCamera}
            onCancel={onCancelCamera}
            onCameraError={onCameraError}
          />
          <FormButtons
            onOpenCamera={onOpenCamera}
            onRetake={onRetake}
            onCancel={onCancelForm}
            isSubmitting={isSubmitting}
            formAction={formAction ?? 'CHECK_IN'}
            showRetake={!!(capturedImage || isCameraActive)}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="pt-2 mt-2 border-t border-gray-100 dark:border-white/10">
      <div className="flex items-center gap-1.5 mb-2">
        <CameraIcon className="w-3.5 h-3.5 text-[#2563EB]" />
        <p className="text-[9px] font-black uppercase tracking-widest text-[#2563EB]">{formTitle}</p>
      </div>

      {!formAction && checkedInOdometer && renderFields(checkedInOdometer)}

      {!formAction && !checkedInOdometer && (
        <p className="text-[11px] text-gray-500 text-center py-2">
          Press <strong>Start Field Check-in</strong> above to open the form
        </p>
      )}

      {formAction && (
        <form onSubmit={onSubmit}>{renderFields()}</form>
      )}
    </div>
  );
}

export function JourneyForm({
  formAction,
  odometerReading,
  odometerInValue,
  capturedImage,
  isCameraActive,
  cameraFacingMode,
  isSubmitting,
  checkedInOdometer,
  onOdometerChange,
  onOpenCamera,
  onCapture,
  onRetake,
  onFlipCamera,
  onCancelCamera,
  onCancelForm,
  onSubmit,
  onCameraError,
  fillHeight = false,
}: {
  formAction: FormAction | null;
  odometerReading: string;
  odometerInValue: string;
  capturedImage: string | null;
  isCameraActive: boolean;
  cameraFacingMode: 'user' | 'environment';
  isSubmitting: boolean;
  checkedInOdometer?: string;
  fillHeight?: boolean;
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
  const title = formAction === 'CHECK_OUT' ? 'Check-out Form' : 'Check-in Form';

  const shell = (title: string, content: React.ReactNode) => (
    <div className={fillHeight ? 'h-full' : undefined}>{content}</div>
  );

  if (!formAction && checkedInOdometer) {
    return shell(
      'Check-in Form',
      <FormShell title="Check-in Form" fillHeight={fillHeight}>
        <div className={`space-y-3 ${fillHeight ? 'flex-1 flex flex-col' : ''}`}>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Odometer Reading
            </label>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                readOnly
                value={checkedInOdometer}
                className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-[#062B6F] dark:text-white"
              />
              <button
                type="button"
                disabled
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-b from-sky-50 to-white border border-sky-300 text-[#2563EB] rounded-xl font-black text-[10px] uppercase opacity-60"
              >
                <CameraIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Open Camera</span>
              </button>
            </div>
          </div>
          <FormButtons onOpenCamera={onOpenCamera} disabled showRetake showSubmit={false} />
        </div>
      </FormShell>
    );
  }

  if (!formAction) {
    return shell(
      'Check-in Form',
      <FormShell title="Check-in Form" fillHeight={fillHeight}>
        <p
          className={`text-sm text-gray-500 text-center leading-relaxed ${
            fillHeight ? 'flex-1 flex items-center justify-center py-6' : 'py-6'
          }`}
        >
          Press <strong className="text-gray-700 dark:text-gray-300">Start Field Check-in</strong> above to open
          the form
        </p>
      </FormShell>
    );
  }

  return shell(
    title,
    <FormShell title={title} fillHeight={fillHeight}>
      <form onSubmit={onSubmit} className={`space-y-3 ${fillHeight ? 'flex-1 flex flex-col' : ''}`}>
        {formAction === 'CHECK_OUT' && odometerInValue && (
          <p className="text-xs font-bold text-gray-500 bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-sky-100">
            Starting Odometer: {odometerInValue} KM
          </p>
        )}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Odometer Reading
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              type="number"
              value={odometerReading}
              onChange={(e) => onOdometerChange(e.target.value)}
              className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-[#062B6F] dark:text-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              placeholder="e.g. 12540"
            />
            {!capturedImage && !isCameraActive && (
              <button
                type="button"
                onClick={onOpenCamera}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900 border border-sky-300 dark:border-sky-700 text-[#2563EB] rounded-xl font-black text-[10px] uppercase shadow-sm"
              >
                <CameraIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Open Camera</span>
              </button>
            )}
          </div>
        </div>

        <CameraCapture
          capturedImage={capturedImage}
          isCameraActive={isCameraActive}
          cameraFacingMode={cameraFacingMode}
          onOpenCamera={onOpenCamera}
          onCapture={onCapture}
          onRetake={onRetake}
          onFlip={onFlipCamera}
          onCancel={onCancelCamera}
          onCameraError={onCameraError}
        />

        <FormButtons
          onOpenCamera={onOpenCamera}
          onRetake={onRetake}
          onCancel={onCancelForm}
          isSubmitting={isSubmitting}
          formAction={formAction}
          showRetake={!!(capturedImage || isCameraActive)}
        />
      </form>
    </FormShell>
  );
}
