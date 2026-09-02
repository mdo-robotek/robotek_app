"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarIcon
} from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import TimeSeriesTable, { TimeBucket, Transaction } from "@/components/TimeSeriesTable";
import DateFilterBar, { FilterPeriod } from "@/components/DateFilterBar";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { matchesCategoryItemFilters } from "@/lib/ims-filters";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";

const fetcher = (url: string) => fetch(url).then(res => res.json());

const getHealthColors = (live: number) => {
  if (live < 0) return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10";
  if (live === 0) return "text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10";
  return "text-[#003875] dark:text-[#FFD500] bg-blue-50 dark:bg-[#FFD500]/10";
};

export default function IMSFinal({ onBack }: { onBack: () => void }) {
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [itemNameFilters, setItemNameFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [viewMode, setViewMode] = useState<'default' | 'timeseries' | 'datewise'>('default');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('ALL');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  const mappedTimeBucket: TimeBucket = useMemo(() => {
    if (filterPeriod === 'WEEK') return 'Weekly';
    if (filterPeriod === 'MONTH') return 'Monthly';
    if (filterPeriod === 'QUARTERLY' || filterPeriod === 'YEARLY') return 'Quarterly';
    return 'Daily';
  }, [filterPeriod]);

  const { data: masterItems = [], isLoading: isLoadingMaster } = useSWR("/api/ims", fetcher);
  const { data: firstItems = [], isLoading: isLoadingFirst } = useSWR("/api/ims/floor?location=1st", fetcher);

  const { data: timeSeriesData = [], isValidating: isTimeSeriesLoading } = useSWR<Transaction[]>(
    viewMode === 'timeseries' ? '/api/ims/time-series' : null,
    fetcher
  );

  const isLoading = isLoadingMaster || isLoadingFirst;

  const aggregatedItems = useMemo(() => {
    const map = new Map<string, any>();
    
    const addToMap = (sourceName: string) => (item: any) => {
      const name = item.item_name?.toLowerCase().trim();
      if (!name) return;
      const key = `${name}-${sourceName}`;
      if (!map.has(key)) {
        map.set(key, {
          item_name: (item.item_name ?? "").trim(),
          category: (item.category || "Uncategorized").trim(),
          source: sourceName,
          in_qty: 0, 
          out_qty: 0, 
          live_stock: 0 
        });
      }
      const agg = map.get(key)!;
      const inVal = parseFloat(item.in_qty) || 0;
      const outVal = parseFloat(item.out_qty) || 0;
      agg.in_qty += inVal;
      agg.out_qty += outVal;
      agg.live_stock += (inVal - outVal);
      // keep the latest category if not set
      if (agg.category === "Uncategorized" && item.category) {
        agg.category = item.category.trim();
      }
    };

    masterItems.forEach(addToMap('IMS - G Floor'));
    firstItems.forEach(addToMap('1st Floor IMS'));

    return Array.from(map.values()).sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [masterItems, firstItems]);

  const uniqueCategories = useMemo(() => {
    return Array.from(
      new Set(aggregatedItems.map((i) => (i.category ?? "").trim()).filter(Boolean))
    ).sort();
  }, [aggregatedItems]);

  const categoryOptions = useMemo(
    () => uniqueCategories.map((cat) => ({ id: cat, label: cat })),
    [uniqueCategories]
  );

  const uniqueItemNames = useMemo(() => {
    const source =
      categoryFilters.length > 0
        ? aggregatedItems.filter((i) =>
            matchesCategoryItemFilters(i, categoryFilters, [])
          )
        : aggregatedItems;
    return Array.from(new Set(source.map((i) => i.item_name))).filter(Boolean).sort();
  }, [aggregatedItems, categoryFilters]);

  const itemNameOptions = useMemo(
    () => uniqueItemNames.map((name) => ({ id: name, label: name })),
    [uniqueItemNames]
  );

  const filteredItems = useMemo(() => {
    return aggregatedItems.filter((item) =>
      matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)
    );
  }, [aggregatedItems, categoryFilters, itemNameFilters]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const handleExport = () => {
    if (viewMode === 'datewise') {
      const exportData = filteredDatewiseTransactions.map((log: any) => ({
        "Date": new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
        "Source": log.source,
        "Category": log.category,
        "Item Name": log.item_name,
        "In Qty": log.in_qty > 0 ? `+${log.in_qty}` : "-",
        "Out Qty": log.out_qty > 0 ? `-${log.out_qty}` : "-",
        "Live Stock": log.running_stock
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Final_IMS_Datewise");
      XLSX.writeFile(wb, `Final_IMS_Datewise_${new Date().toISOString().split("T")[0]}.xlsx`);
    } else {
      const exportData = filteredItems.map(item => ({
        "Source": item.source,
        Category: item.category,
        "Item Name": item.item_name,
        "Total In": item.in_qty,
        "Total Out": item.out_qty,
        "Live Stock": item.live_stock
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Final_IMS");
      XLSX.writeFile(wb, `Final_IMS_${new Date().toISOString().split("T")[0]}.xlsx`);
    }
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilters, itemNameFilters, viewMode, filterPeriod, filterDate, filterStartDate, filterEndDate]);

  React.useEffect(() => {
    setItemNameFilters((prev) => {
      if (prev.length === 0) return prev;
      const valid = new Set(uniqueItemNames);
      const next = prev.filter((name) => valid.has(name));
      return next.length === prev.length ? prev : next;
    });
  }, [categoryFilters, uniqueItemNames]);

  const combinedTransactions = useMemo(() => {
    const masterTxs = (timeSeriesData || []).map((item: any) => ({
      ...item,
      source: 'IMS - G Floor'
    }));
    
    const floorMapper = (sourceName: string) => (item: any): Transaction & { source: string } => ({
      item_name: item.item_name || '',
      category: item.category || 'Uncategorized',
      date: item.date || item.updated_at || '',
      in_qty: parseFloat(item.in_qty) || 0,
      out_qty: parseFloat(item.out_qty) || 0,
      source: sourceName
    });

    const firstTxs = (firstItems || []).map(floorMapper('1st Floor IMS'));

    return [...masterTxs, ...firstTxs];
  }, [timeSeriesData, firstItems]);

  const dateRange = useMemo(() => {
    let start, end;
    if (filterPeriod === 'CUSTOM') {
      if (!filterStartDate || !filterEndDate) return null;
      start = startOfDay(filterStartDate);
      end = endOfDay(filterEndDate);
    } else {
      switch (filterPeriod) {
        case 'ALL':
          return null;
        case 'DAY':
          start = startOfDay(filterDate);
          end = endOfDay(filterDate);
          break;
        case 'WEEK':
          start = startOfWeek(filterDate, { weekStartsOn: 1 });
          end = endOfWeek(filterDate, { weekStartsOn: 1 });
          break;
        case 'MONTH':
          start = startOfMonth(filterDate);
          end = endOfMonth(filterDate);
          break;
        case 'QUARTERLY':
          start = startOfQuarter(filterDate);
          end = endOfQuarter(filterDate);
          break;
        case 'YEARLY':
          start = startOfYear(filterDate);
          end = endOfYear(filterDate);
          break;
      }
    }
    return { start, end };
  }, [filterPeriod, filterDate, filterStartDate, filterEndDate]);

  const datewiseTransactions = useMemo(() => {
    const sortedAll = [...combinedTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const stockMap = new Map<string, number>();
    
    const itemsWithRunningStock = sortedAll.map(item => {
      const key = item.item_name.toLowerCase().trim();
      const inVal = item.in_qty || 0;
      const outVal = item.out_qty || 0;
      const current = (stockMap.get(key) || 0) + (inVal - outVal);
      stockMap.set(key, current);
      return { ...item, running_stock: current };
    });

    itemsWithRunningStock.reverse();

    if (!dateRange) return itemsWithRunningStock;
    return itemsWithRunningStock.filter(item => {
      const itemDate = new Date(item.date);
      return isWithinInterval(itemDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [combinedTransactions, dateRange]);

  const filteredDatewiseTransactions = useMemo(() => {
    return datewiseTransactions.filter((item) =>
      matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)
    );
  }, [datewiseTransactions, categoryFilters, itemNameFilters]);

  const datewiseTotalPages = Math.ceil(filteredDatewiseTransactions.length / itemsPerPage);
  const paginatedDatewiseTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDatewiseTransactions.slice(start, start + itemsPerPage);
  }, [filteredDatewiseTransactions, currentPage]);

  const filteredCombinedTransactions = useMemo(() => {
    return combinedTransactions.filter((item) =>
      matchesCategoryItemFilters(item, categoryFilters, itemNameFilters)
    );
  }, [combinedTransactions, categoryFilters, itemNameFilters]);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-700 rounded-xl shadow-lg shadow-orange-900/20">
              <ClipboardDocumentListIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-orange-600 dark:text-orange-500 uppercase tracking-tight leading-none mb-1">Final IMS</h1>
              <p className="text-[10px] font-black text-orange-600/70 dark:text-orange-500/70 uppercase tracking-widest">Total Storage Overview</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl shrink-0 self-start lg:self-auto">
          <button
            onClick={() => setViewMode('default')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'default' 
                ? 'bg-white dark:bg-[#111827] text-orange-600 dark:text-[#FFD500] shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <TableCellsIcon className="w-4 h-4" /> Default
          </button>
          <button
            onClick={() => setViewMode('timeseries')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'timeseries' 
                ? 'bg-white dark:bg-[#111827] text-orange-600 dark:text-[#FFD500] shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <ChartBarIcon className="w-4 h-4" /> Time Series
          </button>
          <button
            onClick={() => setViewMode('datewise')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'datewise' 
                ? 'bg-white dark:bg-[#111827] text-orange-600 dark:text-[#FFD500] shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <CalendarIcon className="w-4 h-4" /> Date-Wise
          </button>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-500 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border border-orange-200 dark:border-orange-500/20 shadow-sm whitespace-nowrap">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-2 shrink-0">
        <DateFilterBar 
          period={filterPeriod}
          setPeriod={setFilterPeriod}
          currentDate={filterDate}
          setCurrentDate={setFilterDate}
          startDate={filterStartDate}
          setStartDate={setFilterStartDate}
          endDate={filterEndDate}
          setEndDate={setFilterEndDate}
          theme="orange"
        />

        <div className="flex flex-wrap items-end gap-2 flex-1 min-w-[280px] p-2 bg-white dark:bg-[#111827] border border-orange-200 dark:border-orange-500/20 rounded-xl shadow-sm">
          <div className="flex-1 min-w-[130px]">
            <SearchableMultiSelect
              options={categoryOptions}
              value={categoryFilters}
              onChange={setCategoryFilters}
              placeholder="All Categories"
              className="bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 py-2 px-3 rounded-lg"
              accentClass="border-orange-500 ring-orange-500/20"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <SearchableMultiSelect
              options={itemNameOptions}
              value={itemNameFilters}
              onChange={setItemNameFilters}
              placeholder="All Items"
              className="bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 py-2 px-3 rounded-lg"
              accentClass="border-orange-500 ring-orange-500/20"
            />
          </div>
          {(categoryFilters.length > 0 || itemNameFilters.length > 0) && (
            <button
              onClick={() => {
                setCategoryFilters([]);
                setItemNameFilters([]);
              }}
              className="mb-0.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 border border-orange-200 dark:border-orange-500/20 transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {viewMode === 'datewise' ? (
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0 mt-2">
          {filteredDatewiseTransactions.length > 0 && !isLoading && (
            <div className="py-2 px-4 border-b border-orange-200/50 dark:border-orange-500/10 flex items-center justify-between bg-orange-50/50 dark:bg-orange-500/5 shrink-0">
              <p className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredDatewiseTransactions.length)} to {Math.min(currentPage * itemsPerPage, filteredDatewiseTransactions.length)} of {filteredDatewiseTransactions.length} transactions
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, datewiseTotalPages))}
                  disabled={currentPage === datewiseTotalPages || datewiseTotalPages === 0}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse relative">
                <thead className="bg-orange-50 dark:bg-orange-900/20 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-4 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Date</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Source</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Category</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20">Item Name</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">In</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Out</th>
                    <th className="py-2.5 px-4 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Live Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100 dark:divide-orange-500/10">
                  {paginatedDatewiseTransactions.map((log, index) => (
                    <tr key={index} className="hover:bg-orange-50/50 dark:hover:bg-orange-500/[0.03] even:bg-orange-50/30 dark:even:bg-orange-900/10 transition-colors group">
                      <td className="py-2 px-4 text-[11px] font-bold text-gray-500">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-[11px] font-black uppercase">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${
                          log.source === 'IMS - G Floor' ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          'border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}>
                          {log.source}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] font-bold text-gray-500 uppercase">{log.category}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase">{log.item_name}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-right">{log.in_qty > 0 ? `+${log.in_qty}` : "-"}</td>
                      <td className="py-2 px-3 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">{log.out_qty > 0 ? `-${log.out_qty}` : "-"}</td>
                      <td className="py-2 px-4 text-[11px] font-black text-orange-600 dark:text-[#FFD500] text-right">{(log as any).running_stock}</td>
                    </tr>
                  ))}
                  {filteredDatewiseTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : viewMode === 'timeseries' ? (
        <div className="flex flex-col gap-2 shrink-0 mb-2 mt-4">
          <TimeSeriesTable 
            transactions={filteredCombinedTransactions}
            bucket={mappedTimeBucket}
            isLoading={isTimeSeriesLoading || isLoading}
          />
        </div>
      ) : (
        <div className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0 mt-2">
          {filteredItems.length > 0 && !isLoading && (
            <div className="py-2 px-4 border-b border-orange-200/50 dark:border-orange-500/10 flex items-center justify-between bg-orange-50/50 dark:bg-orange-500/5 shrink-0">
              <p className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredItems.length)} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} unique items
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1.5 rounded bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-6 flex-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse relative">
                <thead className="bg-orange-50 dark:bg-orange-900/20 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 border-b border-orange-200 dark:border-orange-500/20 text-center sticky left-0 bg-orange-50 dark:bg-orange-900/20 z-30 shadow-[1px_0_0_0_#fed7aa] dark:shadow-[1px_0_0_0_rgba(249,115,22,0.2)] w-12">
                      <span className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">#</span>
                    </th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 whitespace-nowrap">Source</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 whitespace-nowrap">Category</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 whitespace-nowrap">Item Name</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Total In</th>
                    <th className="py-2.5 px-3 text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right">Total Out</th>
                    <th className="py-2.5 px-4 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest border-b border-orange-200 dark:border-orange-500/20 text-right bg-orange-100/50 dark:bg-orange-500/10 w-32">Live Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100 dark:divide-orange-500/10">
                  {paginatedItems.map((item, idx) => {
                    const health = getHealthColors(item.live_stock || 0);
                    return (
                      <tr
                        key={`${item.source}-${item.item_name}`}
                        className="hover:bg-orange-50/30 dark:hover:bg-white/[0.03] even:bg-gray-50/50 dark:even:bg-[#1f2937]/30 transition-colors group"
                      >
                        <td className="py-1 px-2 text-center sticky left-0 z-10 transition-colors border-r shadow-[1px_0_0_0_#fed7aa] dark:shadow-[1px_0_0_0_rgba(249,115,22,0.2)] bg-white group-even:bg-orange-50/30 dark:bg-[#111827] dark:group-even:bg-[#182031] group-hover:bg-orange-50/50 dark:group-hover:bg-[#1a2335] border-orange-100 dark:border-orange-500/10">
                          <span className="text-[10px] font-bold text-gray-400">{(currentPage - 1) * itemsPerPage + idx + 1}</span>
                        </td>
                        <td className="py-1 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${
                            item.source === 'IMS - G Floor' ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            'border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}>
                            {item.source}
                          </span>
                        </td>
                        <td className="py-1 px-3">
                          <span className="inline-block px-2 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-1 px-3 text-[11px] font-black text-[#003875] dark:text-[#FFD500] uppercase tracking-wide">
                          {item.item_name}
                        </td>
                        <td className="py-1 px-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400 text-right">
                          {item.in_qty !== 0 ? item.in_qty.toLocaleString() : "-"}
                        </td>
                        <td className="py-1 px-3 text-[11px] font-black text-rose-600 dark:text-rose-400 text-right">
                          {item.out_qty !== 0 ? item.out_qty.toLocaleString() : "-"}
                        </td>
                        <td className={`py-1 px-4 text-[12px] font-black text-right transition-colors bg-gray-50/50 dark:bg-white/[0.02] ${health}`}>
                          {item.live_stock.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 text-[11px] font-black uppercase tracking-widest">
                        {categoryFilters.length > 0 || itemNameFilters.length > 0 ? "No items found matching filters" : "No items available"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
