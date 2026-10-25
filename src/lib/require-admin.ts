import { auth } from "@/auth";

/** True when the logged-in user's role is ADMIN or EA (same rule as the UI). */
export async function isAdminSession(): Promise<boolean> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === "ADMIN" || role === "EA";
}

export const ADMIN_ONLY_MESSAGE = "Only admins can add, change or remove users.";
