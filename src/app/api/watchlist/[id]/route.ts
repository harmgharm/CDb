/**
 * PATCH /api/watchlist/[id] — Update watchlist entry status/notes
 * DELETE /api/watchlist/[id] — Remove entry from watchlist
 */

import { parseBody } from "@/lib/api/parse-body";
import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { isModeratorOrAdmin, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateWatchlistEntrySchema } from "@/lib/validations/watchlist";

export const PATCH = withAuth<{ id: string }>(async (req, user, { params }) => {
  const { id } = await params;

  const entry = await db
    .selectFrom("watchlist")
    .select(["id", "user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (entry === undefined) {
    return errorResponse("Watchlist entry not found", 404);
  }

  if (entry.user_id !== user.id && !isModeratorOrAdmin(user.role)) {
    return errorResponse("Not authorized", 403);
  }

  const parsed = await parseBody(req, updateWatchlistEntrySchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const updated = await db
    .updateTable("watchlist")
    .set({
      ...parsed.data,
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "watchlist.updated",
    entityType: "watchlist",
    entityId: id,
    metadata: parsed.data,
  });

  return successResponse(updated, "Watchlist entry updated");
});

export const DELETE = withAuth<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;

  const entry = await db
    .selectFrom("watchlist")
    .select(["id", "user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (entry === undefined) {
    return errorResponse("Watchlist entry not found", 404);
  }

  if (entry.user_id !== user.id && !isModeratorOrAdmin(user.role)) {
    return errorResponse("Not authorized", 403);
  }

  await db.deleteFrom("watchlist").where("id", "=", id).execute();

  await logAudit({
    userId: user.id,
    action: "watchlist.removed",
    entityType: "watchlist",
    entityId: id,
  });

  return successResponse(null, "Removed from watchlist");
});
