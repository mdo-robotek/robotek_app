import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendWhatsAppMessage } from "@/lib/maytapi";
import {
  getJoinedCustomerTargetRows,
  appendSendLog,
  isValidMobile,
} from "@/lib/customer-target-sheets";
import {
  isMonthName,
  buildMessage,
  normalizePartyKey,
  calcPending,
  calcAchievementPct,
} from "@/lib/customer-target-messages";
import { MessageType, MonthName, SendScope } from "@/types/customer-target";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String((session.user as any).role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "EA") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const mode = body.mode === "test" ? "test" : "bulk";
    const typeRaw = String(body.type || "TARGET").toUpperCase();
    const type: MessageType = typeRaw === "ACHIEVEMENT" ? "ACHIEVEMENT" : "TARGET";
    const month = body.month as string;
    const year = Number(body.year) || new Date().getFullYear();
    const sendScope = (body.sendScope || "not_sent") as SendScope;
    const partyNames: string[] = Array.isArray(body.partyNames) ? body.partyNames.map(String) : [];
    const testPhone = String(body.testPhone || "").trim();
    const sentBy =
      (session.user as any).username ||
      session.user.name ||
      session.user.email ||
      "unknown";

    if (!isMonthName(month)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    const allRows = await getJoinedCustomerTargetRows(month as MonthName, type, year);

    // ---- TEST MODE ----
    if (mode === "test") {
      if (!testPhone || !isValidMobile(testPhone)) {
        return NextResponse.json({ error: "Enter a valid 10-digit mobile for test" }, { status: 400 });
      }

      const sampleName = partyNames[0];
      const sample =
        (sampleName
          ? allRows.find((r) => normalizePartyKey(r.partyName) === normalizePartyKey(sampleName))
          : null) ||
        allRows.find((r) => r.target > 0) ||
        allRows[0];

      if (!sample) {
        return NextResponse.json({ error: "No party data available for test message" }, { status: 400 });
      }

      const message = buildMessage(type, sample.partyName, month as MonthName, sample.target, sample.achieved, year, sample.customerName);
      const result = await sendWhatsAppMessage(testPhone, message);

      await appendSendLog({
        timestamp: new Date().toISOString(),
        partyName: sample.partyName,
        mobile: testPhone,
        month: month as MonthName,
        year,
        type: "TEST",
        target: sample.target,
        achieved: sample.achieved,
        pending: calcPending(sample.target, sample.achieved),
        achievementPct: calcAchievementPct(sample.target, sample.achieved),
        status: result.success ? "SENT" : "FAILED",
        error: result.success ? "" : String((result as any).error || "Send failed"),
        sentBy: String(sentBy),
        message,
      });

      return NextResponse.json({
        success: !!result.success,
        error: result.success ? undefined : (result as any).error,
        preview: message,
        sampleParty: sample.partyName,
      });
    }

    // ---- BULK MODE ----
    let candidates = allRows;

    if (partyNames.length > 0) {
      const set = new Set(partyNames.map(normalizePartyKey));
      candidates = candidates.filter((r) => set.has(normalizePartyKey(r.partyName)));
    }

    if (sendScope === "failed_only") {
      candidates = candidates.filter((r) => r.sendStatus === "FAILED");
    } else if (sendScope === "not_sent") {
      candidates = candidates.filter((r) => r.sendStatus === "NOT_SENT" || r.sendStatus === "SKIPPED");
    } else if (sendScope === "selected") {
      // selected parties, but still hard-skip already SENT unless force
      candidates = candidates.filter((r) => r.sendStatus !== "SENT");
    }
    // selected_force: keep selection as-is (allows SENT)

    const results: {
      partyName: string;
      mobile: string;
      status: "SENT" | "FAILED" | "SKIPPED";
      error?: string;
    }[] = [];

    for (const row of candidates) {
      // Hard guard: never Maytapi-send already SENT unless force
      if (row.sendStatus === "SENT" && sendScope !== "selected_force") {
        const skipMsg = row.preview;
        await appendSendLog({
          timestamp: new Date().toISOString(),
          partyName: row.partyName,
          mobile: row.mobile,
          month: month as MonthName,
          year,
          type,
          target: row.target,
          achieved: row.achieved,
          pending: row.pending,
          achievementPct: row.achievementPct,
          status: "SKIPPED",
          error: "already_sent",
          sentBy: String(sentBy),
          message: skipMsg,
        });
        results.push({ partyName: row.partyName, mobile: row.mobile, status: "SKIPPED", error: "already_sent" });
        continue;
      }

      if (!isValidMobile(row.mobile)) {
        await appendSendLog({
          timestamp: new Date().toISOString(),
          partyName: row.partyName,
          mobile: row.mobile,
          month: month as MonthName,
          year,
          type,
          target: row.target,
          achieved: row.achieved,
          pending: row.pending,
          achievementPct: row.achievementPct,
          status: "FAILED",
          error: "invalid_mobile",
          sentBy: String(sentBy),
          message: row.preview,
        });
        results.push({ partyName: row.partyName, mobile: row.mobile, status: "FAILED", error: "invalid_mobile" });
        continue;
      }

      if (type === "TARGET" && !(row.target > 0)) {
        await appendSendLog({
          timestamp: new Date().toISOString(),
          partyName: row.partyName,
          mobile: row.mobile,
          month: month as MonthName,
          year,
          type,
          target: row.target,
          achieved: row.achieved,
          pending: row.pending,
          achievementPct: row.achievementPct,
          status: "SKIPPED",
          error: "missing_target",
          sentBy: String(sentBy),
          message: row.preview,
        });
        results.push({ partyName: row.partyName, mobile: row.mobile, status: "SKIPPED", error: "missing_target" });
        continue;
      }

      const message = buildMessage(type, row.partyName, month as MonthName, row.target, row.achieved, year, row.customerName);

      try {
        const result = await sendWhatsAppMessage(row.mobile, message);
        if (result.success) {
          await appendSendLog({
            timestamp: new Date().toISOString(),
            partyName: row.partyName,
            mobile: row.mobile,
            month: month as MonthName,
            year,
            type,
            target: row.target,
            achieved: row.achieved,
            pending: row.pending,
            achievementPct: row.achievementPct,
            status: "SENT",
            error: "",
            sentBy: String(sentBy),
            message,
          });
          results.push({ partyName: row.partyName, mobile: row.mobile, status: "SENT" });
        } else {
          const err = String((result as any).error || "Send failed");
          await appendSendLog({
            timestamp: new Date().toISOString(),
            partyName: row.partyName,
            mobile: row.mobile,
            month: month as MonthName,
            year,
            type,
            target: row.target,
            achieved: row.achieved,
            pending: row.pending,
            achievementPct: row.achievementPct,
            status: "FAILED",
            error: err,
            sentBy: String(sentBy),
            message,
          });
          results.push({ partyName: row.partyName, mobile: row.mobile, status: "FAILED", error: err });
        }
      } catch (e: any) {
        const err = e?.message || "Send exception";
        await appendSendLog({
          timestamp: new Date().toISOString(),
          partyName: row.partyName,
          mobile: row.mobile,
          month: month as MonthName,
          year,
          type,
          target: row.target,
          achieved: row.achieved,
          pending: row.pending,
          achievementPct: row.achievementPct,
          status: "FAILED",
          error: err,
          sentBy: String(sentBy),
          message,
        });
        results.push({ partyName: row.partyName, mobile: row.mobile, status: "FAILED", error: err });
      }

      await sleep(400);
    }

    const summary = {
      sent: results.filter((r) => r.status === "SENT").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      skipped: results.filter((r) => r.status === "SKIPPED").length,
      total: results.length,
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
      failedParties: results.filter((r) => r.status === "FAILED").map((r) => r.partyName),
    });
  } catch (error: any) {
    console.error("Customer Target send error:", error);
    return NextResponse.json({ error: error.message || "Send failed" }, { status: 500 });
  }
}
