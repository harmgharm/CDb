/**
 * POST /api/auth/change-password
 *
 * Change the current user's password. Revokes all other sessions
 * and re-issues tokens for the current session.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import {
  changePasswordLimiter,
  createRefreshToken,
  getAuthUser,
  hashPassword,
  logAudit,
  revokeAllUserTokens,
  setAuthCookies,
  signAccessToken,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validations/users";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const limit = changePasswordLimiter.check(user.id);
  if (!limit.allowed) {
    return errorResponse(`Too many attempts. Try again in ${String(limit.retryAfter)}s.`, 429);
  }

  const body: unknown = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch current password hash
  const dbUser = await db
    .selectFrom("users")
    .select(["id", "password_hash", "role"])
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();

  // Verify current password
  const valid = await verifyPassword(dbUser.password_hash, currentPassword);
  if (!valid) {
    return errorResponse("Current password is incorrect", 401);
  }

  changePasswordLimiter.reset(user.id);

  // Hash and update new password
  const newHash = await hashPassword(newPassword);
  await db
    .updateTable("users")
    .set({ password_hash: newHash, updated_at: new Date() })
    .where("id", "=", user.id)
    .execute();

  // Revoke all existing sessions
  await revokeAllUserTokens(user.id);

  // Re-issue fresh tokens for current session
  const accessToken = await signAccessToken({ userId: user.id, role: dbUser.role });
  const { jwt: refreshJwt } = await createRefreshToken(user.id);

  await logAudit({
    userId: user.id,
    action: "user.updated",
    entityType: "user",
    entityId: user.id,
    metadata: { field: "password" },
  });

  const response = successResponse(null, "Password changed successfully");
  setAuthCookies(response.cookies, accessToken, refreshJwt);

  return response;
}
