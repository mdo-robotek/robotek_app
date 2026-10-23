import { NextResponse } from "next/server";
import { getBusySales } from "@/lib/busy-sale-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Freshness of the Busy sale register sheet (team copies it from Busy:
// Transaction -> Sales -> List). Drives the dashboard indicator.
export async function GET() {
  try {
    const sales = await getBusySales();
    let last = "";
    for (const r of sales) {
      if (r.date && r.date > last) last = r.date;
    }
    let daysOld: number | null = null;
    if (last) {
      const ms = Date.now() - new Date(`${last}T00:00:00Z`).getTime();
      daysOld = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
    }
    return NextResponse.json({ lastSaleDate: last || null, daysOld, rows: sales.length });
  } catch (error: any) {
    return NextResponse.json({ lastSaleDate: null, daysOld: null, rows: 0, error: error?.message }, { status: 200 });
  }
}
