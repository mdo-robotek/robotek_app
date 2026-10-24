import { NextRequest, NextResponse } from "next/server";
import { getO2DKBsPaginated, o2dkbService, allocateO2DKBOrderNo } from "@/lib/o2dkb-sheets";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const currentUser = (session?.user as any)?.username || "";
    const userRole = (session?.user as any)?.role || "User";

    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "true";
    if (refresh) {
      o2dkbService.invalidateCache();
    }
    
    const type = searchParams.get("type");

    if (type === "ordernumbers") {
      const o2dkbs = await o2dkbService.getAll();
      const orderNumbers = Array.from(new Set(o2dkbs.map((o: any) => o.order_no).filter(Boolean))).sort((a: string, b: string) => b.localeCompare(a));
      return NextResponse.json(orderNumbers);
    }

    if (type === "itemnames") {
      const all = await o2dkbService.getAll();
      const itemNames = Array.from(new Set(all.map((r: any) => r.item_name).filter(Boolean))).sort();
      return NextResponse.json(itemNames);
    }

    if (type === "scotDashboard") {
      const allO2DKBs = await o2dkbService.getAll();
      const currentMonthStr = `${new Date().getFullYear()}-${new Date().getMonth()}`;
      
      const dashboardOrderCounts: Record<string, number> = {};
      const dashboardHistoricalAvg: Record<string, number> = {};

      const partyGroups = allO2DKBs.reduce((acc: any, curr: any) => {
        const partyName = (curr.party_name || "").trim().toLowerCase();
        if (!partyName) return acc;
        if (!acc[partyName]) acc[partyName] = [];
        acc[partyName].push(curr);
        return acc;
      }, {});

      for (const [partyName, partyO2DKBs] of Object.entries(partyGroups)) {
        const pO2DKBs = partyO2DKBs as any[];
        const monthOrderSets: Record<string, Set<string>> = {};
        
        pO2DKBs.forEach((o: any) => {
          const orderNo = (o.order_no || "").trim();
          if (!orderNo) return;
          const d = new Date(o.created_at);
          if (isNaN(d.getTime())) return;
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (!monthOrderSets[key]) monthOrderSets[key] = new Set();
          monthOrderSets[key].add(orderNo);
        });

        const currentMonthCount = monthOrderSets[currentMonthStr]?.size || 0;
        dashboardOrderCounts[partyName] = currentMonthCount;

        const monthlyUniqueCounts = Object.values(monthOrderSets).map(s => s.size);
        const calcMonthly = monthlyUniqueCounts.length > 0
          ? monthlyUniqueCounts.reduce((a, b) => a + b, 0) / monthlyUniqueCounts.length
          : 0;
        dashboardHistoricalAvg[partyName] = Math.round(calcMonthly);
      }

      return NextResponse.json({ dashboardOrderCounts, dashboardHistoricalAvg });
    }

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const dateFilters = JSON.parse(searchParams.get("dateFilters") || "[]");
    const stepFilters = JSON.parse(searchParams.get("stepFilters") || "[]").map((s: any) => parseInt(s));
    const partyFilter = searchParams.get("partyFilter") || "";
    const orderFilter = searchParams.get("orderFilter") || "";
    const pendingFilter = searchParams.get("pendingFilter") === "true";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const result = await getO2DKBsPaginated(
      page,
      limit,
      search,
      dateFilters,
      stepFilters,
      partyFilter,
      orderFilter,
      pendingFilter,
      startDate,
      endDate,
      currentUser,
      userRole
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/o2dkb error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const item = JSON.parse(formData.get("o2dkbData") as string);

      const timestamp = new Date().toISOString();
      const recordToSave = {
        ...item,
        id: item.id || `O2DKB-${Date.now()}-${Math.random()}`,
        created_at: item.created_at || timestamp,
        updated_at: timestamp
      };

      await o2dkbService.add(recordToSave);
      
      return NextResponse.json({ message: "O2DKB record added successfully" });
    } else {
      const o2dkbData = await req.json();
      const timestamp = new Date().toISOString();
      // New order → server assigns the SH- number (no duplicate numbers
      // when two orders are punched quickly).
      const assignedOrderNo = await allocateO2DKBOrderNo();
      const record = {
        ...o2dkbData,
        order_no: assignedOrderNo,
        id: o2dkbData.id || `O2DKB-${Date.now()}`,
        created_at: o2dkbData.created_at || timestamp,
        updated_at: timestamp
      };
      await o2dkbService.add(record);

      return NextResponse.json({ message: "O2DKB record added successfully", order_no: assignedOrderNo });
    }
  } catch (error: any) {
    console.error("POST /api/o2dkb error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
