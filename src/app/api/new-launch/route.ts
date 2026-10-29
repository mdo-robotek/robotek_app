import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getNewLaunches,
  addNewLaunch,
  updateNewLaunch,
  deleteNewLaunch,
  getNewLaunchConfig,
  saveNewLaunchConfig,
} from "@/lib/new-launch-sheets";
import {
  NEW_LAUNCH_BRIEF_FIELDS,
  NEW_LAUNCH_TEAM_ROLES,
  NEW_LAUNCH_TOTAL_STEPS,
  NewLaunchStep,
  NewLaunchStepConfig,
  mergeStepConfig,
} from "@/lib/new-launch-steps";
import { calculatePlannedTimeIST } from "@/lib/workingHours";
import { getUsers } from "@/lib/google-sheets";
import { NewLaunch, NewLaunchHistoryEntry } from "@/types/new-launch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// A working day = 9:30 AM–6:30 PM IST (9 hrs), Sundays skipped — same clock
// the rest of the ERP uses for planned dates.
const WORKING_HOURS_PER_DAY = 9;

function plannedFor(step: NewLaunchStep, item: NewLaunch, from: Date): string {
  if (step.launch && item.launch_date) {
    // Launch happens on the fixed Launch Date — due by end of that day (6:30 PM IST).
    return new Date(`${item.launch_date}T13:00:00.000Z`).toISOString();
  }
  return calculatePlannedTimeIST(from, step.tatDays * WORKING_HOURS_PER_DAY).toISOString();
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sessionInfo(session: { user?: unknown } | null) {
  const user = (session?.user || {}) as Record<string, unknown>;
  return {
    name: String(user.name || user.username || user.email || "").trim(),
    isAdmin: String(user.role || "").toUpperCase() === "ADMIN",
  };
}

let lock: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [items, configs, users] = await Promise.all([getNewLaunches(), getNewLaunchConfig(), getUsers().catch(() => [])]);
    // Names for the doer dropdowns — only what the picker needs, never passwords.
    const people = users
      .filter((u) => u.isActive !== false && String(u.username || "").trim())
      .map((u) => ({ username: String(u.username).trim(), role: u.role_name || "", designation: u.designation || "", department: u.department || "" }))
      .sort((a, b) => a.username.localeCompare(b.username));
    return NextResponse.json(
      { items, steps: mergeStepConfig(configs), users: people, isAdmin: sessionInfo(session).isAdmin },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error fetching New Launch FMS:", error);
    return NextResponse.json({ error: "Failed to load New Launch FMS" }, { status: 500 });
  }
}

type Body = {
  action: string;
  id?: string;
  step?: number;
  remark?: string;
  fields?: Record<string, string>;
  product_name?: string;
  form_date?: string;
  configs?: NewLaunchStepConfig[];
  form?: Record<string, string>;
};

/** Validates the product brief; returns `0_<key>` entries for the fields JSON. */
function readBrief(form: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of NEW_LAUNCH_BRIEF_FIELDS) {
    const v = String(form?.[f.key] ?? "").trim();
    if (f.required && !v) throw new HttpError(400, `${f.label} is required`);
    if (v && f.type === "number" && !(Number(v) > 0)) throw new HttpError(400, `${f.label} must be a number above 0`);
    if (v && f.options && !f.options.includes(v)) throw new HttpError(400, `${f.label}: pick one of the options`);
    out[`0_${f.key}`] = v;
  }
  for (const r of NEW_LAUNCH_TEAM_ROLES) {
    const v = String(form?.[`team_${r.key}`] ?? "").trim().slice(0, 80);
    out[`0_team_${r.key}`] = v;
  }
  return out;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = sessionInfo(session);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await serialized(() => handle(body, me));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("New Launch FMS action failed:", body?.action, error);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
}

async function handle(body: Body, me: { name: string; isAdmin: boolean }): Promise<Record<string, unknown>> {
  const steps = mergeStepConfig(await getNewLaunchConfig());
  const nowDate = new Date();
  const now = nowDate.toISOString();

  if (body.action === "save-config") {
    if (!me.isAdmin) throw new HttpError(403, "Only Admin can change the step setup");
    const configs = (body.configs || [])
      .map((c) => ({ step: Number(c.step), doer: String(c.doer || "").trim(), tat_days: Number(c.tat_days) }))
      .filter((c) => c.step >= 1 && c.step <= NEW_LAUNCH_TOTAL_STEPS && Number.isFinite(c.tat_days) && c.tat_days >= 0);
    if (!(await saveNewLaunchConfig(configs))) throw new Error("config save failed");
    return {};
  }

  if (body.action === "create") {
    const product = String(body.product_name || "").trim();
    if (!product) throw new HttpError(400, "Product name is required");
    const brief = readBrief(body.form);
    const all = await getNewLaunches();
    const maxId = all.reduce((m, r) => Math.max(m, parseInt(r.id) || 0), 0);
    const id = String(maxId + 1);
    const history: NewLaunchHistoryEntry[] = [{ at: now, by: me.name, step: 0, action: "created", remark: body.remark || "" }];
    const item = {
      id,
      launch_no: `NL-${id}`,
      product_name: product,
      filled_by: me.name,
      form_date: String(body.form_date || now.slice(0, 10)),
      remark: String(body.remark || "").trim(),
      status: "Active",
      current_step: "1",
      launch_date: "",
      created_at: now,
      updated_at: now,
      fields: JSON.stringify(brief),
      history: JSON.stringify(history),
    } as NewLaunch;
    item.planned_1 = plannedFor(steps[0], item, nowDate);
    if (!(await addNewLaunch(item))) throw new Error("add failed");
    return { item };
  }

  const all = await getNewLaunches();
  const item = all.find((r) => String(r.id) === String(body.id));
  if (!item) throw new HttpError(404, "Launch not found — please refresh");
  const history = parseJson<NewLaunchHistoryEntry[]>(item.history, []);
  const fields = parseJson<Record<string, string>>(item.fields, {});
  const remark = String(body.remark || "").trim();

  const save = async () => {
    item.history = JSON.stringify(history);
    item.fields = JSON.stringify(fields);
    item.updated_at = now;
    if (!(await updateNewLaunch(item))) throw new Error("update failed");
    return { item };
  };

  if (body.action === "delete") {
    if (!me.isAdmin) throw new HttpError(403, "Only Admin can delete a launch");
    if (!(await deleteNewLaunch(item.id))) throw new Error("delete failed");
    return {};
  }

  if (body.action === "edit") {
    const product = String(body.product_name ?? item.product_name).trim();
    if (!product) throw new HttpError(400, "Product name is required");
    item.product_name = product;
    if (body.form_date) item.form_date = String(body.form_date);
    if (body.remark !== undefined) item.remark = remark;
    if (body.form) Object.assign(fields, readBrief(body.form));
    history.push({ at: now, by: me.name, step: Number(item.current_step) || 0, action: "edited" });
    return save();
  }

  if (body.action === "cancel" || body.action === "restore") {
    if (body.action === "cancel") {
      if (!remark) throw new HttpError(400, "Please write why this launch is being cancelled");
      item.status = "Cancelled";
    } else {
      item.status = item.current_step ? "Active" : "Completed";
    }
    history.push({ at: now, by: me.name, step: Number(item.current_step) || 0, action: body.action === "cancel" ? "cancelled" : "restored", remark });
    return save();
  }

  // ── Step actions: complete / approve / reject the CURRENT step ──
  if (item.status !== "Active") throw new HttpError(400, `This launch is ${item.status}`);
  const n = Number(item.current_step);
  if (!n || Number(body.step) !== n) throw new HttpError(409, "This step was already updated by someone — please refresh");
  const step = steps[n - 1];

  const advance = () => {
    const next = n + 1;
    if (next > NEW_LAUNCH_TOTAL_STEPS) {
      item.current_step = "";
      item.status = "Completed";
      return;
    }
    item.current_step = String(next);
    item[`planned_${next}`] = plannedFor(steps[next - 1], item, nowDate);
  };

  if (body.action === "complete") {
    if (step.approval) throw new HttpError(400, "This is an approval step — use Approve or Reject");
    const values = body.fields || {};
    for (const f of step.fields || []) {
      const v = String(values[f.key] ?? "").trim();
      if (f.required && !v) throw new HttpError(400, `${f.label} is required`);
      if (v) fields[`${n}_${f.key}`] = v;
    }
    if (n === 20) {
      const d = String(values.launch_date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new HttpError(400, "Please pick a valid launch date");
      item.launch_date = d;
    }
    item[`actual_${n}`] = now;
    item[`done_by_${n}`] = me.name;
    item[`remark_${n}`] = remark;
    history.push({ at: now, by: me.name, step: n, action: "done", remark });
    advance();
    return save();
  }

  if (body.action === "approve" || body.action === "reject") {
    if (!step.approval) throw new HttpError(400, "This step does not need approval");
    if (!me.isAdmin) throw new HttpError(403, `Only ${step.approval.by} (Admin login) can approve or reject this step`);
    if (body.action === "approve") {
      item[`actual_${n}`] = now;
      item[`done_by_${n}`] = me.name;
      item[`remark_${n}`] = remark;
      history.push({ at: now, by: me.name, step: n, action: "approved", remark });
      advance();
      return save();
    }
    if (!remark) throw new HttpError(400, "Please write what needs to change (rejection reason)");
    const r = step.approval.reworkStep;
    history.push({ at: now, by: me.name, step: n, action: "rejected", remark });
    item[`remark_${n}`] = `Rejected: ${remark}`;
    item[`planned_${n}`] = "";
    item[`actual_${r}`] = "";
    item[`done_by_${r}`] = "";
    item[`planned_${r}`] = plannedFor(steps[r - 1], item, nowDate);
    item.current_step = String(r);
    return save();
  }

  throw new HttpError(400, "Unknown action");
}
