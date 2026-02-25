/**
 * POST /api/auth/logout
 *
 * Revoke refresh token and clear auth cookies.
 */

import type { NextRequest } from "next/server";

import { successResponse } from "@/lib/api/response";
import {
  clearAuthCookies,
  findRefreshToken,
  hashToken,
  revokeRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const refreshJwt = req.cookies.get("refresh_token")?.value ?? "";

  // Best-effort revocation — always clear cookies even if token is invalid
  if (refreshJwt.length > 0) {
    const payload = await verifyRefreshToken(refreshJwt);
    if (payload) {
      const tokenHash = hashToken(refreshJwt);
      const storedToken = await findRefreshToken(tokenHash);
      if (storedToken) {
        await revokeRefreshToken(storedToken.id);
      }
    }
  }

  const response = successResponse(null, "Logged out");
  clearAuthCookies(response.cookies);

  return response;
}
