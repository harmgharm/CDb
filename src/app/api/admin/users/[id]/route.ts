/**
 * PATCH /api/admin/users/[id] — Change user role (admin only)
 * DELETE /api/admin/users/[id] — Remove user (admin only)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAdminUser, logAudit, revokeAllUserTokens } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateRoleSchema } from "@/lib/validations/users";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await getAdminUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  const targetUser = await db
    .selectFrom("users")
    .select(["id", "role", "username"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!targetUser) {
    return errorResponse("User not found", 404);
  }

  const body: unknown = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { role } = parsed.data;

  // Prevent demoting last admin
  if (targetUser.role === "admin" && role === "member") {
    const adminCount = await db
      .selectFrom("users")
      .select(db.fn.countAll().as("count"))
      .where("role", "=", "admin")
      .executeTakeFirstOrThrow();

    if (Number(adminCount.count) <= 1) {
      return errorResponse("Cannot demote the last admin", 400);
    }
  }

  const updated = await db
    .updateTable("users")
    .set({ role, updated_at: new Date() })
    .where("id", "=", id)
    .returning(["id", "username", "email", "display_name", "role"])
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: admin.id,
    action: "user.updated",
    entityType: "user",
    entityId: id,
    metadata: { role, previousRole: targetUser.role },
  });

  return successResponse(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const admin = await getAdminUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  if (admin.id === id) {
    return errorResponse("Cannot delete yourself", 400);
  }

  const targetUser = await db
    .selectFrom("users")
    .select(["id", "username"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!targetUser) {
    return errorResponse("User not found", 404);
  }

  // Revoke all sessions first
  await revokeAllUserTokens(id);

  await db.deleteFrom("users").where("id", "=", id).execute();

  await logAudit({
    userId: admin.id,
    action: "user.deleted",
    entityType: "user",
    entityId: id,
    metadata: { username: targetUser.username },
  });

  return successResponse(null, "User deleted");
}
