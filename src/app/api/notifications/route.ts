/**
 * GET /api/notifications — List notifications for the current user (paginated)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanupOldNotifications } from "@/lib/notifications";
import { notificationQuerySchema } from "@/lib/validations/notifications";

export async function GET(req: NextRequest) {
  const user = await requireAuth();

  // Lazy cleanup — fire-and-forget, never blocks the response
  void cleanupOldNotifications().catch((error: unknown) => {
    console.error("Failed to cleanup old notifications:", error);
  });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = notificationQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { page, limit, unreadOnly } = parsed.data;
  const offset = (page - 1) * limit;

  // Count total matching notifications
  const { count } = await db
    .selectFrom("notifications")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("user_id", "=", user.id)
    .$if(unreadOnly, (q) => q.where("is_read", "=", false))
    .executeTakeFirstOrThrow();

  const total = Number(count);

  // Fetch page of notifications
  const items = await db
    .selectFrom("notifications")
    .selectAll()
    .where("user_id", "=", user.id)
    .$if(unreadOnly, (q) => q.where("is_read", "=", false))
    .orderBy("created_at", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  return successResponse({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      isRead: n.is_read,
      metadata: n.metadata,
      createdAt: n.created_at.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
