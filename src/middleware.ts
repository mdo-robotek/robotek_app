import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth((req) => {
  // This helps NextAuth trust the Amplify production URL
});

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  // /api is included on purpose: auth.config.ts blocks API calls without a
  // login (except a short public list). Static files and images stay out.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico|jpg|jpeg|webp|gif)$).*)"],
};
