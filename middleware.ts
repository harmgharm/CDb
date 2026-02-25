/**
 * Auth Middleware
 *
 * Optimistic JWT verification in Edge Runtime.
 * Does NOT query the database — full authorization happens in
 * server components and API route handlers.
 */

import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/** Routes accessible without authentication */
const PUBLIC_ROUTES = ["/login", "/signup"];

/** Routes that should redirect to /home if already authenticated */
const AUTH_ROUTES = ["/login", "/signup"];

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, { issuer: "cdb" });
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get("access_token")?.value ?? "";
  const session = accessToken.length > 0 ? await verifyToken(accessToken) : null;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Landing page (/) — always accessible
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Unauthenticated user on protected route → redirect to login
  if (!isPublicRoute && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on auth pages → redirect to home
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api/ (handled by route handlers)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, static assets
     */
    String.raw`/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)`,
  ],
};
