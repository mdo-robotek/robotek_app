import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getAllO2DsForAnalytics, getPendingStepIdx } from "@/lib/o2d-sheets";
import { addMessage } from "@/lib/chat-sheets";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import { getUsers } from "@/lib/google-sheets";
import type { ChatMessage } from "@/types/chat";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Daily bilty reminder (Sahil, 2026-10-23): CP Panday ko roz ERP chat par
// message jaye jisme Send-Bilty-to-CRM (step 9) par pending orders ki list
// ho — ye step sabse zyada delay hota hai. Crontab se roz subah hit hota
// hai: curl http://127.0.0.1:<port>/api/cron/bilty-reminder
const BILTY_STEP = 9;
const RECEIVER = "CP PANDAY"; // ERP username (Users sheet RE010)
const SENDER = "Robotek"; // system/admin account

function isLocalRequest(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export async function GET(req: NextRequest) {
  // Internal cron only — the public domain goes through the proxy with a
  // real Host header, so localhost-only keeps outsiders from triggering it.
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const allO2Ds = await getAllO2DsForAnalytics();
    const grouped: Record<string, any[]> = {};
    allO2Ds.forEach((item: any) => {
      const orderNo = item.order_no || "Unknown";
      (grouped[orderNo] = grouped[orderNo] || []).push(item);
    });

    const now = Date.now();
    const pendingBilty: { orderNo: string; party: string; days: number }[] = [];
    Object.entries(grouped).forEach(([orderNo, items]) => {
      const fi: any = items[0];
      if (!fi || fi.cancelled || fi.hold || fi.is_archived) return;
      if (getPendingStepIdx(items as any) !== BILTY_STEP) return;
      const plannedTs = Date.parse(String(fi[`planned_${BILTY_STEP}`] || ""));
      const days = !isNaN(plannedTs) ? Math.max(0, Math.floor((now - plannedTs) / (1000 * 60 * 60 * 24))) : 0;
      pendingBilty.push({ orderNo, party: fi.party_name || "", days });
    });

    if (pendingBilty.length === 0) {
      return NextResponse.json({ sent: false, reason: "No bilty pending — no reminder needed", count: 0 });
    }

    pendingBilty.sort((a, b) => b.days - a.days);
    const top = pendingBilty.slice(0, 15);
    const lines = top.map((p) => `• ${p.orderNo} — ${p.party}${p.days > 0 ? ` (${p.days} din se)` : ""}`);
    const more = pendingBilty.length > top.length ? `\n...aur ${pendingBilty.length - top.length} orders.` : "";
    const text =
      `🚚 Daily Bilty Reminder\n\n` +
      `${pendingBilty.length} orders ki bilty CRM ko bhejni pending hai (Step 9 — Send Bilty to CRM):\n\n` +
      `${lines.join("\n")}${more}\n\n` +
      `Aaj hi clear karein — O2D page par "SEND BILTY TO CRM" filter se list mil jayegi.`;

    const timestamp = new Date().toISOString();
    const message: ChatMessage = {
      id: uuidv4(),
      sender_id: SENDER,
      receiver_id: RECEIVER,
      text,
      type: "text",
      media_url: "",
      read_by: SENDER,
      created_at: timestamp,
      updated_at: timestamp,
      reply_to_id: "",
      forwarded_from: "",
    };
    const chatOk = await addMessage(message).catch(() => false);

    // WhatsApp bhi (Sahil, 2026-10-23) — number Users sheet se, taaki
    // badalne par code touch na karna pade. Maytapi creds .env mein
    // pehle se hain (customer-target wala hi gateway).
    let waOk = false;
    let waError = "";
    try {
      const users = await getUsers();
      const receiver = (users as any[]).find(
        (u: any) => String(u.username || "").trim().toUpperCase() === RECEIVER
      );
      const phone = String(receiver?.phone || "").trim();
      if (phone) {
        const res = await sendWhatsAppMessage(phone, text);
        waOk = !!res.success;
        if (!waOk) waError = String((res as any).error || "send failed");
      } else {
        waError = "Phone number not found in Users sheet";
      }
    } catch (e) {
      waError = "WhatsApp send threw";
      console.error("Bilty reminder WhatsApp failed:", e);
    }

    if (!chatOk && !waOk) {
      return NextResponse.json({ sent: false, error: "Both chat and WhatsApp failed", waError }, { status: 500 });
    }
    return NextResponse.json({ sent: true, to: RECEIVER, count: pendingBilty.length, chat: chatOk, whatsapp: waOk, ...(waOk ? {} : { waError }) });
  } catch (error) {
    console.error("Bilty reminder cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
