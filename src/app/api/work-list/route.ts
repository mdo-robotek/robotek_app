import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCooReport, normalizeDate, getISTDateString } from "@/lib/coo-report";
import { getI2RItems, getI2RStepConfig } from "@/lib/i2r-sheets";
import { getGRNItems, getGRNStepConfig } from "@/lib/grn-sheets";
import { getO2DStepConfig } from "@/lib/o2d-sheets";
import { getDelegations, getRevisionIndex } from "@/lib/delegation-sheets";
import {
  i2rWorkList, grnWorkList, o2dWorkList, taskWorkList,
  I2R_FILTERS, GRN_FILTERS, O2D_FILTERS, TASK_FILTERS,
  type WorkList,
} from "@/lib/work-list";

import { isStdKey, STD_MODULES, STD_FILTERS, stdFilter, scopeTo } from "@/lib/fms-standard";
import { loadStd } from "@/lib/fms-standard-load";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODULES: Record<string, { title: string; href: string; filters: Record<string, string>; adminOnly: boolean }> = {
  o2d: { title: "Orders", href: "/o2d", filters: O2D_FILTERS, adminOnly: false },
  i2r: { title: "Purchase", href: "/i2r", filters: I2R_FILTERS, adminOnly: true },
  grn: { title: "Goods In", href: "/grn", filters: GRN_FILTERS, adminOnly: false },
  tasks: { title: "Tasks", href: "/delegations", filters: TASK_FILTERS, adminOnly: true },
};

/**
 * GET /api/work-list?module=i2r&filter=late
 * The items behind one number on the CEO home / a module's top tiles.
 * Same access rule as /api/summary: Purchase and Tasks are company-wide, so admins/EA only.
 */
export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.role === "ADMIN" || user.role === "EA";

  const q = new URL(request.url).searchParams;
  const module = q.get("module") || "";
  const filter = q.get("filter") || "";
  if (isStdKey(module)) {
    if (!STD_FILTERS[filter]) return NextResponse.json({ error: "Unknown list" }, { status: 400 });
    try {
      const username = (session?.user as { username?: string } | undefined)?.username || "";
      const items = scopeTo(await loadStd(module), isAdmin ? null : username);
      const sm = STD_MODULES[module];
      const body: WorkList = { module, filter, title: `${sm.title} · ${isAdmin ? "" : "My "}${STD_FILTERS[filter]}`, href: sm.href, rows: stdFilter(items, filter) };
      return NextResponse.json(body);
    } catch (error: any) {
      console.error("work-list API error:", module, filter, error);
      return NextResponse.json({ error: "Couldn't load the list" }, { status: 500 });
    }
  }
  const m = MODULES[module];
  if (!m || !m.filters[filter]) return NextResponse.json({ error: "Unknown list" }, { status: 400 });
  if (m.adminOnly && !isAdmin) return NextResponse.json({ error: "Only for admins" }, { status: 403 });

  try {
    let rows;
    if (module === "i2r") {
      const [items, configs] = await Promise.all([getI2RItems(), getI2RStepConfig()]);
      rows = i2rWorkList(items, configs, filter);
    } else if (module === "grn") {
      const [items, configs, indents] = await Promise.all([getGRNItems(), getGRNStepConfig(), getI2RItems().catch(() => [])]);
      const byId = new Map(indents.map((i) => [String(i.id), i]));
      rows = grnWorkList(items, configs, filter, (g) => String(byId.get(String(g.indent_id || ""))?.supplier_name_3 || "").trim());
    } else if (module === "o2d") {
      const [coo, configs] = await Promise.all([getCooReport(new URLSearchParams("granularity=month")), getO2DStepConfig()]);
      rows = o2dWorkList(coo, configs, filter);
    } else {
      const [tasks, rev] = await Promise.all([getDelegations(), getRevisionIndex().catch(() => new Map())]);
      rows = taskWorkList(
        tasks,
        filter,
        getISTDateString(),
        (v) => normalizeDate(v),
        (t) => t.status === "Need Revision" && !!rev.get(String(t.id))?.pending
      );
    }
    const body: WorkList = { module, filter, title: `${m.title} · ${m.filters[filter]}`, href: m.href, rows };
    return NextResponse.json(body);
  } catch (error: any) {
    console.error("work-list API error:", module, filter, error);
    return NextResponse.json({ error: "Couldn't load the list" }, { status: 500 });
  }
}
