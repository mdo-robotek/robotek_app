import { NextRequest, NextResponse } from "next/server";
import { getTickets } from "@/lib/ticket-sheets";
import { getDelegations } from "@/lib/delegation-sheets";
import { getChecklists } from "@/lib/checklist-sheets";
import { getO2Ds } from "@/lib/o2d-sheets";
import { getParties } from "@/lib/party-management-sheets";
import { auth } from "@/auth";
import { getUsers } from "@/lib/google-sheets";
import { getAttendanceRecords } from "@/lib/sheets/attendance-sheets";
import { leaveRequestService } from "@/lib/leave-sheets";
import { globalCache } from "@/lib/cache";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  if (dateStr.includes("/")) {
    const parts = dateStr.split(" ");
    const dateParts = parts[0].split("/");
    if (dateParts.length === 3) {
      const [day, month, year] = dateParts;
      const timePart = parts[1] || "00:00:00";
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`;
      return new Date(iso);
    }
  }
  return null;
}

function normalizeDateStr(dStr: string | undefined): string {
    if (!dStr) return '';
    const trimmed = dStr.trim().split('T')[0];
    
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        const [dd, mm, yyyy] = trimmed.split('/');
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    
    if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts[2]?.length === 4) {
           const [dd, mm, yyyy] = parts;
           return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
    }
    return trimmed;
}

function calculateMetrics(tasks: any[], from: Date, to: Date) {
  const inRange = tasks.filter(t => {
      if (!t.plannedDate) return false;
      const pd = new Date(t.plannedDate);
      const ad = t.actualDate ? new Date(t.actualDate) : null;
      return (pd >= from && pd <= to) || (ad && ad >= from && ad <= to);
  });

  const completed = inRange.filter(t => t.isCompleted);
  const onTime = completed.filter(t => !t.isLate);
  
  const totalCount = inRange.length;
  const completedCount = completed.length;
  const onTimeCount = onTime.length;
  
  const score = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 0;
  
  return {
    total: totalCount,
    completed: completedCount,
    onTime: onTimeCount,
    score,
    onTimeRate
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRole = (session?.user as any)?.role?.toUpperCase();
    const userId = session?.user?.id;
    const username = (session?.user as any)?.username;
    const isAdmin = userRole === "ADMIN" || userRole === "EA";

    const dashboardCacheKey = `dashboard_${userId}_${isAdmin}`;
    const cachedDashboard = globalCache.get<Record<string, unknown>>(dashboardCacheKey);
    if (cachedDashboard) {
      return NextResponse.json(cachedDashboard);
    }

    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = istFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    const istYear = parseInt(getPart('year'));
    const istMonth = parseInt(getPart('month'));
    const istDay = parseInt(getPart('day'));
    const todayStrRaw = `${istYear}-${String(istMonth).padStart(2, '0')}-${String(istDay).padStart(2, '0')}`;
    const tMM = String(istMonth).padStart(2, '0');
    const tDD = String(istDay).padStart(2, '0');

    const from = new Date(istYear, istMonth - 1, 1, 0, 0, 0, 0);
    const to = new Date(istYear, istMonth, 0, 23, 59, 59, 999);

    const [users, attendance, leaves, tickets, delegations, checklists, o2ds, parties] = await Promise.all([
      getUsers(),
      getAttendanceRecords(),
      leaveRequestService.getAll(),
      getTickets(),
      getDelegations(),
      getChecklists(),
      getO2Ds(),
      getParties()
    ]);

    const attendanceToday = attendance.filter((r: any) => normalizeDateStr(r.date) === todayStrRaw);
    const totalUsersCount = users.length;
    const inTodayCount = attendanceToday.length;
    
    const onLeaveToday = leaves.filter((l: any) => {
        if (!l.status || l.status.toLowerCase() !== 'approved') return false;
        const start = new Date(normalizeDateStr(l.startDate));
        const end = new Date(normalizeDateStr(l.endDate));
        const today = new Date(todayStrRaw);
        return today >= start && today <= end;
    });
    const leaveTodayCount = onLeaveToday.length;
    const outOfOfficeCount = Math.max(0, totalUsersCount - inTodayCount - leaveTodayCount);

    const birthdays = users.filter((u: any) => {
      if (!u.dob) return false;
      const normalized = normalizeDateStr(u.dob);
      if (!normalized) return false;
      const [y, m, d] = normalized.split('-');
      return m === tMM && d === tDD;
    });

    const anniversaries = users.filter((u: any) => {
      if (!u.anniversary_date) return false;
      const normalized = normalizeDateStr(u.anniversary_date);
      if (!normalized) return false;
      const [y, m, d] = normalized.split('-');
      return m === tMM && d === tDD;
    });

    const partyBirthdays = parties.filter((p: any) => {
      if (!p.dateOfBirth) return false;
      const raw = String(p.dateOfBirth).trim();
      const normalized = normalizeDateStr(raw);
      if (normalized) {
        const parts = normalized.split('-');
        if (parts.length === 3 && parts[1] === tMM && parts[2] === tDD) return true;
      }
      try {
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          const pm = String(parsed.getMonth() + 1).padStart(2, '0');
          const pd = String(parsed.getDate()).padStart(2, '0');
          if (pm === tMM && pd === tDD) return true;
        }
      } catch { /* ignore */ }
      return false;
    });

    const partyAnniversaries = parties.filter((p: any) => {
      if (!p.anniversary) return false;
      const raw = String(p.anniversary).trim();
      const normalized = normalizeDateStr(raw);
      if (normalized) {
        const parts = normalized.split('-');
        if (parts.length === 3 && parts[1] === tMM && parts[2] === tDD) return true;
      }
      try {
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          const pm = String(parsed.getMonth() + 1).padStart(2, '0');
          const pd = String(parsed.getDate()).padStart(2, '0');
          if (pm === tMM && pd === tDD) return true;
        }
      } catch { /* ignore */ }
      return false;
    });

    const openTickets = tickets
        .filter((t: any) => t.status !== 'Resolved' && t.status !== 'Closed')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const userLeaves = leaves.filter((l: any) => (l.userName === username) && l.status.toLowerCase() === 'approved');
    const leaveDates: string[] = [];
    userLeaves.forEach((l: any) => {
       const startStr = normalizeDateStr(l.startDate);
       const endStr = normalizeDateStr(l.endDate);
       if (startStr && endStr) {
           let curr = new Date(startStr);
           const end = new Date(endStr);
           while (curr <= end) {
              leaveDates.push(curr.toISOString().split('T')[0]);
              curr.setDate(curr.getDate() + 1);
           }
       }
    });

    const allTasks: any[] = [];
    delegations.forEach((d: any) => {
      const planned = parseDate(d.due_date);
      const actual = d.status === "Completed" || d.status === "Approved" ? parseDate(d.updated_at) : null;
      allTasks.push({
        plannedDate: planned,
        actualDate: actual,
        isCompleted: !!actual,
        isLate: planned && actual ? actual > planned : false,
      });
    });
    checklists.forEach((c: any) => {
      const planned = parseDate(c.due_date);
      const actual = c.status === "Completed" ? parseDate(c.updated_at) : null;
      allTasks.push({
        plannedDate: planned,
        actualDate: actual,
        isCompleted: !!actual,
        isLate: planned && actual ? actual > planned : false,
      });
    });
    o2ds.forEach((order: any) => {
      if (order.hold || order.cancelled) return;
      for (let i = 1; i <= 11; i++) {
        const plannedStr = (order as any)[`planned_${i}`];
        if (!plannedStr) continue;
        const actualStr = (order as any)[`actual_${i}`] || (order as any)[`acual_${i}`];
        const status = (order as any)[`status_${i}`];
        const isDone = status === "Yes" || status === "Done";
        const planned = parseDate(plannedStr);
        const actual = isDone ? parseDate(actualStr) : null;
        allTasks.push({
          plannedDate: planned,
          actualDate: actual,
          isCompleted: !!actual,
          isLate: planned && actual ? actual > planned : false,
        });
      }
    });

    const companyMetrics = calculateMetrics(allTasks, from, to);

    const attendanceTodayWithRole = attendanceToday.map((r: any) => ({
        userName: r.userName,
        inTime: r.inTime,
        outTime: r.outTime,
        userId: r.userId,
        role: users.find((u: any) => String(u.id) === String(r.userId))?.role_name || 'User'
    }));

    const filteredAttendanceToday = isAdmin
        ? attendanceTodayWithRole
        : attendanceTodayWithRole.filter((r: any) => r.userId === userId || r.userName === username);

    const visibleTickets = (isAdmin ? openTickets : openTickets.filter((t: any) => t.raised_by === username || t.solver_person === username)).slice(0, 15);

    const responsePayload = {
      attendanceToday: filteredAttendanceToday.slice(0, 10),
      attendanceHistory: attendance
        .filter((r: any) => String(r.userId) === String(userId))
        .map((r: any) => ({
          date: normalizeDateStr(r.date),
          inTime: r.inTime,
          outTime: r.outTime,
        })),
      summary: {
        totalIn: inTodayCount,
        onLeave: leaveTodayCount,
        outOfOffice: outOfOfficeCount
      },
      leaveDates: Array.from(new Set(leaveDates)),
      birthdays: birthdays.map((u: any) => ({ username: u.username, role: u.role_name, image: u.image_url })),
      anniversaries: anniversaries.map((u: any) => ({ username: u.username, role: u.role_name, image: u.image_url })),
      partyBirthdays: partyBirthdays.map((p: any) => ({ partyName: p.partyName, partyType: p.partyType })),
      partyAnniversaries: partyAnniversaries.map((p: any) => ({ partyName: p.partyName, partyType: p.partyType })),
      openTickets: visibleTickets.map((t: any) => ({ id: t.id, title: t.title, status: t.status })),
      recentLeaves: (isAdmin ? leaves : leaves.filter((l: any) => l.userName === username)).slice(0, 5).map((l: any) => {
        const startDate = normalizeDateStr(l.startDate);
        const endDate = normalizeDateStr(l.endDate);
        const involved = [l.responsibility1, l.responsibility2, l.responsibility3].map((rid: any) => {
          const u = users.find((uu: any) => String(uu.id) === String(rid));
          return u ? (u.full_name || u.username) : null;
        }).filter(Boolean);
        return {
          userName: l.userName,
          reason: l.reason,
          status: l.status,
          startDate,
          endDate,
          involved
        };
      }),
      score: companyMetrics,
      isAdmin
    };

    globalCache.set(dashboardCacheKey, responsePayload, 2 * 60 * 1000);
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

