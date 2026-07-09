/**
 * DELETE /api/recommendations/dismissals/[id] — Restore a dismissed recommendation
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }
  const { id } = await params;

  const entry = await db
    .selectFrom("recommendation_dismissals")
    .select(["id", "user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (entry === undefined) {
    return errorResponse("Dismissal not found", 404);
  }

  if (entry.user_id !== user.id) {
    return errorResponse("Not authorized", 403);
  }

  await db.deleteFrom("recommendation_dismissals").where("id", "=", id).execute();

  await logAudit({
    userId: user.id,
    action: "recommendation.undismissed",
    entityType: "recommendation_dismissal",
    entityId: id,
  });

  return successResponse(null, "Recommendation restored");
}
