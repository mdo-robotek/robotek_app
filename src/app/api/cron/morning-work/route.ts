import { NextRequest, NextResponse } from "next/server";
import { getUsers } from "@/lib/google-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { getAppBaseUrl } from "@/lib/app-url";
import { getO2Ds, getO2DStepConfig, getPendingStepIdx } from "@/lib/o2d-sheets";
import { getGRNItems, getGRNStepConfig } from "@/lib/grn-sheets";
import { getI2RItems, getI2RStepConfig } from "@/lib/i2r-sheets";
import { getI2RPackingItems, getI2RPackingStepConfig } from "@/lib/i2r-packing-sheets";
import { getItemReceivePackingItems, getItemReceivePackingStepConfig } from "@/lib/item-receive-packing-sheets";
import { getReplaceItems, getReplaceStepConfig } from "@/lib/replace-sheets";
import { getServiceForModule, getHrmsStepConfig } from "@/lib/hrms-sheets";
import { getStepCount } from "@/lib/hrms-fields";
import { delegationService, getRevisionIndex, getRevisionRows } from "@/lib/delegation-sheets";
import { eaSection, giverSections, giverYesterday, isEaUser, isManagement, waitingAsks, type ExtraSection } from "@/lib/delegation-digest";
import { grnActiveStep, i2rActiveStep } from "@/lib/module-summary";
import { buildMorningMessage, fmsWork, isFlagOn, taskWork, type WorkItem } from "@/lib/morning-work";
import type { HrmsModuleType } from "@/types/hrms";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

/**
 * Morning WhatsApp (Sahil, 2026-10-27): one message per person with all
 * their late and due-today work from every FMS + their delegation tasks.
 * See src/lib/morning-work.ts for what goes in the message.
 *
 * Server crontab, Mon–Sat 9:15 AM India time:
 *   curl -s http://127.0.0.1:3000/api/cron/morning-work
 * ?dry=1          → send nothing, return who would get what
 * ?show=<name>    → with dry=1, also return that person's full message text
 * ?only=<name>    → send to this one person only (for a test)
 */
function isLocalRequest(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

const s = (v: unknown) => String(v ?? "").trim();
const join = (...xs: unknown[]) => xs.map(s).filter(Boolean).join(" ") || "—";

const HR_MODULES: { key: HrmsModuleType; label: string; name: (r: any) => string }[] = [
  { key: "recruitment", label: "Recruitment", name: (r) => s(r.post_for_recruitment) },
  { key: "candidate", label: "Candidate", name: (r) => s(r.candidate_name) },
  { key: "sales", label: "Sales hiring", name: (r) => s(r.candidate_name) },
  { key: "onboard", label: "Onboarding", name: (r) => s(r.candidate_name) },
  { key: "offboard", label: "Offboarding", name: (r) => s(r.emp_name) },
];

async function collectFms(): Promise<{ work: WorkItem[]; errors: string[] }> {
  const jobs: { label: string; run: () => Promise<WorkItem[]> }[] = [
    {
      label: "O2D",
      run: async () => {
        const [rows, configs] = await Promise.all([getO2Ds(), getO2DStepConfig()]);
        const byOrder = new Map<string, any[]>();
        for (const r of rows as any[]) {
          const key = s(r.order_no);
          if (!key) continue;
          if (!byOrder.has(key)) byOrder.set(key, []);
          byOrder.get(key)!.push(r);
        }
        const orders = [...byOrder.values()].map((list) => ({ ...list[0], __list: list }));
        return fmsWork({
          module: "O2D",
          items: orders,
          total: 11,
          configs,
          skip: (o: any) => isFlagOn(o.hold),
          stepOf: (o: any) => getPendingStepIdx(o.__list),
          title: (o: any) => join(o.order_no, o.party_name),
        });
      },
    },
    {
      label: "GRN",
      run: async () => {
        const [items, configs] = await Promise.all([getGRNItems(), getGRNStepConfig()]);
        return fmsWork({ module: "GRN", items, total: 9, configs, stepOf: (i) => grnActiveStep(i), title: (i: any) => join(i.GRN_No, i.Item_Name) });
      },
    },
    {
      label: "Purchase",
      run: async () => {
        const [items, configs] = await Promise.all([getI2RItems(), getI2RStepConfig()]);
        return fmsWork({ module: "Purchase", items, total: 11, configs, stepOf: (i) => i2rActiveStep(i), title: (i: any) => join(i.indend_num, i.item_name) });
      },
    },
    {
      label: "Packing",
      run: async () => {
        const [items, configs] = await Promise.all([getI2RPackingItems(), getI2RPackingStepConfig()]);
        return fmsWork({ module: "Packing", items, total: 6, configs, title: (i: any) => join(i.ppf_num, i.item_name) });
      },
    },
    {
      label: "Item Receive",
      run: async () => {
        const [items, configs] = await Promise.all([getItemReceivePackingItems(), getItemReceivePackingStepConfig()]);
        return fmsWork({ module: "Item Receive", items, total: 4, configs, title: (i: any) => join(i.ppr_num, i.item_name) });
      },
    },
    {
      label: "Replace",
      run: async () => {
        const [items, configs] = await Promise.all([getReplaceItems(), getReplaceStepConfig()]);
        return fmsWork({ module: "Replace", items, total: 9, configs, title: (i: any) => join(i.rn_num, i.party_name) });
      },
    },
    ...HR_MODULES.map((m) => ({
      label: m.label,
      run: async () => {
        const [items, configs] = await Promise.all([getServiceForModule(m.key).getAll(), getHrmsStepConfig(m.key)]);
        return fmsWork({ module: m.label, items: items as any[], total: getStepCount(m.key), configs, title: (r: any) => m.name(r) || "—" });
      },
    })),
  ];

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const work: WorkItem[] = [];
  const errors: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") work.push(...r.value);
    else {
      console.error(`morning-work: ${jobs[i].label} failed`, r.reason);
      errors.push(jobs[i].label);
    }
  });
  return { work, errors };
}

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const dry = q.get("dry") === "1";
  const only = s(q.get("only")).toLowerCase();
  const show = s(q.get("show")).toLowerCase();
  const now = Date.now();

  try {
    const [{ work, errors }, tasks, revIndex, revRows, users] = await Promise.all([
      collectFms(),
      delegationService.getAll().catch(() => []),
      getRevisionIndex().catch(() => new Map()),
      getRevisionRows().catch(() => []),
      getUsers(),
    ]);

    // Names in step configs are matched to ERP usernames, ignoring case.
    const userByKey = new Map(users.map((u) => [s(u.username).toLowerCase(), u]));
    const tw = taskWork(tasks as any[], (id) => !!revIndex.get(String(id))?.pending, now);

    const people = new Map<string, { fms: WorkItem[]; late: typeof tw.late; today: typeof tw.today }>();
    const unknown = new Map<string, number>();
    const bucket = (name: string) => {
      const key = name.toLowerCase();
      if (!userByKey.has(key)) { unknown.set(name, (unknown.get(name) || 0) + 1); return null; }
      if (!people.has(key)) people.set(key, { fms: [], late: [], today: [] });
      return people.get(key)!;
    };
    for (const w of work) bucket(w.person)?.fms.push(w);
    for (const t of tw.late) bucket(t.person)?.late.push(t);
    for (const t of tw.today) bucket(t.person)?.today.push(t);

    const base = getAppBaseUrl();

    // Delegation date changes (Sahil, 2026-10-27): the EA gets the list of asks
    // waiting for him; management gets what changed since yesterday morning
    // (Monday covers Saturday too) instead of WhatsApps during the day.
    const extras = new Map<string, ExtraSection[]>();
    const istDow = new Date(now + 330 * 60000).getUTCDay();
    const since = now - (istDow === 1 ? 48 : 24) * 3600000;
    const asks = waitingAsks(tasks as any[], revIndex);
    for (const u of users) {
      const key = s(u.username).toLowerCase();
      if (!key || u.isActive === false) continue;
      const list: ExtraSection[] = [];
      if (isEaUser(u as any)) { const sec = eaSection(asks, base); if (sec) list.push(sec); }
      if (isManagement(u.username)) list.push(...giverSections(giverYesterday(s(u.username), tasks as any[], revRows as any[], since)));
      if (list.length) {
        extras.set(key, list);
        if (!people.has(key)) people.set(key, { fms: [], late: [], today: [] });
      }
    }
    const report: { person: string; late: number; today: number; tasksLate: number; sent: boolean; reason?: string }[] = [];
    let sample: string | null = null;

    for (const [key, p] of people) {
      if (only && key !== only) continue;
      const user = userByKey.get(key)!;
      const text = buildMorningMessage({ username: s(user.username), fms: p.fms, tasksLate: p.late, tasksToday: p.today, now, baseUrl: base, extra: extras.get(key) || [] });
      if (!text) continue;
      const lateCount = p.fms.filter((w) => w.planned < now).length;
      const row = { person: s(user.username), late: lateCount, today: p.fms.length - lateCount + p.today.length, tasksLate: p.late.length, sent: false } as (typeof report)[number];
      if (show && key === show) sample = text;
      if (user.isActive === false) { report.push({ ...row, reason: "inactive user" }); continue; }
      if (!s(user.phone)) { report.push({ ...row, reason: "no phone number" }); continue; }
      if (dry) { report.push({ ...row, reason: "dry run" }); continue; }
      const res = await sendWhatsAppMessage(s(user.phone), text).catch(() => null);
      report.push({ ...row, sent: !!res && (res as { success?: boolean }).success !== false });
      await new Promise((r) => setTimeout(r, 800)); // be gentle with the WhatsApp gateway
    }

    report.sort((a, b) => b.late - a.late);
    return NextResponse.json({
      dry,
      people: report.length,
      sent: report.filter((r) => r.sent).length,
      notSent: report.filter((r) => !r.sent && r.reason !== "dry run").map((r) => `${r.person}: ${r.reason || "send failed"}`),
      failedModules: errors,
      unknownNames: [...unknown.keys()],
      report,
      ...(show ? { sample } : {}),
    });
  } catch (error) {
    console.error("morning-work failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
