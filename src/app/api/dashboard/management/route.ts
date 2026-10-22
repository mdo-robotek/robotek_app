import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { globalCache } from "@/lib/cache";
import { getO2Ds, getOutFormData } from "@/lib/o2d-sheets";
import { getIMSItems } from "@/lib/ims-sheets";
import { getGRNItems } from "@/lib/grn-sheets";
import { getFloorIMSItems } from "@/lib/ims-floor-sheets";
import { buildIMSMovementMaps, enrichIMSItems } from "@/lib/ims-enrich";
import { getTickets } from "@/lib/ticket-sheets";
import { getDelegations } from "@/lib/delegation-sheets";
import { getSalesLeads } from "@/lib/sales-sheets";
import { getPaymentVendorRecords } from "@/lib/payment-vendor-sheets";
import { getUsers } from "@/lib/google-sheets";
import { getAttendanceRecords } from "@/lib/sheets/attendance-sheets";
import { leaveRequestService } from "@/lib/leave-sheets";
import { O2D_STEP_SHORTS } from "@/types/o2d";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_KEY = "management_dashboard_v1";
const CACHE_TTL_MS = 3 * 60 * 1000;

// Share one in-flight build between simultaneous requests (several admins opening at once)
let inflight: Promise<Record<string, unknown>> | null = null;

/* ------------------------------ date helpers ------------------------------ */

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const direct = new Date(s);
  if (!isNaN(direct.getTime()) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) return direct;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
  }
  return isNaN(direct.getTime()) ? null : direct;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toNumber(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[₹,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function istNow(): Date {
  // Server may be in UTC; shift so that getDate()/getMonth() read IST calendar values
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist;
}

/* ----------------------------- section builders --------------------------- */

function buildOrders(o2ds: any[], now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayKey = ymd(now);
  const stagePending = new Array(11).fill(0);
  const stageOverdue = new Array(11).fill(0);
  let active = 0;
  let hold = 0;
  let cancelled = 0;
  let createdToday = 0;
  let createdThisMonth = 0;
  let valueThisMonth = 0;
  let overdueOrders = 0;
  let completed = 0;
  const overdueList: any[] = [];
  const dailyMap = new Map<string, number>();

  for (const o of o2ds) {
    const created = parseDate(o.sheet_created_at || o.created_at);
    if (created) {
      if (ymd(created) === todayKey) createdToday++;
      if (created >= monthStart) {
        createdThisMonth++;
        valueThisMonth += toNumber(o.final_amount_1) || toNumber(o.est_amount);
      }
      const key = ymd(created);
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
    }

    if (o.cancelled) {
      cancelled++;
      continue;
    }
    if (o.hold) {
      hold++;
      continue;
    }

    // current stage = first step that has a plan but is not done
    let currentStage = -1;
    for (let i = 1; i <= 11; i++) {
      const planned = o[`planned_${i}`];
      if (!planned) continue;
      const status = o[`status_${i}`];
      const done = status === "Yes" || status === "Done";
      if (!done) {
        currentStage = i;
        break;
      }
    }

    if (currentStage === -1) {
      completed++;
      continue;
    }

    active++;
    stagePending[currentStage - 1]++;
    const plannedAt = parseDate(o[`planned_${currentStage}`]);
    if (plannedAt && plannedAt < now) {
      stageOverdue[currentStage - 1]++;
      overdueOrders++;
      overdueList.push({
        orderNo: o.order_no,
        party: o.party_name,
        stage: O2D_STEP_SHORTS[currentStage - 1] || `Step ${currentStage}`,
        daysLate: Math.max(1, Math.floor((now.getTime() - plannedAt.getTime()) / 86400000)),
        amount: toNumber(o.final_amount_1) || toNumber(o.est_amount),
      });
    }
  }

  overdueList.sort((a, b) => b.daysLate - a.daysLate);

  // last 14 days order trend
  const trend: { date: string; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = ymd(d);
    trend.push({ date: key.slice(5), orders: dailyMap.get(key) || 0 });
  }

  return {
    active,
    hold,
    cancelled,
    completed,
    createdToday,
    createdThisMonth,
    valueThisMonth,
    overdueOrders,
    stages: O2D_STEP_SHORTS.map((label: string, i: number) => ({
      stage: label,
      pending: stagePending[i],
      overdue: stageOverdue[i],
    })),
    overdueList: overdueList.slice(0, 8),
    trend,
  };
}

function buildStock(items: any[]) {
  let total = 0;
  let outOfStock = 0;
  let lowCover = 0;
  const risky: any[] = [];

  for (const it of items) {
    if (it.active_status && String(it.active_status).toLowerCase() === "inactive") continue;
    total++;
    const live = Number(it.live_stock ?? 0);
    const avg = Number(it.avg_daily_con ?? 0);
    if (live <= 0) {
      outOfStock++;
      if (avg > 0) risky.push({ item: it.item_name, live, daysCover: 0, avg });
      continue;
    }
    if (avg > 0) {
      const cover = live / avg;
      if (cover < 7) {
        lowCover++;
        risky.push({ item: it.item_name, live, daysCover: Math.round(cover * 10) / 10, avg });
      }
    }
  }

  risky.sort((a, b) => a.daysCover - b.daysCover);
  return { totalItems: total, outOfStock, lowCover, risky: risky.slice(0, 8) };
}

function buildTasks(delegations: any[], now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let open = 0;
  let overdue = 0;
  let doneThisMonth = 0;
  const byDept = new Map<string, { open: number; overdue: number }>();
  const byPerson = new Map<string, number>();

  for (const d of delegations) {
    const status = String(d.status || "");
    const isDone = status === "Completed" || status === "Approved";
    const due = parseDate(d.due_date);
    const dept = d.department || "General";
    if (isDone) {
      const upd = parseDate(d.updated_at);
      if (upd && upd >= monthStart) doneThisMonth++;
      continue;
    }
    open++;
    const row = byDept.get(dept) || { open: 0, overdue: 0 };
    row.open++;
    if (due && due < now) {
      overdue++;
      row.overdue++;
      const who = d.assigned_to || "Unassigned";
      byPerson.set(who, (byPerson.get(who) || 0) + 1);
    }
    byDept.set(dept, row);
  }

  return {
    open,
    overdue,
    doneThisMonth,
    byDepartment: Array.from(byDept.entries())
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
      .slice(0, 8),
    topOverduePeople: Array.from(byPerson.entries())
      .map(([person, count]) => ({ person, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}

function buildTickets(tickets: any[], now: Date) {
  const openList = tickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed");
  const overdue = openList.filter((t) => {
    const p = parseDate(t.planned_resolution);
    return p && p < now;
  }).length;
  const byPriority = new Map<string, number>();
  openList.forEach((t) => byPriority.set(t.priority || "—", (byPriority.get(t.priority || "—") || 0) + 1));
  return {
    open: openList.length,
    overdue,
    byPriority: Array.from(byPriority.entries()).map(([priority, count]) => ({ priority, count })),
  };
}

function buildSales(leads: any[], now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let newThisMonth = 0;
  const byStatus = new Map<string, number>();
  const byPerson = new Map<string, number>();
  const byState = new Map<string, number>();
  let qualified = 0;

  for (const l of leads) {
    const created = parseDate(l.created_at);
    if (created && created >= monthStart) newThisMonth++;
    const st = l.status || "New";
    byStatus.set(st, (byStatus.get(st) || 0) + 1);
    if (l.qualified_status && String(l.qualified_status).toLowerCase() === "qualified") qualified++;
    if (created && created >= monthStart) {
      const p = l.sales_person_assigned || "Unassigned";
      byPerson.set(p, (byPerson.get(p) || 0) + 1);
      const s = l.state_and_ut || "—";
      byState.set(s, (byState.get(s) || 0) + 1);
    }
  }
  const top = (m: Map<string, number>, key: string, n = 6) =>
    Array.from(m.entries()).map(([k, count]) => ({ [key]: k, count })).sort((a: any, b: any) => b.count - a.count).slice(0, n);

  return {
    totalLeads: leads.length,
    newThisMonth,
    qualified,
    byStatus: top(byStatus, "status", 6),
    byPerson: top(byPerson, "person"),
    byState: top(byState, "state"),
  };
}

function buildPayments(records: any[]) {
  const by = new Map<string, number>();
  records.forEach((r) => by.set(r.status || "Pending", (by.get(r.status || "Pending") || 0) + 1));
  const pending = records.filter((r) => r.status !== "Approved" && r.status !== "Payed").length;
  return {
    total: records.length,
    pending,
    byStatus: Array.from(by.entries()).map(([status, count]) => ({ status, count })),
  };
}

function buildPeople(users: any[], attendance: any[], leaves: any[], now: Date) {
  const todayKey = ymd(now);
  const norm = (s: any) => {
    const d = parseDate(s);
    return d ? ymd(d) : "";
  };
  const present = new Set(attendance.filter((r) => norm(r.date) === todayKey).map((r) => String(r.userId)));
  const onLeave = leaves.filter((l) => {
    if (!l.status || String(l.status).toLowerCase() !== "approved") return false;
    const s = parseDate(l.startDate);
    const e = parseDate(l.endDate);
    return s && e && ymd(s) <= todayKey && todayKey <= ymd(e);
  }).length;
  const pendingLeaves = leaves.filter((l) => String(l.status || "").toLowerCase() === "pending").length;
  const total = users.length;
  return {
    total,
    present: present.size,
    onLeave,
    absent: Math.max(0, total - present.size - onLeave),
    pendingLeaves,
  };
}

/* --------------------------------- builder -------------------------------- */

async function build(): Promise<Record<string, unknown>> {
  const now = istNow();

  const [o2ds, ims, tickets, delegations, leads, payments, users, attendance, leaves] = await Promise.allSettled([
    getO2Ds(),
    (async () => {
      const [items, grns, outForm, gFloor, firstFloor] = await Promise.all([
        getIMSItems(),
        getGRNItems(),
        getOutFormData(),
        getFloorIMSItems("g"),
        getFloorIMSItems("1st"),
      ]);
      const maps = buildIMSMovementMaps(grns, outForm, gFloor, firstFloor);
      return enrichIMSItems(items, maps);
    })(),
    getTickets(),
    getDelegations(),
    getSalesLeads(),
    getPaymentVendorRecords(),
    getUsers(),
    getAttendanceRecords(),
    leaveRequestService.getAll(),
  ]);

  const val = <T,>(r: PromiseSettledResult<T>, fallback: T): { v: T; ok: boolean } =>
    r.status === "fulfilled" ? { v: r.value, ok: true } : (console.error("Management dashboard source failed:", r.reason), { v: fallback, ok: false });

  const o = val(o2ds, [] as any[]);
  const s = val(ims, [] as any[]);
  const t = val(tickets, [] as any[]);
  const d = val(delegations, [] as any[]);
  const l = val(leads, [] as any[]);
  const p = val(payments, [] as any[]);
  const u = val(users, [] as any[]);
  const a = val(attendance, [] as any[]);
  const lv = val(leaves, [] as any[]);

  return {
    generatedAt: new Date().toISOString(),
    // which sources loaded — the UI shows a small notice for any that failed
    sourceStatus: {
      orders: o.ok,
      stock: s.ok,
      tickets: t.ok,
      tasks: d.ok,
      sales: l.ok,
      payments: p.ok,
      people: u.ok && a.ok && lv.ok,
    },
    orders: buildOrders(o.v, now),
    stock: buildStock(s.v),
    tickets: buildTickets(t.v, now),
    tasks: buildTasks(d.v, now),
    sales: buildSales(l.v, now),
    payments: buildPayments(p.v),
    people: buildPeople(u.v, a.v, lv.v, now),
  };
}

/* ---------------------------------- route --------------------------------- */

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String((session.user as any)?.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "EA") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    if (!refresh) {
      const cached = globalCache.get<Record<string, unknown>>(CACHE_KEY);
      if (cached) return NextResponse.json(cached);
    }

    if (!inflight) {
      inflight = build()
        .then((payload) => {
          globalCache.set(CACHE_KEY, payload, CACHE_TTL_MS);
          return payload;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return NextResponse.json(await inflight);
  } catch (error) {
    console.error("Management dashboard API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
