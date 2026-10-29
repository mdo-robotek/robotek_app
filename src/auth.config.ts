import type { NextAuthConfig } from "next-auth";

/**
 * API routes that must work without a login. Keep this list short — each
 * entry protects itself some other way.
 *  - /api/auth/*            NextAuth itself (sign-in, session, csrf). The
 *                           Google token helper under /api/auth/google is
 *                           excluded below so it stays admin-only.
 *  - /api/users/status      the login page asks "is this account inactive?"
 *                           before anyone is logged in; returns yes/no only.
 *  - /api/cron/*            server reminder jobs called from the server's own
 *                           crontab; each one only answers localhost.
 *  - /api/checklists/send-reminders  crontab job; needs the CRON_SECRET key.
 */
function isPublicApi(path: string): boolean {
  if (path.startsWith("/api/auth/google")) return false;
  if (path.startsWith("/api/auth/")) return true;
  if (path === "/api/users/status") return true;
  if (path.startsWith("/api/cron/")) return true;
  if (path === "/api/checklists/send-reminders") return true;
  return false;
}

export const authConfig = {
  // Explicitly passing secret and trustHost for Amplify middleware compatibility
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/");
      const isApiRoute = nextUrl.pathname.startsWith("/api");
      const isLoginRoute = nextUrl.pathname.startsWith("/login");

      // Every API route needs a logged-in user (25 Oct 2026). Before this,
      // 100 of 138 API routes answered anyone on the internet — including
      // /api/users, which returned every employee's password.
      if (isApiRoute) {
        if (isLoggedIn || isPublicApi(nextUrl.pathname)) return true;
        return Response.json({ error: "Please log in first." }, { status: 401 });
      }

      if (isOnDashboard && !isApiRoute && !isLoginRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && isLoginRoute) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
  providers: [], // Add providers with empty array for middleware compatibility
} satisfies NextAuthConfig;
