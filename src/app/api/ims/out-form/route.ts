import { NextRequest, NextResponse } from "next/server";
import { deleteOutFormRows, getOutFormData } from "@/lib/o2d-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getOutFormData();
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error: any) {
    console.error("Error fetching Out Form rows:", error);
    return NextResponse.json({ error: "Failed to fetch Out Form data" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const rowIndexes: number[] = Array.isArray(body?.rowIndexes)
      ? body.rowIndexes.map(Number)
      : [];

    if (rowIndexes.length === 0) {
      return NextResponse.json({ error: "At least one row is required" }, { status: 400 });
    }

    const result = await deleteOutFormRows(rowIndexes);
    if (!result.success) {
      return NextResponse.json({ error: "Failed to delete Out Form rows" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error deleting Out Form rows:", error);
    return NextResponse.json({ error: "Failed to delete Out Form rows" }, { status: 500 });
  }
}
