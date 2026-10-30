import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers, getDropdownData } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

// Data for the phone "Quick Delegate" form (/delegate): who can be assigned
// (active ERP users — names only, no passwords or phone numbers) and the
// department list. The task itself is saved through POST /api/delegations,
// the same as the dashboard form.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [users, dropdowns] = await Promise.all([getUsers(), getDropdownData().catch(() => ({ departments: [] as string[] }))]);
    const people = users
      .filter((u) => u.isActive !== false && String(u.username || "").trim())
      .map((u) => ({ username: String(u.username).trim(), designation: u.designation || "", department: u.department || "", image_url: u.image_url || "" }))
      .sort((a, b) => a.username.localeCompare(b.username));
    const departments = Array.from(new Set([...(dropdowns.departments || []), ...people.map((p) => p.department)].map((d) => String(d || "").trim()).filter(Boolean))).sort();
    const me = (session.user as { username?: string; name?: string | null } | undefined);
    return NextResponse.json(
      { me: String(me?.username || me?.name || ""), people, departments },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Quick delegate data error:", error);
    return NextResponse.json({ error: "Could not load people" }, { status: 500 });
  }
}
