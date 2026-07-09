/**
 * GET /api/users/[id]/stats — Detailed user statistics
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const _user = await getAuthUser();
  if (!_user) {
    return errorResponse("Not authenticated", 401);
  }
  const { id } = await params;

  // Verify user exists
  const user = await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();

  if (!user) {
    return errorResponse("User not found", 404);
  }

  // Rating distribution — individual ratings with media info
  const allRatings = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["ratings.score", "media.id as media_id", "media.title", "media.poster_url"])
    .where("ratings.user_id", "=", id)
    .orderBy("ratings.score", "desc")
    .execute();

  // Group into buckets by floor(score)
  const bucketMap = new Map<number, { count: number; ratings: typeof allRatings }>();
  for (const rating of allRatings) {
    const bucket = Math.floor(Number(rating.score));
    const existing = bucketMap.get(bucket) ?? { count: 0, ratings: [] };
    existing.count += 1;
    existing.ratings.push(rating);
    bucketMap.set(bucket, existing);
  }

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
      "media.release_year",
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
      "media.release_year",
    ])
    .orderBy(sql`watch_sessions.date_watched desc nulls last`)
    .limit(20)
    .execute();

  return successResponse({
    ratingDistribution: [...bucketMap.entries()].map(([score, data]) => ({
      score,
      count: data.count,
      ratings: data.ratings.map((r) => ({
        mediaId: r.media_id,
        title: r.title,
        posterUrl: r.poster_url,
        score: Math.round(Number(r.score) * 10) / 10,
      })),
    })),
    topGenres,
    recentPicks: picks.map((p) => ({
      session_id: p.session_id,
      date_watched: p.date_watched,
      media_id: p.media_id,
      title: p.title,
      type: p.type,
      poster_url: p.poster_url,
      release_year: p.release_year,
      avgScore: Number(p.rating_count) >= 2 ? Math.round(Number(p.avg_score) * 10) / 10 : null,
    })),
  });
}
