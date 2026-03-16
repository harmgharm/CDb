/**
 * PATCH /api/notifications/[id] — Mark a single notification as read
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
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
