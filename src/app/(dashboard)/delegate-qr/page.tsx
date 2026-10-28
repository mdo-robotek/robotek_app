"use client";

import React, { useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import QrCode from "@/components/QrCode";
import { PrinterIcon } from "@heroicons/react/24/outline";

type Person = { username: string; designation: string; department: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Printable QR posters for Quick Delegate (/delegate).
// "Anyone" QR: scan → assign a task to anyone. Desk QR: scan → doer pre-selected.
export default function DelegateQrPage() {
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const [person, setPerson] = useState("");
  const { data } = useSWR<{ people: Person[] }>("/api/delegations/quick", fetcher, { revalidateOnFocus: false });


  const generalUrl = origin ? `${origin}/delegate` : "";
  const personUrl = origin && person ? `${origin}/delegate?to=${encodeURIComponent(person)}` : "";

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">Delegation QR</h1>
          <p className="text-[14px] text-slate-500">Print and stick it up. Scan with any phone camera → log in once → assign a task in seconds.</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-lg bg-[#2563EB] text-white text-[14px] font-semibold">
          <PrinterIcon className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        <Poster title="Assign a task" subtitle="Scan to delegate work to anyone" url={generalUrl} />
        <div className="space-y-3">
          <div className="print:hidden bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Desk QR for one person (optional)</label>
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-[14px]">
              <option value="">Choose person…</option>
              {(data?.people || []).map((p) => (
                <option key={p.username} value={p.username}>{p.username}{p.designation ? ` — ${p.designation}` : ""}</option>
              ))}
            </select>
            <p className="text-[13px] text-slate-500 mt-1.5">Stick it at their desk: whoever scans it assigns a task straight to them.</p>
          </div>
          {person && <Poster title={`Assign to ${person}`} subtitle="Scan to give this person a task" url={personUrl} />}
        </div>
      </div>
    </div>
  );
}

function Poster({ title, subtitle, url }: { title: string; subtitle: string; url: string }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#2563EB] p-6 flex flex-col items-center text-center break-inside-avoid">
      <p className="text-[13px] font-semibold tracking-wide text-[#2563EB]">ROBOTEK · DELEGATION</p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="text-[14px] text-slate-500">{subtitle}</p>
      <div className="my-4">{url ? <QrCode value={url} size={240} /> : <div style={{ width: 240, height: 240 }} />}</div>
      <ol className="text-left text-[14px] text-slate-700 space-y-1">
        <li>1. Open phone camera and scan</li>
        <li>2. Log in with your ERP id (first time only)</li>
        <li>3. Choose person, write task, tap Assign</li>
      </ol>
      <p className="mt-3 text-[12px] text-slate-400 break-all">{url}</p>
    </div>
  );
}
