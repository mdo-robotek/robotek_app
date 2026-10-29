"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  LifebuoyIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import { usePermissions } from "@/hooks/usePermissions";
import { quickNewFor, quickNewHref, type QuickNewKey, type QuickNewItem } from "@/lib/quick-new";

export const QUICK_NEW_ICONS: Record<QuickNewKey, React.ComponentType<{ className?: string }>> = {
  delegation: ClipboardDocumentListIcon,
  indent: ShoppingCartIcon,
  ticket: LifebuoyIcon,
  leave: CalendarDaysIcon,
};

/**
 * "+ New" — one button on every screen that opens the common forms directly.
 *   variant="header": desktop button in the top bar (hidden on phones)
 *   variant="fab":    round button bottom-right on phones (hidden on desktop)
 */
export default function QuickNew({ variant }: { variant: "header" | "fab" }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { data: session } = useSession();
  const { permissions, isAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const username = String((session?.user as { username?: string } | undefined)?.username || "");
  const items = quickNewFor({ username, isAdmin, permissions });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session || items.length === 0) return null;
  // Chat has its own typing bar at the bottom; don't cover it.
  if (variant === "fab" && pathname.startsWith("/chat")) return null;

  const go = (item: QuickNewItem) => {
    setOpen(false);
    router.push(quickNewHref(item));
  };

  const list = (
    <div className="py-1">
      {items.map((item) => {
        const Icon = QUICK_NEW_ICONS[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => go(item)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#60A5FA]/10 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-[#1A1D21] dark:text-white">{item.label}</span>
              <span className="block text-[13px] text-[#5B6472] dark:text-gray-400 truncate">{item.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  if (variant === "header") {
    return (
      <div ref={boxRef} className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="h-10 px-4 flex items-center gap-1.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New
        </button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-72 bg-white dark:bg-navy-800 rounded-xl border border-[#E5E7EB] dark:border-navy-700 shadow-xl z-[200] overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-[13px] font-semibold text-[#5B6472]">Create new</p>
            {list}
          </div>
        )}
      </div>
    );
  }

  // Phone: round button bottom-right, bottom sheet on tap.
  return (
    <div className="md:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Create new"
          className="fixed right-4 bottom-5 z-40 h-14 pl-4 pr-5 rounded-full bg-[#2563EB] active:bg-[#1D4ED8] text-white shadow-lg flex items-center gap-1.5 text-[15px] font-semibold"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <PlusIcon className="w-5 h-5" />
          New
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[300] flex items-end bg-black/30">
          <div ref={boxRef} className="w-full bg-white dark:bg-navy-800 rounded-t-2xl pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <p className="text-[17px] font-semibold text-[#1A1D21] dark:text-white">Create new</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-11 h-11 -mr-2 flex items-center justify-center text-[#5B6472]"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            {list}
          </div>
        </div>
      )}
    </div>
  );
}
