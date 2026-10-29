import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFileMeta, getFileStream } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/<driveId>?meta=1 → { name, mimeType, size }
 * GET /api/files/<driveId>        → the file itself, shown inline (for the viewer)
 *
 * Only files that are already shared by link (normal uploads). Private
 * employee documents keep their own HR-only route.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())?.user) return new NextResponse("Please log in", { status: 401 });
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id || "")) return new NextResponse("Bad file id", { status: 400 });
  const meta = await getFileMeta(id);
  if (!meta) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!meta.isPublic) return NextResponse.json({ error: "This file is private" }, { status: 403 });
  if (new URL(req.url).searchParams.get("meta") === "1") {
    return NextResponse.json({ name: meta.name.replace(/^\d{10,}-/, ""), mimeType: meta.mimeType, size: meta.size });
  }
  const file = await getFileStream(id);
  if (!file) return new NextResponse("File not found", { status: 404 });
  const headers = new Headers();
  if (file.mimeType) headers.set("Content-Type", file.mimeType);
  if (file.size) headers.set("Content-Length", String(file.size));
  headers.set("Content-Disposition", `inline; filename="${String(file.name || "file").replace(/^\d{10,}-/, "").replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, max-age=600");
  return new NextResponse(file.stream as any, { status: 200, headers });
}
