import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCooReport } from "@/lib/coo-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The computation lives in src/lib/coo-report.ts so /api/summary can share it.
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await getCooReport(new URL(request.url).searchParams);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("COO Report API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
