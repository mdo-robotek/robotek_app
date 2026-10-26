import { NextResponse } from "next/server";
import { findLoginUser } from "@/lib/google-sheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get("identifier");

  if (!identifier) {
    return NextResponse.json({ error: "Identifier required" }, { status: 400 });
  }

  try {
    const { user, sharedEmail } = await findLoginUser(identifier);
    if (sharedEmail) {
      return NextResponse.json({ exists: true, sharedEmail: true });
    }
    if (!user) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ 
      exists: true, 
      isActive: user.isActive !== false 
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
