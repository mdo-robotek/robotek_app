import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  PieChart,
  Pie,
  ReferenceLine,
} from "recharts";

import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ClockIcon,
  ArchiveBoxIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import DrillDownModal, { DrillDownColumn } from "./DrillDownModal";

interface CooReportProps {
  data: any;
  loading: boolean;
}

export default function CooReport({ data: coo, loading }: CooReportProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedGapTile, setSelectedGapTile] = useState<any | null>(null);
  const [drillDownModal, setDrillDownModal] = useState<{ isOpen: boolean, title: string, columns: DrillDownColumn[], data: any[] }>({
    isOpen: false, title: "", columns: [], data: []
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const chartTextColor = isDark ? "#ffffff" : "#9ca3af";
  const chartGridColor = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.05)";
  const chartAxisLineColor = isDark ? "rgba(255, 255, 255, 0.2)" : "#e2e8f0";
  const chartLineColor = isDark ? "#ffffff" : "#6366f1";

  if (loading && !coo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ArrowPathIcon className="w-12 h-12 animate-spin text-[#003875] dark:text-[#FFD500]" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Synchronizing Command Center...</p>
      </div>
    );
  }

  if (!coo) return null;

  const att = coo.attendance || {};
  const del = coo.delegations || {};
  const ord = coo.orders || {};
  const rev = coo.revenue || {};
  const alerts = coo.alerts || {};
  const charts = coo.charts || {};
  const pipe = coo.partyPipeline || {};
  const inv = coo.inventory || {};
  const scorecard = coo.scorecard || [];

  const fmtAmount = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
    return `₹${Math.round(n)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "GOOD": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "WATCH": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "ACT": return "text-red-500 bg-red-500/10 border-red-500/20";
      default: return "text-gray-500 bg-gray-500/10 border-gray-500/20";
    }
  };

  const filter = coo.filter || {};
  const periodLabel = filter.startDate && filter.endDate
    ? `${filter.startDate} → ${filter.endDate}`
    : new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-[#003875] dark:bg-navy-900 text-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <ArrowTrendingUpIcon className="w-6 h-6 text-[#FFD500]" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">COO Command Center <span className="text-[10px] bg-[#FFD500] text-[#003875] px-2 py-0.5 rounded-full ml-2">v2.0</span></h2>
              <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] mt-1 font-bold">
                Robotek Enterprise Intelligence Engine &nbsp;·&nbsp; Period: <span className="text-[#FFD500]">{periodLabel}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="hidden md:flex flex-col items-end">
             <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Last Sync</p>
             <p className="text-xs font-black text-[#FFD500]">{new Date(coo.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
          <div className="h-10 w-px bg-white/10" />
          {loading ? (
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-[10px] font-black uppercase border border-white/10">
              <ArrowPathIcon className="w-3 h-3 animate-spin" /> Syncing
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-4 py-2 text-[10px] font-black uppercase text-emerald-400">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> Live
            </div>
          )}
        </div>
        {/* Background Decal */}
        <div className="absolute top-0 right-0 opacity-5 -mr-12 -mt-12">
            <ArrowTrendingUpIcon className="w-64 h-64" />
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Today's Revenue", value: fmtAmount(ord.todayRevenue || 0), sub: `MTD: ${fmtAmount(rev.mtdActual || 0)}`, icon: CurrencyDollarIcon, color: "text-blue-500", border: "border-t-blue-500" },
          { label: "Orders (MTD)", value: ord.mtdOrders?.toLocaleString() || 0, sub: `${ord.mtdDispatched || 0} Dispatched`, icon: ShoppingBagIcon, color: "text-emerald-500", border: "border-t-emerald-500" },
          { label: "OTD % (On-Time)", value: `${ord.otdRate || 0}%`, sub: `Critical Target: 85%`, icon: ClockIcon, color: ord.otdRate >= 85 ? "text-emerald-500" : "text-red-500", border: ord.otdRate >= 85 ? "border-t-emerald-500" : "border-t-red-500" },
          { label: "Delayed Orders", value: ord.delayAging?.total || 0, sub: `${fmtAmount(ord.delayAging?.gt7?.revenueAtRisk || 0)} at risk`, icon: ExclamationTriangleIcon, color: "text-amber-500", border: "border-t-amber-500", onClick: () => setDrillDownModal({ isOpen: true, title: "Delayed Orders", data: ord.delayAging?.undispatchedList || [], columns: [{ key: 'id', label: 'Order No' }, { key: 'party', label: 'Party' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', render: (item: any) => `₹${item.amount.toLocaleString()}` }] }) },
          { label: "Team Miss Score", value: `${(() => { const w = scorecard.reduce((a: number, u: any) => a + (u.assigned || 0), 0); const s = scorecard.reduce((a: number, u: any) => a + (u.missPct ?? 0) * (u.assigned || 0), 0); return w ? Math.round(s / w) : 0; })()}%`, sub: `${scorecard.filter((u: any) => (u.missPct ?? 0) === 0).length}/${scorecard.length} members at 0% target`, icon: ClipboardDocumentCheckIcon, color: "text-violet-500", border: "border-t-violet-500" },
          { label: "Team Present", value: `${att.present || 0}/${att.total || 0}`, sub: `${att.absent || 0} Absent · ${att.onLeave || 0} Leave`, icon: UsersIcon, color: "text-indigo-500", border: "border-t-indigo-500", onClick: () => setDrillDownModal({ isOpen: true, title: "Team Attendance", data: [...(att.presentList || []).map((x: any) => ({ ...x, status: 'Present' })), ...(att.absentList || []).map((x: any) => ({ ...x, status: 'Absent' })), ...(att.onLeaveList || []).map((x: any) => ({ ...x, status: `On Leave (${x.type})` }))], columns: [{ key: 'id', label: 'Employee ID' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }] }) },
        ].map((kpi, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.05 }}
            key={i} 
            onClick={kpi.onClick}
            className={`bg-white dark:bg-navy-800 border border-gray-100 dark:border-white/5 border-t-4 ${kpi.border} rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all group ${kpi.onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.15em]">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
            </div>
            <p className={`text-2xl font-black ${kpi.color} tracking-tighter`}>{kpi.value}</p>
            <div className="mt-2 pt-2 border-t border-gray-50 dark:border-white/5">
              <p className="text-[10px] font-bold text-gray-400">{kpi.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* DISPATCH GAP ANALYSIS */}
      {ord.gapAnalysis && ord.gapAnalysis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {[...ord.gapAnalysis].reverse().map((gap: any, i: number) => {
            let label = gap.date;
            try {
              const dateObj = new Date(gap.date);
              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);
              
              if (gap.date === today.toISOString().split('T')[0]) {
                label = "Today";
              } else if (gap.date === yesterday.toISOString().split('T')[0]) {
                label = "Yesterday";
              } else {
                label = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              }
            } catch (e) {}

            const tileColors = [
              "from-slate-400 to-slate-500",
              "from-cyan-400 to-cyan-500",
              "from-sky-400 to-sky-500",
              "from-blue-400 to-blue-500",
              "from-indigo-400 to-indigo-500",
              "from-violet-400 to-violet-500",
              "from-purple-400 to-purple-500",
              "from-fuchsia-400 to-fuchsia-500",
              "from-pink-400 to-pink-500",
              "from-rose-500 to-red-500" // Today
            ];

            const formatTime = (h: number, spanClass: string) => {
              if (h >= 24) {
                const d = Math.floor(h / 24);
                const rh = h % 24;
                return rh > 0 
                  ? <>{d}<span className={spanClass}>d</span> {rh}<span className={spanClass}>h</span></>
                  : <>{d}<span className={spanClass}>d</span></>;
              }
              return <>{h}<span className={spanClass}>h</span></>;
            };

            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: i * 0.05 }}
                key={i} 
                onClick={() => setSelectedGapTile(gap)}
                className={`bg-gradient-to-br ${tileColors[i] || "from-gray-400 to-gray-500"} rounded-2xl p-3 shadow-xl hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all text-center flex flex-col justify-center text-white ring-1 ring-white/20`}
              >
                <p className="text-[11px] font-black uppercase tracking-widest mb-1 text-white/90">{label}</p>
                <p className="text-3xl lg:text-4xl font-black tracking-tighter drop-shadow-md">{formatTime(gap.avgHours, "text-sm lg:text-lg opacity-80")}</p>
                <div className="mt-2 pt-2 border-t border-white/20 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/90">{gap.count} Orders</span>
                  <span className="text-[10px] font-black uppercase text-white drop-shadow-sm">{formatTime(gap.totalHours, "opacity-80")} total</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* SECOND ROW: ALERTS + VELOCITY + PERF TREND */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Action Required */}
        <div className="lg:col-span-3 bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              Action Required
            </h3>
            <span className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-black px-3 py-1 rounded-full border border-red-100 dark:border-red-500/20">
              {(del.overdue || 0) + (ord.delayAging?.gt7?.count || 0) + (alerts.inactiveParties?.length || 0)} OPEN
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {(ord.delayAging?.gt7?.count || 0) > 0 && (
              <div 
                className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 cursor-pointer hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                onClick={() => setDrillDownModal({ isOpen: true, title: "Critical Delayed Orders (>7 Days)", data: (ord.delayAging?.undispatchedList || []).filter((o: any) => { const diff = (new Date().getTime() - new Date(o.date).getTime())/(1000*3600*24); return diff > 7; }), columns: [{ key: 'id', label: 'Order No' }, { key: 'party', label: 'Party' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', render: (item: any) => `₹${item.amount.toLocaleString()}` }] })}
              >
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Critical · Orders</p>
                <p className="text-sm font-black text-gray-800 dark:text-white mt-1">{ord.delayAging.gt7.count} orders delayed &gt;7 days</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1">{fmtAmount(ord.delayAging.gt7.revenueAtRisk)} at risk · Escalate immediately</p>
              </div>
            )}
            {(del.zeroTaskEmployees?.length || 0) > 0 && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-4">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Critical · Team</p>
                <p className="text-sm font-black text-gray-800 dark:text-white mt-1">{del.zeroTaskEmployees.length} members: 0 tasks MTD</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 truncate">{del.zeroTaskEmployees.slice(0, 3).join(", ")} ...</p>
              </div>
            )}
            {(del.overdue || 0) > 0 && (
              <div 
                className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-2xl p-4 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                onClick={() => setDrillDownModal({ isOpen: true, title: "Overdue Tasks", data: del.overdueList || [], columns: [{ key: 'id', label: 'Task ID' }, { key: 'title', label: 'Title' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'due', label: 'Due Date' }] })}
              >
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Warning · Delegations</p>
                <p className="text-sm font-black text-gray-800 dark:text-white mt-1">{del.overdue} tasks overdue</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1">{del.needRevision || 0} need revision · {del.pending || 0} pending</p>
              </div>
            )}
            {(alerts.inactiveParties?.length || 0) > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Info · CRM</p>
                <p className="text-sm font-black text-gray-800 dark:text-white mt-1">{alerts.inactiveParties.length} parties inactive &gt;60 days</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1">Assign reactivation calls to sales team</p>
              </div>
            )}
          </div>
        </div>

        {/* Order Velocity & OTD% */}
        <div className="lg:col-span-5 bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">📦 Order Velocity & OTD %</h3>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-gray-400"><div className="w-2 h-2 bg-[#6366f1] rounded" /> Orders</div>
               <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-gray-400"><div className="w-2 h-2 bg-red-500 rounded" /> OTD %</div>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 font-bold mb-6">Monthly dispatched volume vs on-time delivery accuracy</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts.orderOtdTrend || []} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor, fontWeight: 700 }} />
                <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#ef4444" }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', background: isDark ? '#1e293b' : '#1e293b', color: '#fff' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                />
                <Bar yAxisId="l" dataKey="orders" fill={isDark ? "#818cf8" : "#6366f1"} radius={[6, 6, 0, 0]} barSize={32}>
                  { (charts.orderOtdTrend || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fillOpacity={index === (charts.orderOtdTrend?.length - 1) ? 1 : 0.4} />
                  ))}
                </Bar>
                <Line yAxisId="r" type="monotone" dataKey="otdRate" stroke="#ef4444" strokeWidth={4} dot={{ r: 6, fill: "#ef4444", strokeWidth: 3, stroke: isDark ? "#1e293b" : "#fff" }} />
                <ReferenceLine yAxisId="r" y={85} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Target 85%', position: 'insideRight', fill: '#10b981', fontSize: 8, fontWeight: 900 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Performance Trend */}
        <div className="lg:col-span-4 bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">📈 Team Performance Trend</h3>
            <span className="bg-red-50 text-red-500 text-[10px] font-black px-2 py-0.5 rounded-full">-34% AVG</span>
          </div>
          <p className="text-[10px] text-gray-400 font-bold mb-6">Weekly combined score & on-time accuracy across all modules</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.orderOtdTrend || []} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} domain={[-110, 20]} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }} />
                <Line type="monotone" dataKey="otdRate" stroke={isDark ? "#ffffff" : "#f59e0b"} strokeWidth={4} dot={{ r: 5, fill: isDark ? "#ffffff" : "#f59e0b" }} name="Combined Score" />
                <Line type="monotone" dataKey="orders" stroke={isDark ? "#ffffff" : "#3b82f6"} strokeWidth={4} strokeDasharray={isDark ? "5 5" : undefined} dot={{ r: 5, fill: isDark ? "#ffffff" : "#3b82f6" }} name="On-Time Rate" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* THIRD ROW: REVENUE vs TARGET + DELAY AGING + TEAM TODAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue vs Target */}
        <div className="lg:col-span-5 bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">💰 Revenue vs Target</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-bold mb-6">Daily actual revenue vs cumulative target pace</p>
          <div className="h-[220px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rev.dailyChart || []} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} hide />
                <Tooltip 
                  formatter={(v: any) => fmtAmount(v)}
                  contentStyle={{ borderRadius: '16px', border: 'none', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }}
                />
                <Line type="monotone" dataKey="amount" stroke={isDark ? "#ffffff" : "#22c55e"} strokeWidth={5} dot={{ r: 6, fill: isDark ? "#ffffff" : "#22c55e", stroke: isDark ? "#1e293b" : "#fff", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="target" stroke={chartTextColor} strokeWidth={2} strokeDasharray="8 8" dot={false} opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-auto">
            {[
              { label: "MTD Actual", value: fmtAmount(rev.mtdActual || 0), color: "text-emerald-500" },
              { label: "MTD Target", value: fmtAmount(rev.proratedTarget || 0), color: "text-gray-400" },
              { label: "Achievement", value: `${rev.achievementPct || 0}%`, color: rev.achievementPct >= 80 ? "text-emerald-500" : "text-amber-500" },
              { label: "Gap", value: fmtAmount(rev.gap || 0), color: "text-amber-500" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className={`text-xl font-black ${s.color} tracking-tighter`}>{s.value}</p>
                <p className="text-[8px] font-black text-gray-400 uppercase mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Delay Aging Analysis */}
        <div className="lg:col-span-4 bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">⏱ Delay Aging Analysis</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase">{ord.delayAging?.total || 0} TOTAL</p>
          </div>
          <p className="text-[10px] text-gray-400 font-bold mb-6">Prioritize oldest delayed orders first for revenue clearance</p>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={ord.delayAging?.agingChart || []} margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', background: isDark ? '#1e293b' : '#1e293b', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  { (ord.delayAging?.agingChart || []).map((entry: any, index: number) => {
                    const colors = isDark 
                      ? ["#818cf8", "#fbbf24", "#fb923c", "#f87171"]
                      : ["#6366f1", "#eab308", "#f59e0b", "#ef4444"];
                    return <Cell key={`cell-${index}`} fill={colors[index]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-6">
            {[
              { label: ">7 DAYS", count: ord.delayAging?.gt7?.count || 0, color: "text-red-500", sub: "Escalate NOW" },
              { label: "4-7 DAYS", count: ord.delayAging?.d4to7?.count || 0, color: "text-amber-500", sub: "Priority Fix" },
              { label: "1-3 DAYS", count: ord.delayAging?.d1to3?.count || 0, color: "text-yellow-500", sub: "Monitor" },
              { label: "SAME DAY", count: ord.delayAging?.sameDay?.count || 0, color: "text-indigo-500", sub: "In Process" },
            ].map((b, i) => (
              <div key={i} className="text-center p-2 bg-gray-50 dark:bg-white/5 rounded-2xl">
                <p className={`text-xl font-black ${b.color} tracking-tighter`}>{b.count}</p>
                <p className="text-[8px] font-black text-gray-400 uppercase mt-1">{b.label}</p>
                <p className="text-[7px] font-bold text-gray-400/60 uppercase">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Today */}
        <div className="lg:col-span-3 bg-white dark:bg-navy-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5 flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white mb-6">👥 Team Today</h3>
          <div className="flex justify-center mb-6">
            <div className="relative w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Present", value: att.present || 0, color: "#22c55e" },
                      { name: "Absent", value: att.absent || 0, color: "#ef4444" },
                      { name: "Leave", value: att.onLeave || 0, color: "#f59e0b" },
                    ]}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {[
                      { name: "Present", value: att.present || 0, color: "#22c55e" },
                      { name: "Absent", value: att.absent || 0, color: "#ef4444" },
                      { name: "Leave", value: att.onLeave || 0, color: "#f59e0b" },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-black tracking-tighter">{att.presentPct || 0}%</p>
                <p className="text-[10px] font-black text-gray-400 uppercase">Present</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-auto">
             {[
               { label: "Present", value: att.present || 0, color: "text-emerald-500", dot: "bg-emerald-500" },
               { label: "Absent (Unauth.)", value: att.absent || 0, color: "text-red-500", dot: "bg-red-500" },
               { label: "On Leave (Appr.)", value: att.onLeave || 0, color: "text-amber-500", dot: "bg-amber-500" },
               { label: "Avg Check-in", value: att.avgCheckIn || "N/A", color: "text-indigo-400", dot: "bg-indigo-400" },
               { label: "Late Arrivals", value: att.lateArrivals || 0, color: "text-amber-500", dot: "bg-amber-500" },
             ].map((r, i) => (
               <div key={i} className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
                   <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{r.label}</p>
                 </div>
                 <p className={`text-sm font-black ${r.color}`}>{r.value}</p>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* FOURTH ROW: DELEGATIONS + INVENTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Delegations Overview */}
        <div className="lg:col-span-6 bg-white dark:bg-navy-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">📋 Delegations Overview</h3>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{del.total || 0} TOTAL TASKS</p>
          </div>
          <p className="text-[10px] text-gray-400 font-bold mb-6 uppercase">Task Pipeline Status</p>
          {/* Pipeline Bar */}
          <div className="mb-8">
            <div className="flex h-3 rounded-full overflow-hidden gap-1 mb-4 bg-gray-50 dark:bg-white/5 p-0.5">
              <div className="bg-emerald-500 transition-all duration-1000" style={{ flex: del.completed || 0 }} />
              <div className="bg-red-500 transition-all duration-1000" style={{ flex: del.overdue || 0 }} />
              <div className="bg-amber-500 transition-all duration-1000" style={{ flex: del.needRevision || 0 }} />
              <div className="bg-blue-400 transition-all duration-1000" style={{ flex: del.pending || 0 }} />
              <div className="bg-indigo-400 transition-all duration-1000" style={{ flex: (del.total || 0) - (del.completed || 0) - (del.overdue || 0) - (del.needRevision || 0) - (del.pending || 0) }} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { label: "Completed", value: del.completed || 0, color: "bg-emerald-500" },
                { label: "Overdue", value: del.overdue || 0, color: "bg-red-500" },
                { label: "Need Revision", value: del.needRevision || 0, color: "bg-amber-500" },
                { label: "Pending", value: del.pending || 0, color: "bg-blue-400" },
                { label: "Planned", value: Math.max(0, (del.total || 0) - (del.completed || 0) - (del.overdue || 0) - (del.needRevision || 0) - (del.pending || 0)), color: "bg-indigo-400" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <p className="text-[10px] font-black text-gray-400 uppercase">{s.label} <span className="text-gray-900 dark:text-white ml-1">{s.value}</span></p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Completed", value: del.completed || 0, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Overdue", value: del.overdue || 0, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20 hover:bg-red-500/20 cursor-pointer", icon: true, onClick: () => setDrillDownModal({ isOpen: true, title: "Overdue Tasks", data: del.overdueList || [], columns: [{ key: 'id', label: 'Task ID' }, { key: 'title', label: 'Title' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'due', label: 'Due Date' }] }) },
              { label: "Need Revision", value: del.needRevision || 0, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 cursor-pointer", onClick: () => setDrillDownModal({ isOpen: true, title: "Needs Revision", data: del.needRevisionList || [], columns: [{ key: 'id', label: 'Task ID' }, { key: 'title', label: 'Title' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'due', label: 'Due Date' }] }) },
              { label: "Pending", value: del.pending || 0, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 cursor-pointer", onClick: () => setDrillDownModal({ isOpen: true, title: "Pending Tasks", data: del.pendingList || [], columns: [{ key: 'id', label: 'Task ID' }, { key: 'title', label: 'Title' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'due', label: 'Due Date' }] }) },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-2xl p-5 text-center transition-colors`} onClick={s.onClick}>
                <p className={`text-2xl font-black ${s.color} tracking-tighter`}>{s.value}{s.icon && <span className="w-2 h-2 bg-red-500 rounded-full inline-block ml-1 animate-pulse align-top" />}</p>
                <p className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase mt-1 tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Overdue / Critical Tasks — Needs Your Attention</p>
             {(del.criticalTasks || []).map((t: any, i: number) => (
               <div key={i} className="group p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-red-500/30 transition-all flex items-center gap-4">
                  <span className="text-[10px] font-black text-gray-300 dark:text-white/10 group-hover:text-red-500 transition-colors">#{t.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 dark:text-white truncate">{t.title}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">{t.assignedTo} · {t.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase">Due: {t.dueDate}</p>
                    <span className="text-[9px] font-black text-red-500 uppercase mt-1 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 rounded-full inline-block">OVERDUE</span>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* Inventory & Reorder Alerts */}
        <div className="lg:col-span-6 bg-white dark:bg-navy-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">📦 Inventory & Reorder Alerts</h3>
            <span className="bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-black px-4 py-1.5 rounded-full border border-red-100 dark:border-red-500/20 uppercase tracking-widest">
              {inv.outOfStockCount || 0} REORDER NEEDED
            </span>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-10">
             <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 text-center border border-transparent hover:border-indigo-500/20 transition-all">
                <p className="text-3xl font-black tracking-tighter">{inv.totalSKUs || 0}</p>
                <p className="text-[10px] font-black text-gray-400 uppercase mt-2 tracking-widest">Total SKUs</p>
                <p className="text-[9px] font-bold text-emerald-500 mt-1 uppercase">↑ 12 new this month</p>
             </div>
             <div 
               className="bg-red-50 dark:bg-red-500/5 rounded-2xl p-6 text-center border border-red-100 dark:border-red-500/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
               onClick={() => setDrillDownModal({ isOpen: true, title: "Out of Stock Items", data: inv.outOfStockList || [], columns: [{ key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' }, { key: 'stockLeft', label: 'Stock Left' }] })}
             >
                <p className="text-3xl font-black text-red-500 tracking-tighter">{inv.outOfStockCount || 0}</p>
                <p className="text-[10px] font-black text-red-500 uppercase mt-2 tracking-widest">Out of Stock</p>
                <p className="text-[9px] font-bold text-red-400 mt-1 uppercase">Reorder NOW</p>
             </div>
             <div 
               className="bg-amber-50 dark:bg-amber-500/5 rounded-2xl p-6 text-center border border-amber-100 dark:border-amber-500/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors"
               onClick={() => setDrillDownModal({ isOpen: true, title: "Low Stock Items", data: inv.lowStockList || [], columns: [{ key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' }, { key: 'stockLeft', label: 'Stock Left' }] })}
             >
                <p className="text-3xl font-black text-amber-500 tracking-tighter">{inv.lowStockCount || 0}</p>
                <p className="text-[10px] font-black text-amber-500 uppercase mt-2 tracking-widest">Low Stock</p>
                <p className="text-[9px] font-bold text-amber-400 mt-1 uppercase">Reorder needed</p>
             </div>
          </div>

          <div className="space-y-4 mb-10">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Inventory by Category</p>
             {(inv.inventoryByCategory || []).map((c: any, i: number) => (
               <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <p className="text-gray-900 dark:text-white">{c.category}</p>
                    <p className="text-gray-400">{c.qty.toLocaleString()} PCS</p>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${Math.min(100, (c.qty / 10000) * 100)}%` }} 
                      className={`h-full rounded-full ${i === 0 ? "bg-emerald-500" : i === 1 ? "bg-blue-500" : "bg-indigo-400"}`} 
                    />
                  </div>
               </div>
             ))}
          </div>

          <div className="space-y-2">
             <div className="grid grid-cols-12 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-4">
                <div className="col-span-4">SKU</div>
                <div className="col-span-3">Category</div>
                <div className="col-span-2 text-center">Stock Left</div>
                <div className="col-span-3 text-right">Status</div>
             </div>
             <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {(inv.lowStockItems || []).map((item: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 items-center p-3 px-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all">
                    <div className="col-span-4 text-xs font-black text-gray-900 dark:text-white">{item.sku}</div>
                    <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase">{item.category}</div>
                    <div className="col-span-2 text-center text-xs font-black" style={{ color: item.stockLeft === 0 ? "#ef4444" : "#f59e0b" }}>{item.stockLeft}</div>
                    <div className="col-span-3 text-right">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${item.status === 'Out of Stock' ? 'bg-red-50 text-red-500 border-red-100 dark:bg-red-500/10 dark:border-red-500/20' : 'bg-amber-50 text-amber-500 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20'}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* FIFTH ROW: SCORECARD + PARTY PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Performance Scorecard */}
        <div className="lg:col-span-8 bg-white dark:bg-navy-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-3">
               <span className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg"><UsersIcon className="w-4 h-4" /></span>
               Team Performance Scorecard
             </h3>
             <div className="flex items-center gap-4">
                {["GOOD", "WATCH", "ACT"].map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${s === 'GOOD' ? 'bg-emerald-500' : s === 'WATCH' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <p className="text-[9px] font-black text-gray-400 uppercase">{s}</p>
                  </div>
                ))}
             </div>
           </div>

           <div className="overflow-x-auto">
             <table className="w-full">
               <thead>
                 <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5">
                   <th className="text-left pb-4 font-black">Member</th>
                   <th className="text-left pb-4 font-black">Dept</th>
                   <th className="text-center pb-4 font-black">Assigned</th>
                   <th className="text-center pb-4 font-black">Not Done</th>
                   <th className="text-center pb-4 font-black">Not On-Time</th>
                   <th className="text-center pb-4 font-black">Miss %</th>
                   <th className="text-center pb-4 font-black">Avg Delay</th>
                   <th className="text-right pb-4 font-black">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                 {scorecard.map((user: any, i: number) => (
                   <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                     <td className="py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black text-indigo-500">
                             {user.name.slice(0, 2).toUpperCase()}
                           </div>
                           <p className="text-sm font-black text-gray-800 dark:text-white">{user.name}</p>
                        </div>
                     </td>
                     <td className="py-4">
                        <span className="text-[9px] font-black uppercase text-gray-400 px-2 py-0.5 bg-gray-50 dark:bg-white/10 rounded-md">{user.dept}</span>
                     </td>
                     <td className="py-4 text-center font-black text-gray-900 dark:text-white">{user.assigned}</td>
                     <td className="py-4 text-center">
                        <span className={`text-sm font-black ${(user.notDone ?? Math.max(0, user.assigned - user.completed)) === 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {user.notDone ?? Math.max(0, user.assigned - user.completed)}
                        </span>
                     </td>
                     <td className="py-4 text-center">
                        <span className={`text-sm font-black ${(user.notOnTime ?? 0) === 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {user.notOnTime ?? 0}
                        </span>
                     </td>
                     <td className="py-4 text-center">
                        <span className={`text-base font-black ${(user.missPct ?? 0) === 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {user.missPct ?? 0}%
                        </span>
                     </td>
                     <td className="py-4 text-center font-black text-gray-400 text-xs">{user.avgDelayHours}h</td>
                     <td className="py-4 text-right">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border ${getStatusColor(user.status)}`}>
                          ✓ {user.status}
                        </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* Party & Sales Pipeline */}
        <div className="lg:col-span-4 bg-white dark:bg-navy-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-white/5 ring-1 ring-black/5 flex flex-col">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-3">
               <span className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg"><ArrowTrendingUpIcon className="w-4 h-4" /></span>
               Party & Sales Pipeline
             </h3>
           </div>
           
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Top Parties by Orders</p>
           <div className="space-y-4 mb-10">
              {(pipe.topPartiesByOrders || []).map((p: any, i: number) => (
                <div key={i} className="space-y-1.5">
                   <div className="flex justify-between text-[10px] font-black uppercase">
                     <p className="text-gray-900 dark:text-white truncate max-w-[200px]">{p.party}</p>
                     <p className="text-gray-400">{p.count}</p>
                   </div>
                   <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${(p.count / (pipe.maxPartyCount || 1)) * 100}%`, opacity: 1 - (i * 0.1) }} />
                   </div>
                </div>
              ))}
           </div>

           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">NBD Pipeline</p>
           <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 text-center">
                 <p className="text-2xl font-black text-emerald-500 tracking-tighter">{pipe.nbdIncoming || 0}</p>
                 <p className="text-[8px] font-black text-gray-400 uppercase mt-1">NBD Incoming</p>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 text-center">
                 <p className="text-2xl font-black text-blue-500 tracking-tighter">{pipe.nbdOutgoing || 0}</p>
                 <p className="text-[8px] font-black text-gray-400 uppercase mt-1">NBD Outgoing</p>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 text-center">
                 <p className="text-2xl font-black text-amber-500 tracking-tighter">{pipe.oldParties || 0}</p>
                 <p className="text-[8px] font-black text-gray-400 uppercase mt-1">Old Parties</p>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 text-center">
                 <p className="text-2xl font-black text-red-500 tracking-tighter">{pipe.inactiveCount || 0}</p>
                 <p className="text-[8px] font-black text-gray-400 uppercase mt-1">Inactive &gt;60d <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block ml-1 animate-pulse" /></p>
              </div>
           </div>

           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Category Revenue</p>
           <div className="space-y-4">
              {(pipe.categoryRevenue || []).map((c: any, i: number) => {
                const maxRevenue = Math.max(...(pipe.categoryRevenue || []).map((x: any) => x.revenue)) || 1;
                const width = (c.revenue / maxRevenue) * 100;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <p className="text-gray-900 dark:text-white">{c.category}</p>
                      <p className="text-gray-400">{fmtAmount(c.revenue)}</p>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${i === 0 ? "bg-emerald-500" : i === 1 ? "bg-blue-500" : i === 2 ? "bg-indigo-400" : "bg-amber-500"}`} 
                      />
                    </div>
                  </div>
                );
              })}
           </div>

        </div>
      </div>

      {/* Footer Decal */}
      <div className="pt-8 border-t border-gray-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <ArchiveBoxIcon className="w-5 h-5 text-gray-300" />
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Robotek COO Dashboard v2.0 · O2D · Score · Attendance · IMS · Delegations · CRM</p>
          </div>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Designed for Sahil Sir · Refresh: 300s</p>
      </div>

      {/* GAP DETAILS MODAL */}
      {selectedGapTile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedGapTile(null)}></div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-navy-900 w-full max-w-3xl max-h-[85vh] rounded-[2rem] shadow-2xl relative z-10 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10"
          >
             {/* Header */}
             <div className="p-6 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                     Dispatch Gap Details
                   </h3>
                   <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                     Date: {selectedGapTile.date ? new Date(selectedGapTile.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ''} · {selectedGapTile.count} Orders · {selectedGapTile.totalHours} Working Hours Total Gap
                   </p>
                </div>
                <button 
                  onClick={() => setSelectedGapTile(null)}
                  className="p-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             {/* Body */}
             <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-navy-900">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5">
                       <th className="pb-3 pl-2 w-32">Order No</th>
                       <th className="pb-3 w-1/3">Party Name</th>
                       <th className="pb-3 w-1/3">Timeline</th>
                       <th className="pb-3 text-right pr-2">Gap (Hours)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                     {selectedGapTile.orders?.map((o: any, idx: number) => {
                       const formatTimeStr = (h: number) => {
                         if (h >= 24) {
                           const d = Math.floor(h / 24);
                           const rh = h % 24;
                           return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
                         }
                         return `${h}h`;
                       };
                       const formatShortDate = (dStr: string) => {
                          if (!dStr) return "N/A";
                          try {
                             const isMidnightUTC = dStr.endsWith('T00:00:00.000Z');
                             const isMidnightIST = dStr.endsWith('T18:30:00.000Z');
                             const options: Intl.DateTimeFormatOptions = { 
                               day: '2-digit', 
                               month: 'short', 
                               year: '2-digit'
                             };
                             if (!isMidnightUTC && !isMidnightIST) {
                               options.hour = '2-digit';
                               options.minute = '2-digit';
                             }
                             return new Date(dStr).toLocaleDateString('en-GB', options);
                          } catch (e) {
                             return dStr;
                          }
                       };
                       return (
                         <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                           <td className="py-4 pl-2 font-black text-sm text-gray-800 dark:text-white align-top">{o.orderNo}</td>
                           <td className="py-4 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase align-top">{o.party}</td>
                           <td className="py-4 text-[10px] text-gray-500 uppercase tracking-wider align-top flex flex-col gap-1">
                             <div className="flex gap-2"><span className="w-20 font-black text-gray-400">Created:</span> <span className="font-bold">{formatShortDate(o.createdAt)}</span></div>
                             {o.isReconfirmed && <div className="flex gap-2"><span className="w-20 font-black text-amber-500">Reconfirmed:</span> <span className="font-bold text-gray-700 dark:text-gray-300">{formatShortDate(o.actual4)}</span></div>}
                             <div className="flex gap-2"><span className="w-20 font-black text-indigo-500">Dispatched:</span> <span className="font-bold text-gray-700 dark:text-gray-300">{formatShortDate(o.dispatchDate)}</span></div>
                           </td>
                           <td className="py-4 text-right pr-2 align-top">
                             <span className="text-sm font-black text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-1 rounded-full border border-red-100 dark:border-red-500/20">
                                {formatTimeStr(o.gapHours)}
                             </span>
                           </td>
                         </tr>
                       );
                     })}
                     {(!selectedGapTile.orders || selectedGapTile.orders.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-xs font-black text-gray-400 uppercase tracking-widest">
                            No orders dispatched on this date
                          </td>
                        </tr>
                     )}
                  </tbody>
                </table>
             </div>
          </motion.div>
        </div>
      )}

      {/* Generic Drill Down Modal */}
      <DrillDownModal 
        isOpen={drillDownModal.isOpen} 
        onClose={() => setDrillDownModal(prev => ({ ...prev, isOpen: false }))} 
        title={drillDownModal.title} 
        columns={drillDownModal.columns} 
        data={drillDownModal.data} 
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
