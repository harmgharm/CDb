/**
 * POST /api/notifications/mark-all-read — Bulk mark all unread notifications as read
 */

import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = withAuth(async (_req, user) => {
  const result = await db
    .updateTable("notifications")
    .set({ is_read: true })
    .where("user_id", "=", user.id)
    .where("is_read", "=", false)
    .execute();

  const updatedCount = Number(result[0]?.numUpdatedRows ?? 0);

  if (updatedCount > 0) {
    void logAudit({
      userId: user.id,
      action: "notification.read_all",
      entityType: "notification",
      entityId: null,
      metadata: { count: updatedCount },
    }).catch((error: unknown) => {
      console.error("Failed to log audit:", error);
    });
  }

  return successResponse({ success: true });
});
