/**
 * GET /api/stats/public — Public group stats (no auth required)
 *
 * Returns aggregate counts and recent activity without exposing user IDs.
 */

import { successResponse } from "@/lib/api/response";
import { db } from "@/lib/db";
import { fetchAvgRating, fetchHoursWatched, fetchMostWatchedGenre } from "@/lib/stats/queries";

export async function GET() {
  const [
    mediaCounts,
    totalSessions,
    totalRatings,
    memberCount,
    recentMedia,
    topMedia,
    hoursWatched,
    avgRating,
    mostWatchedGenre,
  ] = await Promise.all([
    // Total counts by media type
    db
      .selectFrom("media")
      .innerJoin("watch_sessions", "watch_sessions.media_id", "media.id")
      .select(["media.type", db.fn.count("media.id").distinct().as("count")])
      .groupBy("media.type")
      .execute(),

    db.selectFrom("watch_sessions").select(db.fn.countAll().as("count")).executeTakeFirstOrThrow(),

    db.selectFrom("ratings").select(db.fn.countAll().as("count")).executeTakeFirstOrThrow(),

    db.selectFrom("users").select(db.fn.countAll().as("count")).executeTakeFirstOrThrow(),

    // Recent watched media (public-safe: just titles and types, no user info)
    db
      .selectFrom("watch_sessions")
      .innerJoin("media", "media.id", "watch_sessions.media_id")
      .select(["media.title", "media.type", "media.poster_url", "watch_sessions.date_watched"])
      .where("watch_sessions.date_watched", "is not", null)
      .orderBy("watch_sessions.date_watched", "desc")
      .limit(8)
      .execute(),

    // Highest rated media (public-safe, top 6 — matches design system kit)
    db
      .selectFrom("ratings")
      .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
      .innerJoin("media", "media.id", "watch_sessions.media_id")
      .select([
        "media.id",
        "media.title",
        "media.type",
        "media.poster_url",
        db.fn.avg("ratings.score").as("avg_score"),
        db.fn.countAll().as("rating_count"),
      ])
      .groupBy(["media.id", "media.title", "media.type", "media.poster_url"])
      .having(db.fn.countAll(), ">=", 2)
      .orderBy("avg_score", "desc")
      .limit(6)
      .execute(),

    fetchHoursWatched(),
    fetchAvgRating(),
    fetchMostWatchedGenre(),
  ]);

  return successResponse({
    mediaWatched: Object.fromEntries(mediaCounts.map((m) => [m.type, Number(m.count)])),
    totalSessions: Number(totalSessions.count),
    totalRatings: Number(totalRatings.count),
    memberCount: Number(memberCount.count),
    hoursWatched,
    avgRating,
    mostWatchedGenre,
    recentMedia: recentMedia.map((m) => ({
      title: m.title,
      type: m.type,
      posterUrl: m.poster_url,
      dateWatched: m.date_watched,
    })),
    topMedia: topMedia.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      posterUrl: m.poster_url,
      avgScore: Math.round(Number(m.avg_score) * 10) / 10,
      ratingCount: Number(m.rating_count),
    })),
  });
}
