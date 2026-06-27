/**
 * POST /api/auth/refresh
 *
 * Rotate refresh token and issue new access token.
 * Implements reuse detection — if a revoked token is reused outside the grace
 * window, the entire token family is invalidated. Within the grace window, reuse
 * is treated as a benign concurrent-refresh race and the caller is handed a
 * fresh access token off the family's current token instead.
 */

import type { NextRequest } from "next/server";

import { getIp } from "@/lib/api/get-ip";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  clearAuthCookies,
  createRefreshToken,
  findRefreshToken,
  hashToken,
  isWithinReuseGrace,
  refreshLimiter,
  resolveCurrentToken,
  revokeAndReplaceRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  setAccessTokenCookie,
  setAuthCookies,
  signAccessToken,
  verifyRefreshToken,
} from "@/lib/auth";
import { db } from "@/lib/db";
import type { RefreshToken } from "@/lib/db/types";

/** Look up the user behind a token, for issuing a fresh access token. */
async function getTokenUser(userId: string) {
  return db.selectFrom("users").select(["id", "role"]).where("id", "=", userId).executeTakeFirst();
}

/**
 * Handle a re-presented already-revoked token. Within the grace window, follow
 * the chain to the family's current token and return a fresh-access-token
 * response (a benign concurrent-refresh race). Otherwise — stale reuse or a
 * torn-down chain — revoke the whole family as theft.
 */
async function handleRevokedToken(storedToken: RefreshToken): Promise<Response> {
  if (isWithinReuseGrace(storedToken.revoked_at, Date.now())) {
    const current = await resolveCurrentToken(storedToken);
    const graceUser = current === undefined ? undefined : await getTokenUser(current.user_id);
    if (graceUser !== undefined) {
      const accessToken = await signAccessToken({ userId: graceUser.id, role: graceUser.role });
      const response = successResponse({ refreshed: true });
      setAccessTokenCookie(response.cookies, accessToken);
      return response;
    }
  }
  await revokeTokenFamily(storedToken.family);
  const response = errorResponse("Token reuse detected. All sessions revoked.", 401);
  clearAuthCookies(response.cookies);
  return response;
}

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

  // Reuse detection — a revoked token re-presented is either a benign
  // concurrent-refresh race (within grace) or theft (handled in the helper).
  if (storedToken.revoked_at) {
    return handleRevokedToken(storedToken);
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

  // Rotate: create the successor (same family), then revoke the old token while
  // recording the successor in `replaced_by` so a racing reuse can follow the
  // chain to it during the grace window.
  const accessToken = await signAccessToken({ userId: user.id, role: user.role });
  const { jwt: newRefreshJwt, tokenId: newTokenId } = await createRefreshToken(
    user.id,
    storedToken.family,
  );
  await revokeAndReplaceRefreshToken(storedToken.id, newTokenId);

  const response = successResponse({ refreshed: true });
  setAuthCookies(response.cookies, accessToken, newRefreshJwt);

  return response;
}
