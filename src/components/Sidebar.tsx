"use client";

import { useState, useEffect, useMemo } from "react";
import { canSeeActionBoard } from "@/lib/action-board";
import SarthiMark from "./SarthiMark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/lib/navigation";

import { useSession, signOut } from "next-auth/react";
import { XMarkIcon, ArrowRightOnRectangleIcon, UserCircleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { usePermissions } from "@/hooks/usePermissions";

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  const [delegationsPendingCount, setDelegationsPendingCount] = useState(0);
  const [checklistsPendingCount, setChecklistsPendingCount] = useState(0);
  const [ticketsOpenCount, setTicketsOpenCount] = useState(0);
  const [o2dPendingCount, setO2dPendingCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [leavePendingCount, setLeavePendingCount] = useState(0);
  
  const [recruitmentPendingCount, setRecruitmentPendingCount] = useState(0);
  const [candidatePendingCount, setCandidatePendingCount] = useState(0);
  const [salesPendingCount, setSalesPendingCount] = useState(0);
  const [onboardPendingCount, setOnboardPendingCount] = useState(0);
  const [offboardPendingCount, setOffboardPendingCount] = useState(0);

  useEffect(() => {
    if (!session?.user) return;
    
    // @ts-ignore
    const userRole = session.user.role || 'USER';
    const currentUser = (session.user as any)?.username || "";

    const fetchCounts = async () => {
      try {
        const safeFetch = async (url: string) => {
          try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
          } catch (e) {
            console.error(`Sidebar fetch failed for ${url}:`, e);
          }
          return null;
        };

        const isRegularUser = userRole?.toUpperCase() === 'USER' || userRole?.toUpperCase() === 'SALES' || userRole?.toUpperCase() === 'CRM';
        const checklistCountUrl = `/api/checklists?page=1&limit=1&view=tasks&currentUser=${encodeURIComponent(currentUser || '')}&userRole=${encodeURIComponent(userRole || 'USER')}&assignmentFilter=${isRegularUser ? 'ToMe' : 'All'}`;

        const [delData, checkPage, tickData, o2dSummary, badgeData, hrmsSummary] = await Promise.all([
          safeFetch('/api/delegations'),
          safeFetch(checklistCountUrl),
          safeFetch('/api/tickets'),
          safeFetch('/api/o2d/summary'),   // lightweight — just aggregate counts, not all rows
          safeFetch('/api/sidebar/badges'),
          safeFetch('/api/hrms/summary')
        ]);
        
        // Filter for USER role
        const baseDel = (delData || []).length > 0 && isRegularUser ? delData.filter((d: any) => d.assigned_to === currentUser) : (delData || []);

        // Common helper
        const getEarliestDate = (dateString?: string) => {
          if (!dateString) return null;
          if (!dateString.includes(',')) {
            if (dateString.includes('/')) {
              const parts = dateString.split(' ')[0].split('/');
              if (parts.length === 3) {
                  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
            }
            return new Date(dateString);
          }
          const dates = dateString.split(',').map(d => new Date(d.trim()));
          const validDates = dates.filter(d => !isNaN(d.getTime()));
          if (validDates.length === 0) return null;
          return validDates.reduce((earliest, current) => current < earliest ? current : earliest);
        };

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const isDelayedOrToday = (item: any) => {
          const s = item.status;
          if (s === 'Completed' || s === 'Approved') return false;
          if (!item.due_date) return false;
          const due = getEarliestDate(item.due_date);
          if (!due || isNaN(due.getTime())) return false;
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 0;
        };

        setDelegationsPendingCount(baseDel.filter(isDelayedOrToday).length);
        const checkStatusCounts = checkPage?.statusCounts || {};
        setChecklistsPendingCount(
          (checkStatusCounts.Overdue || checkStatusCounts.Delayed || 0) +
            (checkStatusCounts.Pending || 0)
        );
        setTicketsOpenCount((tickData || []).filter((t: any) => t.status !== 'Resolved').length);

        // O2D badge: use summary stepCounts (steps 1-11 that are incomplete = pending)
        // stepCounts[i] = number of orders currently at step i+1
        // Total pending = sum of all steps 1..11 that have active orders (not completed)
        const stepCounts: number[] = o2dSummary?.stepCounts || [];
        const totalPending = stepCounts.slice(0, 11).reduce((sum: number, c: number) => sum + (c || 0), 0);
        setO2dPendingCount(totalPending);

        // Pending leave count for sidebar badge
        setLeavePendingCount(badgeData?.pendingLeaveCount || 0);

        // Chat badge disabled — no Sheets reads for unread counts
        setChatUnreadCount(0);

        // HRMS Logic
        if (hrmsSummary) {
          const isAdminRole = userRole?.toUpperCase() === 'ADMIN' || userRole?.toUpperCase() === 'EA';
          const u = currentUser.toLowerCase();
          
          setRecruitmentPendingCount(isAdminRole ? hrmsSummary.recruitment?.totalPending || 0 : hrmsSummary.recruitment?.assignedPending?.[u] || 0);
          setCandidatePendingCount(isAdminRole ? hrmsSummary.candidate?.totalPending || 0 : hrmsSummary.candidate?.assignedPending?.[u] || 0);
          setSalesPendingCount(isAdminRole ? hrmsSummary.sales?.totalPending || 0 : hrmsSummary.sales?.assignedPending?.[u] || 0);
          setOnboardPendingCount(isAdminRole ? hrmsSummary.onboard?.totalPending || 0 : hrmsSummary.onboard?.assignedPending?.[u] || 0);
          setOffboardPendingCount(isAdminRole ? hrmsSummary.offboard?.totalPending || 0 : hrmsSummary.offboard?.assignedPending?.[u] || 0);
        }

      } catch (err) {
        console.error("Failed to fetch sidebar counts:", err);
      }
    };

    fetchCounts();
    
    // Refresh counts every 5 minutes
    const interval = setInterval(fetchCounts, 300000);
    return () => clearInterval(interval);
  }, [session]);

  const { permissions: userPermissions, isAdmin } = usePermissions();

  const filteredNavigation = navigation.filter(item => {
    // Action Board: Admin, EA and the Process Coordinator (Sahil, 2026-10-28)
    if (item.id === 'action-board' || item.id === 'team-board') {
      const u = session?.user as any;
      return isAdmin || canSeeActionBoard({ username: u?.username, role: u?.role, designation: u?.designation });
    }
    // Dashboard is the system home, visible to all authenticated users, Chat is available to all, Scheduler set to visible
    if (item.id === 'dashboard' || item.id === 'chat' || item.id === 'scheduler' || item.id === 'grn' || item.id === 'payment-vendor-approval' || item.id === 'field-driver' || item.id === 'stationary' || item.id === 'attendance' || item.id === 'leave' || item.id === 'scot' || item.id === 'scot-kb' || item.id === 'customer-target') return true;

    // If matrix permissions exist, use them strictly
    if (userPermissions.length > 0) {
      return userPermissions.some((p: string) => p.toLowerCase() === item.id.toLowerCase());
    }
    // Fallback: Default to allowing Admins if no matrix data exists yet
    return isAdmin;
  });

  // Pending-count badge per menu item (same numbers as before).
  const badgeFor = (item: { id: string; href: string }): number => {
    if (item.id === 'delegations') return delegationsPendingCount;
    if (item.id === 'checklists') return checklistsPendingCount;
    if (item.id === 'tickets') return ticketsOpenCount;
    if (item.id === 'o2d') return o2dPendingCount;
    if (item.id === 'chat') return chatUnreadCount;
    if (item.id === 'leave') return leavePendingCount;
    if (item.href === '/hrms/recruitment') return recruitmentPendingCount;
    if (item.href === '/hrms/candidate') return candidatePendingCount;
    if (item.href === '/hrms/sales') return salesPendingCount;
    if (item.href === '/hrms/onboard') return onboardPendingCount;
    if (item.href === '/hrms/offboard') return offboardPendingCount;
    return 0;
  };

  // Sections open/close (Sahil, 24 Oct): the menu has many items, so each
  // section is a folder. The section holding the current page opens by
  // itself; what you open or close is remembered for next time.
  const sections = useMemo(() => {
    const out: { name: string; items: typeof filteredNavigation }[] = [];
    filteredNavigation.forEach(item => {
      const sectionName = (item as any).section || 'Other';
      let section = out.find(s => s.name === sectionName);
      if (!section) { section = { name: sectionName, items: [] }; out.push(section); }
      section.items.push(item);
    });
    return out;
  }, [filteredNavigation]);

  const activeSection = useMemo(() => {
    const hit = filteredNavigation.find(item =>
      pathname === item.href || (item.href !== '/' && (pathname + '/').startsWith(item.href + '/'))
    );
    return (hit as any)?.section || 'Dashboard';
  }, [filteredNavigation, pathname]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('erp_menu_sections');
      if (saved) setOpenSections(JSON.parse(saved));
    } catch { /* ignore */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored || !activeSection) return;
    setOpenSections(prev => (prev[activeSection] ? prev : { ...prev, [activeSection]: true }));
  }, [restored, activeSection]);

  const toggleSection = (name: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [name]: !prev[name] };
      try { localStorage.setItem('erp_menu_sections', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Pending count shown on a closed section, so nothing stays hidden.
  const sectionCount = (items: typeof filteredNavigation) =>
    items.reduce((sum, it) => sum + badgeFor(it as any), 0);

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        aria-label="Main menu"
        className={`
        fixed left-0 top-0 h-screen w-64 md:w-60 z-50 bg-white dark:bg-navy-900 border-r border-[#E5E7EB] dark:border-navy-800
        transition-transform duration-200 ease-out flex flex-col
        ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'}
      `}>

        <div className="flex items-center justify-between h-14 px-4 border-b border-[#E5E7EB] dark:border-navy-800 shrink-0">
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen?.(false)}>
            <div className="w-8 h-8 min-w-[32px] rounded-lg bg-[#2563EB] text-white flex items-center justify-center">
              <SarthiMark className="w-5 h-5" />
            </div>
            <span className="text-[17px] font-semibold text-[#1A1D21] dark:text-white whitespace-nowrap">
              Sarthi
            </span>
          </Link>

          {mobileOpen && (
            <button
              onClick={() => setMobileOpen?.(false)}
              aria-label="Close menu"
              className="w-11 h-11 flex items-center justify-center text-[#5B6472] hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg md:hidden"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {sections.map((section) => {
            const isOpen = !!openSections[section.name];
            const closedCount = sectionCount(section.items);
            return (
              <div key={section.name} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.name)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-2 px-3 min-h-[44px] md:min-h-[38px] rounded-lg text-[14px] font-semibold text-[#5B6472] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronDownIcon
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`}
                  />
                  <span className="flex-1 text-left truncate">{section.name}</span>
                  {!isOpen && closedCount > 0 && (
                    <span className="shrink-0 min-w-[22px] text-center text-[13px] font-semibold text-white bg-[#DC2626] rounded-full px-1.5 py-px tabular-nums">
                      {closedCount}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-0.5 mt-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== '/' && (pathname + '/').startsWith(item.href + '/'));
                      const count = badgeFor(item as any);
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileOpen?.(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`
                            flex items-center gap-3 pl-6 pr-3 min-h-[44px] md:min-h-[40px] rounded-lg transition-colors text-[15px]
                            ${isActive
                              ? 'bg-[#EFF4FF] text-[#2563EB] font-semibold dark:bg-white/10 dark:text-white'
                              : 'text-[#1A1D21] dark:text-slate-300 hover:bg-[#F7F8FA] dark:hover:bg-white/5'}
                          `}
                        >
                          <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#2563EB] dark:text-white' : 'text-[#5B6472] dark:text-slate-400'}`} />
                          <span className="flex-1 min-w-0 truncate">{item.name}</span>
                          {count > 0 && (
                            <span className="shrink-0 min-w-[22px] text-center text-[13px] font-semibold text-white bg-[#DC2626] rounded-full px-1.5 py-px tabular-nums">
                              {count}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile User Profile Section */}
        {mobileOpen && (
          <div className="p-3 border-t border-[#E5E7EB] dark:border-white/5 md:hidden">
            <div className="flex items-center gap-3 px-2">
              <UserCircleIcon className="w-9 h-9 text-[#5B6472]" />
              <div className="flex-1 overflow-hidden">
                <p className="text-[15px] font-semibold text-[#1A1D21] dark:text-white truncate">
                  {(session?.user as any)?.username || "User"}
                </p>
                <p className="text-[13px] text-[#5B6472] dark:text-gray-400 capitalize">
                  {/* @ts-ignore */}
                  {String(session?.user?.role || "Member").toLowerCase()}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                aria-label="Sign out"
                className="w-11 h-11 flex items-center justify-center text-[#5B6472] hover:text-[#B91C1C] hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
