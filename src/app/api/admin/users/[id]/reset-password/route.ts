/**
 * POST /api/admin/users/[id]/reset-password
 *
 * Admin-only endpoint to reset a user's password.
 * Generates a temporary password, revokes all sessions, and returns the temp password.
 */

import { randomBytes } from "node:crypto";

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAdminUser, hashPassword, logAudit, revokeAllUserTokens } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const admin = await getAdminUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  if (admin.id === id) {
    return errorResponse("Cannot reset your own password here. Use the change password page.", 400);
  }

  const targetUser = await db
    .selectFrom("users")
    .select(["id", "username"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!targetUser) {
    return errorResponse("User not found", 404);
  }

  const temporaryPassword = generateTemporaryPassword();
  const newHash = await hashPassword(temporaryPassword);

  await db
    .updateTable("users")
    .set({ password_hash: newHash, updated_at: new Date() })
    .where("id", "=", id)
    .execute();

  await revokeAllUserTokens(id);

  await logAudit({
    userId: admin.id,
    action: "user.password_reset",
    entityType: "user",
    entityId: id,
    metadata: { username: targetUser.username },
  });

  return successResponse({ temporaryPassword }, "Password reset successfully");
}
