/**
 * GET /api/users/[id]/stats — Detailed user statistics
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  await requireAuth();
  const { id } = await params;

  // Verify user exists
  const user = await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();

  if (!user) {
    return errorResponse("User not found", 404);
  }

  // Rating distribution (1-10 histogram)
  const ratingDistribution = await db
    .selectFrom("ratings")
    .select([sql<string>`floor(score)`.as("bucket"), db.fn.countAll().as("count")])
    .where("user_id", "=", id)
    .groupBy(sql`floor(score)`)
    .orderBy("bucket", "asc")
    .execute();

  // Genre breakdown (count per genre from attended sessions)
  const genreBreakdown = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.genres"])
    .where("session_attendees.user_id", "=", id)
    .execute();

  const genreCounts: Record<string, number> = {};
  for (const row of genreBreakdown) {
    const genres = row.genres;
    for (const genre of genres) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
  }

  const topGenres = Object.entries(genreCounts)
    .toSorted(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));

  // Pick history (recent picks with media info + avg rating for W/L)
  const picks = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .leftJoin("ratings", "ratings.session_id", "watch_sessions.id")
    .select([
      "watch_sessions.id as session_id",
      "watch_sessions.date_watched",
      "media.id as media_id",
      "media.title",
      "media.type",
      "media.poster_url",
      db.fn.avg("ratings.score").as("avg_score"),
      db.fn.count("ratings.id").as("rating_count"),
    ])
    .where("watch_sessions.picked_by_user_id", "=", id)
    .groupBy([
      "watch_sessions.id",
      "watch_sessions.date_watched",
      "media.id",
      "media.title",
      "media.type",
      "media.poster_url",
    ])
    .orderBy("watch_sessions.date_watched", "desc")
    .limit(20)
    .execute();

  return successResponse({
    ratingDistribution: ratingDistribution.map((r) => ({
      score: Number(r.bucket),
      count: Number(r.count),
    })),
    topGenres,
    recentPicks: picks.map((p) => ({
      session_id: p.session_id,
      date_watched: p.date_watched,
      media_id: p.media_id,
      title: p.title,
      type: p.type,
      poster_url: p.poster_url,
      avgScore: Number(p.rating_count) >= 2 ? Math.round(Number(p.avg_score) * 10) / 10 : null,
    })),
  });
}
