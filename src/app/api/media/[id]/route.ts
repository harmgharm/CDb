/**
 * GET /api/media/[id] — Media detail with sessions and ratings
 * PATCH /api/media/[id] — Update media (admin only)
 * DELETE /api/media/[id] — Delete media (admin only)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAdmin, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateMediaSchema } from "@/lib/validations/media";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  await requireAuth();
  const { id } = await params;

  const media = await db.selectFrom("media").selectAll().where("id", "=", id).executeTakeFirst();

  if (!media) {
    return errorResponse("Media not found", 404);
  }

  // Fetch sessions with picker info
  const sessions = await db
    .selectFrom("watch_sessions")
    .innerJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "watch_sessions.id",
      "watch_sessions.date_watched",
      "watch_sessions.time_watched_at",
      "watch_sessions.notes",
      "watch_sessions.created_at",
      "users.id as picker_id",
      "users.username as picker_username",
      "users.display_name as picker_display_name",
    ])
    .where("watch_sessions.media_id", "=", id)
    .orderBy("watch_sessions.date_watched", "desc")
    .execute();

  // Fetch all ratings for this media across sessions
  const ratings = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "ratings.id",
      "ratings.session_id",
      "ratings.score",
      "ratings.review",
      "ratings.created_at",
      "users.id as user_id",
      "users.username",
      "users.display_name",
    ])
    .where("watch_sessions.media_id", "=", id)
    .execute();

  // Compute stats
  const scores = ratings.map((r) => r.score);
  const avgRating = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return successResponse({
    ...media,
    sessions,
    ratings,
    stats: {
      sessionCount: sessions.length,
      ratingCount: ratings.length,
      avgRating: avgRating === null ? null : Math.round(avgRating * 10) / 10,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin();
  const { id } = await params;

  const media = await db.selectFrom("media").select("id").where("id", "=", id).executeTakeFirst();
  if (!media) {
    return errorResponse("Media not found", 404);
  }

  const body: unknown = await req.json();
  const parsed = updateMediaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const data = parsed.data;
  const updated = await db
    .updateTable("media")
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.tmdbId !== undefined && { tmdb_id: data.tmdbId }),
      ...(data.malId !== undefined && { mal_id: data.malId }),
      ...(data.posterUrl !== undefined && { poster_url: data.posterUrl }),
      ...(data.backdropUrl !== undefined && { backdrop_url: data.backdropUrl }),
      ...(data.synopsis !== undefined && { synopsis: data.synopsis }),
      ...(data.genres !== undefined && { genres: JSON.stringify(data.genres) }),
      ...(data.releaseYear !== undefined && { release_year: data.releaseYear }),
      ...(data.runtimeMinutes !== undefined && { runtime_minutes: data.runtimeMinutes }),
      ...(data.episodeCount !== undefined && { episode_count: data.episodeCount }),
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: admin.id,
    action: "media.updated",
    entityType: "media",
    entityId: id,
    metadata: data,
  });

  return successResponse(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin();
  const { id } = await params;

  const media = await db
    .selectFrom("media")
    .select(["id", "title"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!media) {
    return errorResponse("Media not found", 404);
  }

  await db.deleteFrom("media").where("id", "=", id).execute();

  await logAudit({
    userId: admin.id,
    action: "media.deleted",
    entityType: "media",
    entityId: id,
    metadata: { title: media.title },
  });

  return successResponse(null, "Media deleted");
}
