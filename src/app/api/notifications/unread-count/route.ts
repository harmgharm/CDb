/**
 * GET /api/notifications/unread-count — Lightweight unread count for the bell badge
 */

import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";

export const GET = withAuth(async (_req, user) => {
  const { count } = await db
    .selectFrom("notifications")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("user_id", "=", user.id)
    .where("is_read", "=", false)
    .executeTakeFirstOrThrow();

  return successResponse({ count: Number(count) });
});
