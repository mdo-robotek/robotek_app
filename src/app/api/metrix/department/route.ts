import { NextRequest, NextResponse } from "next/server";
import { getI2RItems } from "@/lib/i2r-sheets";
import { getI2RPackingItems } from "@/lib/i2r-packing-sheets";
import { getReplaceItems } from "@/lib/replace-sheets";
import { getItemReceivePackingItems } from "@/lib/item-receive-packing-sheets";
import { getGRNItems } from "@/lib/grn-sheets";
import { auth } from "@/auth";
import { I2R_STEPS } from "@/types/i2r";
import { I2R_PACKING_STEPS } from "@/types/i2r-packing";
import { REPLACE_STEPS } from "@/types/replace";

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
    const granularity = searchParams.get("granularity") || "month";

    const [allI2R, allI2RPacking, allReplace, allGRN, allItemReceivePacking] = await Promise.all([
      getI2RItems().catch(() => []),
      getI2RPackingItems().catch(() => []),
      getReplaceItems().catch(() => []),
      getGRNItems().catch(() => []),
      getItemReceivePackingItems().catch(() => [])
    ]);

    let start: Date | null = null;
    let end: Date | null = null;

    if (startDateParam && endDateParam) {
      start = new Date(startDateParam);
      end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
    } else if (granularity !== "all") {
      // Fallback to granularity-based filtering relative to today
      const now = new Date();
      end = new Date(now);
      start = new Date(now);
      start.setHours(0, 0, 0, 0);

      if (granularity === 'day') {
        // Keep start as today 00:00:00
      } else if (granularity === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        start = new Date(start.setDate(diff));
        start.setHours(0, 0, 0, 0);
      } else if (granularity === 'month') {
        start.setDate(1);
      } else if (granularity === 'quarter' || granularity === 'quarterly') {
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3, 1);
      } else if (granularity === 'year' || granularity === 'yearly') {
        start.setMonth(0, 1);
      }
    }

    const filterByDate = (items: any[], dateField: string = "created_at") => {
      if (!start || !end) return items;
      return items.filter(item => {
        const dateVal = item[dateField];
        if (!dateVal) return false;
        let d = new Date(dateVal);
        if (isNaN(d.getTime())) {
            const parts = dateVal.split(/[-/]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                 d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
              } else {
                 d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
              }
            }
        }
        return d >= start! && d <= end!;
      });
    };

    const i2rFiltered = filterByDate(allI2R, "actual_6");
    const packingFiltered = filterByDate(allI2RPacking, "actual_4");
    const replaceFiltered = filterByDate(allReplace, "created_at");

    const itemReceivePackingFiltered = filterByDate(allItemReceivePacking, "created_at");

    const calculateFMS = (items: any[], steps: string[], type: string, grnItems: any[] = [], irpItems: any[] = []) => {
      const stepData = steps.map((stepName, i) => {
        const index = i + 1;
        let pending = 0;
        let completed = 0;
        items.forEach(item => {
          const status = (item[`status_${index}`] || "").toString().toUpperCase();
          if (status === "COMPLETED" || status === "DONE") {
            completed++;
          } else if (status === "PENDING" || status === "") {
            pending++;
          }
        });
        return { step: index, name: stepName, pending, completed };
      });

      const metrics: Record<string, number | string> = {
        'Total PO Raised': 0,
        'Total PO Closed': 0,
        'Pending POs': 0,
        'Delivery Overdue': 0,
        'Payment Overdue': 0,
        'Avg I2R time (IND)': '0 days',
        'Avg I2R time (CHN)': '0 days',
        'Material Rejected': 0,
        'On Time Material Received': 0,
        'Bottleneck': 'None',
        'Total Rep. Raised': 0,
        'Total Rep. Closed': 0,
        'Pending REPs': 0,
        'Avg Rep Process time': 0
      };

      let indTotalDays = 0, indCount = 0;
      let chnTotalDays = 0, chnCount = 0;
      let stepDelays: Record<number, number> = {};
      for (let i = 1; i <= 11; i++) stepDelays[i] = 0;

      if (type === 'i2r') {
        const rejectedGRNs = grnItems.filter((grn: any) => {
          if (!grn.status_3 || grn.status_3.toString().trim().toLowerCase() !== 'rejected') return false;
          const dateVal = grn.actual_3;
          if (!dateVal) return false;
          let d = new Date(dateVal);
          if (isNaN(d.getTime())) {
              const parts = dateVal.split(/[-/]/);
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                   d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                } else {
                   d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
                }
              }
          }
          return !isNaN(d.getTime()) && d >= start && d <= end;
        });
        metrics['Material Rejected'] = rejectedGRNs.length;
      }

      if (type === 'i2rPacking') {
        metrics['Total PO Closed'] = irpItems.length;
      }

      items.forEach(item => {
        if (type === 'i2r') {
          // Bottleneck calculation
          for (let i = 1; i <= 11; i++) {
            const plannedStr = item[`planned_${i}`];
            const actualStr = item[`actual_${i}`];
            if (plannedStr && actualStr) {
              const pDate = new Date(plannedStr);
              const aDate = new Date(actualStr);
              if (!isNaN(pDate.getTime()) && !isNaN(aDate.getTime()) && aDate > pDate) {
                stepDelays[i] += aDate.getTime() - pDate.getTime();
              }
            }
          }

          const hasPO = item.po_number_6 && item.po_number_6.toString().trim() !== '';
          if (hasPO) {
            (metrics['Total PO Raised'] as number)++;
            const reqQty = Number(item.quantity) || 0;
            const recQty = Number(item.received_qty_10) || 0;
            
            if (reqQty > 0 && recQty >= reqQty) {
              (metrics['Total PO Closed'] as number)++;
              
              // Avg I2R time calculation
            const fullReceivedStr = item.actual_10;
              if (item.actual_6 && fullReceivedStr) {
                const poCreated = new Date(item.actual_6);
                const fullReceived = new Date(fullReceivedStr);

                if (!isNaN(poCreated.getTime()) && !isNaN(fullReceived.getTime())) {
                  const diffTime = Math.abs(fullReceived.getTime() - poCreated.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  const grn = grnItems.find((g: any) => g.PO_Number === item.po_number_6 || g.indent_id === item.id);
                  if (grn && grn.Country) {
                    const country = grn.Country.toUpperCase();
                    if (country.includes('IND')) {
                      indTotalDays += diffDays;
                      indCount++;
                    } else if (country.includes('CHN') || country.includes('CHINA')) {
                      chnTotalDays += diffDays;
                      chnCount++;
                    }
                  }

                  // On Time Material Received Logic
                  const leadTimeDays = parseInt(item.lead_time_acc_to_vendor_4) || 0;
                  const expectedDeliveryDate = new Date(poCreated);
                  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadTimeDays);
                  
                  if (fullReceived <= expectedDeliveryDate) {
                    (metrics['On Time Material Received'] as number)++;
                  }
                }
              }
            } else {
              (metrics['Pending POs'] as number)++;
              
              // Delivery Overdue Logic
              if (item.actual_6) {
                const poDate = new Date(item.actual_6);
                if (!isNaN(poDate.getTime())) {
                  const leadTimeDays = parseInt(item.lead_time_acc_to_vendor_4) || 0;
                  const expectedDeliveryDate = new Date(poDate);
                  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadTimeDays);
                  
                  if (new Date() > expectedDeliveryDate) {
                    (metrics['Delivery Overdue'] as number)++;
                  }
                }
              }
            }

            // Payment Overdue Logic via GRN
            const grns = grnItems.filter((g: any) => g.PO_Number === item.po_number_6 || g.indent_id === item.id);
            grns.forEach((grn: any) => {
              // Payment Overdue Logic
              const planned9 = new Date(grn.planned_9);
              if (!isNaN(planned9.getTime())) {
                if (grn.actual_9) {
                  // If completed, check if it was delayed
                  const actual9 = new Date(grn.actual_9);
                  if (!isNaN(actual9.getTime()) && actual9 > planned9) {
                    (metrics['Payment Overdue'] as number)++;
                  }
                } else {
                  // If pending, check if today is past planned date
                  if (new Date() > planned9) {
                    (metrics['Payment Overdue'] as number)++;
                  }
                }
              }
            });
          }
        } else if (type === 'i2rPacking') {
          const hasPO = item.po_num_4 && item.po_num_4.toString().trim() !== '';
          if (hasPO) {
            (metrics['Total PO Raised'] as number)++;
            // Pending PO logic: if it's raised but not closed (for the same period, we might just look at status_4 or something)
            // Wait, previously we relied on status_4 to say it was closed.
            // If they want closed to just be the total number of Item Receive Packing created in this month, 
            // then Pending POs is roughly Total PO Raised - Total PO Closed, though mathematically this might be negative if received in different months.
            // Let's just calculate Pending POs based on status_4 not being COMPLETED.
            const status4 = (item.status_4 || "").toString().toUpperCase();
            if (status4 !== "COMPLETED" && status4 !== "DONE") {
              (metrics['Pending POs'] as number)++;
            }
          }
        }
      });

      if (type === 'i2r') {
        let maxDelay = 0;
        let bottleneckIdx = -1;
        for (let i = 1; i <= 11; i++) {
          if (stepDelays[i] > maxDelay) {
            maxDelay = stepDelays[i];
            bottleneckIdx = i;
          }
        }
        if (bottleneckIdx !== -1 && steps[bottleneckIdx - 1] && maxDelay > 0) {
          const delayDays = Math.ceil(maxDelay / (1000 * 60 * 60 * 24));
          metrics['Bottleneck'] = `${steps[bottleneckIdx - 1]}|${delayDays} Days Delay`;
        } else {
          metrics['Bottleneck'] = 'None';
        }
      }

      if (indCount > 0) {
        metrics['Avg I2R time (IND)'] = `${Math.round(indTotalDays / indCount)} days`;
      }
      if (chnCount > 0) {
        metrics['Avg I2R time (CHN)'] = `${Math.round(chnTotalDays / chnCount)} days`;
      }

      return { total: items.length, steps: stepData, metrics };
    };

    return NextResponse.json({
      i2r: calculateFMS(i2rFiltered, I2R_STEPS, 'i2r', allGRN),
      i2rPacking: calculateFMS(packingFiltered, I2R_PACKING_STEPS, 'i2rPacking', allGRN, itemReceivePackingFiltered),
      replace: calculateFMS(replaceFiltered, REPLACE_STEPS, 'replace')
    });

  } catch (error: any) {
    console.error("Department Performance API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
