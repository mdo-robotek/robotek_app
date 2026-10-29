import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateOrderToggleStatus, o2dService, getPendingStepIdx } from "@/lib/o2d-sheets";
import { sendO2DRemarkNotification } from "@/lib/o2d-notifications";
import { parseHold } from "@/lib/o2d-hold";

export async function POST(req: NextRequest) {
  try {
    if (!(await auth())?.user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
    const { orderNo, action, value } = await req.json();

    if (!orderNo || !action || (action !== "hold" && action !== "cancelled")) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Releasing a hold: the clock was stopped while on hold, so move the
    // planned time of the step it was waiting at forward by the hold time.
    if (action === "hold" && !value) {
      try {
        const rows = (await o2dService.getAll()).filter((r) => String(r.order_no).trim() === String(orderNo).trim());
        const h = parseHold(rows[0]?.hold);
        const step = rows.length ? getPendingStepIdx(rows) : -1;
        const plannedRaw = step > 0 ? String((rows[0] as any)[`planned_${step}`] || "") : "";
        const planned = new Date(plannedRaw);
        if (h?.since && step > 0 && plannedRaw && !isNaN(planned.getTime())) {
          const held = Date.now() - h.since.getTime();
          if (held > 0) {
            await o2dService.updateOrderColumn(orderNo, `planned_${step}`, new Date(planned.getTime() + held).toISOString());
          }
        }
      } catch (e) {
        console.error("Hold release: couldn't move the planned time", e);
      }
    }

    await updateOrderToggleStatus(orderNo, action, value);

    // Fetch the updated order to send notification
    const all = await o2dService.getAll();
    const updatedOrder = all.filter(r => r.order_no === orderNo);

    if (updatedOrder.length > 0) {
      const statusWord = value ? (action === "hold" ? "Put On Hold" : "Cancelled") : (action === "hold" ? "Released from Hold" : "Restored from Cancelled");
      await sendO2DRemarkNotification(updatedOrder, statusWord);
    }

    return NextResponse.json({ message: `Order ${action} state updated successfully` });
  } catch (error: any) {
    console.error("Status Toggle API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
