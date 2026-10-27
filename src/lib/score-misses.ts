// "Why did my score drop?" (Sahil, 2026-10-27): for every employee, the exact
// tasks / FMS steps that pulled the score down in a period — not done by the
// planned time, or done late — across every module that assigns work.
//
// Each source is read through a namespace import and its own try/catch, so a
// module whose sheet or code differs on the server only drops out of the
// report (listed in `failedSources`) instead of breaking it.
import * as Delegations from "./delegation-sheets";
import * as Checklists from "./checklist-sheets";
import * as Tickets from "./ticket-sheets";
import * as O2D from "./o2d-sheets";
import * as I2R from "./i2r-sheets";
import * as I2RPacking from "./i2r-packing-sheets";
import * as GRN from "./grn-sheets";
import * as Hrms from "./hrms-sheets";
import * as NewLaunch from "./new-launch-sheets";
import { doerFor, mergeStepConfig } from "./new-launch-steps";

export type MissKind = "not_done" | "late";

export interface MissItem {
  module: string;      // "Delegation", "O2D", "Candidate FMS", ...
  step: string;        // step name, or "" for single-step work
  title: string;       // which task / order / candidate
  ref: string;         // id shown to the user
  responsible: string; // name as written in the sheet / step setup
  planned: string;     // ISO
  actual: string;      // ISO, "" when not done
  kind: MissKind;
  delayHours: number;  // hours late (till now when not done)
}

export interface RawWork {
  module: string;
  step: string;
  title: string;
  ref: string;
  responsible: string;
  planned: Date | null;
  actual: Date | null;
  done: boolean;
}

type AnyRow = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "").trim();

export function parseSheetDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // dd/mm/yyyy with optional hh:mm or hh:mm:ss
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:${ss.padStart(2, "0")}+05:30`;
    const p = new Date(iso);
    return isNaN(p.getTime()) ? null : p;
  }
  return null;
}

const isCancelled = (r: AnyRow) => {
  const c = str(r.cancelled ?? r.Cancelled).toLowerCase();
  const h = str(r.hold).toLowerCase();
  return (c !== "" && c !== "no" && c !== "false") || (h !== "" && h !== "no" && h !== "false");
};

const firstOf = (r: AnyRow, keys: string[]) => {
  for (const k of keys) if (str(r[k])) return str(r[k]);
  return "";
};

type StepCfg = { step_name?: string; responsible_person?: string };

/** Generic planned_N / actual_N / status_N FMS sheet. */
function fmsWork(
  module: string,
  rows: AnyRow[],
  configs: StepCfg[],
  steps: number,
  titleKeys: string[],
  refKeys: string[],
): RawWork[] {
  const out: RawWork[] = [];
  for (const r of rows) {
    if (isCancelled(r)) continue;
    const title = firstOf(r, titleKeys) || "—";
    const ref = firstOf(r, refKeys);
    for (let n = 1; n <= steps; n++) {
      const planned = parseSheetDate(r[`planned_${n}`] ?? r[`Planned_${n}`]);
      if (!planned) continue;
      const actualRaw = r[`actual_${n}`] ?? r[`Actual_${n}`] ?? r[`acual_${n}`];
      const status = str(r[`status_${n}`] ?? r[`Status_${n}`]).toLowerCase();
      const actual = parseSheetDate(actualRaw);
      const done = !!actual && status !== "no" && status !== "pending";
      out.push({
        module,
        step: `Step ${n}${configs[n - 1]?.step_name ? ` · ${str(configs[n - 1].step_name)}` : ""}`,
        title,
        ref,
        responsible: str(configs[n - 1]?.responsible_person),
        planned,
        actual: done ? actual : null,
        done,
      });
    }
  }
  return out;
}

async function source(name: string, failed: string[], fn: () => Promise<RawWork[]>): Promise<RawWork[]> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[score-misses] ${name} skipped:`, error);
    failed.push(name);
    return [];
  }
}

const call = <T>(mod: unknown, fn: string, ...args: unknown[]): Promise<T> => {
  const f = (mod as Record<string, unknown>)[fn];
  if (typeof f !== "function") throw new Error(`${fn} not available`);
  return Promise.resolve((f as (...a: unknown[]) => T)(...args));
};

/** Reads every module; `skip` leaves out modules the caller already has. */
export async function collectWork(opts: { skip?: string[] } = {}): Promise<{ work: RawWork[]; failedSources: string[] }> {
  const failed: string[] = [];
  const skip = new Set(opts.skip || []);
  const run = (name: string, fn: () => Promise<RawWork[]>) => (skip.has(name) ? Promise.resolve([]) : source(name, failed, fn));
  const parts = await Promise.all([
    run("Delegation", async () => {
      const rows = await call<AnyRow[]>(Delegations, "getDelegations");
      return rows.map((d) => {
        const status = str(d.status);
        const done = status === "Completed" || status === "Approved";
        return {
          module: "Delegation", step: "", title: str(d.title) || "—", ref: `#${str(d.id)}`,
          responsible: str(d.assigned_to), planned: parseSheetDate(d.due_date),
          actual: done ? parseSheetDate(d.updated_at) : null, done,
        };
      });
    }),
    run("Checklist", async () => {
      const page = await call<{ data?: AnyRow[] }>(
        Checklists, "getChecklistsPaginated",
        1, 100000, "", [], "All", "", "ADMIN", [], "", "", [], [], [], [], [], [], "due_date", "desc", "tasks",
      );
      return (page?.data || []).map((c) => {
        const done = str(c.display_status) === "Completed";
        return {
          module: "Checklist", step: "", title: str(c.task) || "—", ref: str(c.occurrence_key || c.id),
          responsible: str(c.assigned_to), planned: parseSheetDate(c.occurrence_due_date || c.due_date),
          actual: done ? parseSheetDate(c.completed_date) : null, done,
        };
      });
    }),
    run("Help Ticket", async () => {
      const svc = (Tickets as unknown as { ticketService?: { getAll: () => Promise<AnyRow[]> } }).ticketService;
      if (!svc) throw new Error("ticketService not available");
      const rows = await svc.getAll();
      return rows.map((t) => {
        const st = str(t.status).toLowerCase();
        const done = st === "resolved" || st === "closed";
        return {
          module: "Help Ticket", step: "", title: str(t.title) || "—", ref: str(t.id),
          responsible: str(t.solver_person), planned: parseSheetDate(t.planned_resolution),
          actual: done ? parseSheetDate(t.updated_at) : null, done,
        };
      });
    }),
    run("O2D", async () => {
      const [rows, cfg] = await Promise.all([call<AnyRow[]>(O2D, "getO2Ds"), call<StepCfg[]>(O2D, "getO2DStepConfig")]);
      return fmsWork("O2D", rows, cfg, 11, ["party_name"], ["order_no", "id"]);
    }),
    run("I2R", async () => {
      const [rows, cfg] = await Promise.all([call<AnyRow[]>(I2R, "getI2RItems"), call<StepCfg[]>(I2R, "getI2RStepConfig")]);
      return fmsWork("I2R", rows, cfg, 11, ["item_name"], ["indend_num", "id"]);
    }),
    run("I2R Packing", async () => {
      const [rows, cfg] = await Promise.all([call<AnyRow[]>(I2RPacking, "getI2RPackingItems"), call<StepCfg[]>(I2RPacking, "getI2RPackingStepConfig")]);
      return fmsWork("I2R Packing", rows, cfg, 15, ["item_name", "packing_design"], ["ppf_num", "id"]);
    }),
    run("GRN", async () => {
      const [rows, cfg] = await Promise.all([call<AnyRow[]>(GRN, "getGRNItems"), call<StepCfg[]>(GRN, "getGRNStepConfig")]);
      return fmsWork("GRN", rows, cfg, 15, ["Item_Name", "item_name"], ["GRN_No", "id"]);
    }),
    ...([
      ["recruitment", "Recruitment FMS", 5, ["post_for_recruitment"]],
      ["candidate", "Candidate FMS", 7, ["candidate_name"]],
      ["sales", "Sales HR FMS", 8, ["candidate_name"]],
      ["onboard", "Onboard FMS", 11, ["candidate_name"]],
      ["offboard", "Offboard FMS", 4, ["emp_name"]],
    ] as const).map(([mod, label, steps, titleKeys]) =>
      run(label, async () => {
        const svc = await call<{ getAll: () => Promise<AnyRow[]> }>(Hrms, "getServiceForModule", mod);
        const [rows, cfg] = await Promise.all([svc.getAll(), call<StepCfg[]>(Hrms, "getHrmsStepConfig", mod)]);
        return fmsWork(label, rows, cfg, steps, [...titleKeys], ["id"]);
      }),
    ),
    run("New Launch FMS", async () => {
      const [rows, cfg] = await Promise.all([
        call<AnyRow[]>(NewLaunch, "getNewLaunches"),
        call<Parameters<typeof mergeStepConfig>[0]>(NewLaunch, "getNewLaunchConfig"),
      ]);
      const steps = mergeStepConfig(cfg);
      const out: RawWork[] = [];
      for (const r of rows) {
        if (str(r.status) === "Cancelled") continue;
        let fields: Record<string, string> = {};
        try { fields = JSON.parse(str(r.fields) || "{}"); } catch { /* keep empty */ }
        for (const s of steps) {
          const planned = parseSheetDate(r[`planned_${s.n}`]);
          if (!planned) continue;
          const actual = parseSheetDate(r[`actual_${s.n}`]);
          out.push({
            module: "New Launch FMS", step: `Step ${s.n} · ${s.name}`, title: str(r.product_name) || "—",
            ref: str(r.launch_no), responsible: s.approval ? "" : doerFor(s, fields),
            planned, actual, done: !!actual,
          });
        }
      }
      return out;
    }),
  ]);
  return { work: parts.flat(), failedSources: failed };
}

// ── people matching ───────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Maps a name as written in a sheet ("Himanshi", "ABHISHEK GUPTA") to ERP usernames. */
export function makeNameResolver(usernames: string[]) {
  const exact = new Map(usernames.map((u) => [norm(u), u]));
  const byFirst = new Map<string, string[]>();
  usernames.forEach((u) => {
    const f = norm(u).split(" ")[0];
    if (f) byFirst.set(f, [...(byFirst.get(f) || []), u]);
  });
  return (raw: string): string[] => {
    const out = new Set<string>();
    raw.split(/\s*(?:,|\/|&|\band\b)\s*/i).map(norm).filter(Boolean).forEach((name) => {
      const hit = exact.get(name);
      if (hit) { out.add(hit); return; }
      const first = byFirst.get(name.split(" ")[0]);
      if (first && first.length === 1) out.add(first[0]);
    });
    return Array.from(out);
  };
}

/** Work items that hurt the score in [from, to]: overdue-not-done, or done after planned. */
export function toMisses(work: RawWork[], from: Date, to: Date, now = new Date()): (MissItem & { _raw: RawWork })[] {
  const out: (MissItem & { _raw: RawWork })[] = [];
  for (const w of work) {
    if (!w.planned) continue;
    const inRange = (w.planned >= from && w.planned <= to) || (!!w.actual && w.actual >= from && w.actual <= to);
    if (!inRange) continue;
    let kind: MissKind | null = null;
    let delayMs = 0;
    if (!w.done) {
      if (w.planned < now) { kind = "not_done"; delayMs = now.getTime() - w.planned.getTime(); }
    } else if (w.actual && w.actual > w.planned) {
      kind = "late"; delayMs = w.actual.getTime() - w.planned.getTime();
    }
    if (!kind) continue;
    out.push({
      module: w.module, step: w.step, title: w.title, ref: w.ref, responsible: w.responsible,
      planned: w.planned.toISOString(), actual: w.actual ? w.actual.toISOString() : "",
      kind, delayHours: Math.round(delayMs / 36e5), _raw: w,
    });
  }
  return out;
}
