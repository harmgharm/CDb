/**
 * PATCH /api/watchlist/[id] — Update watchlist entry status/notes
 * DELETE /api/watchlist/[id] — Remove entry from watchlist
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { isModeratorOrAdmin, logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateWatchlistEntrySchema } from "@/lib/validations/watchlist";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
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

  const body: unknown = await req.json();
  const parsed = updateWatchlistEntrySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
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
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
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
}
