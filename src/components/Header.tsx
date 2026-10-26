"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { navigation } from "@/lib/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import {
  BellIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChatBubbleLeftRightIcon
} from "@heroicons/react/24/outline";

import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { permissions: userPermissions, isAdmin } = usePermissions();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredNavigation = navigation.filter(item => {
    if (item.id === 'dashboard' || item.id === 'chat' || item.id === 'scheduler' || item.id === 'grn' || item.id === 'field-driver' || item.id === 'stationary' || item.id === 'customer-target') return true;
    if (userPermissions.length > 0) {
      return userPermissions.some((p: string) => p.toLowerCase() === item.id.toLowerCase());
    }
    return isAdmin;
  });

  const searchResults = filteredNavigation.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNormalizedImageUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
      const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?sz=w200&id=${match[1]}`;
      }
    }
    return url;
  };

  // Chat unread badge disabled while chat backend is off (see chat-config.ts)
  const chatUnreadCount = 0;

  return (
    <header className="relative h-14 flex items-center justify-between px-2 md:px-6 sticky top-0 z-40 overflow-visible bg-white dark:bg-navy-900 border-b border-[#E5E7EB] dark:border-navy-800">

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="w-11 h-11 flex items-center justify-center md:hidden text-[#1A1D21] hover:bg-gray-100 dark:text-white dark:hover:bg-white/10 rounded-lg transition-colors"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>

        <div className="flex flex-col">
          <span className="text-[17px] font-semibold text-[#1A1D21] dark:text-white leading-tight">
            Hi, {(() => {
              const raw = String((session?.user as any)?.username || session?.user?.name || session?.user?.email?.split("@")[0] || "there");
              return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
            })()}
          </span>
          <span className="text-[13px] text-[#5B6472] dark:text-slate-400 leading-tight hidden sm:block">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex-1 min-w-0" />

      {/* Right Section: Search, Notifications & Profile */}
      <div className="relative z-10 flex items-center gap-1 md:gap-2 flex-shrink-0">
        {/* Search Input - Hidden on mobile */}
        <div ref={searchRef} className="relative z-50 group hidden lg:block flex-shrink-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472] dark:text-white/50 z-20 pointer-events-none" />
          <input
            suppressHydrationWarning
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            aria-label="Search pages"
            className="relative z-10 w-56 lg:w-64 h-10 pl-10 pr-4 bg-[#F7F8FA] dark:bg-white/10 border border-[#E5E7EB] dark:border-white/20 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] focus:bg-white dark:focus:bg-white/15 transition-colors text-[15px] placeholder:text-[#5B6472] dark:placeholder:text-white/40 text-[#1A1D21] dark:text-white"
          />
          
          {/* Search Dropdown */}
          {isSearchOpen && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-gray-200 dark:border-navy-700 z-[200] max-h-80 overflow-y-auto custom-scrollbar">
              {searchResults.length > 0 ? (
                <div className="p-1.5">
                  {searchResults.map((item, idx) => (
                    <button
                      key={`${item.name}-${item.href}-${idx}`}
                      onClick={() => {
                        router.push(item.href);
                        setIsSearchOpen(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3 group/item"
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 dark:bg-navy-900 group-hover/item:bg-[#EFF4FF] transition-colors">
                        <item.icon className="w-4 h-4 text-[#5B6472] dark:text-gray-400 group-hover/item:text-[#2563EB]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[15px] text-[#1A1D21] dark:text-white truncate">{item.name}</div>
                        <div className="text-[13px] text-[#5B6472]">{item.section}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No pages found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle (Replaces Bell) */}
        <ThemeToggle />

        {/* Chat Notification Icon */}
        <Link
          href="/chat"
          className="relative w-11 h-11 flex items-center justify-center text-[#5B6472] hover:text-[#1A1D21] hover:bg-gray-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors"
          title="Chat"
          aria-label="Chat"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5" />
          {chatUnreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1 py-0.5 text-[13px] font-semibold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-[#DC2626] rounded-full shadow-sm ring-2 ring-amber-200 dark:ring-[#60A5FA]">
              {chatUnreadCount}
            </span>
          )}
        </Link>

        <div className="h-6 w-px bg-[#E5E7EB] dark:bg-navy-800 mx-1 md:mx-2" />

        {/* User Profile & Logout */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-navy-700 flex-shrink-0">
            {session?.user?.image ? (
              <img
                src={getNormalizedImageUrl(session.user.image)}
                alt="Profile"
                className="object-cover w-full h-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-[#EFF4FF] flex items-center justify-center text-[#2563EB] font-semibold text-[13px]">
                {session?.user?.name?.substring(0, 2) || session?.user?.email?.substring(0, 2) || "UR"}
              </div>
            )}
          </div>

          <button
            suppressHydrationWarning
            onClick={() => signOut()}
            className="w-11 h-11 flex items-center justify-center text-[#5B6472] hover:text-[#B91C1C] hover:bg-red-50 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
