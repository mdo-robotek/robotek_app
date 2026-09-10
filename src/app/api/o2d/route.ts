import { NextRequest, NextResponse } from "next/server";
import { getO2DsPaginated, addO2Ds, addItem, getO2Ds, o2dService, o2dArchivedService, getAllO2DsForAnalytics } from "@/lib/o2d-sheets";
import { uploadFileToDrive, O2D_UPLOADS_FOLDER_ID } from "@/lib/google-drive";
import { auth } from "@/auth";
import { sendO2DRemarkNotification } from "@/lib/o2d-notifications";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const currentUser = (session?.user as any)?.username || "";
    const userRole = (session?.user as any)?.role || "User";

    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "true";
    const includeArchived = searchParams.get("includeArchived") === "true";
    if (refresh) {
      o2dService.invalidateCache();
      if (includeArchived) o2dArchivedService.invalidateCache();
    }
    
    const type = searchParams.get("type");

    if (type === "ordernumbers") {
      const o2ds = await getO2Ds();
      const orderNumbers = Array.from(new Set(o2ds.map((o) => o.order_no).filter(Boolean))).sort((a, b) => b.localeCompare(a));
      return NextResponse.json(orderNumbers);
    }

    if (type === "itemnames") {
      const { getAllItemNames } = await import("@/lib/o2d-sheets");
      const itemNames = await getAllItemNames();
      return NextResponse.json(itemNames);
    }

    if (type === "scotDashboard") {
      const allO2Ds = await getAllO2DsForAnalytics();
      const currentMonthStr = `${new Date().getFullYear()}-${new Date().getMonth()}`;
      
      const dashboardOrderCounts: Record<string, number> = {};
      const dashboardHistoricalAvg: Record<string, number> = {};

      const partyGroups = allO2Ds.reduce((acc: any, curr: any) => {
        const partyName = (curr.party_name || "").trim().toLowerCase();
        if (!partyName) return acc;
        if (!acc[partyName]) acc[partyName] = [];
        acc[partyName].push(curr);
        return acc;
      }, {});

      for (const [partyName, partyO2Ds] of Object.entries(partyGroups)) {
        const pO2Ds = partyO2Ds as any[];
        const monthOrderSets: Record<string, Set<string>> = {};
        
        pO2Ds.forEach((o: any) => {
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
    const itemNameFilter = searchParams.get("itemNameFilter") || "";
    const pendingFilter = searchParams.get("pendingFilter") === "true";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const result = await getO2DsPaginated(
      page,
      limit,
      search,
      dateFilters,
      stepFilters,
      partyFilter,
      orderFilter,
      itemNameFilter,
      pendingFilter,
      startDate,
      endDate,
      currentUser,
      userRole,
      includeArchived
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/o2d error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "item") {
      const { name, price, gst, finalPrice } = await req.json();
      await addItem(name, price, gst, finalPrice);
      return NextResponse.json({ message: "Item added successfully" });
    }

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const o2dDataArray = JSON.parse(formData.get("o2dData") as string) as any[];
      const screenshotFile = formData.get("order_screenshot") as File;

      let screenshotUrl = "";
      if (screenshotFile && screenshotFile.size > 0) {
        const fileId = await uploadFileToDrive(screenshotFile, O2D_UPLOADS_FOLDER_ID);
        screenshotUrl = fileId || "";
      }

      const timestamp = new Date().toISOString();
      const recordsToSave = o2dDataArray.map(item => ({
        ...item,
        id: item.id || `O2D-${Date.now()}-${Math.random()}`,
        order_screenshot: screenshotUrl || item.order_screenshot || "",
        created_at: item.created_at || timestamp,
        updated_at: timestamp
      }));

      await addO2Ds(recordsToSave);
      
      // Send WhatsApp Notification for the new order(s)
      // Group by order number if multiple were added
      const orderGroups = recordsToSave.reduce((acc, curr) => {
        if (!acc[curr.order_no]) acc[curr.order_no] = [];
        acc[curr.order_no].push(curr);
        return acc;
      }, {} as Record<string, any[]>);

      for (const orderNo in orderGroups) {
        await sendO2DRemarkNotification(orderGroups[orderNo], "Created");
      }

      return NextResponse.json({ message: "O2D records added successfully" });
    } else {
      const o2dData = await req.json();
      const timestamp = new Date().toISOString();
      const record = {
        ...o2dData,
        id: o2dData.id || `O2D-${Date.now()}`,
        created_at: o2dData.created_at || timestamp,
        updated_at: timestamp
      };
      await addO2Ds([record]);
      
      // Send WhatsApp Notification
      await sendO2DRemarkNotification(record, "Created");

      return NextResponse.json({ message: "O2D record added successfully" });
    }
  } catch (error: any) {
    console.error("POST /api/o2d error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
