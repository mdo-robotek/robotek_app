"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { navigation } from "@/lib/navigation";
import { usePermissions } from "@/hooks/usePermissions";

export default function AccessGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const { permissions: userPermissions, isAdmin, isLoading: loadingPermissions } = usePermissions();

  // Safety timeout — never stay stuck longer than 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthorized === null) setIsAuthorized(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isAuthorized]);

  useEffect(() => {
    if (status === "loading" || loadingPermissions) return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Skip check for universally accessible core features.
    // Action Board / Performance Board check access on the server (Admin, EA, Process Coordinator).
    if (pathname === "/login" || pathname === "/" || pathname.startsWith("/chat") || pathname.startsWith("/grn") || pathname.startsWith("/scheduler") || pathname.startsWith("/field-driver") || pathname.startsWith("/inventory/stationary") || pathname.startsWith("/attendance") || pathname.startsWith("/leave") || pathname.startsWith("/customer-target") || pathname.startsWith("/action-board") || pathname.startsWith("/team-board")) {
      setIsAuthorized(true);
      return;
    }

    // Find if the current path is one of the managed pages
    // Use exact match for root, startsWith for others
    const currentNavItem = navigation.find(item => 
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
    );

    if (currentNavItem) {
      // It's a managed page
      let hasAccess = false;
      
      if (userPermissions.length > 0) {
        hasAccess = userPermissions.some((p: string) => p.toLowerCase() === currentNavItem.id.toLowerCase());
      } else {
        // Fallback: Admins see all if no matrix data
        hasAccess = isAdmin;
      }

      if (!hasAccess) {
        setIsAuthorized(false);
        return;
      }
    }

    setIsAuthorized(true);
  }, [session, status, loadingPermissions, pathname, router, userPermissions, isAdmin]);

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 transition-all duration-500 animate-in fade-in zoom-in-95">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mb-8 border-2 border-red-100 dark:border-red-900/30 shadow-inner">
          <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-3 tracking-tighter">Access Denied</h1>
        <p className="text-gray-500 dark:text-slate-400 font-bold text-sm max-w-md leading-relaxed">
          Your account does not have permission to view this section.<br/> Please contact your administrator if this is an error.
        </p>
        <div className="flex gap-4 mt-10">
            <button 
                onClick={() => router.back()}
                className="px-8 py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 font-semibold text-[13px] rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:scale-95"
            >
                Go Back
            </button>
            <button 
                onClick={() => router.push('/')}
                className="px-8 py-3 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black font-semibold text-[13px] rounded-full shadow-[0_10px_20px_-5px_rgba(0,56,117,0.3)] dark:shadow-[0_10px_20px_-5px_rgba(255,213,0,0.3)] hover:scale-105 transition-all active:scale-95 border-b-4 border-black/10 dark:border-black/20"
            >
                Return to Dashboard
            </button>
        </div>
      </div>
    );
  }

  if (isAuthorized === null || status === "loading") {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-[#2563EB] dark:border-t-[#60A5FA] rounded-full animate-spin mb-4" />
            <p className="text-[13px] font-semibold text-[#5B6472] animate-pulse font-mono">Verifying Access...</p>
        </div>
    );
  }

  return <>{children}</>;
}
