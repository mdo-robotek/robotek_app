"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Quick Delegate (Sahil, 2026-10-28): scan the QR on a phone, assign a task to
// anyone in a few taps. Saved through POST /api/delegations — exactly like the
// dashboard form — so it lands in the doer's Delegations and the doer gets the
// usual WhatsApp. "Assigned by" is always the logged-in person.
// ?to=USERNAME pre-selects the doer (desk QR for one person).

type Person = { username: string; designation: string; department: string; image_url: string };
type Data = { me: string; people: Person[]; departments: string[] };

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Failed to load");
    return j;
  });

function defaultDue(): string {
  // Today 6:30 PM, or tomorrow 6:30 PM if it's already past 5:30 PM (phone local time = IST).
  const d = new Date();
  if (d.getHours() * 60 + d.getMinutes() > 17 * 60 + 30) d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
  d.setHours(18, 30, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const input = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[16px] text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";
const label = "block text-[14px] font-semibold text-slate-700 mb-1.5";

function QuickDelegate() {
  const params = useSearchParams();
  const presetTo = params.get("to") || "";
  const { data, error, isLoading } = useSWR<Data>("/api/delegations/quick", fetcher, { revalidateOnFocus: false });

  const [to, setTo] = useState(presetTo);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(defaultDue);
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [department, setDepartment] = useState("");
  const [evidence, setEvidence] = useState<"No" | "Yes">("No");
  const [photo, setPhoto] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; to: string } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);

  const people = useMemo(() => data?.people || [], [data]);
  const toPerson = people.find((p) => p.username.toLowerCase() === to.toLowerCase());

  // Pre-fill department from the doer.
  useEffect(() => {
    if (toPerson?.department) setDepartment(toPerson.department);
  }, [toPerson?.username, toPerson?.department]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = people.filter((p) => p.username.toLowerCase() !== (data?.me || "").toLowerCase());
    return q ? list.filter((p) => `${p.username} ${p.designation} ${p.department}`.toLowerCase().includes(q)) : list;
  }, [people, search, data?.me]);

  const missing = !toPerson ? "Choose who will do it" : !title.trim() ? "Write the task" : !due ? "Pick the due time" : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing || !toPerson) { setErr(missing); return; }
    setBusy(true);
    setErr("");
    const now = new Date().toISOString();
    const dueIso = new Date(due).toISOString();
    const delegationData = {
      id: "",
      title: title.trim(),
      description: description.trim(),
      assigned_by: data?.me || "",
      assigned_to: toPerson.username,
      department,
      priority,
      due_date: dueIso,
      status: "Pending",
      voice_note_url: "",
      reference_docs: "",
      evidence_required: evidence,
      created_at: now,
      updated_at: now,
    };
    const body = new FormData();
    body.append("delegationData", JSON.stringify(delegationData));
    if (voice) body.append("voice_note", voice);
    if (photo) body.append("reference_doc", photo);
    try {
      const res = await fetch("/api/delegations", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Could not save. Please try again.");
      setDone({ id: String(j?.delegation?.id || ""), to: toPerson.username });
    } catch (e2) {
      setErr(String((e2 as Error).message || e2));
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setDone(null);
    setTitle("");
    setDescription("");
    setPhoto(null);
    setVoice(null);
    setDue(defaultDue());
    setPriority("Medium");
    setEvidence("No");
    if (!presetTo) { setTo(""); setSearch(""); }
  };

  if (done) {
    return (
      <Shell>
        <div className="text-center py-10">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✓</div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Task assigned</h2>
          <p className="mt-1 text-[15px] text-slate-600">{done.id ? `#${done.id} · ` : ""}to <b>{done.to}</b></p>
          <p className="mt-1 text-[14px] text-slate-500">It is in their Delegations now and they get a WhatsApp.</p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={again} className="w-full min-h-[48px] rounded-xl bg-[#2563EB] text-white text-[16px] font-semibold">Assign another task</button>
            <a href="/delegations" className="w-full min-h-[48px] rounded-xl border border-slate-200 text-slate-700 text-[16px] font-semibold flex items-center justify-center">Open Delegations</a>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {error && <p className="mb-3 p-3 rounded-xl bg-red-50 text-red-700 text-[14px]">{String(error.message || error)}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className={label}>Assign to *</span>
          {toPerson ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-[#2563EB] bg-blue-50">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-slate-900 truncate">{toPerson.username}</p>
                <p className="text-[13px] text-slate-500 truncate">{[toPerson.designation, toPerson.department].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <button type="button" onClick={() => { setTo(""); setSearch(""); }} className="shrink-0 px-3 min-h-[40px] rounded-lg bg-white border border-slate-200 text-[14px] font-semibold text-slate-700">Change</button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isLoading ? "Loading people…" : "Search name"} className="w-full px-4 py-3 text-[16px] outline-none border-b border-slate-100" />
              <div className="max-h-64 overflow-y-auto">
                {matches.slice(0, 60).map((p) => (
                  <button type="button" key={p.username} onClick={() => setTo(p.username)} className="w-full text-left px-4 py-3 border-b border-slate-50 active:bg-blue-50">
                    <p className="text-[15px] font-semibold text-slate-800">{p.username}</p>
                    <p className="text-[13px] text-slate-500">{[p.designation, p.department].filter(Boolean).join(" · ") || "—"}</p>
                  </button>
                ))}
                {!isLoading && matches.length === 0 && <p className="px-4 py-3 text-[14px] text-slate-500">No one found</p>}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={label} htmlFor="t">Task *</label>
          <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="What needs to be done" maxLength={200} />
        </div>
        <div>
          <label className={label} htmlFor="d">Details</label>
          <textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={input} placeholder="Any instructions" />
        </div>
        <div>
          <label className={label} htmlFor="due">Due *</label>
          <input id="due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
        </div>
        <div>
          <span className={label}>Priority</span>
          <div className="grid grid-cols-3 gap-2">
            {(["Low", "Medium", "High"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPriority(p)}
                className={`min-h-[44px] rounded-xl border-2 text-[15px] font-semibold ${priority === p
                  ? p === "High" ? "bg-red-600 border-red-600 text-white" : p === "Medium" ? "bg-amber-500 border-amber-500 text-white" : "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-200 text-slate-600 bg-white"}`}>{p}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={label} htmlFor="dep">Department</label>
          <select id="dep" value={department} onChange={(e) => setDepartment(e.target.value)} className={input}>
            <option value="">—</option>
            {(data?.departments || []).map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => photoRef.current?.click()} className={`min-h-[48px] rounded-xl border-2 text-[14px] font-semibold ${photo ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-white"}`}>
            {photo ? "📎 Photo added" : "📷 Add photo / file"}
          </button>
          <button type="button" onClick={() => voiceRef.current?.click()} className={`min-h-[48px] rounded-xl border-2 text-[14px] font-semibold ${voice ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-white"}`}>
            {voice ? "🎙️ Voice added" : "🎙️ Voice note"}
          </button>
          <input ref={photoRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          <input ref={voiceRef} type="file" accept="audio/*" capture className="hidden" onChange={(e) => setVoice(e.target.files?.[0] || null)} />
        </div>
        <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white">
          <span className="text-[15px] text-slate-700">Proof needed when done</span>
          <input type="checkbox" checked={evidence === "Yes"} onChange={(e) => setEvidence(e.target.checked ? "Yes" : "No")} className="w-6 h-6 accent-[#2563EB]" />
        </label>

        {err && <p className="p-3 rounded-xl bg-red-50 text-red-700 text-[14px]">{err}</p>}
        <button type="submit" disabled={busy || !!missing} className="w-full min-h-[52px] rounded-xl bg-[#2563EB] text-white text-[17px] font-semibold disabled:opacity-50">
          {busy ? "Assigning…" : missing || "Assign task"}
        </button>
        <p className="text-center text-[13px] text-slate-400">Assigned by {data?.me || "you"}</p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-[#2563EB] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[17px] font-semibold leading-tight">Assign a task</p>
          <p className="text-[12px] text-blue-100">Robotek · Delegation</p>
        </div>
        <a href="/delegations" className="text-[13px] font-semibold text-blue-100 underline">My delegations</a>
      </header>
      <main className="max-w-md mx-auto p-4 pb-10">{children}</main>
    </div>
  );
}

export default function QuickDelegatePage() {
  return (
    <Suspense fallback={null}>
      <QuickDelegate />
    </Suspense>
  );
}
