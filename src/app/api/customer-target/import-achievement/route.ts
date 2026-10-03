import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { importAchievementForMonth } from "@/lib/customer-target-sheets";
import { isMonthName, parseAmount } from "@/lib/customer-target-messages";
import { MonthName } from "@/types/customer-target";

export const dynamic = "force-dynamic";

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
    const month = body.month as string;
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!isMonthName(month)) {
      return NextResponse.json({ error: "Invalid month. Select a valid month before import." }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }

    const normalized = rows
      .map((r: any) => ({
        no: String(r.no || r["No"] || "").trim(),
        mobile: String(r.mobile || r["Mobile No"] || r["Mobile Num"] || r["Mobile"] || "").trim(),
        customerName: String(r.customerName || r["Customer Name"] || r.accountName || r["Account Name"] || "").trim(),
        amount: parseAmount(
          r.amount ??
            r.nettSaleAmt ??
            r["Achievement Amount"] ??
            r["Nett Sale Amt."] ??
            r["Nett Sale Amt"] ??
            0
        ),
      }))
      .filter((r: { no: string; mobile: string; customerName: string }) => r.no || r.mobile || r.customerName);

    if (normalized.length === 0) {
      return NextResponse.json({
        error: "No valid rows. Use No + Achievement Amount, or Customer Name + Mobile No + Achievement Amount.",
      }, { status: 400 });
    }

    const result = await importAchievementForMonth(month as MonthName, normalized);

    return NextResponse.json({
      success: true,
      month,
      ...result,
    });
  } catch (error: any) {
    console.error("Achievement import error:", error);
    return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 });
  }
}
