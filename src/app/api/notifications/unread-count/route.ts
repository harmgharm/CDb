/**
 * GET /api/notifications/unread-count — Lightweight unread count for the bell badge
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireAuth();

  const { count } = await db
    .selectFrom("notifications")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("user_id", "=", user.id)
    .where("is_read", "=", false)
    .executeTakeFirstOrThrow();

  return successResponse({ count: Number(count) });
}
