/**
 * GET /api/sessions/[id] — Session detail with attendees and ratings
 * PATCH /api/sessions/[id] — Update session (admin or picker)
 * DELETE /api/sessions/[id] — Delete session (admin only)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { isModeratorOrAdmin, logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSessionSchema } from "@/lib/validations/sessions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  await requireAuth();
  const { id } = await params;

  const session = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .leftJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "watch_sessions.id",
      "watch_sessions.date_watched",
      "watch_sessions.time_watched_at",
      "watch_sessions.notes",
      "watch_sessions.created_at",
      "watch_sessions.created_by_user_id",
      "media.id as media_id",
      "media.title as media_title",
      "media.type as media_type",
      "media.poster_url as media_poster_url",
      "media.backdrop_url as media_backdrop_url",
      "users.id as picker_id",
      "users.username as picker_username",
      "users.display_name as picker_display_name",
    ])
    .where("watch_sessions.id", "=", id)
    .executeTakeFirst();

  if (!session) {
    return errorResponse("Session not found", 404);
  }

  const attendees = await db
    .selectFrom("session_attendees")
    .innerJoin("users", "users.id", "session_attendees.user_id")
    .select(["users.id", "users.username", "users.display_name", "users.avatar_url"])
    .where("session_attendees.session_id", "=", id)
    .execute();

  const ratings = await db
    .selectFrom("ratings")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "ratings.id",
      "ratings.score",
      "ratings.review",
      "ratings.created_at",
      "users.id as user_id",
      "users.username",
      "users.display_name",
    ])
    .where("ratings.session_id", "=", id)
    .execute();

  return successResponse({
    ...session,
    attendees,
    ratings: ratings.map((r) => ({ ...r, score: Number(r.score) })),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const session = await db
    .selectFrom("watch_sessions")
    .select(["id", "picked_by_user_id", "created_by_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!session) {
    return errorResponse("Session not found", 404);
  }

  // Only admin/mod, creator, or picker can update
  if (
    !isModeratorOrAdmin(user.role) &&
    user.id !== session.created_by_user_id &&
    user.id !== session.picked_by_user_id
  ) {
    return errorResponse("Not authorized", 403);
  }

  const body: unknown = await req.json();
  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const data = parsed.data;
  const updated = await db
    .updateTable("watch_sessions")
    .set({
      ...(data.mediaId !== undefined && { media_id: data.mediaId }),
      ...(data.dateWatched !== undefined && { date_watched: data.dateWatched }),
      ...(data.timeWatchedAt !== undefined && { time_watched_at: data.timeWatchedAt }),
      ...(data.pickedByUserId !== undefined && { picked_by_user_id: data.pickedByUserId }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "session.updated",
    entityType: "session",
    entityId: id,
  });

  return successResponse(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const session = await db
    .selectFrom("watch_sessions")
    .select(["id", "created_by_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!session) {
    return errorResponse("Session not found", 404);
  }

  // Only admin/mod or creator can delete
  if (!isModeratorOrAdmin(user.role) && user.id !== session.created_by_user_id) {
    return errorResponse("Not authorized", 403);
  }

  await db.deleteFrom("watch_sessions").where("id", "=", id).execute();

  await logAudit({
    userId: user.id,
    action: "session.deleted",
    entityType: "session",
    entityId: id,
  });

  return successResponse(null, "Session deleted");
}
