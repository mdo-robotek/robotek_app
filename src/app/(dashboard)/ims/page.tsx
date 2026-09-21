"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { 
  ClipboardDocumentListIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  ScaleIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  CubeTransparentIcon,
  InformationCircleIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import IMSMaster from "./IMSMaster";
import IMSFloor from "./IMSFloor";
import IMSFinal from "./IMSFinal";

const fetcher = (url: string) => fetch(url).then(res => res.json());

type ImsLocation = "sfg" | "master" | "1st" | "final";

type CalcSource = { label: string; detail: string };

type ImsCalcInfo = {
  title: string;
  formula: string;
  inSources: CalcSource[];
  outSources: CalcSource[];
  liveHow: string;
  approvalHow?: string;
};

const IMS_CALC_INFO: Record<ImsLocation, ImsCalcInfo> = {
  master: {
    title: "IMS - G Floor",
    formula: "Live Stock = IN − OUT",
    inSources: [
      {
        label: "GRN Sheet — Packed items",
        detail:
          "Sum of GRN Qty for Packed items (and older GRN rows with no Packed/Unpacked value). Unpacked GRN is counted on SFG IMS instead. Cancelled and Rejected GRN rows are excluded.",
      },
      {
        label: "IMS-G Floor Sheet (in_qty)",
        detail:
          "Manual Production IN entries and Physical Check IN adjustments logged on the G Floor ledger sheet.",
      },
      {
        label: "1st Floor OUT → G Floor IN (auto transfer)",
        detail:
          "Every OUT qty recorded on IMS-1st Floor is treated as an IN transfer to G Floor. No manual Production IN needed for floor-to-floor movement.",
      },
    ],
    outSources: [
      {
        label: "O2D Out Form Sheet",
        detail:
          "Sum of Out Form line-item quantities whose item names match the G Floor catalog.",
      },
      {
        label: "IMS-G Floor Sheet (out_qty)",
        detail:
          "Physical Check OUT adjustments logged on the G Floor ledger sheet when physical count is lower than live stock.",
      },
    ],
    liveHow:
      "For each catalog item (and pending GRN/O2D orphans): total IN minus total OUT. Orphan items from movement only also appear in the table.",
    approvalHow:
      "Date-Wise tab lists all IN/OUT movements (newest date first). Select rows to Mark Checked and/or Approve — both save to the IMS-G Floor Approval sheet (Checked Status + Approval Status). Works for GRN, O2D, G Floor, Production, and 1st OUT virtual entries.",
  },
  "1st": {
    title: "IMS - 1st Floor",
    formula: "Live Stock = IN − OUT",
    inSources: [
      {
        label: "SFG In (1st Floor) → SFG OUT + 1st Floor IN",
        detail:
          "Use SFG In on 1st Floor IMS. That books packed OUT on SFG and the same qty as IN on 1st Floor with source SFG.",
      },
      {
        label: "IMS-1st Floor Sheet (in_qty)",
        detail: "Sum of every in_qty row from manual bulk entry or Physical Check IN adjustments.",
      },
    ],
    outSources: [
      {
        label: "IMS-1st Floor Sheet (out_qty)",
        detail:
          "Sum of every out_qty row from manual bulk entry or Physical Check OUT adjustments. Each OUT also creates a pending IN on G Floor.",
      },
    ],
    liveHow: "For each ledger row: in_qty − out_qty, aggregated per item name across all rows.",
  },
  sfg: {
    title: "SFG IMS",
    formula: "Live Stock = IN − OUT",
    inSources: [
      {
        label: "GRN Sheet — Unpacked items",
        detail:
          "Unpacked GRN qty is auto-IN on SFG IMS. There is no manual IN. Check and verify Date-Wise rows only.",
      },
    ],
    outSources: [
      {
        label: "IMS-SFG Floor Sheet (out_qty)",
        detail:
          "Use SFG In on 1st Floor IMS. Each save books packed OUT on SFG and IN on 1st Floor (source SFG).",
      },
    ],
    liveHow: "Unpacked GRN IN minus packed transfers OUT to 1st Floor, aggregated per item.",
  },
  final: {
    title: "Final IMS",
    formula: "G Floor totals + SFG totals + 1st Floor totals",
    inSources: [
      {
        label: "IMS - G Floor IN",
        detail: "Packed GRN + G Floor ledger IN + 1st Floor OUT transfers.",
      },
      {
        label: "SFG IMS IN",
        detail: "Unpacked GRN auto-IN.",
      },
      {
        label: "IMS - 1st Floor IN",
        detail: "SFG packed transfers plus all in_qty from the 1st Floor ledger sheet.",
      },
    ],
    outSources: [
      {
        label: "IMS - G Floor OUT",
        detail: "O2D Out Form + G Floor ledger OUT.",
      },
      {
        label: "IMS - 1st Floor OUT",
        detail: "All out_qty from the 1st Floor ledger sheet.",
      },
      {
        label: "SFG IMS OUT",
        detail: "Packed transfers from SFG to 1st Floor.",
      },
    ],
    liveHow: "G Floor Live Stock + SFG Live Stock + 1st Floor Live Stock.",
  },
};

const formatMetric = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const getLiveStockFontClass = (value: number) => {
  const length = formatMetric(value).length;
  if (length > 13) return "text-lg sm:text-xl";
  if (length > 10) return "text-2xl sm:text-3xl";
  if (length > 8) return "text-3xl";
  return "text-4xl";
};

const getInOutFontClass = (value: number) => {
  const length = formatMetric(value).length;
  if (length > 11) return "text-xs sm:text-sm";
  if (length > 9) return "text-sm sm:text-base";
  if (length > 7) return "text-base";
  return "text-lg";
};

export default function IMSHub() {
  const [activeLocation, setActiveLocation] = useState<ImsLocation | null>(null);
  const [infoLocation, setInfoLocation] = useState<ImsLocation | null>(null);
  
  const { data: summary, isLoading } = useSWR(activeLocation === null ? "/api/ims/summary" : null, fetcher);

  if (activeLocation === "master") {
    return <IMSMaster onBack={() => setActiveLocation(null)} />;
  }

  if (activeLocation === "sfg") {
    return <IMSFloor location={activeLocation} onBack={() => setActiveLocation(null)} />;
  }

  if (activeLocation === "1st") {
    return <IMSFloor location={activeLocation} onBack={() => setActiveLocation(null)} />;
  }

  if (activeLocation === "final") {
    return <IMSFinal onBack={() => setActiveLocation(null)} />;
  }

  const finalData = summary ? {
    liveStock: (summary.main?.liveStock || 0) + (summary.sfg?.liveStock || 0) + (summary.first?.liveStock || 0),
    totalIn: (summary.main?.totalIn || 0) + (summary.sfg?.totalIn || 0) + (summary.first?.totalIn || 0),
    totalOut: (summary.main?.totalOut || 0) + (summary.sfg?.totalOut || 0) + (summary.first?.totalOut || 0),
  } : undefined;

  const renderTile = (
    id: ImsLocation, 
    title: string, 
    subtitle: string, 
    icon: React.ReactNode, 
    data: any,
    gradient: string,
    shadow: string
  ) => {
    return (
      <div 
        onClick={() => setActiveLocation(id)}
        className={`relative rounded-3xl p-6 shadow-xl ${shadow} transition-all duration-300 group flex flex-col justify-between border border-white/10 ${gradient} hover:shadow-2xl hover:-translate-y-2 cursor-pointer`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"></div>
        </div>

        <button
          type="button"
          title="How IN / OUT are calculated"
          onClick={(e) => {
            e.stopPropagation();
            setInfoLocation(id);
          }}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-white/15 hover:bg-white/30 border border-white/25 text-white transition-colors"
        >
          <InformationCircleIcon className="w-5 h-5" />
        </button>
        
        <div className="relative mb-10 z-10 pr-8">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl transition-all duration-300 shadow-sm group-hover:shadow-md shrink-0">
              <div className="text-white w-7 h-7 transition-colors duration-300">
                {icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base lg:text-lg xl:text-xl font-black text-white uppercase tracking-tight leading-snug transition-colors">
                {title}
              </h2>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1 leading-snug">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="relative space-y-4 animate-pulse z-10">
            <div className="h-16 bg-white/20 rounded-2xl w-full"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-white/20 rounded-2xl w-full"></div>
              <div className="h-16 bg-white/20 rounded-2xl w-full"></div>
            </div>
          </div>
        ) : (
          <div className="relative space-y-4 z-10 min-w-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 transition-colors shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-white/80 uppercase tracking-widest flex items-center gap-1.5">
                  <ScaleIcon className="w-4 h-4 text-white/80"/> Live Stock
                </span>
              </div>
              <div
                className={`${getLiveStockFontClass(data.liveStock)} font-black tracking-tight leading-none break-words [overflow-wrap:anywhere] ${data.liveStock < 0 ? "text-rose-300" : "text-white"} transition-colors`}
                title={formatMetric(data.liveStock)}
              >
                {formatMetric(data.liveStock)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/20 transition-colors min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs sm:text-sm font-black text-white/80 uppercase tracking-widest flex items-center gap-1.5">
                    <ArrowTrendingUpIcon className="w-4 h-4 shrink-0"/> In
                  </span>
                </div>
                <div
                  className={`${getInOutFontClass(data.totalIn)} font-black text-white leading-none whitespace-nowrap tabular-nums`}
                  title={formatMetric(data.totalIn)}
                >
                  {formatMetric(data.totalIn)}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/20 transition-colors min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-black text-white/80 uppercase tracking-widest flex items-center gap-1.5 leading-tight ${id === "1st" || id === "sfg" ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm"}`}>
                    <ArrowTrendingDownIcon className="w-4 h-4 shrink-0"/>
                    {id === "sfg" ? "Transfer to 1st Floor" : id === "1st" ? "Transfer to G Floor" : "Out"}
                  </span>
                </div>
                <div
                  className={`${getInOutFontClass(data.totalOut)} font-black text-white leading-none whitespace-nowrap tabular-nums`}
                  title={formatMetric(data.totalOut)}
                >
                  {formatMetric(data.totalOut)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] p-6">
      <div className="w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2 flex items-center gap-3">
            <ClipboardDocumentListIcon className="w-8 h-8 text-[#003875] dark:text-[#FFD500]" />
            IMS Dashboard Hub
          </h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest max-w-xl">
            Select an inventory management system location to view detailed stock metrics, manage inward/outward flow, and generate reports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {renderTile(
            "sfg",
            "SFG IMS",
            "Semi Finished Goods",
            <CubeTransparentIcon />,
            summary?.sfg,
            "bg-gradient-to-br from-teal-500 to-cyan-800",
            "shadow-teal-900/20"
          )}
          {renderTile(
            "master", 
            "IMS - G Floor", 
            "Ground Floor Storage", 
            <CubeIcon />, 
            summary?.main,
            "bg-gradient-to-br from-blue-600 to-indigo-800",
            "shadow-blue-900/20"
          )}
          {renderTile(
            "1st", 
            "IMS - 1st Floor", 
            "First Floor Storage", 
            <BuildingStorefrontIcon />, 
            summary?.first,
            "bg-gradient-to-br from-purple-600 to-fuchsia-800",
            "shadow-purple-900/20"
          )}
          {renderTile(
            "final",
            "Final IMS",
            "Total Storage Overview",
            <ClipboardDocumentListIcon />,
            finalData,
            "bg-gradient-to-br from-orange-500 to-amber-700",
            "shadow-orange-900/20"
          )}
        </div>

        {infoLocation && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setInfoLocation(null)}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-[#003875]">
                <div className="flex items-center gap-2 min-w-0">
                  <InformationCircleIcon className="w-5 h-5 text-[#FFD500] shrink-0" />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest truncate">
                    {IMS_CALC_INFO[infoLocation].title} — Calculation
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoLocation(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                <div className="rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 px-4 py-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Formula</p>
                  <p className="text-sm font-black text-[#003875] dark:text-[#FFD500]">{IMS_CALC_INFO[infoLocation].formula}</p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-600" />
                      <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">IN</p>
                    </div>
                    <ul className="space-y-3">
                      {IMS_CALC_INFO[infoLocation].inSources.map((source) => (
                        <li key={source.label} className="border-t border-emerald-100/80 dark:border-emerald-500/10 pt-3 first:border-t-0 first:pt-0">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Source</p>
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">{source.label}</p>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">How Calculated</p>
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-relaxed">{source.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-rose-100 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowTrendingDownIcon className="w-4 h-4 text-rose-600" />
                      <p className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">OUT</p>
                    </div>
                    <ul className="space-y-3">
                      {IMS_CALC_INFO[infoLocation].outSources.map((source) => (
                        <li key={source.label} className="border-t border-rose-100/80 dark:border-rose-500/10 pt-3 first:border-t-0 first:pt-0">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Source</p>
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">{source.label}</p>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">How Calculated</p>
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-relaxed">{source.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-900/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ScaleIcon className="w-4 h-4 text-blue-600" />
                      <p className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Live Stock</p>
                    </div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-relaxed">{IMS_CALC_INFO[infoLocation].liveHow}</p>
                  </div>

                  {IMS_CALC_INFO[infoLocation].approvalHow && (
                    <div className="rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-900/10 p-4">
                      <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">Date-Wise Approval</p>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-relaxed">{IMS_CALC_INFO[infoLocation].approvalHow}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
