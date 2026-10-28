"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * /grn?find=GRN-451 → puts "GRN-451" in the page's search box so that one
 * item is on screen, ready to update. Used by the "Open" button in the work
 * list window (Sahil, 2026-10-28). The URL is cleaned afterwards.
 */
export function useFindFromLink(onFind: (text: string) => void) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef(onFind);
  ref.current = onFind;

  useEffect(() => {
    const text = searchParams?.get("find");
    if (!text) return;
    ref.current(text);
    router.replace(pathname || "/", { scroll: false });
  }, [searchParams, router, pathname]);
}
