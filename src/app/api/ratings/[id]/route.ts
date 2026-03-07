/**
 * PATCH /api/ratings/[id] — Update own rating
 * DELETE /api/ratings/[id] — Delete own rating (or admin)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { isModeratorOrAdmin, logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateRatingSchema } from "@/lib/validations/sessions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const rating = await db
    .selectFrom("ratings")
    .select(["id", "user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!rating) {
    return errorResponse("Rating not found", 404);
  }

  if (!isModeratorOrAdmin(user.role) && rating.user_id !== user.id) {
    return errorResponse("Not authorized", 403);
  }

  const body: unknown = await req.json();
  const parsed = updateRatingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const data = parsed.data;
  const updated = await db
    .updateTable("ratings")
    .set({
      ...(data.score !== undefined && { score: data.score }),
      ...(data.review !== undefined && { review: data.review }),
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "rating.updated",
    entityType: "rating",
    entityId: id,
    metadata: data,
  });

  return successResponse({ ...updated, score: Number(updated.score) });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const rating = await db
    .selectFrom("ratings")
    .select(["id", "user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!rating) {
    return errorResponse("Rating not found", 404);
  }

  if (!isModeratorOrAdmin(user.role) && rating.user_id !== user.id) {
    return errorResponse("Not authorized", 403);
  }

  await db.deleteFrom("ratings").where("id", "=", id).execute();

  await logAudit({
    userId: user.id,
    action: "rating.deleted",
    entityType: "rating",
    entityId: id,
  });

  return successResponse(null, "Rating deleted");
}
