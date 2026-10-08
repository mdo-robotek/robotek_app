import { NextResponse } from "next/server";

/** Remarks are disabled — completions go to checklists_revision_history only. */
export async function POST() {
  return NextResponse.json(
    { error: "Remarks are no longer supported for checklists" },
    { status: 410 }
  );
}
