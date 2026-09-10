import { NextRequest, NextResponse } from "next/server";
import { getAllO2DsForAnalytics } from "@/lib/o2d-sheets";
import { imsService } from "@/lib/ims-sheets";
import { auth } from "@/auth";
import { getWorkingHoursGapMs } from "@/lib/workingHours";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const targetDate = searchParams.get("targetDate"); // For Roadmap
    const granularity = searchParams.get("granularity") || "month";

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const getTrendKey = (date: Date, gran: string) => {
      const y = date.getFullYear();
      const m = date.getMonth();
      if (gran === 'day') return date.toISOString().split('T')[0];
      if (gran === 'week') {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const startOfWeek = new Date(d.setDate(diff));
        return startOfWeek.toISOString().split('T')[0];
      }
      if (gran === 'quarter') {
        const q = Math.floor(m / 3) + 1;
        return `${y}-Q${q}`;
      }
      if (gran === 'year') return `${y}`;
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    };

    const getTrendLabel = (key: string, gran: string) => {
      if (gran === 'day') {
        const [y, m, d] = key.split('-');
        return `${d}-${months[parseInt(m) - 1]}`;
      }
      if (gran === 'week') {
        const [y, m, d] = key.split('-');
        return `W/C ${d}-${months[parseInt(m) - 1]}`;
      }
      if (gran === 'quarter') {
        const [y, q] = key.split('-');
        return `${q}-${y}`;
      }
      if (gran === 'year') return key;
      const [y, m] = key.split('-');
      return `${months[parseInt(m) - 1]}-${y}`;
    };

    // 1. Fetch all data
    const [allO2Ds, allIMS] = await Promise.all([
      getAllO2DsForAnalytics(),
      imsService.getAll()
    ]);

    // Create item to category map
    const itemToCategory: Record<string, string> = {};
    allIMS.forEach(item => {
      itemToCategory[item.item_name.toLowerCase().trim()] = item.category || "Uncategorized";
    });

    // Helper to parse merged fields (e.g. "1. Item | 2. Item")
    const parseMergedField = (field: string) => {
      if (!field) return [];
      if (field.includes(" | ")) {
        return field.split(" | ").map(s => s.replace(/^\d+\.\s*/, "").trim());
      }
      return [field.trim()];
    };

    // 2. Group by Order
    const groupedByOrder: Record<string, any[]> = {};
    allO2Ds.forEach(item => {
      const orderNo = item.order_no || "Unknown";
      if (!groupedByOrder[orderNo]) groupedByOrder[orderNo] = [];
      groupedByOrder[orderNo].push(item);
    });

    const orders = Object.entries(groupedByOrder)
      .filter(([_, items]) => items[0].status_3 !== "No")
      .map(([orderNo, items]) => {
      const firstItem = items[0];
      const createdAt = new Date(firstItem.created_at);
      const actual7 = firstItem.actual_7 ? new Date(firstItem.actual_7) : null;
      const planned7 = firstItem.planned_7 ? new Date(firstItem.planned_7) : null;
      
      let isOTD = false;
      let isDelayed = false;
      let targetDateForOTD = createdAt;
      
      if (targetDateForOTD) {
        if (actual7) {
          const gapMs = getWorkingHoursGapMs(targetDateForOTD, actual7);
          isOTD = gapMs <= 9 * 60 * 60 * 1000;
          isDelayed = gapMs > 9 * 60 * 60 * 1000;
        } else {
          const gapMs = getWorkingHoursGapMs(targetDateForOTD, new Date());
          isDelayed = gapMs > 9 * 60 * 60 * 1000;
        }
      }

      const isDispatched = !!firstItem.actual_7 && firstItem.status_7 !== "No";
      
      let currentStep = -1;
      for (let i = 1; i <= 11; i++) {
        if (!firstItem[`actual_${i}`] || firstItem[`status_${i}`] === "No") {
          currentStep = i;
          break;
        }
      }

      const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.est_amount) || 0), 0);

      // Parse individual items
      const processedItems: any[] = [];
      items.forEach(i => {
        const names = parseMergedField(i.item_name);
        const qtys = parseMergedField(i.item_qty);
        const amounts = parseMergedField(i.est_amount);

        names.forEach((name, idx) => {
          const qty = qtys[idx] || "1";
          const amt = parseFloat(amounts[idx]) || 0;
          processedItems.push({
            name,
            qty,
            amount: amt,
            category: itemToCategory[name.toLowerCase()] || "Uncategorized"
          });
        });
      });

      return {
        orderNo,
        party: firstItem.party_name,
        createdAt,
        actual7,
        isOTD,
        isDelayed,
        isDispatched,
        currentStep,
        totalAmount,
        items: processedItems,
        raw: firstItem
      };
    });

    // 3. Filters
    let filteredOrders = orders;
    let trendGrouping = granularity;

    if (startDateParam && endDateParam) {
      const start = new Date(startDateParam);
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      filteredOrders = orders.filter(o => o.createdAt >= start && o.createdAt <= end);

      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 7) trendGrouping = 'day';
      else if (diffDays <= 60) trendGrouping = 'week';
      else if (diffDays <= 365) trendGrouping = 'month';
      else trendGrouping = 'year';
    } else {
      filteredOrders = orders;
      trendGrouping = granularity === "all" ? "year" : granularity;
    }

    // Determine endDate for lookback
    let lookbackEnd = new Date();
    if (endDateParam) {
      lookbackEnd = new Date(endDateParam);
      lookbackEnd.setHours(23, 59, 59, 999);
    }
    const lookbackOrders = orders.filter(o => o.createdAt <= lookbackEnd);

    // 4. Monthly Trends
    const trendDataMap: Record<string, { month: string, count: number, amount: number, otdCount: number, deliveredCount: number }> = {};
    lookbackOrders.forEach(o => {
      const key = getTrendKey(o.createdAt, trendGrouping);
      if (!trendDataMap[key]) {
        trendDataMap[key] = { 
          month: getTrendLabel(key, trendGrouping),
          count: 0, 
          amount: 0,
          otdCount: 0,
          deliveredCount: 0
        };
      }
      trendDataMap[key].count++;
      trendDataMap[key].amount += o.totalAmount;
      if (o.isDispatched) {
        trendDataMap[key].deliveredCount++;
        if (o.isOTD) trendDataMap[key].otdCount++;
      }
    });
    const monthlyTrendData = Object.entries(trendDataMap)
      .map(([key, data]) => ({ 
        key, 
        ...data,
        otdRate: data.deliveredCount > 0 ? Math.round((data.otdCount / data.deliveredCount) * 100) : 0
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-15);

    const mapBasicOrder = (o: any) => ({
      id: o.orderNo,
      party: o.party,
      amount: o.totalAmount,
      date: o.createdAt.toISOString().split('T')[0]
    });

    // 5. Basic Stats
    const stats = {
      total: filteredOrders.length,
      dispatched: filteredOrders.filter(o => o.isDispatched).length,
      pending: filteredOrders.filter(o => !o.isDispatched && o.currentStep !== -1).length,
      toDispatch: filteredOrders.filter(o => o.currentStep > 0 && o.currentStep < 7).length,
      otdCount: filteredOrders.filter(o => o.isOTD).length,
      delayedCount: filteredOrders.filter(o => o.isDelayed).length,
      otdRate: filteredOrders.filter(o => o.isDispatched).length > 0 
        ? Math.round((filteredOrders.filter(o => o.isOTD).length / filteredOrders.filter(o => o.isDispatched).length) * 100) 
        : 0,
      totalAmount: filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      ordersList: filteredOrders.map(mapBasicOrder),
      pendingList: filteredOrders.filter(o => !o.isDispatched && o.currentStep !== -1).map(mapBasicOrder),
      otdList: filteredOrders.filter(o => o.isOTD).map(mapBasicOrder),
      delayedList: filteredOrders.filter(o => o.isDelayed).map(mapBasicOrder)
    };

    // 6. Party Analysis (Deep)
    const partyStats: Record<string, any> = {};
    filteredOrders.forEach(o => {
      if (!partyStats[o.party]) {
        partyStats[o.party] = { 
          party: o.party, 
          count: 0, 
          amount: 0, 
          otdCount: 0,
          deliveredCount: 0,
          delayedCount: 0,
          items: {} as Record<string, number>,
          categories: {} as Record<string, { count: number, amount: number }>,
          history: [] as any[]
        };
      }
      partyStats[o.party].count++;
      partyStats[o.party].amount += o.totalAmount;
      if (o.isDispatched) {
        partyStats[o.party].deliveredCount++;
        if (o.isOTD) partyStats[o.party].otdCount++;
      }
      if (o.isDelayed) partyStats[o.party].delayedCount++;
      
      o.items.forEach(item => {
        if (!partyStats[o.party].items[item.name]) partyStats[o.party].items[item.name] = 0;
        partyStats[o.party].items[item.name] += parseFloat(item.qty) || 1;
        
        if (!partyStats[o.party].categories[item.category]) {
          partyStats[o.party].categories[item.category] = { count: 0, amount: 0 };
        }
        partyStats[o.party].categories[item.category].count++;
        partyStats[o.party].categories[item.category].amount += item.amount;
      });
    });

    // 7. Category Analysis (Deep)
    const categoryStats: Record<string, any> = {};
    filteredOrders.forEach(o => {
      o.items.forEach(item => {
        if (!categoryStats[item.category]) {
          categoryStats[item.category] = { 
            category: item.category, 
            count: 0, 
            amount: 0, 
            otdCount: 0,
            deliveredCount: 0,
            delayedCount: 0,
            items: {} as Record<string, { count: number, amount: number }>,
            history: [] as any[]
          };
        }
        categoryStats[item.category].count++;
        categoryStats[item.category].amount += item.amount;
        if (o.isDispatched) {
          categoryStats[item.category].deliveredCount++;
          if (o.isOTD) categoryStats[item.category].otdCount++;
        }
        if (o.isDelayed) categoryStats[item.category].delayedCount++;

        if (!categoryStats[item.category].items[item.name]) {
          categoryStats[item.category].items[item.name] = { count: 0, amount: 0 };
        }
        categoryStats[item.category].items[item.name].count += parseFloat(item.qty) || 1;
        categoryStats[item.category].items[item.name].amount += item.amount;
      });
    });

    // Populate History for Parties and Categories from lookbackOrders
    lookbackOrders.forEach(o => {
      if (partyStats[o.party]) {
        partyStats[o.party].history.push({
          date: o.createdAt.toISOString().split('T')[0],
          amount: o.totalAmount,
          orderNo: o.orderNo,
          isOTD: o.isOTD,
          isDispatched: o.isDispatched
        });
      }
      o.items.forEach(item => {
        if (categoryStats[item.category]) {
          categoryStats[item.category].history.push({
            date: o.createdAt.toISOString().split('T')[0],
            amount: item.amount,
            isOTD: o.isOTD,
            isDispatched: o.isDispatched
          });
        }
      });
    });

    const allAvailableCategories = Object.keys(categoryStats);

    const partyList = Object.values(partyStats).map((p: any) => {
      const groupedHistory: Record<string, { date: string, amount: number, count: number, otdCount: number, deliveredCount: number }> = {};
      p.history.forEach((h: any) => {
        const key = getTrendKey(new Date(h.date), trendGrouping);
        if (!groupedHistory[key]) {
          groupedHistory[key] = { date: key, amount: 0, count: 0, otdCount: 0, deliveredCount: 0 };
        }
        groupedHistory[key].amount += h.amount;
        groupedHistory[key].count += 1;
        if (h.isDispatched) {
          groupedHistory[key].deliveredCount++;
          if (h.isOTD) groupedHistory[key].otdCount++;
        }
      });

      const sortedHistory = Object.values(groupedHistory).map((t: any) => {
        return {
          ...t,
          displayDate: getTrendLabel(t.date, trendGrouping),
          otdRate: t.deliveredCount > 0 ? Math.round((t.otdCount / t.deliveredCount) * 100) : 0
        };
      }).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-15);
      
      const categoryList = Object.entries(p.categories).map(([name, stats]: any) => ({
        category: name,
        ...stats
      })).sort((a, b) => b.count - a.count);

      const purchasedCategories = new Set(categoryList.map(c => c.category));
      const untappedCategories = allAvailableCategories
        .filter(cat => !purchasedCategories.has(cat))
        .map(cat => ({
          category: cat,
          marketAvg: categoryStats[cat]?.amount / (categoryStats[cat]?.count || 1) || 0
        }))
        .sort((a, b) => b.marketAvg - a.marketAvg);

      return {
        ...p,
        history: sortedHistory,
        otdRate: p.deliveredCount > 0 ? Math.round((p.otdCount / p.deliveredCount) * 100) : 0,
        topItem: Object.entries(p.items).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "None",
        categoryList,
        untappedCategories
      };
    }).sort((a, b) => b.count - a.count);

    const categoryList = Object.values(categoryStats).map((c: any) => {
      // Group category history by month for dual metrics
      const groupedHist: Record<string, { date: string, amount: number, count: number, otdCount: number, deliveredCount: number }> = {};
      c.history.forEach((h: any) => {
        const key = getTrendKey(new Date(h.date), trendGrouping);
        if (!groupedHist[key]) {
          groupedHist[key] = { date: key, amount: 0, count: 0, otdCount: 0, deliveredCount: 0 };
        }
        groupedHist[key].amount += h.amount;
        groupedHist[key].count += 1;
        if (h.isDispatched) {
          groupedHist[key].deliveredCount++;
          if (h.isOTD) groupedHist[key].otdCount++;
        }
      });

      const sortedHistory = Object.values(groupedHist).map((t: any) => {
        return {
          ...t,
          displayDate: getTrendLabel(t.date, trendGrouping),
          otdRate: t.deliveredCount > 0 ? Math.round((t.otdCount / t.deliveredCount) * 100) : 0
        };
      }).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-15);

      const allItems = Object.entries(c.items).map(([name, stats]: any) => ({
        name,
        ...stats
      })).sort((a, b) => b.count - a.count);

      return {
        ...c,
        history: sortedHistory,
        otdRate: c.deliveredCount > 0 ? Math.round((c.otdCount / c.deliveredCount) * 100) : 0,
        top30Items: allItems.slice(0, 30),
        bottom30Items: allItems.slice(-30).reverse(),
        itemList: allItems // Keep for backward compatibility if needed
      };
    }).sort((a, b) => b.count - a.count);

    const categories = {
      all: categoryList,
      top20: categoryList.slice(0, 20),
      bottom20: categoryList.slice(-20).reverse()
    };

    // 8. Roadmap Data (Detailed)
    const STEP_NAMES = [
      "MAKE SO", "CROSS CHECK SO", "DISPATCH APPR.", "RECONFIRM", "PACK ITEM",
      "SHARE PI", "INVOICE & DISP.", "BILL UPDATE", "SEND BILTY", "DELIVERY DOC", "CLEAR PAY"
    ];

    let roadmapData: any[] = [];
    const target = targetDate ? new Date(targetDate) : new Date();
    const targetStr = target.toISOString().split('T')[0];
    
    // Base roadmap for the selected date
    roadmapData = orders.filter(o => o.createdAt.toISOString().split('T')[0] === targetStr).map(o => {
      const steps = [];
      for (let i = 1; i <= 11; i++) {
        steps.push({
          step: i,
          name: STEP_NAMES[i-1],
          planned: o.raw[`planned_${i}`],
          actual: o.raw[`actual_${i}`],
          status: o.raw[`status_${i}`],
        });
      }
      return {
        orderNo: o.orderNo,
        party: o.party,
        currentStep: o.currentStep,
        amount: o.totalAmount,
        items: o.items,
        steps
      };
    });

    // If there's a search but the order isn't in today's list, find it and add it
    const searchParam = req.nextUrl.searchParams.get("search")?.toLowerCase();
    if (searchParam) {
      const foundOrder = orders.find(o => 
        o.orderNo.toString().toLowerCase() === searchParam || 
        o.party.toLowerCase().includes(searchParam)
      );
      if (foundOrder && !roadmapData.some(r => r.orderNo === foundOrder.orderNo)) {
        const steps = [];
        for (let i = 1; i <= 11; i++) {
          steps.push({
            step: i,
            name: STEP_NAMES[i-1],
            planned: foundOrder.raw[`planned_${i}`],
            actual: foundOrder.raw[`actual_${i}`],
            status: foundOrder.raw[`status_${i}`],
          });
        }
        roadmapData.unshift({
          orderNo: foundOrder.orderNo,
          party: foundOrder.party,
          currentStep: foundOrder.currentStep,
          amount: foundOrder.totalAmount,
          items: foundOrder.items,
          steps
        });
      }
    }

    const searchableOrders = orders.map(o => ({ orderNo: o.orderNo, party: o.party }));

    return NextResponse.json({
      stats,
      trends: monthlyTrendData,
      parties: {
        top20: partyList.slice(0, 20),
        bottom20: partyList.slice(-20).reverse(),
        all: partyList
      },
      categories: {
        top20: categoryList.slice(0, 20),
        bottom20: categoryList.slice(-20).reverse(),
        all: categoryList
      },
      roadmap: roadmapData,
      searchableOrders,
      todayCount: orders.filter(o => o.createdAt.toISOString().split('T')[0] === targetStr).length
    });

  } catch (error: any) {
    console.error("Metrix API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
