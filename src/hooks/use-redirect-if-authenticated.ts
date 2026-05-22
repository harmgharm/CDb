"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirect away from auth pages (login/signup) when the user already has a
 * valid session. Re-checks on bfcache restore so the back button doesn't
 * show the form to authenticated users.
 */
function isSafeRedirectPath(target: string): boolean {
  return target.startsWith("/") && !target.startsWith("//");
}

export function useRedirectIfAuthenticated(target: string) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const safeTarget = isSafeRedirectPath(target) ? target : "/home";

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me");
        if (!cancelled && response.ok) {
          router.replace(safeTarget);
        }
      } catch {
        // Network failure — fall through and let the user log in normally.
      }
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void checkAuth();
      }
    }

    void checkAuth();
    globalThis.addEventListener("pageshow", handlePageShow);
    return () => {
      cancelled = true;
      globalThis.removeEventListener("pageshow", handlePageShow);
    };
  }, [target, router]);
}
