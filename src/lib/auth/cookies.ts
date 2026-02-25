/**
 * Auth cookie helpers
 *
 * Access token: sent on all requests (path=/)
 * Refresh token: only sent to refresh endpoint (path=/api/auth/refresh)
 */

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import { env } from "@/lib/env";

const IS_PRODUCTION = env.NODE_ENV === "production";

const ACCESS_TOKEN_NAME = "access_token";
const REFRESH_TOKEN_NAME = "refresh_token";

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export function setAuthCookies(
  cookieStore: ResponseCookies,
  accessToken: string,
  refreshToken: string,
): void {
  cookieStore.set(ACCESS_TOKEN_NAME, accessToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookieStore.set(REFRESH_TOKEN_NAME, refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/api/auth/refresh",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearAuthCookies(cookieStore: ResponseCookies): void {
  cookieStore.set(ACCESS_TOKEN_NAME, "", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  cookieStore.set(REFRESH_TOKEN_NAME, "", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/api/auth/refresh",
    maxAge: 0,
  });
}

export function getAccessToken(cookieStore: ReadonlyRequestCookies): string | undefined {
  return cookieStore.get(ACCESS_TOKEN_NAME)?.value;
}

export function getRefreshToken(cookieStore: ReadonlyRequestCookies): string | undefined {
  return cookieStore.get(REFRESH_TOKEN_NAME)?.value;
}
