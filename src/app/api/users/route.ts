import { NextRequest, NextResponse } from "next/server";
import { isAdminSession, ADMIN_ONLY_MESSAGE } from "@/lib/require-admin";
import { getUsers, addUser } from "@/lib/google-sheets";
import { uploadFileToDrive } from "@/lib/google-drive";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Serialize user creation so two simultaneous adds can never get the same code
let userAddLock: Promise<any> = Promise.resolve();

function nextEmpCodeFrom(users: { id?: string }[]): string {
  let max = 0;
  for (const u of users) {
    const m = String(u.id || "").trim().match(/^RE\s*0*(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "RE" + String(max + 1).padStart(3, "0");
}

export async function GET() {
  try {
    const allUsers = await getUsers();
    // Passwords never leave the server. Editing a user with the password box
    // left blank keeps the current password (see updateUser).
    const safe = allUsers.map(({ password: _password, ...rest }) => ({ ...rest, password: "" }));
    return NextResponse.json(safe);
  } catch (error: any) {
    console.error("GET Users Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Writes are admin-only (Oct 26): before this any logged-in user could
  // add users, change roles (even their own to ADMIN) or reset passwords.
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: ADMIN_ONLY_MESSAGE }, { status: 403 });
  }
  try {
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

    // Auto-generate / validate unique employee code under a lock
    const success = await (userAddLock = userAddLock.then(async () => {
      const existing = await getUsers();
      const idStr = String(userData.id || "").trim();
      const isValidFormat = /^RE\d+$/i.test(idStr);
      const isDuplicate = existing.some(
        (u) => String(u.id || "").trim().toLowerCase() === idStr.toLowerCase()
      );
      if (!idStr || !isValidFormat || isDuplicate) {
        userData.id = nextEmpCodeFrom(existing);
      }
      return addUser(userData);
    }).catch((err) => {
      console.error("Error in user add lock:", err);
      return false;
    }));
    if (!success) throw new Error("Failed to add user to Sheets");

    // Sync permissions if provided
    if (userData.permissions) {
      const { navigation } = await import("@/lib/navigation");
      const { updateUserPermissions } = await import("@/lib/google-sheets");
      const allPageIds = navigation.map(n => n.id);
      await updateUserPermissions(userData.id, userData.username, userData.permissions, allPageIds);
    }

    return NextResponse.json({ message: "User added successfully", id: userData.id });
  } catch (error: any) {
    console.error("POST User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
