import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFileStream } from "@/lib/google-drive";
import { canSeeEmployeeDocs } from "@/lib/employee-docs";

export const dynamic = "force-dynamic";

/** Opens a private employee document — only for logged-in HR / admins. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!canSeeEmployeeDocs(await auth())) return new NextResponse("Only HR and admins can open employee documents.", { status: 403 });
  try {
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id || "")) return new NextResponse("Bad file id", { status: 400 });
    const file = await getFileStream(id);
    if (!file) return new NextResponse("File not found", { status: 404 });
    const headers = new Headers();
    if (file.mimeType) headers.set("Content-Type", file.mimeType);
    if (file.size) headers.set("Content-Length", String(file.size));
    headers.set("Content-Disposition", `inline; filename="${String(file.name || "document").replace(/"/g, "")}"`);
    headers.set("Cache-Control", "private, no-store");
    return new NextResponse(file.stream as any, { status: 200, headers });
  } catch (error) {
    console.error("employee doc stream failed", error);
    return new NextResponse("Could not open the file", { status: 500 });
  }
}
