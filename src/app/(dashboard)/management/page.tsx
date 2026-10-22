"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/* Robotek brand palette */
const RED = "#E52D31";
const MAROON = "#852321";
const BLACK = "#1F1B20";
const YELLOW = "#F7DA11";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
  { id: "tasks", label: "Tasks & HR" },
  { id: "accounts", label: "Accounts" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

const inr = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ------------------------------- small parts ------------------------------ */

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "bad" | "good" | "warn";
}) {
  const bar = tone === "bad" ? RED : tone === "warn" ? YELLOW : tone === "good" ? BLACK : MAROON;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E293B]">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: bar }} />
      <p className="pl-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">{label}</p>
      <p className="pl-2 pt-1 text-2xl font-black tabular-nums text-[#1F1B20] dark:text-white sm:text-3xl">{value}</p>
      {hint && <p className="pl-2 pt-0.5 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E293B] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-[#1F1B20] dark:text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ text = "Abhi koi data nahi" }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-gray-400">{text}</p>;
}

function Rows({ rows }: { rows: { left: string; sub?: string; right: string; bad?: boolean }[] }) {
  if (!rows.length) return <Empty />;
  return (
    <ul className="divide-y divide-black/5 dark:divide-white/10">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1F1B20] dark:text-white">{r.left}</p>
            {r.sub && <p className="truncate text-xs text-gray-500 dark:text-slate-400">{r.sub}</p>}
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums"
            style={r.bad ? { background: RED, color: "#fff" } : { background: "#F7DA1133", color: MAROON }}
          >
            {r.right}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BarBlock({ data, xKey, yKey, color = RED, height = 220 }: { data: any[]; xKey: string; yKey: string; color?: string; height?: number }) {
  if (!data?.length) return <Empty />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(247,218,17,0.15)" }} />
          <Bar dataKey={yKey} radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------- tab views ------------------------------- */

function Overview({ d }: { d: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Aaj ke orders" value={d.orders.createdToday} hint={`Is mahine: ${d.orders.createdThisMonth}`} />
        <Kpi label="Is mahine ki value" value={inr(d.orders.valueThisMonth)} hint="Orders ki total value" tone="good" />
        <Kpi label="Overdue orders" value={d.orders.overdueOrders} hint={`${d.orders.active} active orders`} tone={d.orders.overdueOrders ? "bad" : "good"} />
        <Kpi label="Stock risk" value={d.stock.outOfStock + d.stock.lowCover} hint={`${d.stock.outOfStock} khatam, ${d.stock.lowCover} 7 din se kam`} tone={d.stock.outOfStock ? "bad" : "warn"} />
        <Kpi label="Overdue tasks" value={d.tasks.overdue} hint={`${d.tasks.open} open tasks`} tone={d.tasks.overdue ? "bad" : "good"} />
        <Kpi label="Open tickets" value={d.tickets.open} hint={`${d.tickets.overdue} late`} tone={d.tickets.overdue ? "warn" : "neutral"} />
        <Kpi label="Payments pending" value={d.payments.pending} hint={`${d.payments.total} total`} tone={d.payments.pending ? "warn" : "good"} />
        <Kpi label="Aaj team present" value={`${d.people.present}/${d.people.total}`} hint={`${d.people.onLeave} leave par`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Orders — pichhle 14 din">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.orders.trend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="ord" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="orders" stroke={RED} strokeWidth={2.5} fill="url(#ord)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Sabse zyada late orders">
          <Rows
            rows={d.orders.overdueList.slice(0, 5).map((o: any) => ({
              left: `${o.party || "—"} · #${o.orderNo}`,
              sub: `Stuck: ${o.stage}`,
              right: `${o.daysLate} din`,
              bad: o.daysLate >= 3,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function SalesTab({ d }: { d: any }) {
  const s = d.sales;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total leads" value={s.totalLeads} />
        <Kpi label="Is mahine naye" value={s.newThisMonth} tone="good" />
        <Kpi label="Qualified" value={s.qualified} />
        <Kpi label="Order value (mahina)" value={inr(d.orders.valueThisMonth)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Lead status">
          <BarBlock data={s.byStatus} xKey="status" yKey="count" />
        </Card>
        <Card title="State-wise naye leads (is mahine)">
          <BarBlock data={s.byState} xKey="state" yKey="count" color={MAROON} />
        </Card>
        <Card title="Sales person-wise naye leads">
          <Rows rows={s.byPerson.map((p: any) => ({ left: p.person, right: String(p.count) }))} />
        </Card>
      </div>
    </div>
  );
}

function OperationsTab({ d }: { d: any }) {
  const o = d.orders;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active orders" value={o.active} />
        <Kpi label="Hold" value={o.hold} tone="warn" />
        <Kpi label="Cancelled" value={o.cancelled} />
        <Kpi label="Overdue" value={o.overdueOrders} tone={o.overdueOrders ? "bad" : "good"} />
      </div>
      <Card title="Order pipeline — kis step par kitne atke hain">
        <BarBlock data={o.stages} xKey="stage" yKey="pending" height={260} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Late orders">
          <Rows
            rows={o.overdueList.map((x: any) => ({
              left: `${x.party || "—"} · #${x.orderNo}`,
              sub: `Stuck: ${x.stage}${x.amount ? " · " + inr(x.amount) : ""}`,
              right: `${x.daysLate} din`,
              bad: x.daysLate >= 3,
            }))}
          />
        </Card>
        <Card title="Stock — jaldi khatam hone wale">
          <Rows
            rows={d.stock.risky.map((x: any) => ({
              left: x.item,
              sub: `Stock ${x.live} · roz ~${Math.round(x.avg)} jaata hai`,
              right: x.daysCover === 0 ? "Khatam" : `${x.daysCover} din`,
              bad: x.daysCover < 3,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function TasksTab({ d }: { d: any }) {
  const t = d.tasks;
  const p = d.people;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open tasks" value={t.open} />
        <Kpi label="Overdue" value={t.overdue} tone={t.overdue ? "bad" : "good"} />
        <Kpi label="Is mahine complete" value={t.doneThisMonth} tone="good" />
        <Kpi label="Leave pending" value={p.pendingLeaves} tone={p.pendingLeaves ? "warn" : "neutral"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Department-wise open tasks">
          <BarBlock data={t.byDepartment} xKey="department" yKey="open" color={MAROON} />
        </Card>
        <Card title="Sabse zyada overdue — kiske paas">
          <Rows rows={t.topOverduePeople.map((x: any) => ({ left: x.person, right: String(x.count), bad: x.count >= 5 }))} />
        </Card>
        <Card title="Aaj ki attendance">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-3xl font-black" style={{ color: BLACK }}>{p.present}</p><p className="text-xs text-gray-500">Present</p></div>
            <div><p className="text-3xl font-black" style={{ color: MAROON }}>{p.onLeave}</p><p className="text-xs text-gray-500">Leave par</p></div>
            <div><p className="text-3xl font-black" style={{ color: RED }}>{p.absent}</p><p className="text-xs text-gray-500">Absent / baaki</p></div>
          </div>
        </Card>
        <Card title="Help tickets (open)">
          <BarBlock data={d.tickets.byPriority} xKey="priority" yKey="count" height={160} />
        </Card>
      </div>
    </div>
  );
}

function AccountsTab({ d }: { d: any }) {
  const p = d.payments;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Vendor payments pending" value={p.pending} tone={p.pending ? "warn" : "good"} />
        <Kpi label="Total records" value={p.total} />
        <Kpi label="Is mahine order value" value={inr(d.orders.valueThisMonth)} />
      </div>
      <Card title="Vendor payment status">
        <BarBlock data={p.byStatus} xKey="status" yKey="count" />
      </Card>
    </div>
  );
}

/* ----------------------------------- page --------------------------------- */

export default function ManagementDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const { data, error, isLoading, isValidating, mutate } = useSWR("/api/dashboard/management", fetcher, {
    refreshInterval: 180000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  if (error && !data) {
    const forbidden = String(error.message) === "403";
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
        <ExclamationTriangleIcon className="mx-auto h-10 w-10" style={{ color: RED }} />
        <p className="mt-3 font-black" style={{ color: MAROON }}>
          {forbidden ? "Ye dashboard sirf Admin / EA ke liye hai" : "Dashboard load nahi ho paya"}
        </p>
        {!forbidden && (
          <button onClick={() => mutate()} className="mt-4 rounded-full px-5 py-2 text-sm font-bold text-white" style={{ background: RED }}>
            Dobara try karein
          </button>
        )}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  const failed = Object.entries(data.sourceStatus || {})
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  const updated = new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 pb-10 pt-2">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#1F1B20] dark:text-white sm:text-3xl">
            Management <span style={{ color: RED }}>Dashboard</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Updated {updated} · har 3 minute mein refresh</p>
        </div>
        <button
          onClick={() => mutate(fetcher("/api/dashboard/management?refresh=1"), { revalidate: false })}
          disabled={isValidating}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: RED }}
        >
          <ArrowPathIcon className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {failed.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: YELLOW, background: "#F7DA1122", color: MAROON }}>
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          Kuch data abhi load nahi hua: {failed.join(", ")}. Baaki dashboard sahi hai.
        </div>
      )}

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition"
            style={
              tab === t.id
                ? { background: BLACK, color: YELLOW }
                : { background: "transparent", color: "inherit", border: "1px solid rgba(120,120,120,0.3)" }
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <Overview d={data} />}
      {tab === "sales" && <SalesTab d={data} />}
      {tab === "operations" && <OperationsTab d={data} />}
      {tab === "tasks" && <TasksTab d={data} />}
      {tab === "accounts" && <AccountsTab d={data} />}
    </div>
  );
}
