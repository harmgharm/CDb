/**
 * POST /api/notifications/clear-all — Delete all notifications for the current user
 */

import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = withAuth(async (_req, user) => {
  const result = await db.deleteFrom("notifications").where("user_id", "=", user.id).execute();

  const deletedCount = Number(result[0]?.numDeletedRows ?? 0);

  if (deletedCount > 0) {
    void logAudit({
      userId: user.id,
      action: "notification.cleared",
      entityType: "notification",
      entityId: null,
      metadata: { count: deletedCount },
    }).catch((error: unknown) => {
      console.error("Failed to log audit:", error);
    });
  }

  return successResponse({ success: true, deletedCount });
});
