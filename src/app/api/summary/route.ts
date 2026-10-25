import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCooReport } from "@/lib/coo-report";
import { getI2RItems } from "@/lib/i2r-sheets";
import { getGRNItems } from "@/lib/grn-sheets";
import {
  o2dSummary, i2rSummary, grnSummary, imsSummary, tasksSummary, peopleSummary,
  MODULE_DETAIL_SECTIONS, cooSliceFor,
  type ModuleKey, type ModuleSummary,
} from "@/lib/module-summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COO_PARAMS = () => new URLSearchParams("granularity=month"); // same key the Home page uses
const COO_MODULES: ModuleKey[] = ["o2d", "ims", "tasks", "people"];
const ORDER: ModuleKey[] = ["o2d", "i2r", "grn", "ims", "tasks", "people"];

async function build(key: ModuleKey, coo: any | null): Promise<ModuleSummary> {
  switch (key) {
    case "o2d": return o2dSummary(coo);
    case "ims": return imsSummary(coo);
    case "tasks": return tasksSummary(coo);
    case "people": return peopleSummary(coo);
    case "i2r": return i2rSummary(await getI2RItems());
    case "grn": return grnSummary(await getGRNItems());
  }
}

/**
 * GET /api/summary            -> every module's short summary (admins: CEO home)
 * GET /api/summary?module=o2d -> one module's summary for the strip on its page,
 *                                plus the detailed report sections for admins.
 */
export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.role === "ADMIN" || user.role === "EA";

  const one = new URL(request.url).searchParams.get("module") as ModuleKey | null;

  try {
    if (one) {
      if (!ORDER.includes(one)) return NextResponse.json({ error: "Unknown module" }, { status: 400 });
      const coo = COO_MODULES.includes(one) ? await getCooReport(COO_PARAMS()) : null;
      const summary = await build(one, coo);
      const sections = MODULE_DETAIL_SECTIONS[one];
      const detail = isAdmin && sections && coo ? { sections, data: cooSliceFor(one, coo) } : null;
      return NextResponse.json({ module: summary, detail });
    }

    if (!isAdmin) return NextResponse.json({ error: "Only for admins" }, { status: 403 });
    const coo = await getCooReport(COO_PARAMS()).catch((e) => {
      console.error("summary: COO report failed", e);
      return null;
    });
    const results = await Promise.allSettled(
      ORDER.map((k) => (COO_MODULES.includes(k) && !coo ? Promise.reject(new Error("no report")) : build(k, coo)))
    );
    const modules = results
      .filter((r): r is PromiseFulfilledResult<ModuleSummary> => r.status === "fulfilled")
      .map((r) => r.value);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthTarget = coo?.revenue?.fullMonthTarget || 0;
    const overview = coo
      ? {
          todaySale: coo.orders?.todayRevenue || 0,
          dailyTarget: monthTarget ? Math.round(monthTarget / daysInMonth) : 0,
          monthSale: coo.revenue?.mtdActual || 0,
          monthTarget,
          alerts: {
            ordersOver7Days: coo.alerts?.criticalDelayCount || 0,
            overdueTasks: coo.alerts?.overdueTaskCount || 0,
            stockMismatches: coo.alerts?.ledgerMismatchCount || 0,
          },
        }
      : null;
    return NextResponse.json({ modules, overview, generatedAt: coo?.generatedAt || now.toISOString() });
  } catch (error: any) {
    console.error("summary API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
