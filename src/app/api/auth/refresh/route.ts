/**
 * POST /api/auth/refresh
 *
 * Rotate refresh token and issue new access token.
 * Implements reuse detection — if a revoked token is reused,
 * the entire token family is invalidated.
 */

import type { NextRequest } from "next/server";

import { getIp } from "@/lib/api/get-ip";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  clearAuthCookies,
  createRefreshToken,
  findRefreshToken,
  hashToken,
  refreshLimiter,
  revokeRefreshToken,
  revokeTokenFamily,
  setAuthCookies,
  signAccessToken,
  verifyRefreshToken,
} from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getIp(req);
  const limit = refreshLimiter.check(ip);
  if (!limit.allowed) {
    return errorResponse(`Too many attempts. Try again in ${String(limit.retryAfter)}s.`, 429);
  }

  // Read refresh token from cookie
  const refreshJwt = req.cookies.get("refresh_token")?.value ?? "";
  if (refreshJwt.length === 0) {
    return errorResponse("No refresh token", 401);
  }

  // Verify JWT signature
  const payload = await verifyRefreshToken(refreshJwt);
  if (!payload) {
    return errorResponse("Invalid refresh token", 401);
  }

  // Look up in DB by hash
  const tokenHash = hashToken(refreshJwt);
  const storedToken = await findRefreshToken(tokenHash);

  if (!storedToken) {
    return errorResponse("Refresh token not found", 401);
  }

  // Reuse detection: if token was already revoked, someone stole it
  if (storedToken.revoked_at) {
    await revokeTokenFamily(storedToken.family);
    const response = errorResponse("Token reuse detected. All sessions revoked.", 401);
    clearAuthCookies(response.cookies);
    return response;
  }

  // Check expiry
  if (new Date() > storedToken.expires_at) {
    await revokeRefreshToken(storedToken.id);
    const response = errorResponse("Refresh token expired", 401);
    clearAuthCookies(response.cookies);
    return response;
  }

  // Fetch user
  const user = await db
    .selectFrom("users")
    .select(["id", "role"])
    .where("id", "=", storedToken.user_id)
    .executeTakeFirst();

  if (!user) {
    await revokeTokenFamily(storedToken.family);
    return errorResponse("User not found", 401);
  }

  // Rotate: revoke old, create new (same family)
  await revokeRefreshToken(storedToken.id);
  const accessToken = await signAccessToken({ userId: user.id, role: user.role });
  const { jwt: newRefreshJwt } = await createRefreshToken(user.id, storedToken.family);

  const response = successResponse({ refreshed: true });
  setAuthCookies(response.cookies, accessToken, newRefreshJwt);

  return response;
}
