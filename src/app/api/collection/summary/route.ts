import { NextResponse } from "next/server";
import { getOutstandingSummary } from "@/lib/outstanding-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Party-wise outstanding, read from the Busy export sheet. */
export async function GET() {
  const summary = await getOutstandingSummary();
  return NextResponse.json(summary);
}
