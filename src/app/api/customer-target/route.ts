import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getJoinedCustomerTargetRows,
  addPlannedParty,
  updatePlannedParty,
  deletePlannedParty,
  ensureCustomerTargetSheets,
  getPlannedParties,
  getSendLogs,
} from "@/lib/customer-target-sheets";
import { isMonthName, normalizePartyKey } from "@/lib/customer-target-messages";
import { MONTH_NAMES, MessageType, MonthName } from "@/types/customer-target";

export const dynamic = "force-dynamic";

function requireAdmin(session: any) {
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const role = String((session.user as any).role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "EA") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureCustomerTargetSheets();

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month") || MONTH_NAMES[new Date().getMonth()];
    const typeParam = (searchParams.get("type") || "TARGET").toUpperCase() as MessageType;
    const year = Number(searchParams.get("year")) || new Date().getFullYear();

    if (!isMonthName(monthParam)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    const normalizedType: MessageType =
      typeParam === "ACHIEVEMENT" ? "ACHIEVEMENT" : typeParam === "PLANNED" ? "TARGET" : typeParam === "TARGET" ? "TARGET" : ("" as any);
    if (normalizedType !== "TARGET" && normalizedType !== "ACHIEVEMENT") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const rows = await getJoinedCustomerTargetRows(monthParam as MonthName, normalizedType, year);

    const summary = {
      totalParties: rows.length,
      withTarget: rows.filter((r) => Number(r.target) > 0).length,
      withAchievement: rows.filter((r) => Number(r.achieved) > 0).length,
      pendingTarget: rows.reduce((sum, r) => sum + (Number(r.pending) || 0), 0),
    };

    const allLogs = await getSendLogs();
    const logs = allLogs
      .filter((l) => l.month === monthParam && l.year === year)
      .slice(-300)
      .reverse();

    if (searchParams.get("full") === "1") {
      const planned = await getPlannedParties();
      const byKey = new Map(planned.map((p) => [normalizePartyKey(p.partyName), p]));
      const enriched = rows.map((r) => {
        const p = byKey.get(normalizePartyKey(r.partyName));
        return { ...r, allMonths: p?.months || null };
      });
      return NextResponse.json({
        month: monthParam,
        type: normalizedType,
        year,
        rows: enriched,
        months: MONTH_NAMES,
        summary,
        logs,
      });
    }

    return NextResponse.json({
      month: monthParam,
      type: normalizedType,
      year,
      rows,
      months: MONTH_NAMES,
      summary,
      logs,
    });
  } catch (error: any) {
    console.error("Customer Target GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const gate = requireAdmin(session);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json();
    await addPlannedParty({
      partyName: body.partyName,
      customerName: body.customerName,
      mobile: body.mobile,
      months: body.months,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Customer Target POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to add" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    const gate = requireAdmin(session);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json();
    await updatePlannedParty({
      partyName: body.partyName,
      customerName: body.customerName,
      mobile: body.mobile,
      months: body.months,
      originalPartyName: body.originalPartyName || body.partyName,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Customer Target PUT error:", error);
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const gate = requireAdmin(session);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const partyName = searchParams.get("partyName") || body.partyName;
    if (!partyName) {
      return NextResponse.json({ error: "partyName is required" }, { status: 400 });
    }

    await deletePlannedParty(partyName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Customer Target DELETE error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
