/**
 * PATCH /api/notifications/[id] — Mark a single notification as read
 * DELETE /api/notifications/[id] — Delete a single notification
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const updated = await db
    .updateTable("notifications")
    .set({ is_read: true })
    .where("id", "=", id)
    .where("user_id", "=", user.id)
    .returning("id")
    .executeTakeFirst();

  if (updated === undefined) {
    return errorResponse("Notification not found", 404);
  }

  return successResponse({ id: updated.id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const deleted = await db
    .deleteFrom("notifications")
    .where("id", "=", id)
    .where("user_id", "=", user.id)
    .returning("id")
    .executeTakeFirst();

  if (deleted === undefined) {
    return errorResponse("Notification not found", 404);
  }

  void logAudit({
    userId: user.id,
    action: "notification.deleted",
    entityType: "notification",
    entityId: id,
  }).catch((error: unknown) => {
    console.error("Failed to log audit:", error);
  });

  return successResponse({ id: deleted.id });
}
