import { useMemo } from 'react';
import { DataFeeder } from '@/types/data-feeder';

export type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'custom' | 'all';

export interface AnalyticsFilters {
  dateRange: DateFilter;
  customStart?: string; // YYYY-MM-DD
  customEnd?: string; // YYYY-MM-DD
  week: string; // 'all' or specific week
  month: string; // 'all' or specific month
  employee: string; // 'all' or specific name
  callType: string; // 'all' or specific type
}

// Converts an Excel/Google Sheets serial date (e.g. 46127.00012) to a Date object.
export const excelSerialToDate = (serial: string | number): Date | null => {
  if (!serial) return null;
  const num = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(num)) return null;
  if (num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(serial as string);
  return isNaN(d.getTime()) ? null : d;
};

export const parseDurationToSeconds = (dur: string) => {
  if (!dur) return 0;
  let seconds = 0;
  const hMatch = dur.match(/(\d+)h/);
  const mMatch = dur.match(/(\d+)m/);
  const sMatch = dur.match(/(\d+)s/);
  if (hMatch) seconds += parseInt(hMatch[1]) * 3600;
  if (mMatch) seconds += parseInt(mMatch[1]) * 60;
  if (sMatch) seconds += parseInt(sMatch[1]);
  return seconds;
};

export const formatSecondsToDuration = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const getExcelHour = (callTime: string | number | undefined): number | null => {
  if (!callTime) return null;
  
  if (typeof callTime === 'string') {
    if (callTime.includes(':')) {
      const parts = callTime.split(':');
      let hour = parseInt(parts[0], 10);
      if (!isNaN(hour)) {
        if (callTime.toLowerCase().includes('pm') && hour < 12) hour += 12;
        if (callTime.toLowerCase().includes('am') && hour === 12) hour = 0;
        if (hour >= 0 && hour <= 23) return hour;
      }
    }
  }

  const num = typeof callTime === 'string' ? parseFloat(callTime) : callTime;
  if (isNaN(num)) return null; 
  if (num >= 1 || num < 0) {
    if (num >= 0 && num <= 23 && !String(callTime).includes(':')) return Math.floor(num);
    return null; 
  }
  const totalMinutes = Math.round(num * 24 * 60);
  return Math.floor(totalMinutes / 60); // 0 to 23
};

// Normalizes a phone number to its last 10 digits so formats like "+91",
// "091", spaces/dashes etc. all key the same way.
const normalizeNumber = (num: string | undefined | null): string => {
  const digits = String(num || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export function useCallAnalytics(
  feeders: DataFeeder[],
  filters: AnalyticsFilters,
  partyNameByNumber?: Record<string, string>
) {
  return useMemo(() => {
    // Reverse-lookup table: real party mobile number -> real party name.
    // Callyzer writes a literal "Unknown" (or blank) To Name whenever the
    // customer's number isn't saved in the employee's own phone contacts —
    // the call's real number is still captured correctly, so we can recover
    // the real party name from our own records instead of showing "Unknown".
    const numberLookup: Record<string, string> = {};
    if (partyNameByNumber) {
      Object.entries(partyNameByNumber).forEach(([name, num]) => {
        const key = normalizeNumber(num);
        if (key) numberLookup[key] = name;
      });
    }
    const resolveName = (rawName: string | undefined, rawNumber: string | undefined): string => {
      const name = (rawName || "").trim();
      if (name && name.toLowerCase() !== "unknown") return name;
      const resolved = numberLookup[normalizeNumber(rawNumber)];
      return resolved || "Unknown";
    };

    // 1. Filter Data First
    const todayStart = new Date().setHours(0,0,0,0);
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgo = todayStart - (86400000 * 7);
    const thirtyDaysAgo = todayStart - (86400000 * 30);

    const filteredData = feeders.filter(f => {
      // Employee Filter
      if (filters.employee !== 'all' && f.employeeName !== filters.employee) return false;
      // Type Filter
      if (filters.callType !== 'all' && !f.callType?.toUpperCase().includes(filters.callType.toUpperCase())) return false;

      // Date Filter
      if (filters.dateRange !== 'all') {
        const d = excelSerialToDate(f.callDate);
        if (!d) return false;
        
        let time = d.getTime();
        const normalizedDate = new Date(time);
        normalizedDate.setHours(0,0,0,0);
        time = normalizedDate.getTime();
        
        if (filters.dateRange === 'today' && time < todayStart) return false;
        if (filters.dateRange === 'yesterday' && (time < yesterdayStart || time >= todayStart)) return false;
        if (filters.dateRange === '7days' && time < sevenDaysAgo) return false;
        if (filters.dateRange === '30days' && time < thirtyDaysAgo) return false;
        if (filters.dateRange === 'custom' && filters.customStart && filters.customEnd) {
          const s = new Date(filters.customStart).getTime();
          const e = new Date(filters.customEnd).getTime() + 86400000; // inclusive
          if (time < s || time >= e) return false;
        }
      }

      // Month Filter
      if (filters.month && filters.month !== 'all') {
        const d = excelSerialToDate(f.callDate);
        if (!d) return false;
        const mStr = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().substring(2)}`;
        if (mStr !== filters.month) return false;
      }

      // Week Filter
      if (filters.week && filters.week !== 'all') {
        const d = excelSerialToDate(f.callDate);
        if (!d) return false;
        const d0 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = d0.getUTCDay() || 7;
        d0.setUTCDate(d0.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d0.getUTCFullYear(),0,1));
        const w = Math.ceil((((d0.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        const wStr = `Week ${w} ${d.getFullYear().toString().substring(2)}`;
        if (wStr !== filters.week) return false;
      }

      return true;
    });

    // 2. Variables for Aggregation
    let totalCalls = filteredData.length;
    let totalDurationSecs = 0;
    let callsTodayCount = 0;
    
    let incomingCount = 0;
    let outgoingCount = 0;
    let missedCount = 0;
    let rejectedCount = 0;

    const uniqueCustomers = new Set<string>();
    const uniqueEmployees = new Set<string>();

    const empStatsMap = new Map<string, { calls: number, duration: number, missed: number }>();
    const targetMap = new Map<string, { calls: number, duration: number, incoming: number, outgoing: number, missed: number }>();
    const countryMap = new Map<string, number>();

    // Heatmap [0-23][0-6] 
    const heatMapMatrix: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0));
    const hourCounts = Array(24).fill(0);
    
    // Duration Buckets
    let bucketLt30s = 0;
    let bucket30sTo1m = 0;
    let bucket1mTo5m = 0;
    let bucket5mTo15m = 0;
    let bucketGt15m = 0;

    // Daily Trend
    const dailyMap = new Map<number, { total: number, incoming: number, outgoing: number, missed: number, rejected: number }>();

    // 3. Process Data
    filteredData.forEach(f => {
      const type = (f.callType || "").toUpperCase();
      const durSecs = parseDurationToSeconds(f.duration);
      
      totalDurationSecs += durSecs;
      
      if (type.includes("INCOMING")) incomingCount++;
      else if (type.includes("OUTGOING")) outgoingCount++;
      else if (type.includes("MISSED")) missedCount++;
      else if (type.includes("REJECTED")) rejectedCount++;

      const resolvedToName = resolveName(f.toName, f.toNumber);
      if (resolvedToName && resolvedToName.toLowerCase() !== "unknown") uniqueCustomers.add(resolvedToName.toLowerCase());
      if (f.employeeName) uniqueEmployees.add(f.employeeName);

      // Buckets
      if (durSecs < 30) bucketLt30s++;
      else if (durSecs <= 60) bucket30sTo1m++;
      else if (durSecs <= 300) bucket1mTo5m++;
      else if (durSecs <= 900) bucket5mTo15m++;
      else bucketGt15m++;

      // Maps
      const emp = f.employeeName || "Unknown";
      const eStat = empStatsMap.get(emp) || { calls: 0, duration: 0, missed: 0 };
      eStat.calls++;
      eStat.duration += durSecs;
      if (type.includes("MISSED")) eStat.missed++;
      empStatsMap.set(emp, eStat);

      const tgt = resolvedToName;
      const tStat = targetMap.get(tgt) || { calls: 0, duration: 0, incoming: 0, outgoing: 0, missed: 0 };
      tStat.calls++;
      tStat.duration += durSecs;
      if (type.includes("INCOMING")) tStat.incoming++;
      if (type.includes("OUTGOING")) tStat.outgoing++;
      if (type.includes("MISSED")) tStat.missed++;
      targetMap.set(tgt, tStat);

      const cty = f.countryCode || "Unknown";
      countryMap.set(cty, (countryMap.get(cty) || 0) + 1);

      // Date/Time based logic
      const d = excelSerialToDate(f.callDate);
      if (d) {
        if (d.getTime() >= todayStart) callsTodayCount++;

        const dayTime = new Date(d).setHours(0,0,0,0);
        const dayStats = dailyMap.get(dayTime) || { total: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0 };
        dayStats.total++;
        if (type.includes("INCOMING")) dayStats.incoming++;
        if (type.includes("OUTGOING")) dayStats.outgoing++;
        if (type.includes("MISSED")) dayStats.missed++;
        if (type.includes("REJECTED")) dayStats.rejected++;
        dailyMap.set(dayTime, dayStats);

        const hr = getExcelHour(f.callTime);
        if (hr !== null) {
          hourCounts[hr]++;
          const dayIndex = d.getDay(); // 0 Sun, 1 Mon ... 6 Sat
          heatMapMatrix[hr][dayIndex]++;
        }
      }
    });

    // 4. Derive Insights & Sort Data
    const avgDurationSecs = totalCalls > 0 ? totalDurationSecs / totalCalls : 0;
    
    // Find Peak Hour
    let peakHour = 0;
    let maxHourCount = 0;
    hourCounts.forEach((cnt, hr) => {
      if (cnt > maxHourCount) { maxHourCount = cnt; peakHour = hr; }
    });

    const formatHour = (h: number) => {
      if (h === 0) return '12 AM';
      if (h < 12) return `${h} AM`;
      if (h === 12) return '12 PM';
      return `${h - 12} PM`;
    };

    // Leaderboard & Scoring
    // Score Logic: Max possible per category. 
    // Calls=40, Talk=30, Avg=20, Missed(inverse)=10
    const maxCalls = Math.max(...Array.from(empStatsMap.values()).map(e => e.calls)) || 1;
    const maxDuration = Math.max(...Array.from(empStatsMap.values()).map(e => e.duration)) || 1;
    
    const leaderboard = Array.from(empStatsMap.entries()).map(([name, stats]) => {
      const avgDur = stats.calls > 0 ? stats.duration / stats.calls : 0;
      
      const scoreCalls = (stats.calls / maxCalls) * 40;
      const scoreTalk = (stats.duration / maxDuration) * 30;
      // Let's cap average score (say max ideal is 5 mins = 300s)
      const scoreAvg = Math.min(avgDur / 300, 1) * 20; 
      // Missed: 0 missed = 10 pts, 10%+ missed = 0 pts
      const missedPct = stats.calls > 0 ? stats.missed / stats.calls : 0;
      const scoreMissed = Math.max(0, 10 - (missedPct * 100)); // Roughly

      const rawScore = Math.min(100, Math.round(scoreCalls + scoreTalk + scoreAvg + scoreMissed));
      
      let stars = 0;
      if (rawScore >= 90) stars = 5;
      else if (rawScore >= 75) stars = 4;
      else if (rawScore >= 50) stars = 3;
      else if (rawScore >= 30) stars = 2;
      else stars = 1;

      return {
        name,
        calls: stats.calls,
        duration: stats.duration,
        avgDurStr: formatSecondsToDuration(avgDur),
        missed: stats.missed,
        score: rawScore,
        stars
      };
    }).sort((a, b) => b.calls - a.calls); // Sort by highest calls by default

    // Country Distribution (Map)
    const totalWithCountry = Array.from(countryMap.values()).reduce((a,b)=>a+b, 0);
    const countryDistribution = Array.from(countryMap.entries())
      .map(([code, count]) => ({
        code: code === "Unknown" ? "Others" : (code === "91" ? "India" : (code === "971" ? "UAE" : (code === "1" ? "USA" : `+${code}`))),
        count,
        percent: totalWithCountry > 0 ? Math.round((count / totalWithCountry) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Top Customers
    const topCustomers = Array.from(targetMap.entries())
      .map(([name, stats]) => ({
        name,
        calls: stats.calls,
        incoming: stats.incoming,
        outgoing: stats.outgoing,
        missed: stats.missed,
        durationStr: formatSecondsToDuration(stats.duration)
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    // Daily Trends
    const dailyTrends = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([time, stats]) => {
        const d = new Date(time);
        return {
          date: `${d.getDate()} ${d.toLocaleString('default',{month:'short'})}`,
          total: stats.total,
          incoming: stats.incoming,
          outgoing: stats.outgoing,
          missed: stats.missed,
          rejected: stats.rejected
        };
      });

    // Calculate AI Insights
    const smartInsights: string[] = [];
    if (maxHourCount > 0) smartInsights.push(`⚡ Peak calling time is consistently around ${formatHour(peakHour)} to ${formatHour(peakHour+1)}.`);
    
    // Find highest missed %
    let highestMissedEmp = '';
    let highestMissedPct = 0;
    empStatsMap.forEach((v, k) => {
      if (v.calls > 20) {
        const pct = v.missed / v.calls;
        if (pct > highestMissedPct) { highestMissedPct = pct; highestMissedEmp = k; }
      }
    });
    if (highestMissedPct > 0.15) {
      smartInsights.push(`⚠ Employee ${highestMissedEmp} has a high missed call rate of ${Math.round(highestMissedPct*100)}%.`);
    }

    if (topCustomers.length > 0 && topCustomers[0].calls > 50) {
      smartInsights.push(`🔥 Customer ${topCustomers[0].name} is highly engaged with ${topCustomers[0].calls} calls.`);
    }
    
    if (avgDurationSecs < 60 && totalCalls > 100) {
      smartInsights.push(`📉 The global average call duration is under 1 minute. Many short calls may indicate wrong numbers or low connectivity.`);
    }

    return {
      kpi: {
        totalCalls,
        totalDurationHours: Math.round(totalDurationSecs / 3600),
        avgDurationStr: formatSecondsToDuration(avgDurationSecs),
        activeEmployees: uniqueEmployees.size,
        uniqueCustomers: uniqueCustomers.size,
        incomingPct: totalCalls ? Math.round((incomingCount / totalCalls) * 100) : 0,
        outgoingPct: totalCalls ? Math.round((outgoingCount / totalCalls) * 100) : 0,
        missedPct: totalCalls ? Math.round((missedCount / totalCalls) * 100) : 0,
        callsToday: callsTodayCount,
        peakHour: formatHour(peakHour)
      },
      leaderboard,
      charts: {
        callTypes: [
          { name: 'Outgoing', value: outgoingCount, color: '#10B981' },
          { name: 'Incoming', value: incomingCount, color: '#3B82F6' },
          { name: 'Missed', value: missedCount, color: '#EF4444' },
          { name: 'Rejected', value: rejectedCount, color: '#F59E0B' }
        ].filter(x => x.value > 0),
        durationBuckets: [
          { name: '<30 sec', calls: bucketLt30s },
          { name: '30s-1m', calls: bucket30sTo1m },
          { name: '1m-5m', calls: bucket1mTo5m },
          { name: '5m-15m', calls: bucket5mTo15m },
          { name: '15m+', calls: bucketGt15m }
        ],
        dailyTrends,
        countryDistribution,
        topCustomers
      },
      heatMap: heatMapMatrix,
      insights: smartInsights
    };
  }, [feeders, filters]);
}
