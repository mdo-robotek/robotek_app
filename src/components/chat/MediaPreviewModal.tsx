"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  DocumentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { getDriveImageUrl, getDrivePreviewUrl, getDriveDownloadUrl } from "@/lib/drive-utils";
import { formatPreviewDateTime } from "@/lib/chat-time";

export interface ChatMediaItem {
  id: string;
  type: "image" | "file";
  label: string;
  messageId: string;
  senderId: string;
  createdAt: string;
}

interface MediaPreviewModalProps {
  items: ChatMediaItem[];
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onForward?: (messageId: string) => void;
}

function isPdfFile(label: string): boolean {
  return /\.pdf$/i.test(label.trim());
}

function formatSenderName(senderId: string): string {
  return senderId
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function MediaPreviewModal({
  items,
  activeId,
  onClose,
  onSelect,
  onForward,
}: MediaPreviewModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const activeRef = useRef<HTMLButtonElement>(null);

  const activeIndex = items.findIndex((i) => i.id === activeId);
  const active = items[activeIndex >= 0 ? activeIndex : 0];

  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < items.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onSelect(items[activeIndex - 1].id);
  }, [hasPrev, activeIndex, items, onSelect]);

  const goNext = useCallback(() => {
    if (hasNext) onSelect(items[activeIndex + 1].id);
  }, [hasNext, activeIndex, items, onSelect]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [activeId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext]);

  if (!active) return null;

  const isDocument = active.type === "file";
  const canEmbedPreview = active.type === "image" || isPdfFile(active.label);

  const handleCopy = async () => {
    if (active.type === "image") {
      try {
        const response = await fetch(`/api/drive-proxy?id=${active.id}`);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(getDrivePreviewUrl(active.id));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const toolbarBtn =
    "p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:pointer-events-none";

  const chatPattern =
    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cdc4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

  return (
    <div
      className="absolute inset-0 z-[100] flex flex-col bg-[#ECE5DD]"
      style={{ backgroundImage: chatPattern }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1 pr-3">
          <p className="text-gray-900 text-sm font-medium truncate">{formatSenderName(active.senderId)}</p>
          <p className="text-gray-500 text-[14px] truncate">{formatPreviewDateTime(active.createdAt)}</p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
            className={toolbarBtn}
          >
            <MagnifyingGlassPlusIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
            className={toolbarBtn}
          >
            <MagnifyingGlassMinusIcon className="w-5 h-5" />
          </button>
          {!isDocument && (
            <button
              type="button"
              title="Rotate"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className={toolbarBtn}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          )}
          {onForward && (
            <button
              type="button"
              title="Forward"
              onClick={() => onForward(active.messageId)}
              className={toolbarBtn}
            >
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            title="Download"
            onClick={() => window.open(getDriveDownloadUrl(active.id), "_blank")}
            className={toolbarBtn}
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
          </button>
          <button type="button" title={isCopied ? "Copied!" : "Copy link"} onClick={handleCopy} className={toolbarBtn}>
            {isCopied ? <CheckIcon className="w-5 h-5 text-[#25D366]" /> : <DocumentDuplicateIcon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            title="Open in new tab"
            onClick={() => window.open(getDrivePreviewUrl(active.id), "_blank")}
            className={toolbarBtn}
          >
            <ArrowTopRightOnSquareIcon className="w-5 h-5" />
          </button>
          <button type="button" title="Close" onClick={onClose} className={toolbarBtn}>
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main preview with prev/next */}
      <div className="flex-1 relative flex items-center min-h-0" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            disabled={!hasPrev}
            className="absolute left-3 z-10 p-2 rounded-full bg-white text-gray-700 shadow-md border border-gray-200 hover:bg-gray-50 disabled:opacity-20 disabled:pointer-events-none"
            title="Previous"
          >
            <ChevronLeftIcon className="w-7 h-7" />
          </button>
        )}

        <div className="flex-1 flex items-center justify-center h-full px-14 py-4 overflow-auto custom-scrollbar">
          {active.type === "image" ? (
            <img
              src={`https://drive.google.com/thumbnail?sz=w1600&id=${active.id}`}
              alt={active.label || "Image"}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          ) : canEmbedPreview ? (
            <div
              className="w-full h-full flex items-center justify-center origin-center transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <iframe
                src={`https://drive.google.com/file/d/${active.id}/preview?usp=embed`}
                title={active.label || "Document preview"}
                className="w-full h-full min-h-[60vh] max-w-5xl bg-white rounded-sm border-0 shadow-2xl"
                allow="autoplay"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-800 max-w-md text-center p-8 bg-white rounded-2xl shadow-lg">
              <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center">
                <DocumentIcon className="w-12 h-12 text-gray-500" />
              </div>
              <p className="font-medium text-lg break-all">{active.label || "Document"}</p>
              <p className="text-sm text-gray-500">Preview not available for this file type</p>
              <a
                href={getDrivePreviewUrl(active.id)}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 bg-[#25D366] text-white rounded-full text-sm font-medium hover:bg-[#20bd5a]"
              >
                Open in Google Drive
              </a>
            </div>
          )}
        </div>

        {items.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!hasNext}
            className="absolute right-3 z-10 p-2 rounded-full bg-white text-gray-700 shadow-md border border-gray-200 hover:bg-gray-50 disabled:opacity-20 disabled:pointer-events-none"
            title="Next"
          >
            <ChevronRightIcon className="w-7 h-7" />
          </button>
        )}
      </div>

      {/* Bottom media strip */}
      {items.length > 0 && (
        <div className="shrink-0 bg-white border-t border-gray-200 px-3 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]" onClick={(e) => e.stopPropagation()}>
          <p className="text-[14px] text-gray-500 mb-2 px-1">
            {activeIndex + 1} of {items.length} — scroll to browse
          </p>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
            {items.map((item) => {
              const isActive = item.id === active.id;
              return (
                <button
                  key={item.messageId}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    isActive
                      ? "border-[#25D366] ring-2 ring-[#25D366]/40"
                      : "border-gray-200 opacity-80 hover:opacity-100"
                  }`}
                >
                  {item.type === "image" ? (
                    <img src={getDriveImageUrl(item.id)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center p-1">
                      <DocumentIcon className="w-6 h-6 text-gray-600" />
                      <span className="text-[14px] text-gray-500 truncate w-full text-center mt-0.5">
                        {item.label.split(".").pop()?.toUpperCase() || "DOC"}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
