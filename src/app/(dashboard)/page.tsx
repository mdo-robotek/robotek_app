"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { 
  UsersIcon, 
  MapPinIcon, 
  UserMinusIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { 
  CompactWelcome,
  CompactScore,
  CompactOccasionCard,
  StatusTile,
  QuickActionSquare,
  HighightedCalendar,
  CompactTable,
  BirthdayCelebrationModal,
  UserAssetsPanel,
  CompactPartyCelebrationCard
} from "./DashboardComponents";
import PendingApprovalsCard from "@/components/PendingApprovalsCard";
import CeoOverview from "@/components/CeoOverview";
import { QUICK_NEW_ICONS } from "@/components/QuickNew";
import { quickNewFor } from "@/lib/quick-new";
import { usePermissions } from "@/hooks/usePermissions";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Dashboard() {
  const { data: session } = useSession();
  
  const { data, error, isLoading } = useSWR('/api/dashboard', fetcher, {
    refreshInterval: 300000 
  });

  const [view, setView] = useState<"coo" | "me">("coo");

  const firstName = (session?.user as any)?.username || session?.user?.name?.split(' ')[0] || "Guest";
  const username = (session?.user as any)?.username as string | undefined;
  const userRole = (session?.user as any)?.role || 'User';
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'EA';
  const { permissions, isAdmin: isAdminRole } = usePermissions();
  const quickActions = quickNewFor({ username, isAdmin: isAdminRole, permissions });


  // Busy sale register freshness — reminder for the accounts team to copy
  // Busy -> Transaction -> Sales -> List into the sale sheet.
  const { data: busyFresh } = useSWR('/api/ims/busy-freshness', fetcher, {
    refreshInterval: 600000, revalidateOnFocus: false,
  });
  const busyBanner = busyFresh?.lastSaleDate ? (
    <div className="max-w-[1600px] mx-auto px-4 pb-3">
      <div
        className={`rounded-2xl px-4 py-2.5 flex items-center gap-3 text-[14px] font-semibold   border ${
          (busyFresh.daysOld ?? 99) >= 2
            ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
            : (busyFresh.daysOld ?? 99) >= 1
            ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
            : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
        }`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${(busyFresh.daysOld ?? 99) >= 2 ? "bg-rose-500 animate-pulse" : (busyFresh.daysOld ?? 99) >= 1 ? "bg-amber-500" : "bg-emerald-500"}`} />
        {(busyFresh.daysOld ?? 99) >= 2
          ? `Busy sale data is ${busyFresh.daysOld} days old — copy the sale list from Busy (Transaction → Sales → List)`
          : (busyFresh.daysOld ?? 99) >= 1
          ? `Busy sale data is up to ${busyFresh.lastSaleDate} — today's copy still pending`
          : `Busy sale data up to date (${busyFresh.lastSaleDate})`}
      </div>
    </div>
  ) : null;

  // Calculate Monthly Averages
  let avgIn = "--:--";
  let avgOut = "--:--";

  if (data?.attendanceHistory) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthRecords = data.attendanceHistory.filter((r: any) => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const calculateAvgTime = (records: any[], type: 'inTime' | 'outTime') => {
      const times = records
        .map(r => r[type] ? new Date(r[type]) : null)
        .filter(t => t !== null) as Date[];
      
      if (times.length === 0) return null;

      const totalMinutes = times.reduce((acc, t) => acc + (t.getHours() * 60 + t.getMinutes()), 0);
      const avgMinutes = Math.round(totalMinutes / times.length);
      const h = Math.floor(avgMinutes / 60);
      const m = avgMinutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    avgIn = calculateAvgTime(monthRecords, 'inTime') || "--:--";
    avgOut = calculateAvgTime(monthRecords, 'outTime') || "--:--";
  }

  if (error) return (
    <div className="flex items-center justify-center min-h-[400px] text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/20 rounded-3xl border border-rose-100 italic">
      Synchronizing System Core...
    </div>
  );

  const myDay = (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10 px-4">
      
      {/* ROW 1: MISSION CONTROL HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-2 hidden md:block">
          <CompactWelcome firstName={firstName} role={userRole} />
        </div>
        <div className="xl:col-span-2">
            {!isLoading && data?.score && <CompactScore score={data.score.score} total={data.score.total} label="Failure score (gap)" isNegative={true} />}
        </div>
        <div className="xl:col-span-2">
            {!isLoading && data?.score && <CompactScore score={data.score.onTimeRate} total={data.score.completed} label="Accuracy gap" isNegative={true} />}
        </div>
        <div className="xl:col-span-3">
            {!isLoading && data && <CompactOccasionCard birthdays={data.birthdays || []} anniversaries={data.anniversaries || []} />}
        </div>
        <div className="xl:col-span-3">
            {!isLoading && data && <CompactPartyCelebrationCard partyBirthdays={data.partyBirthdays || []} partyAnniversaries={data.partyAnniversaries || []} />}
        </div>
      </div>

      {/* Row 2: Status, Schedule, & Calendars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Column: Metrics & Actions */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-4 auto-rows-max">
           <StatusTile label="Present" value={data?.summary?.totalIn || 0} icon={UsersIcon} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-900/30" />
           <StatusTile label="Absent" value={data?.summary?.outOfOffice || 0} icon={MapPinIcon} color="text-rose-600 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-900/30" />
           <StatusTile label="On Leave" value={data?.summary?.onLeave || 0} icon={UserMinusIcon} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/30" />
           
           {/* Same forms as the "+ New" button, so both places always match */}
           {quickActions.map((item) => (
             <QuickActionSquare key={item.key} label={item.key === "leave" ? "Apply Leave" : `New ${item.label}`} href={item.href} icon={QUICK_NEW_ICONS[item.key]} />
           ))}
           <QuickActionSquare label="Attendance" href="/attendance" icon={ClockIcon} color="bg-emerald-500" />
        </div>

        {/* Middle Column: My Assets */}
        <div className="lg:col-span-4">
            <UserAssetsPanel username={username} />
        </div>

        {/* Right Column: Personal Calendar */}
        <div className="lg:col-span-4">
            <HighightedCalendar 
              history={data?.attendanceHistory || []} 
              leaveDates={data?.leaveDates || []} 
              avgIn={avgIn} 
              avgOut={avgOut} 
            />
        </div>
      </div>

      {/* ROW 3: DETAILED LOGS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CompactTable 
            title="Today's check-ins"
            icon={UsersIcon}
            headerTheme="emerald"
            data={data?.attendanceToday || []}
            linkHref="/attendance"
            columns={[
                { label: 'User', key: 'userName', render: (row: any) => (
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-[#2563EB]/10 dark:bg-[#60A5FA]/10 flex items-center justify-center text-[13px] font-semibold">{row.userName.charAt(0)}</div>
                        <span className="text-[14px] font-bold leading-tight break-words">{row.userName}</span>
                    </div>
                )},
                { label: 'In', key: 'inTime', className: 'text-center', render: (row: any) => (
                    <span className="text-emerald-500 text-[14px] font-bold">{row.inTime ? new Date(row.inTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</span>
                )},
                { label: 'Out', key: 'outTime', className: 'text-center', render: (row: any) => (
                    <span className="text-rose-500 text-[14px] font-bold">{row.outTime ? new Date(row.outTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</span>
                )}
            ]}
        />

        <CompactTable 
            title="Open tickets"
            icon={ChatBubbleLeftRightIcon}
            headerTheme="blue"
            data={data?.openTickets || []}
            linkHref="/tickets"
            columns={[
                { label: 'Ticket', key: 'id', render: (row: any) => (
                    <div className="flex flex-col">
                        <span className="block font-semibold text-gray-900 dark:text-white leading-tight text-[14px] break-words">{row.title}</span>
                        <span className="text-[13px] text-[#5B6472] font-mono italic mt-0.5">{row.id}</span>
                    </div>
                )},
                { label: 'Status', key: 'status', className: 'text-right', render: (row: any) => (
                    <span className={`px-2 py-0.5 rounded-full text-[13px]  font-semibold ${
                        row.status === 'Open' ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-amber-500/10 text-amber-500'
                    }`}>{row.status}</span>
                )}
            ]}
        />

        <CompactTable 
            title="Leave requests"
            icon={UserMinusIcon}
            headerTheme="amber"
            data={(data?.recentLeaves || []).filter((l: any) => (l.status || '').toLowerCase() === 'pending')}
            linkHref="/leave"
            columns={[
                { label: isAdmin ? 'Person' : 'Reason', key: 'userName', render: (row: any) => (
                    <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-white font-semibold text-[14px] leading-tight break-words">{isAdmin ? row.userName : row.reason}</span>
                        <span className="text-[13px] text-[#5B6472] font-bold mt-0.5">{new Date(row.startDate).toLocaleDateString()}</span>
                    </div>
                )},
                      { label: 'Covering', key: 'involved', render: (row: any) => (
                        <div className="text-[14px] text-gray-600">{(row.involved || []).join(', ')}</div>
                      )},
                { label: 'Status', key: 'status', className: 'text-right', render: (row: any) => (
                    <span className={`px-2 py-0.5 rounded-full text-[13px]  ${
                        row.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 font-semibold' : 
                        row.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 font-semibold' : 'bg-rose-500/10 text-rose-500 font-semibold'
                    }`}>{row.status}</span>
                )}
            ]}
        />
      </div>

      <BirthdayCelebrationModal birthdays={data?.birthdays} anniversaries={data?.anniversaries} partyBirthdays={data?.partyBirthdays} partyAnniversaries={data?.partyAnniversaries} currentUser={firstName} />
    </div>
  );

  // Pending Approvals — only the approvals this user owns; hides itself when empty.
  const approvalsStrip = (
    <div className="max-w-[1600px] mx-auto px-4 pb-4">
      <PendingApprovalsCard />
    </div>
  );

  // Non-admins: personal dashboard + Busy freshness reminder (accounts team)
  if (!isAdmin) return (
    <div>
      {busyBanner}
      {approvalsStrip}
      {myDay}
    </div>
  );

  const tabs = [
    { id: "coo" as const, label: "COO Command Center" },
    { id: "me" as const, label: "My Day" },
  ];

  return (
    <div>
      {/* On the CEO view the Busy reminder sits inside "Needs attention" */}
      {view !== "coo" && busyBanner}
      <div className="max-w-[1600px] mx-auto px-4 pb-4 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`shrink-0 rounded-full px-5 py-2 text-[14px] font-semibold   transition-all active:scale-95 ${
              view === t.id
                ? "bg-[#2563EB] text-white dark:bg-[#60A5FA] dark:text-[#0B1120] shadow-lg"
                : "bg-white text-gray-500 ring-1 ring-black/10 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {view === "coo" ? (
        <div className="max-w-[1600px] mx-auto px-4 pb-10">
          <CeoOverview />
        </div>
      ) : (
        <>
          {approvalsStrip}
          {myDay}
        </>
      )}
    </div>
  );
}
