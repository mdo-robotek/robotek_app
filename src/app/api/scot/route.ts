import { NextRequest, NextResponse } from "next/server";
import { auth } from '@/auth';
import { 
  getScotData, 
  getCallData, 
  getFollowUpData, 
  saveFollowUpData,
  addCallRecord, 
  updateCallData,
  appendScotData
} from "@/lib/scot-sheets";
import { getAllO2DsForAnalytics } from "@/lib/o2d-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') || 'feeder';
  const skipO2D = searchParams.get('skipO2D') === 'true';
  const source = (searchParams.get('source') as "scot" | "scot-kb") || "scot";

  try {
    if (tab === 'calls' || tab === 'lost') {
      const [allCalls, allFollowUps, allO2Ds] = await Promise.all([
        getCallData(),
        getFollowUpData(),
        skipO2D ? Promise.resolve([]) : getAllO2DsForAnalytics()
      ]);

      const latestFollowUps = allFollowUps.reduce((acc: any, curr: any) => {
        const existing = acc[curr.partyName];
        if (!existing || new Date(curr.createdAt) > new Date(existing.createdAt)) {
          acc[curr.partyName] = curr;
        }
        return acc;
      }, {} as Record<string, any>);

      const mergedData = allCalls.map(call => {
        const latest = latestFollowUps[call.partyName];
        const partyO2Ds = allO2Ds.filter(o =>
          o.party_name?.trim().toLowerCase() === call.partyName?.trim().toLowerCase()
        );

        let dynamicMetrics: any = {};
        if (partyO2Ds.length > 0) {
          const uniqueOrderNos = [...new Set(partyO2Ds.map((o: any) => (o.order_no || '').trim()).filter(Boolean))];
          const totalAmt = partyO2Ds.reduce((sum: number, o: any) => {
            const amt = parseFloat(String(o.est_amount || "0").replace(/[^0-9.]/g, ''));
            return sum + (isNaN(amt) ? 0 : amt);
          }, 0);

          const monthOrderSets: Record<string, Set<string>> = {};
          partyO2Ds.forEach((o: any) => {
            const orderNo = (o.order_no || '').trim();
            if (!orderNo) return;
            const d = new Date(o.created_at);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!monthOrderSets[key]) monthOrderSets[key] = new Set();
            monthOrderSets[key].add(orderNo);
          });

          const monthlyUniqueCounts = Object.values(monthOrderSets).map(s => s.size);
          const calcMonthly = monthlyUniqueCounts.length > 0
            ? monthlyUniqueCounts.reduce((a, b) => a + b, 0) / monthlyUniqueCounts.length
            : 0;

          const orderFirstDates = (uniqueOrderNos as string[])
            .map(no => {
              const rows = partyO2Ds.filter((o: any) => (o.order_no || '').trim() === no);
              const dates = rows.map((o: any) => new Date(o.created_at)).filter(d => !isNaN(d.getTime()));
              return dates.length ? dates.reduce((a, b) => a < b ? a : b) : null;
            })
            .filter(Boolean) as Date[];
          orderFirstDates.sort((a, b) => a.getTime() - b.getTime());

          const gaps = orderFirstDates.map((d, i) =>
            i > 0 ? (d.getTime() - orderFirstDates[i-1].getTime()) / (1000 * 60 * 60 * 24) : null
          ).filter(g => g !== null) as number[];

          const lastOrderDate = orderFirstDates.length > 0
            ? orderFirstDates[orderFirstDates.length - 1].toISOString().split('T')[0]
            : "";

          const calcOrderSize = uniqueOrderNos.length > 0 ? totalAmt / uniqueOrderNos.length : 0;
          const calcFreq = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

          dynamicMetrics = {
            averageOrderSize: calcOrderSize > 0 ? calcOrderSize.toFixed(2) : call.averageOrderSize,
            usuallyNoOfOrderMonthly: calcMonthly > 0 ? Math.round(calcMonthly).toString() : call.usuallyNoOfOrderMonthly,
            frequencyOfCallingAfterOrderPlaced: calcFreq > 0 ? calcFreq.toFixed(0) : call.frequencyOfCallingAfterOrderPlaced,
            lastOrderDate,
            isAvgDynamic: calcOrderSize > 0,
            isMonthlyDynamic: calcMonthly > 0,
            isFreqDynamic: calcFreq > 0,
            isDynamic: true
          };
        }

        return {
          ...call,
          ...dynamicMetrics,
          latestStatus: latest?.status || "Pending",
          latestNextDate: latest?.nextFollowUpDate || "",
          followUpHistoryCount: allFollowUps.filter(f => f.partyName === call.partyName).length
        };
      });

      if (tab === 'calls') return NextResponse.json(mergedData.filter(c => c.latestStatus !== 'Order Lost'));
      if (tab === 'lost') return NextResponse.json(mergedData.filter(c => c.latestStatus === 'Order Lost'));
      return NextResponse.json(mergedData);
    }

    if (tab === 'followup') {
      const followUps = await getFollowUpData(source);
      return NextResponse.json(followUps);
    }

    const scotRecords = await getScotData();
    return NextResponse.json(scotRecords);

  } catch (error: any) {
    console.error("Scot GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    if (body.type === 'party') {
      const success = await addCallRecord(body.data);
      if (!success) return NextResponse.json({ error: "Failed to add party" }, { status: 500 });
      return NextResponse.json({ message: "Party added successfully" });
    }

    if (body.type === 'followup') {
      const source = body.source || "scot";
      const success = await saveFollowUpData(body.data, source);
      if (!success) return NextResponse.json({ error: "Failed to add follow up" }, { status: 500 });
      return NextResponse.json({ message: "Follow up added successfully" });
    }

    const { records } = body;
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const success = await appendScotData(records.map(r => {
      if (Array.isArray(r)) {
        const id = (r[0] !== undefined && String(r[0]).trim()) 
          ? String(r[0]) 
          : `${Date.now()}`;
        const employeeName = r[1] !== undefined ? String(r[1]) : "";
        const employeeNumber = r[2] !== undefined ? String(r[2]) : "";
        const toName = r[3] !== undefined ? String(r[3]) : "";
        const countryCode = r[4] !== undefined ? String(r[4]) : "";
        const toNumber = r[5] !== undefined ? String(r[5]) : "";
        const callType = r[6] !== undefined ? String(r[6]) : "";
        const duration = r[7] !== undefined ? String(r[7]) : "";
        const callDate = r[8] !== undefined ? String(r[8]) : "";
        const callTime = r[9] !== undefined ? String(r[9]) : "";
        const timestamp = new Date().toISOString();
        const created_at = r[10] !== undefined && String(r[10]).trim() ? String(r[10]) : timestamp;
        const updated_at = r[11] !== undefined && String(r[11]).trim() ? String(r[11]) : timestamp;

        return [
          id, employeeName, employeeNumber, toName, countryCode, toNumber,
          callType, duration, callDate, callTime, created_at, updated_at
        ];
      } else {
        const id = (r.id && String(r.id).trim())
          ? String(r.id)
          : `${Date.now()}`;
        const timestamp = new Date().toISOString();
        return [
          id,
          r.employeeName !== undefined ? String(r.employeeName) : "",
          r.employeeNumber !== undefined ? String(r.employeeNumber) : "",
          r.toName !== undefined ? String(r.toName) : "",
          r.countryCode !== undefined ? String(r.countryCode) : "",
          r.toNumber !== undefined ? String(r.toNumber) : "",
          r.callType !== undefined ? String(r.callType) : "",
          r.duration !== undefined ? String(r.duration) : "",
          r.callDate !== undefined ? String(r.callDate) : "",
          r.callTime !== undefined ? String(r.callTime) : "",
          r.created_at !== undefined && String(r.created_at).trim() ? String(r.created_at) : timestamp,
          r.updated_at !== undefined && String(r.updated_at).trim() ? String(r.updated_at) : timestamp
        ];
      }
    }));

    if (!success) return NextResponse.json({ error: "Failed to import records" }, { status: 500 });
    return NextResponse.json({ message: "Data imported successfully" });
  } catch (error: any) {
    console.error("Scot POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const partyName = searchParams.get('partyName');
    const tab = searchParams.get('tab');

    if (!partyName || tab !== 'calls') {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const data = await req.json();
    const success = await updateCallData(partyName, data);

    if (!success) {
      return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
    }

    return NextResponse.json({ message: "Record updated successfully" });
  } catch (error: any) {
    console.error("Scot PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
