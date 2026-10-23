import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCallData } from "@/lib/scot-sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lightweight: just {partyName, mobileNum} from the Target/Calls sheet, used
// by the Call Analytics dashboard to resolve "Unknown" caller names back to
// a real party whenever the number matches — Callyzer writes "Unknown" as
// the To Name when a customer's number isn't saved in the employee's own
// phone contacts, even though the real number is captured correctly.
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calls = await getCallData();
    const data = calls
      .filter((c) => c.partyName && c.mobileNum)
      .map((c) => ({ partyName: c.partyName, mobileNum: c.mobileNum }));
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("GET /api/scot/party-numbers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
