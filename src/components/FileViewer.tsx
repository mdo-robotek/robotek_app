"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import {
  XMarkIcon, ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon,
  DocumentIcon, TableCellsIcon, PhotoIcon, DocumentTextIcon,
} from "@heroicons/react/24/outline";

/**
 * One file viewer for the whole ERP (Sahil, 2026-10-29): any uploaded file —
 * PDF, Excel, Word, PowerPoint, photo, video — opens in a clean window inside
 * Sarthi instead of downloading or opening Google Drive in a new tab.
 *
 * Works without touching every page: FileViewerProvider (in the dashboard
 * layout) catches clicks on links to uploaded files and opens this window.
 * Hold Ctrl / Cmd while clicking to open the old way in a new tab.
 */

type Target = { url: string; name?: string };
const Ctx = createContext<{ open: (t: Target) => void }>({ open: () => {} });
export const useFileViewer = () => useContext(Ctx);

/** Drive file id from any Drive link we store (uc?id=, file/d/, open?id=, thumbnail?id=). */
export function driveIdOf(url: string): string | null {
  if (!/drive\.google\.com|googleusercontent\.com|\/api\/drive-proxy\?/.test(url)) return null;
  const m = url.match(/\/d\/([A-Za-z0-9_-]{10,})/) || url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}
/** Private employee documents have their own HR-only route. */
const isPrivateDoc = (url: string) => /\/api\/hrms\/documents\/file\//.test(url);
export const isFileLink = (url: string) => !!driveIdOf(url) || isPrivateDoc(url);

type Kind = "image" | "pdf" | "sheet" | "doc" | "slides" | "video" | "other";
function kindOf(mime: string, name: string): Kind {
  const m = (mime || "").toLowerCase();
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.includes("spreadsheet") || m.includes("excel") || m === "text/csv" || ["xlsx", "xls", "csv"].includes(ext)) return "sheet";
  if (m.includes("word") || m.includes("document") || ["doc", "docx", "txt", "rtf"].includes(ext)) return "doc";
  if (m.includes("presentation") || m.includes("powerpoint") || ["ppt", "pptx"].includes(ext)) return "slides";
  if (m.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
  return "other";
}
const KIND_LABEL: Record<Kind, string> = { image: "Photo", pdf: "PDF", sheet: "Excel", doc: "Word", slides: "PowerPoint", video: "Video", other: "File" };
const KIND_ICON: Record<Kind, typeof DocumentIcon> = { image: PhotoIcon, pdf: DocumentTextIcon, sheet: TableCellsIcon, doc: DocumentTextIcon, slides: DocumentIcon, video: DocumentIcon, other: DocumentIcon };
const size = (n: number) => (!n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Viewer({ target, onClose }: { target: Target; onClose: () => void }) {
  const id = driveIdOf(target.url);
  const { data: meta, error: metaError } = useSWR<{ name: string; mimeType: string; size: number }>(
    id ? `/api/files/${id}?meta=1` : null,
    (u: string) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    { revalidateOnFocus: false }
  );
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const name = meta?.name || target.name || (isPrivateDoc(target.url) ? "Employee document" : "Document");
  const kind: Kind = meta ? kindOf(meta.mimeType, meta.name) : isPrivateDoc(target.url) ? "pdf" : "other";
  const Icon = KIND_ICON[kind];
  const waiting = !!id && !meta && !metaError;

  // Where the content comes from
  const downloadUrl = id ? `https://drive.google.com/uc?export=download&id=${id}` : target.url;
  const newTabUrl = id ? `https://drive.google.com/file/d/${id}/view` : target.url;
  let body: React.ReactNode = null;
  if (waiting) {
    body = <div className="m-auto w-10 h-10 rounded-full border-4 border-[#E5E7EB] border-t-[#2563EB] animate-spin" />;
  } else if (!id) {
    // Private employee document: our own route, the browser shows PDF / photo itself
    body = <iframe title={name} src={target.url} className="w-full h-full bg-white" onLoad={() => setLoaded(true)} />;
  } else if (kind === "image") {
    body = (
      <div className={`w-full h-full overflow-auto flex ${zoom ? "items-start justify-start" : "items-center justify-center"} bg-[#F1F3F6] dark:bg-navy-950`}>
        <img
          src={`/api/files/${id}`}
          alt={name}
          onLoad={() => setLoaded(true)}
          onClick={() => setZoom(!zoom)}
          className={zoom ? "max-w-none cursor-zoom-out" : "max-w-full max-h-full object-contain cursor-zoom-in"}
        />
      </div>
    );
  } else if (kind === "other" && meta) {
    body = (
      <div className="m-auto text-center p-6">
        <p className="text-[16px] font-semibold text-[#1A1D21] dark:text-white">This type of file can&apos;t be shown here.</p>
        <p className="mt-1 text-[14px] text-[#5B6472]">Download it to open on your computer or phone.</p>
        <a href={downloadUrl} data-no-viewer download className="mt-4 inline-flex h-11 px-4 items-center gap-2 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold"><ArrowDownTrayIcon className="w-5 h-5" /> Download</a>
      </div>
    );
  } else {
    // PDF, Excel, Word, PowerPoint, video: Google's viewer shows every page, sheet tabs and zoom, on phone and iPad too
    body = <iframe title={name} src={`https://drive.google.com/file/d/${id}/preview`} allow="autoplay" className="w-full h-full bg-white" onLoad={() => setLoaded(true)} />;
  }

  const btn = "h-11 px-2.5 md:px-3 whitespace-nowrap inline-flex items-center gap-1.5 rounded-xl text-[14px] font-semibold text-[#1A1D21] dark:text-white hover:bg-[#F1F3F6] dark:hover:bg-navy-800";
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-stretch md:items-center justify-center" role="dialog" aria-modal="true" aria-label={name}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full md:w-[min(1200px,94vw)] h-full md:h-[92vh] flex flex-col bg-white dark:bg-navy-900 md:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 md:px-4 py-2 border-b border-[#E5E7EB] dark:border-navy-800">
          <span className="w-10 h-10 rounded-xl bg-[#EFF4FF] text-[#2563EB] flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
          <div className="flex-1 min-w-[55%] md:min-w-0">
            <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white truncate">{name}</p>
            <p className="text-[12px] text-[#5B6472]">{meta ? [KIND_LABEL[kind], size(meta.size)].filter(Boolean).join(" · ") : metaError ? "Opening…" : ""}</p>
          </div>
          <div className="flex items-center gap-1 ml-auto">
          {kind === "image" && (
            <button type="button" onClick={() => setZoom(!zoom)} className={btn} aria-label={zoom ? "Fit to screen" : "Zoom in"}>
              {zoom ? <MagnifyingGlassMinusIcon className="w-5 h-5" /> : <MagnifyingGlassPlusIcon className="w-5 h-5" />}
              <span>{zoom ? "Fit" : "Zoom"}</span>
            </button>
          )}
          <a href={downloadUrl} data-no-viewer download className={btn}><ArrowDownTrayIcon className="w-5 h-5" /><span>Download</span></a>
          <a href={newTabUrl} target="_blank" rel="noreferrer" data-no-viewer className={btn}><ArrowTopRightOnSquareIcon className="w-5 h-5" /><span>New tab</span></a>
          <button type="button" onClick={onClose} className={btn}><XMarkIcon className="w-5 h-5" /><span>Close</span></button>
          </div>
        </div>
        <div className="relative flex-1 min-h-0 flex">
          {body}
          {!waiting && !loaded && kind !== "other" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-4 border-[#E5E7EB] border-t-[#2563EB] animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function FileViewerProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const open = useCallback((t: Target) => setTarget(t), []);

  // Catch clicks on any link to an uploaded file, anywhere in the ERP.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("data-no-viewer") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (!isFileLink(href)) return;
      // Download links stay downloads
      if (/export=download/.test(href)) return;
      e.preventDefault();
      setTarget({ url: href, name: a.getAttribute("title") || undefined });
    };
    document.addEventListener("click", onClick, true);
    // Buttons that call window.open(fileUrl) open the viewer too
    const original = window.open;
    window.open = function (url?: string | URL, ...rest: any[]) {
      const s = String(url || "");
      if (s && isFileLink(s) && !/export=download/.test(s)) {
        setTarget({ url: s });
        return null;
      }
      return original.call(window, url as any, ...rest);
    } as typeof window.open;
    return () => {
      document.removeEventListener("click", onClick, true);
      window.open = original;
    };
  }, []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {target && <Viewer target={target} onClose={() => setTarget(null)} />}
    </Ctx.Provider>
  );
}
