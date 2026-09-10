import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { 
  getScotData, 
  getCallData, 
  getFollowUpData,
  getActivePartyData
} from "@/lib/scot-sheets";
import { getAllO2DsForAnalytics } from "@/lib/o2d-sheets";
import { o2dkbService } from "@/lib/o2dkb-sheets";
import { getDataFeeder } from "@/lib/data-feeder-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function excelSerialToDate(serial: string | number): Date | null {
  if (serial === undefined || serial === null) return null;
  const num = typeof serial === "string" ? parseFloat(serial) : serial;
  if (isNaN(num)) return null;
  if (num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(serial as string);
  return isNaN(d.getTime()) ? null : d;
}

const matchSalesCoordinator = (salesCoordinator: string, employeeName: string): boolean => {
  const sc = (salesCoordinator || "").trim().toLowerCase();
  const emp = (employeeName || "").trim().toLowerCase();
  if (!sc || !emp) return false;
  return emp.includes(sc) || sc.includes(emp);
};

const matchPartyNumber = (toNumber: string, mobileNum: string): boolean => {
  if (!toNumber || !mobileNum) return false;
  const cleanTo = toNumber.replace(/\D/g, "");
  const cleanMobile = mobileNum.replace(/\D/g, "");
  if (!cleanTo || !cleanMobile) return false;
  return cleanTo.endsWith(cleanMobile) || cleanMobile.endsWith(cleanTo);
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const source = searchParams.get("source") || "scot";
  const activeOnly = searchParams.get("activeOnly") === "true";

  // Determine last completed calendar week Monday to Sunday by default
  const today = new Date();
  const currentDay = today.getDay();
  const distanceToLastMonday = (currentDay === 0 ? 7 : currentDay) + 6;

  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - distanceToLastMonday);
  defaultStart.setHours(0, 0, 0, 0);

  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultStart.getDate() + 6);
  defaultEnd.setHours(23, 59, 59, 999);

  const start = startDateStr ? new Date(startDateStr) : defaultStart;
  const end = endDateStr ? new Date(endDateStr) : defaultEnd;

  try {
    let scotFeeder, callsData, followUpData, allO2Ds;

    if (source === "scot-kb") {
      [scotFeeder, followUpData, allO2Ds] = await Promise.all([
        getDataFeeder(),
        getFollowUpData("scot-kb"),
        o2dkbService.getAll()
      ]);

      // Mock callsData for scot-kb to act as the master party list since it lacks a Target sheet
      const uniqueParties = new Map<string, any>();
      
      allO2Ds.forEach(o => {
        const name = (o.party_name || "").trim();
        if (name && !uniqueParties.has(name.toLowerCase())) {
          uniqueParties.set(name.toLowerCase(), { partyName: name, mobileNum: o.party_number || "", salesCoordinator: "charanpreet kaur" });
        }
      });
      
      scotFeeder.forEach(f => {
        const name = (f.toName || "").trim();
        if (name && uniqueParties.has(name.toLowerCase())) {
          const existing = uniqueParties.get(name.toLowerCase());
          if (existing && !existing.salesCoordinator && f.employeeName) {
            existing.salesCoordinator = f.employeeName;
          }
        }
      });

      callsData = Array.from(uniqueParties.values());

    } else {
      const [scotFeederResult, followUpResult, allO2DsResult, activePartyResult] = await Promise.all([
        getScotData(),
        getFollowUpData("scot"),
        getAllO2DsForAnalytics(),
        getActivePartyData("scot"),
      ]);
      scotFeeder = scotFeederResult;
      followUpData = followUpResult;
      allO2Ds = allO2DsResult;

      const activePartySet = new Set(
        activePartyResult
          .filter((record) => record.active)
          .map((record) => record.partyName.toLowerCase().trim())
      );

      // Mock callsData for scot to act as the master party list since we are ignoring the Target sheet
      const uniqueParties = new Map<string, any>();
      
      allO2Ds.forEach(o => {
        const name = (o.party_name || "").trim();
        if (name && !uniqueParties.has(name.toLowerCase())) {
          uniqueParties.set(name.toLowerCase(), { partyName: name, mobileNum: (o as any).party_number || "", salesCoordinator: "UZEFA" });
        }
      });
      
      scotFeeder.forEach(f => {
        const name = (f.toName || "").trim();
        let empName = (f.employeeName || "UZEFA").trim();
        if (empName.toLowerCase() === "uzefa (sc)") empName = "UZEFA";
        
        if (name && uniqueParties.has(name.toLowerCase())) {
          const existing = uniqueParties.get(name.toLowerCase());
          if (existing) {
            let currentSc = (existing.salesCoordinator || "UZEFA").trim();
            if (currentSc.toLowerCase() === "uzefa (sc)") currentSc = "UZEFA";
            if (currentSc === "UZEFA" && empName !== "UZEFA") {
              existing.salesCoordinator = empName;
            } else {
              existing.salesCoordinator = currentSc;
            }
          }
        }
      });

      callsData = Array.from(uniqueParties.values());

      if (activeOnly) {
        callsData = callsData.filter((party) =>
          activePartySet.has((party.partyName || "").toLowerCase().trim())
        );
      }
    }

    // 1. Filter calls & follow-ups in the requested date range
    const rangeCalls = scotFeeder.filter(call => {
      const dateObj = excelSerialToDate(call.callDate);
      if (!dateObj) return false;
      return dateObj >= start && dateObj <= end;
    });

    const rangeFollowUps = followUpData.filter(fu => {
      if (!fu.createdAt) return false;
      const dateObj = new Date(fu.createdAt);
      if (isNaN(dateObj.getTime())) return false;
      return dateObj >= start && dateObj <= end;
    });

    // 2. Pre-calculate O2D metrics for Dashboard Party Analysis
    const currentMonthStr = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    const o2dGroupedByParty: Record<string, any[]> = {};
    allO2Ds.forEach(o => {
      const key = (o.party_name || "").trim().toLowerCase();
      if (!key) return;
      if (!o2dGroupedByParty[key]) o2dGroupedByParty[key] = [];
      o2dGroupedByParty[key].push(o);
    });

    // Map partyName -> latest followUp record
    const latestFollowUps = followUpData.reduce((acc, curr) => {
      if (!curr.partyName) return acc;
      const key = curr.partyName.trim().toLowerCase();
      const existing = acc[key];
      if (!existing || new Date(curr.createdAt) > new Date(existing.createdAt)) {
        acc[key] = curr;
      }
      return acc;
    }, {} as Record<string, any>);

    const partyAnalysis: Record<string, any> = {};
    callsData.forEach(call => {
      const key = (call.partyName || "").trim().toLowerCase();
      if (!key) return;

      const pO2Ds = o2dGroupedByParty[key] || [];
      const monthOrderSets: Record<string, Set<string>> = {};

      const uniqueOrderNos = Array.from(new Set(pO2Ds.map(o => (o.order_no || "").trim()).filter(Boolean)));
      
      const orderFirstDates = (uniqueOrderNos as string[])
        .map(no => {
          const rows = pO2Ds.filter((o: any) => (o.order_no || '').trim() === no);
          const dates = rows.map((o: any) => new Date(o.created_at)).filter(d => !isNaN(d.getTime()));
          return dates.length ? dates.reduce((a, b) => a < b ? a : b) : null;
        })
        .filter(Boolean) as Date[];
      orderFirstDates.sort((a, b) => a.getTime() - b.getTime());

      const lastOrderDate = orderFirstDates.length > 0
        ? orderFirstDates[orderFirstDates.length - 1].toISOString().split('T')[0]
        : "";

      pO2Ds.forEach((o: any) => {
        const orderNo = (o.order_no || "").trim();
        if (!orderNo) return;
        const d = new Date(o.created_at);
        if (isNaN(d.getTime())) return;
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthOrderSets[monthKey]) monthOrderSets[monthKey] = new Set();
        monthOrderSets[monthKey].add(orderNo);
      });

      const currentMonthCount = monthOrderSets[currentMonthStr]?.size || 0;
      const monthlyUniqueCounts = Object.values(monthOrderSets).map(s => s.size);
      
      const activeMonths = monthlyUniqueCounts.length;
      const totalDedupedOrders = monthlyUniqueCounts.reduce((a, b) => a + b, 0);
      
      const monthlyPlanned = activeMonths > 0 ? Math.max(1, Math.round(totalDedupedOrders / activeMonths)) : 1;
      const actualMonth = currentMonthCount;
      const remainingMonth = Math.max(0, monthlyPlanned - actualMonth);
      const weeklyPlanned = Math.round(monthlyPlanned / 4);
      
      let actualWeek = 0;
      orderFirstDates.forEach(d => {
        if (d >= start && d <= end) {
          actualWeek++;
        }
      });
      
      const remainingWeek = Math.max(0, weeklyPlanned - actualWeek);

      // Latest follow up next date
      const latestNextDate = latestFollowUps[key]?.nextFollowUpDate || "";

      partyAnalysis[key] = {
        monthlyPlanned,
        actualMonth,
        remainingMonth,
        weeklyPlanned,
        actualWeek,
        remainingWeek,
        lastOrderDate,
        latestNextDate
      };
    });

    // 3. Normalize empty sales coordinators to 'UZEFA'
    callsData.forEach(c => {
      if (!c.salesCoordinator || !c.salesCoordinator.trim()) {
        c.salesCoordinator = "UZEFA";
      }
    });

    const salesCoordinatorNames = Array.from(
      new Set(
        callsData
          .map(c => c.salesCoordinator.trim())
          .filter(name => name.length > 0)
      )
    );

    // 4. Gather detailed metrics for each sales coordinator
    const reportData = salesCoordinatorNames.map(salesCoordinatorName => {
      const personParties = callsData.filter(c => 
        c.salesCoordinator && c.salesCoordinator.trim().toLowerCase() === salesCoordinatorName.toLowerCase()
      );

      // Data Feeder logs matching this coordinator name (fuzzy match)
      const personFeederCalls = rangeCalls.filter(c => 
        matchSalesCoordinator(salesCoordinatorName, c.employeeName)
      );

      const partiesMetrics = personParties.map(party => {
        const partyKey = (party.partyName || "").trim().toLowerCase();
        
        // Follow-ups in the last week
        const partyWeekFollowUps = rangeFollowUps.filter(fu => 
          fu.partyName && fu.partyName.trim().toLowerCase() === partyKey
        );

        // Call attempts in data feeder in last week matching either employee name or party phone number
        const partyWeekFeederCalls = rangeCalls.filter(c => 
          matchSalesCoordinator(salesCoordinatorName, c.employeeName) && 
          matchPartyNumber(c.toNumber, party.mobileNum)
        );

        const latestStatus = latestFollowUps[partyKey]?.status || "Pending";
        const latestNextDate = latestFollowUps[partyKey]?.nextFollowUpDate || "";

        const statusCounts = partyWeekFollowUps.reduce((acc, curr) => {
          const status = curr.status || "Pending";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Determine if a follow-up was planned for last week
        let isPlanned = false;
        const partyFollowUps = followUpData
          .filter(fu => fu.partyName && fu.partyName.trim().toLowerCase() === partyKey)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const beforeLastWeekFUs = partyFollowUps.filter(fu => fu.createdAt && new Date(fu.createdAt) < start);
        if (beforeLastWeekFUs.length > 0) {
          const lastFU = beforeLastWeekFUs[beforeLastWeekFUs.length - 1];
          if (lastFU.nextFollowUpDate) {
            const nextDate = new Date(lastFU.nextFollowUpDate);
            if (!isNaN(nextDate.getTime()) && nextDate >= start && nextDate <= end) {
              isPlanned = true;
            }
          }
        } else {
          const info = partyAnalysis[partyKey] || {};
          if (info.lastOrderDate) {
            const freq = parseInt(party.frequencyOfCallingAfterOrderPlaced) || 30;
            const orderTime = new Date(info.lastOrderDate).getTime();
            if (!isNaN(orderTime)) {
              const calcDate = new Date(orderTime + freq * 24 * 60 * 60 * 1000);
              if (calcDate >= start && calcDate <= end) {
                isPlanned = true;
              }
            }
          }
        }

        const info = partyAnalysis[partyKey] || {};
        if (!isPlanned && info.latestNextDate) {
          const currentNext = new Date(info.latestNextDate);
          if (!isNaN(currentNext.getTime()) && currentNext >= start && currentNext <= end) {
            isPlanned = true;
          }
        }

        return {
          partyName: party.partyName,
          firmName: party.firmName,
          concernPerson: party.concernPerson,
          mobileNum: party.mobileNum,
          customerType: party.customerType,
          creditDaysNew: party.creditDaysNew,
          limit: party.limit,
          collectionRating: party.collectionRating,
          averageOrderSize: party.averageOrderSize,
          salesPerson: party.salesPerson,
          isPlanned,
          
          // Weekly direct call attempts
          feederCallAttemptsCount: partyWeekFeederCalls.length,
          feederCalls: partyWeekFeederCalls,

          // Weekly follow-up attempts & status
          followUpAttemptsCount: partyWeekFollowUps.length,
          followUpAttempts: partyWeekFollowUps,
          statusCounts,

          // All-time status
          latestStatus,
          latestNextDate,

          // Dashboard order analysis
          dashboard: partyAnalysis[partyKey] || {
            monthlyPlanned: 0,
            actualMonth: 0,
            remainingMonth: 0,
            weeklyPlanned: 0,
            actualWeek: 0,
            remainingWeek: 0
          }
        };
      });

      // Aggregate totals for the coordinator
      const totalParties = partiesMetrics.length;
      const totalDirectCalls = personFeederCalls.length;
      const directCallsIncoming = personFeederCalls.filter(c => (c.callType || "").toLowerCase() === "incoming").length;
      const directCallsOutgoing = personFeederCalls.filter(c => (c.callType || "").toLowerCase() === "outgoing").length;
      const directCallsMissed = personFeederCalls.filter(c => (c.callType || "").toLowerCase() === "missed").length;
      const directCallsRejected = personFeederCalls.filter(c => (c.callType || "").toLowerCase() === "rejected").length;

      const totalFollowUpAttempts = partiesMetrics.reduce((sum, p) => sum + p.followUpAttemptsCount, 0);

      // Score Metrics
      const plannedFollowUps = partiesMetrics.filter(p => p.isPlanned).length;
      const actualFollowUps = partiesMetrics.filter(p => p.followUpAttemptsCount > 0 || p.feederCallAttemptsCount > 0).length;
      const followUpScore = plannedFollowUps > 0 
        ? Math.min(100, Math.round((actualFollowUps / plannedFollowUps) * 100)) 
        : 100;

      // Follow up status summary
      const aggregatedStatusCounts: Record<string, number> = {
        "Order Won": 0,
        "Order Lost": 0,
        "Not Answered": 0,
        "Call Later": 0
      };

      partiesMetrics.forEach(p => {
        Object.entries(p.statusCounts).forEach(([status, count]) => {
          aggregatedStatusCounts[status] = (aggregatedStatusCounts[status] || 0) + count;
        });
      });

      // Weekly order target summary
      const totalWeeklyPlanned = partiesMetrics.reduce((sum, p) => sum + p.dashboard.weeklyPlanned, 0);
      const totalWeeklyActual = partiesMetrics.reduce((sum, p) => sum + p.dashboard.actualWeek, 0);

      return {
        salesCoordinator: salesCoordinatorName,
        totalParties,
        totalDirectCalls,
        directCallsIncoming,
        directCallsOutgoing,
        directCallsMissed,
        directCallsRejected,
        feederCalls: personFeederCalls,
        totalFollowUpAttempts,
        plannedFollowUps,
        actualFollowUps,
        followUpScore,
        statusCounts: aggregatedStatusCounts,
        totalWeeklyPlanned,
        totalWeeklyActual,
        parties: partiesMetrics
      };
    });

    return NextResponse.json({
      dateRange: {
        from: start.toISOString().split("T")[0],
        to: end.toISOString().split("T")[0]
      },
      report: reportData
    });

  } catch (error: any) {
    console.error("GET /api/scot/report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
