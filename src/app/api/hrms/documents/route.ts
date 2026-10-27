import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getEmployeeDocs, addEmployeeDoc } from "@/lib/employee-docs-sheets";
import { EMPLOYEE_DOCS, canSeeEmployeeDocs } from "@/lib/employee-docs";

export const dynamic = "force-dynamic";

const HRMS_UPLOADS_FOLDER_ID = "1OZaMAju9UsUlO8LraQSaLMuUxE2U4kuk"; // same folder as CV uploads

/** GET → { [personKey]: DocUpload[] } */
export async function GET() {
  try {
    if (!canSeeEmployeeDocs(await auth())) return NextResponse.json({});
    return NextResponse.json(await getEmployeeDocs());
  } catch (error) {
    console.error("hrms/documents GET failed", error);
    return NextResponse.json({});
  }
}

/** POST (form): file, doc_key, person_key, person_name, module, record_id */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const username = (session?.user as { username?: string } | undefined)?.username || "";
    if (!canSeeEmployeeDocs(session)) return NextResponse.json({ error: "Only HR and admins can upload employee documents." }, { status: 403 });
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const docKey = String(form.get("doc_key") || "");
    const personKey = String(form.get("person_key") || "").trim();
    if (!EMPLOYEE_DOCS.some((d) => d.key === docKey)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
    if (!personKey) return NextResponse.json({ error: "Missing person." }, { status: 400 });
    if (!file || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File is too big. Keep it under 15 MB." }, { status: 400 });

    // Private: ID documents are never opened to "anyone with the link".
    const fileId = await uploadFileToDrive(file, HRMS_UPLOADS_FOLDER_ID, { private: true });
    if (!fileId) throw new Error("Drive upload failed");
    const fileUrl = `/api/hrms/documents/file/${fileId}`;
    await addEmployeeDoc({
      person_key: personKey,
      person_name: String(form.get("person_name") || ""),
      module: String(form.get("module") || ""),
      record_id: String(form.get("record_id") || ""),
      doc_key: docKey,
      file_url: fileUrl,
      uploaded_by: username,
    });
    return NextResponse.json({ ok: true, file_url: fileUrl });
  } catch (error) {
    console.error("hrms/documents POST failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
