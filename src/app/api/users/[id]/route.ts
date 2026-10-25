import { NextRequest, NextResponse } from "next/server";
import { isAdminSession, ADMIN_ONLY_MESSAGE } from "@/lib/require-admin";
import { updateUser, deleteUser } from "@/lib/google-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Writes are admin-only (Oct 26): before this any logged-in user could
  // add users, change roles (even their own to ADMIN) or reset passwords.
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: ADMIN_ONLY_MESSAGE }, { status: 403 });
  }
  try {
    const { id } = await params;
    const contentType = req.headers.get("content-type") || "";
    let userData: any;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      userData = JSON.parse(formData.get("userData") as string);
      const file = formData.get("image") as File;

      if (file && file.size > 0) {
        const fileId = await uploadFileToDrive(file);
        userData.image_url = fileId || "";
      }
    } else {
      userData = await req.json();
    }

    const success = await updateUser(id, userData);
    if (!success) throw new Error("Failed to update user in Sheets");

    // Sync permissions if provided
    if (userData.permissions) {
      const { navigation } = await import("@/lib/navigation");
      const { updateUserPermissions } = await import("@/lib/google-sheets");
      const allPageIds = navigation.map(n => n.id);
      await updateUserPermissions(id, userData.username, userData.permissions, allPageIds);
    }

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error: any) {
    console.error("PUT User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Writes are admin-only (Oct 26): before this any logged-in user could
  // add users, change roles (even their own to ADMIN) or reset passwords.
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: ADMIN_ONLY_MESSAGE }, { status: 403 });
  }
  try {
    const { id } = await params;
    const success = await deleteUser(id);
    if (!success) throw new Error("Failed to delete user from Sheets");

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("DELETE User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
