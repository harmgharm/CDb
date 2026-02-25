/**
 * Extract client IP from request headers (Vercel / standard proxies)
 */

import type { NextRequest } from "next/server";

export function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
