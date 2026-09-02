import React, { useMemo, useState, useEffect } from 'react';
import { 
  subDays, subWeeks, subMonths, subQuarters, 
  endOfDay, endOfWeek, endOfMonth, endOfQuarter,
  format, isBefore, isAfter, isEqual 
} from 'date-fns';

export type TimeBucket = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';

export interface Transaction {
  item_name: string;
  category?: string;
  date: string; // ISO or YYYY-MM-DD
  in_qty: number;
  out_qty: number;
  source?: 'GRN' | 'O2D' | 'GFloor' | '1stFloor';
}

interface TimeSeriesTableProps {
  transactions: Transaction[];
  bucket: TimeBucket;
  isLoading?: boolean;
  searchQuery?: string;
}

export default function TimeSeriesTable({ transactions, bucket, isLoading, searchQuery = "" }: TimeSeriesTableProps) {
  const buckets = useMemo(() => {
    const today = new Date();
    const result: { label: string; end: Date }[] = [];

    if (bucket === 'Daily') {
      // Last 14 days (going forward)
      for (let i = 13; i >= 0; i--) {
        const d = subDays(today, i);
        result.push({
          label: format(d, 'dd MMM'),
          end: endOfDay(d)
        });
      }
    } else if (bucket === 'Weekly') {
      // Last 12 weeks
      for (let i = 11; i >= 0; i--) {
        const d = subWeeks(today, i);
        result.push({
          label: `W${format(d, 'I')} ${format(d, 'yy')}`,
          end: endOfWeek(d, { weekStartsOn: 1 })
        });
      }
    } else if (bucket === 'Monthly') {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(today, i);
        result.push({
          label: format(d, 'MMM yy'),
          end: endOfMonth(d)
        });
      }
    } else if (bucket === 'Quarterly') {
      // Last 8 quarters
      for (let i = 7; i >= 0; i--) {
        const d = subQuarters(today, i);
        result.push({
          label: `Q${format(d, 'q')} ${format(d, 'yy')}`,
          end: endOfQuarter(d)
        });
      }
    }
    return result;
  }, [bucket]);

  const aggregatedData = useMemo(() => {
    const itemMap = new Map<string, { item_name: string; category: string; values: number[] }>();
    const txByItem = new Map<string, Transaction[]>();

    const sortedTx = [...transactions].sort(
      (a, b) =>
        new Date(a.date || (a as any).updated_at || 0).getTime() -
        new Date(b.date || (b as any).updated_at || 0).getTime()
    );

    sortedTx.forEach((tx) => {
      const key = tx.item_name.trim().toLowerCase();
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          item_name: tx.item_name.trim(),
          category: tx.category || "GENERAL",
          values: new Array(buckets.length).fill(0),
        });
        txByItem.set(key, []);
      }
      txByItem.get(key)!.push(tx);
    });

    itemMap.forEach((itemObj, key) => {
      const itemTx = txByItem.get(key)!;
      let currentStock = 0;
      let txIdx = 0;

      for (let b = 0; b < buckets.length; b++) {
        const bucketEnd = buckets[b].end;

        while (txIdx < itemTx.length) {
          const txDateStr = itemTx[txIdx].date || (itemTx[txIdx] as any).updated_at;
          const txDate = txDateStr ? new Date(txDateStr) : new Date(0);
          if (isBefore(txDate, bucketEnd) || isEqual(txDate, bucketEnd)) {
            const inQ = parseFloat(itemTx[txIdx].in_qty as any) || 0;
            const outQ = parseFloat(itemTx[txIdx].out_qty as any) || 0;
            currentStock += inQ - outQ;
            txIdx++;
          } else {
            break;
          }
        }
        itemObj.values[b] = currentStock;
      }
    });

    const finalArr = Array.from(itemMap.values()).sort((a, b) =>
      a.item_name.localeCompare(b.item_name)
    );

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return finalArr.filter((item) => item.item_name.toLowerCase().includes(q));
    }
    return finalArr;
  }, [transactions, buckets, searchQuery]);

  const getHealthColors = (live: number) => {
    if (live < 0) return "text-rose-500 font-black";
    if (live === 0) return "text-gray-400 font-bold";
    return "text-emerald-600 dark:text-emerald-400 font-black";
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, bucket, transactions.length]);

  const totalPages = Math.ceil(aggregatedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return aggregatedData.slice(start, start + itemsPerPage);
  }, [aggregatedData, currentPage]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 w-full h-full bg-white dark:bg-[#111827]">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="animate-pulse flex items-center gap-4">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 flex-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 flex-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden min-h-0 relative">
      {aggregatedData.length > 0 && (
        <div className="py-2 px-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-[#1f2937]/50 shrink-0">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, aggregatedData.length)} to {Math.min(currentPage * itemsPerPage, aggregatedData.length)} of {aggregatedData.length} items
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
      <table className="w-full text-left border-collapse relative min-w-max">
        <thead className="bg-gray-100 dark:bg-[#1f2937] sticky top-0 z-20 shadow-sm">
          <tr>
            <th className="py-2.5 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 whitespace-nowrap sticky left-0 bg-gray-100 dark:bg-[#1f2937] z-30 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] min-w-[200px]">
              Item Name
            </th>
            <th className="py-2.5 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 whitespace-nowrap sticky left-[200px] bg-gray-100 dark:bg-[#1f2937] z-30 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] w-32">
              Category
            </th>
            {buckets.map((b, idx) => (
              <th key={idx} className="py-2.5 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 text-center whitespace-nowrap min-w-[80px]">
                {b.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {paginatedData.map((item, idx) => (
            <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-white/[0.03] even:bg-gray-50/50 dark:even:bg-[#1f2937]/30 transition-colors group">
              <td className="py-2 px-3 text-[11px] font-black text-gray-900 dark:text-white uppercase truncate sticky left-0 z-20 transition-colors border-r shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] bg-white group-even:bg-gray-50/50 dark:bg-[#111827] dark:group-even:bg-[#182031] group-hover:bg-blue-50/30 dark:group-hover:bg-[#1a2335] border-gray-100 dark:border-white/5 min-w-[200px] max-w-[200px]" title={item.item_name}>
                {item.item_name}
              </td>
              <td className="py-2 px-3 text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap sticky left-[200px] z-20 transition-colors border-r shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] bg-white group-even:bg-gray-50/50 dark:bg-[#111827] dark:group-even:bg-[#182031] group-hover:bg-blue-50/30 dark:group-hover:bg-[#1a2335] border-gray-100 dark:border-white/5">
                {item.category}
              </td>
              {item.values.map((val, vIdx) => (
                <td key={vIdx} className="py-2 px-3 text-[12px] text-center bg-gray-50/50 dark:bg-white/[0.01]">
                  <span className={getHealthColors(val)}>
                    {val}
                  </span>
                </td>
              ))}
            </tr>
          ))}
          {paginatedData.length === 0 && (
            <tr>
              <td colSpan={buckets.length + 2} className="py-8 text-center text-gray-400 text-[11px] font-black uppercase">
                No items found
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
