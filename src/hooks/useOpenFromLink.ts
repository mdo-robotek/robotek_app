"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Opens a page's form when the URL asks for it, e.g. /delegations?new=1 from
 * the "+ New" button. Reacts to every new link (the button adds `n=<time>`),
 * so it works even when you are already on the page. Afterwards the URL is
 * cleaned so a refresh doesn't reopen the form.
 */
export function useOpenFromLink(param: string, value: string, onOpen: () => void) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    if (searchParams?.get(param) !== value) return;
    openRef.current();
    router.replace(pathname || "/", { scroll: false });
  }, [searchParams, param, value, router, pathname]);
}
