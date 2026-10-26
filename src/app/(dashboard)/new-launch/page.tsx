"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import {
  RocketLaunchIcon,
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  CheckBadgeIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  QueueListIcon,
  ArrowPathIcon,
  NoSymbolIcon,
  ArrowUturnLeftIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
  CalendarIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { NewLaunchField, NewLaunchStep, NEW_LAUNCH_BRIEF_FIELDS, NEW_LAUNCH_LAUNCH_STEP, NEW_LAUNCH_TOTAL_STEPS } from "@/lib/new-launch-steps";
import { NewLaunch, NewLaunchHistoryEntry } from "@/types/new-launch";

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to load");
    return json;
  });

type ApiData = { items: NewLaunch[]; steps: NewLaunchStep[]; isAdmin: boolean };

type Filter =
  | { kind: "all" }
  | { kind: "mine" }
  | { kind: "overdue" }
  | { kind: "approval" }
  | { kind: "step"; n: number }
  | { kind: "completed" }
  | { kind: "cancelled" };

// ── helpers ────────────────────────────────────────────────────────────────

const IST = "Asia/Kolkata";
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: IST });
}
function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST });
}
function gapText(ms: number) {
  const h = Math.abs(ms) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
}
function delayInfo(planned?: string, now = Date.now()) {
  if (!planned) return null;
  const t = new Date(planned).getTime();
  if (isNaN(t)) return null;
  const diff = now - t;
  return diff > 0
    ? { overdue: true, text: `Late by ${gapText(diff)}`, cls: "text-red-600 dark:text-red-400" }
    : { overdue: false, text: `Due in ${gapText(diff)}`, cls: "text-emerald-600 dark:text-emerald-400" };
}
function parseJson<T>(raw: string | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function currentStepOf(item: NewLaunch) {
  return Number(item.current_step) || 0;
}
function isMine(step: NewLaunchStep | undefined, username: string, role: string, isAdmin: boolean) {
  if (!step) return false;
  const doer = step.doer.toLowerCase().trim();
  const me = username.toLowerCase().trim();
  if (step.approval) return isAdmin;
  if (doer === "ea") return role.toUpperCase() === "EA" || me === "ea";
  if (!me) return false;
  const first = doer.split(/\s+/)[0];
  return doer === me || me.includes(first) || doer.includes(me);
}

const card = "bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-[14px] font-semibold disabled:opacity-50 transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 text-[14px] font-semibold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors";
const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px] text-slate-800 dark:text-white outline-none focus:border-[#2563EB]";

// ── page ───────────────────────────────────────────────────────────────────

export default function NewLaunchFmsPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { username?: string; name?: string | null; role?: string } | undefined;
  const username = String(sessionUser?.username || sessionUser?.name || "");
  const role = String(sessionUser?.role || "");
  const { data, error, isLoading, mutate } = useSWR<ApiData>("/api/new-launch", fetcher, { refreshInterval: 60_000 });

  const items = useMemo(() => data?.items || [], [data]);
  const steps = useMemo(() => data?.steps || [], [data]);
  const isAdmin = !!data?.isAdmin;
  const now = Date.now();

  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<NewLaunch | null>(null);
  const [actionFor, setActionFor] = useState<{ item: NewLaunch; mode: "complete" | "approve" | "reject" | "cancel" } | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const post = async (payload: Record<string, unknown>, okMsg: string) => {
    const res = await fetch("/api/new-launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(false, json?.error || "Could not save. Please try again.");
      if (res.status === 409) mutate();
      return false;
    }
    showToast(true, okMsg);
    await mutate();
    return true;
  };

  const active = items.filter((i) => i.status === "Active");
  const stepOf = (i: NewLaunch) => steps[currentStepOf(i) - 1];
  const overdueOf = (i: NewLaunch) => !!delayInfo(i[`planned_${currentStepOf(i)}`], now)?.overdue;

  const counts = useMemo(() => {
    const byStep: Record<number, number> = {};
    active.forEach((i) => {
      const n = currentStepOf(i);
      byStep[n] = (byStep[n] || 0) + 1;
    });
    return {
      byStep,
      all: active.length,
      mine: active.filter((i) => isMine(stepOf(i), username, role, isAdmin)).length,
      overdue: active.filter(overdueOf).length,
      approval: active.filter((i) => !!stepOf(i)?.approval).length,
      launched: items.filter((i) => i.status !== "Cancelled" && !!i[`actual_${NEW_LAUNCH_LAUNCH_STEP}`]).length,
      completed: items.filter((i) => i.status === "Completed").length,
      cancelled: items.filter((i) => i.status === "Cancelled").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, steps, username, role, isAdmin]);

  const visible = useMemo(() => {
    let list: NewLaunch[];
    switch (filter.kind) {
      case "completed": list = items.filter((i) => i.status === "Completed"); break;
      case "cancelled": list = items.filter((i) => i.status === "Cancelled"); break;
      case "mine": list = active.filter((i) => isMine(stepOf(i), username, role, isAdmin)); break;
      case "overdue": list = active.filter(overdueOf); break;
      case "approval": list = active.filter((i) => !!stepOf(i)?.approval); break;
      case "step": list = active.filter((i) => currentStepOf(i) === filter.n); break;
      default: list = active;
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => `${i.launch_no} ${i.product_name} ${i.filled_by} ${i.remark}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const pa = new Date(a[`planned_${currentStepOf(a)}`] || a.updated_at || 0).getTime() || 0;
      const pb = new Date(b[`planned_${currentStepOf(b)}`] || b.updated_at || 0).getTime() || 0;
      return pa - pb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, steps, filter, search, username, role, isAdmin]);

  const phases = useMemo(() => {
    const map = new Map<string, NewLaunchStep[]>();
    steps.forEach((s) => map.set(s.phase, [...(map.get(s.phase) || []), s]));
    return Array.from(map.entries());
  }, [steps]);

  const filterLabel = (() => {
    switch (filter.kind) {
      case "mine": return "My tasks";
      case "overdue": return "Overdue";
      case "approval": return "Waiting for approval";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      case "step": return `Step ${filter.n} — ${steps[filter.n - 1]?.name || ""}`;
      default: return "All active launches";
    }
  })();

  const sameFilter = (f: Filter) =>
    f.kind === filter.kind && (f.kind !== "step" || (filter.kind === "step" && filter.n === f.n));

  const FilterBtn = ({ f, label, count, tone = "blue", icon: Icon }: { f: Filter; label: string; count: number; tone?: "blue" | "red" | "amber" | "green" | "slate"; icon?: React.ElementType }) => {
    const on = sameFilter(f);
    const pill = { blue: "bg-[#2563EB]", red: "bg-red-500", amber: "bg-amber-500", green: "bg-emerald-500", slate: "bg-slate-400" }[tone];
    return (
      <button
        onClick={() => setFilter(f)}
        className={`w-full flex items-center justify-between gap-2 px-3 min-h-[40px] rounded-lg text-left text-[14px] transition-colors ${
          on ? "bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-300 font-semibold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          <span className="truncate">{label}</span>
        </span>
        {count > 0 && <span className={`min-w-6 h-6 px-1.5 rounded-full text-[13px] font-semibold text-white flex items-center justify-center ${pill}`}>{count}</span>}
      </button>
    );
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <RocketLaunchIcon className="w-6 h-6 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-white">New Launch FMS</h1>
            <p className="text-[14px] text-slate-500 dark:text-slate-400">Form fill se lekar launch aur marketing tak — {NEW_LAUNCH_TOTAL_STEPS} steps, 7 approvals</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFlowOpen(true)} className={btnGhost}><QueueListIcon className="w-4 h-4" /> Flow</button>
          {isAdmin && <button onClick={() => setConfigOpen(true)} className={btnGhost}><Cog6ToothIcon className="w-4 h-4" /> Step setup</button>}
          <button onClick={() => mutate()} className={btnGhost} title="Refresh"><ArrowPathIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /></button>
          <button onClick={() => setCreateOpen(true)} className={btnPrimary}><PlusIcon className="w-4 h-4" /> New Launch</button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Active launches", value: counts.all, f: { kind: "all" } as Filter, cls: "text-slate-800 dark:text-white" },
          { label: "My tasks", value: counts.mine, f: { kind: "mine" } as Filter, cls: "text-[#2563EB]" },
          { label: "Overdue", value: counts.overdue, f: { kind: "overdue" } as Filter, cls: counts.overdue ? "text-red-600" : "text-slate-800 dark:text-white" },
          { label: "Waiting approval", value: counts.approval, f: { kind: "approval" } as Filter, cls: "text-amber-600" },
          { label: "Launched", value: counts.launched, f: null, cls: "text-emerald-600" },
          { label: "Completed", value: counts.completed, f: { kind: "completed" } as Filter, cls: "text-emerald-600" },
        ].map((k) => (
          <button
            key={k.label}
            disabled={!k.f}
            onClick={() => k.f && setFilter(k.f)}
            className={`${card} p-3 text-left ${k.f ? "hover:border-[#2563EB]/40 cursor-pointer" : "cursor-default"} ${k.f && sameFilter(k.f) ? "ring-2 ring-[#2563EB]/30" : ""}`}
          >
            <p className="text-[13px] text-slate-500 dark:text-slate-400">{k.label}</p>
            <p className={`text-2xl font-semibold mt-0.5 ${k.cls}`}>{k.value}</p>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-[14px]">
          Could not load New Launch FMS: {String(error.message || error)}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Filters — select on mobile, list on desktop */}
        <div className="lg:hidden">
          <select
            value={filter.kind === "step" ? `step:${filter.n}` : filter.kind}
            onChange={(e) => {
              const v = e.target.value;
              setFilter(v.startsWith("step:") ? { kind: "step", n: Number(v.slice(5)) } : ({ kind: v } as Filter));
            }}
            className={inputCls}
          >
            <option value="all">All active ({counts.all})</option>
            <option value="mine">My tasks ({counts.mine})</option>
            <option value="overdue">Overdue ({counts.overdue})</option>
            <option value="approval">Waiting approval ({counts.approval})</option>
            {steps.map((s) => (
              <option key={s.n} value={`step:${s.n}`}>Step {s.n} — {s.name} ({counts.byStep[s.n] || 0})</option>
            ))}
            <option value="completed">Completed ({counts.completed})</option>
            <option value="cancelled">Cancelled ({counts.cancelled})</option>
          </select>
        </div>

        <aside className={`hidden lg:block w-72 shrink-0 ${card} p-2 self-start max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar`}>
          <FilterBtn f={{ kind: "all" }} label="All active" count={counts.all} tone="slate" icon={RocketLaunchIcon} />
          <FilterBtn f={{ kind: "mine" }} label="My tasks" count={counts.mine} icon={UserIcon} />
          <FilterBtn f={{ kind: "overdue" }} label="Overdue" count={counts.overdue} tone="red" icon={ExclamationTriangleIcon} />
          <FilterBtn f={{ kind: "approval" }} label="Waiting approval" count={counts.approval} tone="amber" icon={CheckBadgeIcon} />
          <div className="my-2 border-t border-slate-100 dark:border-navy-700" />
          {phases.map(([phase, ps]) => {
            const phaseCount = ps.reduce((s, p) => s + (counts.byStep[p.n] || 0), 0);
            const hasCurrent = filter.kind === "step" && ps.some((p) => p.n === filter.n);
            const open = openPhases[phase] ?? (hasCurrent || phaseCount > 0);
            return (
              <div key={phase}>
                <button
                  onClick={() => setOpenPhases((o) => ({ ...o, [phase]: !open }))}
                  className="w-full flex items-center justify-between px-3 min-h-[36px] text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700"
                >
                  <span>{phase} <span className="font-normal">· {ps[0].n}–{ps[ps.length - 1].n}</span></span>
                  <span className="flex items-center gap-1.5">
                    {!open && phaseCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#2563EB] text-white text-[12px] flex items-center justify-center">{phaseCount}</span>}
                    {open ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {open && ps.map((s) => (
                  <FilterBtn key={s.n} f={{ kind: "step", n: s.n }} label={`${s.n}. ${s.name}`} count={counts.byStep[s.n] || 0} tone={s.approval ? "amber" : s.launch ? "green" : "blue"} />
                ))}
              </div>
            );
          })}
          <div className="my-2 border-t border-slate-100 dark:border-navy-700" />
          <FilterBtn f={{ kind: "completed" }} label="Completed" count={counts.completed} tone="green" icon={CheckCircleIcon} />
          <FilterBtn f={{ kind: "cancelled" }} label="Cancelled" count={counts.cancelled} tone="slate" icon={NoSymbolIcon} />
        </aside>

        {/* List */}
        <section className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{filterLabel} <span className="text-slate-400 font-normal">({visible.length})</span></h2>
            <div className="relative ml-auto w-full sm:w-72">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product / NL no." className={`${inputCls} pl-9`} />
            </div>
          </div>

          {isLoading && !data ? (
            <div className={`${card} p-10 text-center text-slate-400 text-[14px]`}><ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />Loading…</div>
          ) : visible.length === 0 ? (
            <div className={`${card} p-10 text-center`}>
              <RocketLaunchIcon className="w-10 h-10 mx-auto text-slate-300" />
              <p className="mt-2 text-[14px] text-slate-500">Nothing here.</p>
              {items.length === 0 && (
                <button onClick={() => setCreateOpen(true)} className={`${btnPrimary} mt-3`}><PlusIcon className="w-4 h-4" /> Add the first upcoming launch</button>
              )}
            </div>
          ) : (
            visible.map((item) => (
              <LaunchCard
                key={item.id}
                item={item}
                steps={steps}
                now={now}
                isAdmin={isAdmin}
                mine={isMine(stepOf(item), username, role, isAdmin)}
                expanded={!!expanded[item.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                onAction={(mode) => setActionFor({ item, mode })}
                onEdit={() => setEditItem(item)}
                onRestore={() => post({ action: "restore", id: item.id }, "Launch restored")}
                onDelete={() => {
                  if (confirm(`Delete ${item.launch_no} — ${item.product_name}? This cannot be undone.`)) post({ action: "delete", id: item.id }, "Launch deleted");
                }}
              />
            ))
          )}
        </section>
      </div>

      {(createOpen || editItem) && (
        <LaunchFormModal
          item={editItem}
          onClose={() => { setCreateOpen(false); setEditItem(null); }}
          onSubmit={async (v) => {
            const ok = editItem
              ? await post({ action: "edit", id: editItem.id, ...v }, "Launch updated")
              : await post({ action: "create", ...v }, "New launch added — Step 1 started");
            if (ok) { setCreateOpen(false); setEditItem(null); }
          }}
        />
      )}

      {actionFor && (
        <StepActionModal
          item={actionFor.item}
          mode={actionFor.mode}
          step={steps[currentStepOf(actionFor.item) - 1]}
          steps={steps}
          onClose={() => setActionFor(null)}
          onSubmit={async (remark, fields) => {
            const { item, mode } = actionFor;
            const msg = { complete: "Step done — moved to next step", approve: "Approved — moved to next step", reject: "Rejected — sent back for rework", cancel: "Launch cancelled" }[mode];
            const ok = await post({ action: mode, id: item.id, step: currentStepOf(item), remark, fields }, msg);
            if (ok) setActionFor(null);
          }}
        />
      )}

      {configOpen && (
        <ConfigModal
          steps={steps}
          onClose={() => setConfigOpen(false)}
          onSave={async (configs) => {
            const ok = await post({ action: "save-config", configs }, "Step setup saved");
            if (ok) setConfigOpen(false);
          }}
        />
      )}

      {flowOpen && <FlowModal steps={steps} onClose={() => setFlowOpen(false)} />}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-4 py-3 rounded-lg shadow-lg text-[14px] font-semibold text-white ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Launch card ────────────────────────────────────────────────────────────

function LaunchCard({
  item, steps, now, isAdmin, mine, expanded, onToggle, onAction, onEdit, onRestore, onDelete,
}: {
  item: NewLaunch;
  steps: NewLaunchStep[];
  now: number;
  isAdmin: boolean;
  mine: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAction: (mode: "complete" | "approve" | "reject" | "cancel") => void;
  onEdit: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const n = currentStepOf(item);
  const step = steps[n - 1];
  const delay = item.status === "Active" ? delayInfo(item[`planned_${n}`], now) : null;
  const doneCount = item.status === "Completed" ? NEW_LAUNCH_TOTAL_STEPS : Math.max(0, n - 1);
  const pct = Math.round((doneCount / NEW_LAUNCH_TOTAL_STEPS) * 100);
  const history = parseJson<NewLaunchHistoryEntry[]>(item.history, []);
  const fields = parseJson<Record<string, string>>(item.fields, {});
  const rejections = history.filter((h) => h.action === "rejected");
  const launched = !!item[`actual_${NEW_LAUNCH_LAUNCH_STEP}`];
  const brief = briefOf(item);

  return (
    <div className={`${card} overflow-hidden ${delay?.overdue ? "border-l-4 border-l-red-500" : ""}`}>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-900 text-[13px] font-semibold text-slate-600 dark:text-slate-300">{item.launch_no}</span>
              <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white">{item.product_name}</h3>
              {launched && <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[13px] font-semibold">🚀 Launched</span>}
              {item.status === "Completed" && <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[13px] font-semibold">Completed</span>}
              {item.status === "Cancelled" && <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-[13px] font-semibold">Cancelled</span>}
              {rejections.length > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 text-[13px] font-semibold">{rejections.length} rework</span>}
              {brief.priority === "High" && <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[13px] font-semibold">High priority</span>}
            </div>
            {(brief.category || brief.target_mrp) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[13px]">
                {brief.category && <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-300 font-semibold">{brief.category}</span>}
                {brief.target_mrp && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200">MRP ₹{brief.target_mrp}</span>}
                {brief.target_cost && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200">Cost ₹{brief.target_cost}</span>}
                {brief.first_order_qty && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200">{brief.first_order_qty} pcs</span>}
                {brief.target_launch_month && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200">Target {fmtMonth(brief.target_launch_month)}</span>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> {item.filled_by || "—"}</span>
              <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" /> Form: {fmtDate(item.form_date)}</span>
              {item.launch_date && <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold"><RocketLaunchIcon className="w-3.5 h-3.5" /> Launch: {fmtDate(item.launch_date)}</span>}
            </div>
            {item.remark && <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">“{item.remark}”</p>}
          </div>

          {item.status === "Active" && step && (
            <div className="w-full sm:w-auto sm:min-w-[260px] rounded-lg border border-slate-200 dark:border-navy-700 p-3 bg-slate-50 dark:bg-navy-900">
              <p className="text-[12px] text-slate-500">Step {n} of {NEW_LAUNCH_TOTAL_STEPS} · {step.phase}</p>
              <p className="text-[14px] font-semibold text-slate-800 dark:text-white leading-snug">{step.name}</p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Doer: <span className={`font-semibold ${mine ? "text-[#2563EB]" : "text-slate-700 dark:text-slate-200"}`}>{step.doer}{mine ? " (you)" : ""}</span>
              </p>
              <p className="text-[13px] mt-0.5">
                <span className="text-slate-500">Planned {fmtDateTime(item[`planned_${n}`])}</span>
                {delay && <span className={`ml-2 font-semibold ${delay.cls}`}>{delay.text}</span>}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {step.approval ? (
                  isAdmin ? (
                    <>
                      <button onClick={() => onAction("approve")} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-semibold"><CheckCircleIcon className="w-4 h-4" /> Approve</button>
                      <button onClick={() => onAction("reject")} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-lg bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold"><XCircleIcon className="w-4 h-4" /> Reject</button>
                    </>
                  ) : (
                    <span className="text-[13px] text-amber-700 dark:text-amber-400 font-semibold">Waiting for {step.approval.by} approval</span>
                  )
                ) : (
                  <button onClick={() => onAction("complete")} className={btnPrimary}><CheckCircleIcon className="w-4 h-4" /> Mark done</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-navy-900 overflow-hidden">
            <div className={`h-full ${item.status === "Completed" ? "bg-emerald-500" : "bg-[#2563EB]"}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[13px] text-slate-500 w-12 text-right">{pct}%</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={onToggle} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] min-h-[36px]">
            {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />} {expanded ? "Hide" : "Show"} all steps & history
          </button>
          <div className="ml-auto flex flex-wrap gap-1">
            {item.status !== "Cancelled" && (
              <button onClick={onEdit} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700" title="Edit"><PencilSquareIcon className="w-4 h-4" /></button>
            )}
            {item.status === "Active" && (
              <button onClick={() => onAction("cancel")} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700" title="Cancel launch"><NoSymbolIcon className="w-4 h-4" /></button>
            )}
            {item.status === "Cancelled" && (
              <button onClick={onRestore} className="inline-flex items-center gap-1 px-2 min-h-[36px] rounded-lg text-[13px] font-semibold text-[#2563EB] hover:bg-blue-50"><ArrowUturnLeftIcon className="w-4 h-4" /> Restore</button>
            )}
            {isAdmin && (
              <button onClick={onDelete} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete"><TrashIcon className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-navy-700 bg-slate-50/60 dark:bg-navy-900/40 p-3 space-y-3">
          <BriefView item={item} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[720px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1.5 px-2 font-semibold">#</th>
                  <th className="py-1.5 px-2 font-semibold">Step</th>
                  <th className="py-1.5 px-2 font-semibold">Doer</th>
                  <th className="py-1.5 px-2 font-semibold">Planned</th>
                  <th className="py-1.5 px-2 font-semibold">Actual</th>
                  <th className="py-1.5 px-2 font-semibold">Done by / remark</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => {
                  const planned = item[`planned_${s.n}`];
                  const actual = item[`actual_${s.n}`];
                  const isCurrent = item.status === "Active" && s.n === n;
                  const late = actual && planned && new Date(actual) > new Date(planned);
                  const stepFields = (s.fields || []).map((f) => ({ f, v: fields[`${s.n}_${f.key}`] })).filter((x) => x.v);
                  const rework = rejections.filter((r) => r.step === s.n).length;
                  return (
                    <tr key={s.n} className={`border-t border-slate-100 dark:border-navy-800 ${isCurrent ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                      <td className="py-1.5 px-2 text-slate-400">{s.n}</td>
                      <td className="py-1.5 px-2 text-slate-700 dark:text-slate-200">
                        <span className={s.approval ? "text-amber-700 dark:text-amber-400" : s.launch ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}>{s.name}</span>
                        {rework > 0 && <span className="ml-1 text-red-600">({rework}× rejected)</span>}
                        {stepFields.map(({ f, v }) => (
                          <div key={f.key} className="text-slate-500">
                            {f.label}: {f.type === "url" ? <a href={v} target="_blank" rel="noreferrer" className="text-[#2563EB] underline inline-flex items-center gap-0.5"><LinkIcon className="w-3 h-3" />open</a> : f.type === "date" ? fmtDate(v) : v}
                          </div>
                        ))}
                      </td>
                      <td className="py-1.5 px-2 text-slate-500">{s.doer}</td>
                      <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{fmtDateTime(planned)}</td>
                      <td className={`py-1.5 px-2 whitespace-nowrap ${actual ? (late ? "text-red-600" : "text-emerald-600") : "text-slate-400"}`}>
                        {actual ? fmtDateTime(actual) : isCurrent ? "Pending" : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-slate-500">
                        {item[`done_by_${s.n}`]}{item[`remark_${s.n}`] ? ` — ${item[`remark_${s.n}`]}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {history.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 mb-1">History</p>
              <ul className="space-y-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                {[...history].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="text-slate-400">{fmtDateTime(h.at)}</span> · <span className="font-semibold">{h.by || "—"}</span>{" "}
                    <span className={h.action === "rejected" ? "text-red-600" : h.action === "approved" ? "text-emerald-600" : ""}>{h.action}</span>
                    {h.step ? ` step ${h.step}` : ""}{h.remark ? ` — ${h.remark}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-navy-800 w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-navy-700">
          <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"><XMarkIcon className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[13px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{children}</label>;
}

function todayIST() {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

function briefOf(item: NewLaunch): Record<string, string> {
  const fields = parseJson<Record<string, string>>(item.fields, {});
  const out: Record<string, string> = {};
  NEW_LAUNCH_BRIEF_FIELDS.forEach((f) => { out[f.key] = fields[`0_${f.key}`] || ""; });
  return out;
}

function fmtMonth(v?: string) {
  if (!v || !/^\d{4}-\d{2}$/.test(v)) return v || "";
  return new Date(`${v}-01T00:00:00+05:30`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: IST });
}

function FieldInput({ f, value, onChange, autoFocus }: { f: NewLaunchField; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  if (f.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} autoFocus={autoFocus}>
        <option value="">Select…</option>
        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "textarea") {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={inputCls} placeholder={f.placeholder} autoFocus={autoFocus} />;
  }
  return (
    <input
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : f.type === "month" ? "month" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      placeholder={f.placeholder || (f.type === "url" ? "https://…" : f.type === "month" ? "YYYY-MM" : "")}
      step={f.type === "number" ? "any" : undefined}
      min={f.type === "number" ? 0 : undefined}
      autoFocus={autoFocus}
    />
  );
}

/** Read-only product brief — shown on the card's detail and in every step popup. */
function BriefView({ item, compact }: { item: NewLaunch; compact?: boolean }) {
  const b = briefOf(item);
  const rows = NEW_LAUNCH_BRIEF_FIELDS.filter((f) => b[f.key]);
  if (rows.length === 0) return null;
  return (
    <div className={`rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 ${compact ? "p-2.5" : "p-3"}`}>
      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Product brief</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        {rows.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <dt className="inline text-slate-500">{f.label.replace(/ \(.*\)$/, "")}: </dt>
            <dd className="inline text-slate-800 dark:text-slate-100 whitespace-pre-line">
              {f.type === "url" ? <a href={b[f.key]} target="_blank" rel="noreferrer" className="text-[#2563EB] underline">open link</a>
                : f.type === "month" ? fmtMonth(b[f.key])
                : f.key === "target_mrp" || f.key === "target_cost" ? `₹${b[f.key]}`
                : b[f.key]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type LaunchFormValues = { product_name: string; form_date: string; remark: string; form: Record<string, string> };

function LaunchFormModal({ item, onClose, onSubmit }: { item: NewLaunch | null; onClose: () => void; onSubmit: (v: LaunchFormValues) => Promise<void> }) {
  const [product, setProduct] = useState(item?.product_name || "");
  const [date, setDate] = useState(item?.form_date || todayIST());
  const [remark, setRemark] = useState(item?.remark || "");
  const [form, setForm] = useState<Record<string, string>>(() => {
    const b = item ? briefOf(item) : {};
    return { ...b, priority: b.priority || "Normal" };
  });
  const [busy, setBusy] = useState(false);
  const missing = [
    ...(product.trim() ? [] : ["Product name"]),
    ...NEW_LAUNCH_BRIEF_FIELDS.filter((f) => f.required && !String(form[f.key] || "").trim()).map((f) => f.label),
  ];
  return (
    <Modal title={item ? `Edit ${item.launch_no}` : "Upcoming New Launch"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing.length) return;
          setBusy(true);
          await onSubmit({ product_name: product, form_date: date, remark, form });
          setBusy(false);
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Product name *</Label>
            <input autoFocus required value={product} onChange={(e) => setProduct(e.target.value)} className={inputCls} placeholder="e.g. TWS Earbuds R-55" />
          </div>
          <div>
            <Label>Date</Label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          {NEW_LAUNCH_BRIEF_FIELDS.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <Label>{f.label}{f.required ? " *" : ""}</Label>
              <FieldInput f={f} value={form[f.key] || ""} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label>Remark</Label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className={inputCls} placeholder="Anything else the team should know" />
          </div>
        </div>
        {missing.length > 0 && <p className="text-[13px] text-amber-700 dark:text-amber-400">Still needed: {missing.join(", ")}</p>}
        {!item && missing.length === 0 && <p className="text-[13px] text-slate-500">Filled by you. Step 1 (Final Vendor — Himanshi, 5 days) starts as soon as you save.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy || missing.length > 0} className={btnPrimary}>{busy ? "Saving…" : item ? "Save" : "Start launch"}</button>
        </div>
      </form>
    </Modal>
  );
}

function StepActionModal({
  item, mode, step, steps, onClose, onSubmit,
}: {
  item: NewLaunch;
  mode: "complete" | "approve" | "reject" | "cancel";
  step?: NewLaunchStep;
  steps: NewLaunchStep[];
  onClose: () => void;
  onSubmit: (remark: string, fields: Record<string, string>) => Promise<void>;
}) {
  const [remark, setRemark] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const needsRemark = mode === "reject" || mode === "cancel";
  const fieldList = mode === "complete" ? step?.fields || [] : [];
  const missing = fieldList.some((f) => f.required && !String(values[f.key] || "").trim()) || (needsRemark && !remark.trim());
  const rework = step?.approval ? steps[step.approval.reworkStep - 1] : undefined;

  const title = {
    complete: `Step ${step?.n} — ${step?.name}`,
    approve: `Approve — ${step?.name}`,
    reject: `Reject — ${step?.name}`,
    cancel: `Cancel ${item.launch_no}`,
  }[mode];

  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing) return;
          setBusy(true);
          await onSubmit(remark.trim(), values);
          setBusy(false);
        }}
      >
        <p className="text-[14px] text-slate-600 dark:text-slate-300"><span className="font-semibold">{item.product_name}</span> · {item.launch_no}</p>
        {step?.detail && mode !== "cancel" && <p className="text-[13px] text-slate-500">{step.detail}</p>}
        {mode !== "cancel" && <BriefView item={item} compact />}
        {mode === "reject" && rework && (
          <p className="text-[13px] p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
            Goes back to Step {rework.n} — {rework.name} ({rework.doer}) for rework.
          </p>
        )}
        {mode === "approve" && <p className="text-[13px] text-slate-500">Moves to Step {(step?.n || 0) + 1} — {steps[step?.n || 0]?.name}.</p>}
        {fieldList.map((f) => (
          <div key={f.key}>
            <Label>{f.label}{f.required ? " *" : ""}</Label>
            <FieldInput f={f} value={values[f.key] || ""} onChange={(val) => setValues((v) => ({ ...v, [f.key]: val }))} />
          </div>
        ))}
        <div>
          <Label>{needsRemark ? (mode === "reject" ? "What needs to change? *" : "Reason for cancelling *") : "Remark"}</Label>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} className={inputCls} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Close</button>
          <button
            type="submit"
            disabled={busy || missing}
            className={`${btnPrimary} ${mode === "reject" || mode === "cancel" ? "!bg-red-600 hover:!bg-red-700" : mode === "approve" ? "!bg-emerald-600 hover:!bg-emerald-700" : ""}`}
          >
            {busy ? "Saving…" : { complete: "Mark done", approve: "Approve", reject: "Reject & send back", cancel: "Cancel launch" }[mode]}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfigModal({ steps, onClose, onSave }: { steps: NewLaunchStep[]; onClose: () => void; onSave: (c: { step: number; doer: string; tat_days: number }[]) => Promise<void> }) {
  const [rows, setRows] = useState(() => steps.map((s) => ({ step: s.n, name: s.name, doer: s.doer, tat_days: String(s.tatDays), launch: !!s.launch })));
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Step setup — doer & TAT" onClose={onClose} wide>
      <p className="text-[13px] text-slate-500 mb-3">TAT is in working days (9:30 AM–6:30 PM, Sundays off). Changes apply to the next planned dates.</p>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.step} className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_1fr_11rem_6rem] gap-2 items-center">
            <span className="text-[13px] text-slate-400">{r.step}</span>
            <span className="text-[13px] text-slate-700 dark:text-slate-200">{r.name}</span>
            <input value={r.doer} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, doer: e.target.value } : x)))} className={`${inputCls} col-start-2 sm:col-start-auto`} />
            {r.launch ? (
              <span className="text-[12px] text-slate-400 col-start-2 sm:col-start-auto">Launch date</span>
            ) : (
              <input type="number" min={0} step="0.5" value={r.tat_days} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, tat_days: e.target.value } : x)))} className={`${inputCls} col-start-2 sm:col-start-auto`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className={btnGhost}>Close</button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(rows.map((r) => ({ step: r.step, doer: r.doer, tat_days: Number(r.tat_days) || 0 })));
            setBusy(false);
          }}
          className={btnPrimary}
        >
          {busy ? "Saving…" : "Save setup"}
        </button>
      </div>
    </Modal>
  );
}

function FlowModal({ steps, onClose }: { steps: NewLaunchStep[]; onClose: () => void }) {
  return (
    <Modal title="New Launch flow — 42 steps" onClose={onClose} wide>
      <ol className="space-y-1.5">
        <li className="flex items-center gap-2 text-[14px] text-slate-700 dark:text-slate-200"><span className="w-7 text-center">📋</span> Form fill — Product name, filled by, date, remark</li>
        {steps.map((s) => (
          <li key={s.n} className={`flex items-start gap-2 p-2 rounded-lg text-[14px] ${s.approval ? "bg-amber-50 dark:bg-amber-900/20" : s.launch ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-slate-50 dark:bg-navy-900"}`}>
            <span className="w-7 shrink-0 text-center font-semibold text-slate-500">{s.n}</span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 dark:text-white">{s.launch ? "🎉 " : ""}{s.name}</p>
              <p className="text-[13px] text-slate-500">
                {s.approval ? `Approved by ${s.approval.by} · ❌ Reject → back to Step ${s.approval.reworkStep}` : `Doer: ${s.doer} · ${s.launch ? "As per launch date" : `${s.tatDays} day${s.tatDays === 1 ? "" : "s"}`}`}
                {s.detail ? ` · ${s.detail}` : ""}
              </p>
            </div>
          </li>
        ))}
        <li className="flex items-center gap-2 text-[14px] text-emerald-700 dark:text-emerald-400 font-semibold"><span className="w-7 text-center">✅</span> Process complete</li>
      </ol>
    </Modal>
  );
}
