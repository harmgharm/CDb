/**
 * DELETE /api/recommendations/dismissals/[id] — Restore a dismissed recommendation
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";

export const DELETE = withAuth<{ id: string }>(async (_req, user, { params }) => {
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
});
