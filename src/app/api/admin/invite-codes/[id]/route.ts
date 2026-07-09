/**
 * PATCH /api/admin/invite-codes/[id] — Update invite code expiry (admin only)
 * DELETE /api/admin/invite-codes/[id] — Delete unused invite code (admin only)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAdminUser, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateInviteCodeSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await getAdminUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  const invite = await db
    .selectFrom("invite_codes")
    .select(["id", "code", "used_by_user_id", "expires_at"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (invite === undefined) {
    return errorResponse("Invite code not found", 404);
  }

  if (invite.used_by_user_id !== null) {
    return errorResponse("Cannot edit a used invite code", 400);
  }

  const body: unknown = await req.json();
  const parsed = updateInviteCodeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { expiresInDays } = parsed.data;
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + expiresInDays);

  await db
    .updateTable("invite_codes")
    .set({ expires_at: newExpiresAt })
    .where("id", "=", id)
    .execute();

  await logAudit({
    userId: admin.id,
    action: "invite.updated",
    entityType: "invite_code",
    entityId: id,
    metadata: {
      code: invite.code,
      previousExpiresAt: invite.expires_at.toISOString(),
      newExpiresAt: newExpiresAt.toISOString(),
    },
  });

  return successResponse({ id, expiresAt: newExpiresAt });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const admin = await getAdminUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  const invite = await db
    .selectFrom("invite_codes")
    .select(["id", "code", "used_by_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (invite === undefined) {
    return errorResponse("Invite code not found", 404);
  }

  if (invite.used_by_user_id !== null) {
    return errorResponse("Cannot delete a used invite code", 400);
  }

  await db.deleteFrom("invite_codes").where("id", "=", id).execute();

  await logAudit({
    userId: admin.id,
    action: "invite.deleted",
    entityType: "invite_code",
    entityId: id,
    metadata: { code: invite.code },
  });

  return successResponse(null, "Invite code deleted");
}
