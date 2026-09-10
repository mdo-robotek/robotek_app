import { NextResponse } from "next/server";
import { getAttendanceRecords, getLeaveRequests } from "@/lib/sheets/attendance-sheets";
import { getDelegations } from "@/lib/delegation-sheets";
import { getChecklists } from "@/lib/checklist-sheets";
import { getUsers } from "@/lib/google-sheets";
import { getAllO2DsForAnalytics } from "@/lib/o2d-sheets";
import { getIMSItems } from "@/lib/ims-sheets";
import { auth } from "@/auth";
import { getWorkingHoursGapMs } from "@/lib/workingHours";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeDate(dateVal: string | undefined | null): string {
  if (!dateVal) return "";
  let dateStr = dateVal.split("T")[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [p1, p2, yyyy] = dateStr.split("/");
    let mm = p1, dd = p2;
    if (parseInt(p1) > 12) { dd = p1; mm = p2; }
    dateStr = `${yyyy}-${mm}-${dd}`;
  }
  return dateStr;
}

function getISTDateString(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString().split("T")[0];
}

function getTimeFromISO(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const h = d.getUTCHours().toString().padStart(2, "0");
    const m = d.getUTCMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  } catch { return ""; }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const granularity = searchParams.get("granularity") || "month";

    const todayStr = getISTDateString();
    const now = new Date();

    // ── Parallel fetch all data sources ──
    const [allO2Ds, allLeaves, allDelegations, allChecklists, allUsers, allAttendance, allIMS] = await Promise.all([
      getAllO2DsForAnalytics(),
      getLeaveRequests(),
      getDelegations(),
      getChecklists(),
      getUsers(),
      getAttendanceRecords(),
      getIMSItems(),
    ]);

    // Process O2D rows into orders (same as metrix route)
    const groupedByOrder: Record<string, any[]> = {};
    allO2Ds.forEach((item: any) => {
      const orderNo = item.order_no || "Unknown";
      if (!groupedByOrder[orderNo]) groupedByOrder[orderNo] = [];
      groupedByOrder[orderNo].push(item);
    });

    const allOrders = Object.entries(groupedByOrder)
      .filter(([_, items]) => items[0].status_3 !== "No")
      .map(([orderNo, items]) => {
      const firstItem = items[0];
      const createdAt = new Date(firstItem.created_at);
      const actual7 = firstItem.actual_7 ? new Date(firstItem.actual_7) : null;
      const planned7 = firstItem.planned_7 ? new Date(firstItem.planned_7) : null;
      let isOTD = false;
      let isDelayed = false;
      let targetDateForOTD = createdAt;
      
      if (targetDateForOTD) {
        if (actual7) {
          const gapMs = getWorkingHoursGapMs(targetDateForOTD, actual7);
          isOTD = gapMs <= 9 * 60 * 60 * 1000;
          isDelayed = gapMs > 9 * 60 * 60 * 1000;
        } else {
          const gapMs = getWorkingHoursGapMs(targetDateForOTD, new Date());
          isDelayed = gapMs > 9 * 60 * 60 * 1000;
        }
      }

      const isDispatched = !!firstItem.actual_7 && firstItem.status_7 !== "No";
      const totalAmount = items.reduce((sum: number, i: any) => sum + (parseFloat(i.est_amount) || 0), 0);
      
      const isReconfirmed = false;
      const actual4 = firstItem.actual_4 ? new Date(firstItem.actual_4) : null;
      
      return { orderNo, party: firstItem.party_name, createdAt, actual7, targetDateForOTD, isOTD, isDelayed, isDispatched, totalAmount, isReconfirmed, actual4 };
    });

    const totalUsers = (allUsers as any[]).filter((u: any) => u.status !== "Inactive").length;

    // ── 1. ATTENDANCE SUMMARY ──
    const todayAttendance = allAttendance.filter(r => normalizeDate(r.date) === todayStr);
    const checkedInUserIds = new Set(todayAttendance.map(r => String(r.userId)));

    // Calculate average check-in time (in minutes from midnight IST)
    const checkInTimes = todayAttendance
      .filter(r => r.inTime)
      .map(r => {
        const t = getTimeFromISO(r.inTime);
        const [h, m] = t.split(":").map(Number);
        return isNaN(h) ? null : h * 60 + m;
      })
      .filter((x): x is number => x !== null);

    const avgCheckInMins = checkInTimes.length > 0
      ? Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)
      : null;

    const avgCheckInStr = avgCheckInMins !== null
      ? `${Math.floor(avgCheckInMins / 60).toString().padStart(2, "0")}:${(avgCheckInMins % 60).toString().padStart(2, "0")}`
      : "N/A";

    // Late = checked in after 9:30 AM (9*60+30 = 570 mins)
    const lateArrivals = checkInTimes.filter(m => m > 570).length;

    // Approved leaves covering today
    const onLeaveToday = allLeaves.filter(l => {
      if (l.status !== "Approved") return false;
      const start = normalizeDate(l.startDate);
      const end = normalizeDate(l.endDate);
      return start <= todayStr && end >= todayStr;
    });
    const onLeaveUserIds = new Set(onLeaveToday.map(l => String(l.userId)));

    const presentCount = checkedInUserIds.size;
    const onLeaveCount = onLeaveUserIds.size;
    const absentCount = Math.max(0, totalUsers - presentCount - onLeaveCount);

    // ── 2. DELEGATION PIPELINE ──
    // Use filter params if provided, otherwise default to all time ('1970-01-01')
    const mtdStart = startDateParam || "1970-01-01";
    const mtdEnd = endDateParam || todayStr;
    const mtdDelegations = allDelegations.filter(d => {
      const created = normalizeDate(d.created_at);
      return created >= mtdStart && created <= mtdEnd;
    });

    const completed = allDelegations.filter(d => d.status === "Completed").length;
    const needRevision = allDelegations.filter(d => d.status === "Need Revision").length;
    const overdue = allDelegations.filter(d => {
      const due = normalizeDate(d.due_date);
      return due && due < todayStr && d.status !== "Completed";
    });
    const pending = allDelegations.filter(d => d.status === "Pending").length;
    const total = allDelegations.length;

    // Zero-task employees this month
    const assignedThisMonth = new Set(mtdDelegations.map(d => d.assigned_to));
    const zeroTaskEmployees = allUsers
      .filter((u: any) => u.status !== "Inactive" && !assignedThisMonth.has(u.username))
      .map((u: any) => u.username)
      .slice(0, 10);

    // Critical overdue tasks list (top 5)
    const criticalTasks = overdue.slice(0, 5).map(d => ({
      id: d.id,
      title: d.title,
      assignedTo: d.assigned_to,
      department: d.department,
      dueDate: normalizeDate(d.due_date),
      status: d.status,
    }));

    // ── 3. ORDER / REVENUE ANALYTICS ──
    const today = new Date(todayStr);
    const todayOrders = allOrders.filter((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString() || "");
      return d === todayStr;
    });
    const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

    // MTD orders — filtered to the selected period
    const mtdOrders = allOrders.filter((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString() || "");
      return d >= mtdStart && d <= mtdEnd;
    });
    const mtdRevenue = mtdOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const mtdDispatched = mtdOrders.filter((o: any) => o.isDispatched).length;
    const mtdOTD = mtdOrders.filter((o: any) => o.isOTD).length;
    const otdRate = mtdDispatched > 0 ? Math.round((mtdOTD / mtdDispatched) * 100) : 0;

    // Delay Aging — all un-dispatched orders
    const undispatched = allOrders.filter((o: any) => !o.isDispatched);
    const delayAging = { gt7: [] as any[], d4to7: [] as any[], d1to3: [] as any[], sameDay: [] as any[] };
    let revenueAtRisk = 0;

    undispatched.forEach((o: any) => {
      const created = new Date(normalizeDate(o.createdAt?.toISOString?.() || o.createdAt || ""));
      const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const entry = { orderNo: o.orderNo, party: o.party, days: diffDays, amount: o.totalAmount || 0 };
      if (diffDays > 7) { delayAging.gt7.push(entry); revenueAtRisk += entry.amount; }
      else if (diffDays >= 4) delayAging.d4to7.push(entry);
      else if (diffDays >= 1) delayAging.d1to3.push(entry);
      else delayAging.sameDay.push(entry);
    });

    // Gap Analysis (Last 10 days)
    const last10DaysStats: Record<string, { totalGapMs: number; count: number; dateStr: string; orders: any[] }> = {};
    for (let i = 0; i < 10; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split("T")[0];
      last10DaysStats[dStr] = { totalGapMs: 0, count: 0, dateStr: dStr, orders: [] };
    }

    allOrders.forEach((o: any) => {
      if (o.isDispatched && o.actual7 && o.targetDateForOTD) {
        const dispatchDateStr = normalizeDate(o.actual7.toISOString());
        if (last10DaysStats[dispatchDateStr]) {
          const gapMs = getWorkingHoursGapMs(o.targetDateForOTD, o.actual7);
          const gapHours = Math.round(gapMs / (1000 * 60 * 60));
          last10DaysStats[dispatchDateStr].totalGapMs += gapMs;
          last10DaysStats[dispatchDateStr].count += 1;
          last10DaysStats[dispatchDateStr].orders.push({
             orderNo: o.orderNo,
             party: o.party,
             gapHours,
             createdAt: o.createdAt ? o.createdAt.toISOString() : null,
             dispatchDate: o.actual7 ? o.actual7.toISOString() : null,
             isReconfirmed: o.isReconfirmed,
             actual4: o.actual4 ? o.actual4.toISOString() : null
          });
        }
      }
    });

    const gapAnalysis = Object.values(last10DaysStats)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
      .map(stat => {
         stat.orders.sort((a, b) => b.gapHours - a.gapHours);
         const totalHours = Math.round(stat.totalGapMs / (1000 * 60 * 60));
         const avgHours = stat.count > 0 ? Math.round(totalHours / stat.count) : 0;
         return {
            date: stat.dateStr,
            totalHours,
            avgHours,
            count: stat.count,
            orders: stat.orders
         };
      });

    // Revenue Target (auto: max monthly revenue from last 12 months)
    const last12MonthsStart = new Date(now);
    last12MonthsStart.setFullYear(last12MonthsStart.getFullYear() - 1);
    const last12MonthsStartStr = last12MonthsStart.toISOString().split("T")[0];

    const monthlyRevMap: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString() || "");
      if (d < last12MonthsStartStr) return;
      const monthKey = d.substring(0, 7); // YYYY-MM
      monthlyRevMap[monthKey] = (monthlyRevMap[monthKey] || 0) + (o.totalAmount || 0);
    });

    const monthlyRevValues = Object.values(monthlyRevMap).filter(v => v > 0);
    const avgMonthlyRev = monthlyRevValues.length > 0
      ? monthlyRevValues.reduce((a, b) => a + b, 0) / monthlyRevValues.length
      : 0;
    const maxMonthlyRev = monthlyRevValues.length > 0 ? Math.max(...monthlyRevValues) : 0;
    // Target = average of avg and max (aspirational but realistic)
    const revenueTarget = Math.round((avgMonthlyRev + maxMonthlyRev) / 2);

    // Prorate target to today
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const proratedTarget = Math.round((revenueTarget / daysInMonth) * dayOfMonth);
    const achievementPct = proratedTarget > 0 ? Math.round((mtdRevenue / proratedTarget) * 100) : 0;
    const revenueGap = Math.max(0, proratedTarget - mtdRevenue);

    // Revenue daily chart (MTD)
    const revenueDailyMap: Record<string, number> = {};
    mtdOrders.forEach((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString() || "");
      revenueDailyMap[d] = (revenueDailyMap[d] || 0) + (o.totalAmount || 0);
    });
    const revenueDailyChart = Object.entries(revenueDailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date: date.slice(5), // MM-DD
        amount,
        target: Math.round(revenueTarget / daysInMonth),
      }));

    // Inactive parties >60 days
    const partyLastOrder: Record<string, string> = {};
    allOrders.forEach((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString?.() || o.createdAt || "");
      if (!partyLastOrder[o.party] || d > partyLastOrder[o.party]) {
        partyLastOrder[o.party] = d;
      }
    });
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];
    const inactiveParties = Object.entries(partyLastOrder)
      .filter(([, lastDate]) => lastDate < sixtyDaysAgoStr)
      .map(([party, lastDate]) => ({ party, lastDate, daysSince: Math.floor((today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)) }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 10);

    // OTD vs Orders monthly trend (last 6 months)
    const trendMap: Record<string, { month: string; orders: number; otd: number; dispatched: number }> = {};
    allOrders.forEach((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString() || "");
      const key = d.substring(0, 7);
      if (!trendMap[key]) trendMap[key] = { month: key, orders: 0, otd: 0, dispatched: 0 };
      trendMap[key].orders++;
      if (o.isDispatched) { trendMap[key].dispatched++; if (o.isOTD) trendMap[key].otd++; }
    });
    const orderOtdTrend = Object.values(trendMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(t => ({
        month: t.month.slice(5) + " " + t.month.slice(2, 4), // MM-YY
        orders: t.orders,
        otdRate: t.dispatched > 0 ? Math.round((t.otd / t.dispatched) * 100) : 0,
      }));

    // ── 5. PARTY PIPELINE & CATEGORY REVENUE ──
    const itemToCategory: Record<string, string> = {};
    allIMS.forEach((i: any) => {
      if (i.item_name && i.category) itemToCategory[i.item_name.trim()] = i.category;
    });

    const categoryRevenueMap: Record<string, number> = {};
    allO2Ds.forEach((item: any) => {
      const created = normalizeDate(item.created_at);
      if (created >= mtdStart && created <= mtdEnd) {
        const cat = itemToCategory[item.item_name?.trim()] || "Other";
        const rev = parseFloat(item.est_amount) || 0;
        categoryRevenueMap[cat] = (categoryRevenueMap[cat] || 0) + rev;
      }
    });

    const categoryRevenue = Object.entries(categoryRevenueMap)
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const partyOrderCount: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      partyOrderCount[o.party] = (partyOrderCount[o.party] || 0) + 1;
    });
    const topPartiesByOrders = Object.entries(partyOrderCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([party, count]) => ({ party, count }));
    const maxPartyCount = topPartiesByOrders[0]?.count || 1;

    const inactiveCount = inactiveParties.length;
    const allPartyNames = Object.keys(partyOrderCount);
    
    // NBD Incoming = New parties added this period
    const nbdIncoming = allOrders.filter((o: any) => {
      const d = normalizeDate(o.createdAt?.toISOString() || "");
      return d >= mtdStart && d <= mtdEnd;
    }).length; // Simplified for demo, usually involves checking if party is new

    // ── 6. IMS INVENTORY ──

    const outOfStock = allIMS.filter((i: any) => (parseFloat(i.stock_qty) || 0) === 0);
    const lowStock = allIMS.filter((i: any) => {
      const qty = parseFloat(i.stock_qty) || 0;
      const reorder = parseFloat(i.reorder_point) || 5;
      return qty > 0 && qty <= reorder;
    });
    const categoryStockMap: Record<string, number> = {};
    allIMS.forEach((i: any) => {
      const cat = i.category || "Other";
      categoryStockMap[cat] = (categoryStockMap[cat] || 0) + (parseFloat(i.stock_qty) || 0);
    });
    const inventoryByCategory = Object.entries(categoryStockMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([category, qty]) => ({ category, qty }));
    const lowStockItems = [...outOfStock, ...lowStock].slice(0, 8).map((i: any) => ({
      sku: i.item_name,
      category: i.category,
      stockLeft: parseFloat(i.stock_qty) || 0,
      status: (parseFloat(i.stock_qty) || 0) === 0 ? "Out of Stock" : "Low",
    }));

    // ── 7. TEAM SCORE SCORECARD ──
    const scorecard = (allUsers as any[]).filter((u: any) => u.status !== "Inactive").map((u: any) => {
      const userDelegations = allDelegations.filter(d => d.assigned_to === u.username);
      const userChecklists = allChecklists.filter((c: any) => c.assigned_to === u.username);
      const totalAssigned = userDelegations.length + userChecklists.length;
      const completedCount = userDelegations.filter(d => d.status === "Completed").length +
        userChecklists.filter((c: any) => c.status === "Completed").length;
      const onTimeCount = [
        ...userDelegations.filter(d => d.status === "Completed").map(d => ({ due: normalizeDate(d.due_date), done: normalizeDate(d.updated_at) })),
        ...userChecklists.filter(c => c.status === "Completed").map(c => ({ due: normalizeDate(c.due_date), done: normalizeDate(c.updated_at) }))
      ].filter(t => t.due && t.done && t.done <= t.due).length;

      const overdueUser = userDelegations.filter(d => {
        const due = normalizeDate(d.due_date);
        return due && due < todayStr && d.status !== "Completed";
      });
      const avgDelayHours = overdueUser.length > 0
        ? Math.round(overdueUser.reduce((sum, d) => {
          const due = new Date(normalizeDate(d.due_date));
          return sum + Math.max(0, (today.getTime() - due.getTime()) / (1000 * 60 * 60));
        }, 0) / overdueUser.length)
        : 0;
      
      // On-time % is (On-Time / Total Assigned) to penalize pending/overdue tasks
      const onTimePct = totalAssigned > 0 ? Math.round((onTimeCount / totalAssigned) * 100) : 0;
      const status = onTimePct >= 80 ? "GOOD" : onTimePct >= 50 ? "WATCH" : "ACT";

      return {
        name: u.username,
        dept: u.department || u.role_name || "",
        assigned: totalAssigned,
        completed: completedCount,
        onTimePct,
        avgDelayHours,
        status,
      };
    }).filter(u => u.assigned > 0).sort((a, b) => b.assigned - a.assigned).slice(0, 10);

    return NextResponse.json({
      generatedAt: now.toISOString(),
      filter: { startDate: mtdStart, endDate: mtdEnd, granularity },
      attendance: {
        total: totalUsers,
        present: presentCount,
        onLeave: onLeaveCount,
        absent: absentCount,
        avgCheckIn: avgCheckInStr,
        lateArrivals,
        presentPct: totalUsers > 0 ? Math.round((presentCount / totalUsers) * 100) : 0,
        presentList: Array.from(checkedInUserIds).map(id => ({ id, name: (allUsers as any[]).find((u: any) => String(u.id) === String(id))?.username || id })),
        onLeaveList: onLeaveToday.map((l: any) => ({ id: l.id, name: (allUsers as any[]).find((u: any) => String(u.id) === String(l.userId))?.username || l.userId, type: l.leaveType })),
        absentList: (allUsers as any[]).filter((u: any) => u.status !== "Inactive" && !checkedInUserIds.has(String(u.id)) && !onLeaveUserIds.has(String(u.id))).map((u: any) => ({ id: u.id, name: u.username }))
      },
      delegations: {
        total,
        completed,
        needRevision,
        overdue: overdue.length,
        pending,
        criticalTasks,
        zeroTaskEmployees,
        overdueList: overdue.map((d: any) => ({ id: d.id, title: d.title, assignedTo: d.assigned_to, due: normalizeDate(d.due_date) })),
        pendingList: allDelegations.filter((d: any) => d.status === "Pending").map((d: any) => ({ id: d.id, title: d.title, assignedTo: d.assigned_to, due: normalizeDate(d.due_date) })),
        needRevisionList: allDelegations.filter((d: any) => d.status === "Need Revision").map((d: any) => ({ id: d.id, title: d.title, assignedTo: d.assigned_to, due: normalizeDate(d.due_date) }))
      },
      orders: {
        todayRevenue,
        mtdRevenue,
        mtdOrders: mtdOrders.length,
        mtdDispatched,
        otdRate,
        delayAging: {
          gt7: { count: delayAging.gt7.length, revenueAtRisk },
          d4to7: { count: delayAging.d4to7.length },
          d1to3: { count: delayAging.d1to3.length },
          sameDay: { count: delayAging.sameDay.length },
          total: undispatched.length,
          agingChart: [
            { label: "Same Day", count: delayAging.sameDay.length },
            { label: "1-3 Days", count: delayAging.d1to3.length },
            { label: "4-7 Days", count: delayAging.d4to7.length },
            { label: ">7 Days", count: delayAging.gt7.length },
          ],
          undispatchedList: undispatched.map((o: any) => ({
            id: o.orderNo,
            party: o.party,
            amount: o.totalAmount,
            date: o.createdAt.toISOString().split('T')[0]
          }))
        },
        topDelayedOrders: delayAging.gt7.slice(0, 5),
        gapAnalysis,
      },
      revenue: {
        mtdActual: mtdRevenue,
        proratedTarget,
        fullMonthTarget: revenueTarget,
        achievementPct,
        gap: revenueGap,
        dailyChart: revenueDailyChart,
      },
      alerts: {
        inactiveParties,
        zeroTaskEmployees,
        overdueTaskCount: overdue.length,
        criticalDelayCount: delayAging.gt7.length,
      },
      charts: {
        orderOtdTrend,
      },
      partyPipeline: {
        topPartiesByOrders,
        maxPartyCount,
        nbdIncoming,
        nbdOutgoing: allOrders.filter((o: any) => normalizeDate(o.createdAt?.toISOString() || "") >= mtdStart && o.isDispatched).length,
        oldParties: allPartyNames.length,
        inactiveCount,
        categoryRevenue,
      },

      inventory: {
        totalSKUs: allIMS.length,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
        inventoryByCategory,
        lowStockItems,
        outOfStockList: outOfStock.map((i: any) => ({ sku: i.item_name, category: i.category, stockLeft: parseFloat(i.stock_qty) || 0 })),
        lowStockList: lowStock.map((i: any) => ({ sku: i.item_name, category: i.category, stockLeft: parseFloat(i.stock_qty) || 0 }))
      },
      scorecard,
    });

  } catch (error: any) {
    console.error("COO Report API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
