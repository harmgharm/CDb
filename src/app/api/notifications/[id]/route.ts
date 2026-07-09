/**
 * PATCH /api/notifications/[id] — Mark a single notification as read
 * DELETE /api/notifications/[id] — Delete a single notification
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";

export const PATCH = withAuth<{ id: string }>(async (_req, user, { params }) => {
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
});

export const DELETE = withAuth<{ id: string }>(async (_req, user, { params }) => {
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
});
