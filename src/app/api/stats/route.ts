/**
 * GET /api/stats — Group-level dashboard statistics
 */

import { sql } from "kysely";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deriveWeeksSince } from "@/lib/sessions/timeline";
import { fetchAvgRating, fetchHoursWatched } from "@/lib/stats/queries";

export async function GET() {
  const _user = await getAuthUser();
  if (!_user) {
    return errorResponse("Not authenticated", 401);
  }

  // Total counts by media type
  const mediaCounts = await db
    .selectFrom("media")
    .innerJoin("watch_sessions", "watch_sessions.media_id", "media.id")
    .select(["media.type", db.fn.count("media.id").distinct().as("count")])
    .groupBy("media.type")
    .execute();

  const totalSessions = await db
    .selectFrom("watch_sessions")
    .select(db.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();

  const totalRatings = await db
    .selectFrom("ratings")
    .select(db.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();

  // Most active picker
  const topPicker = await db
    .selectFrom("watch_sessions")
    .innerJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "users.id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
      db.fn.countAll().as("pick_count"),
    ])
    .where("watch_sessions.picked_by_user_id", "is not", null)
    .groupBy(["users.id", "users.username", "users.display_name", "users.avatar_url"])
    .orderBy("pick_count", "desc")
    .limit(1)
    .executeTakeFirst();

  // Highest average rater (min 3 ratings)
  const topRater = await db
    .selectFrom("ratings")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "users.id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
      db.fn.avg("ratings.score").as("avg_score"),
      db.fn.countAll().as("rating_count"),
    ])
    .groupBy(["users.id", "users.username", "users.display_name", "users.avatar_url"])
    .having(db.fn.countAll(), ">=", 3)
    .orderBy("avg_score", "desc")
    .limit(1)
    .executeTakeFirst();

  // Most attended user
  const topAttendee = await db
    .selectFrom("session_attendees")
    .innerJoin("users", "users.id", "session_attendees.user_id")
    .select([
      "users.id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
      db.fn.countAll().as("attendance_count"),
    ])
    .groupBy(["users.id", "users.username", "users.display_name", "users.avatar_url"])
    .orderBy("attendance_count", "desc")
    .limit(1)
    .executeTakeFirst();

  // Highest rated media (min 2 ratings)
  const highestRated = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select([
      "media.id",
      "media.title",
      "media.type",
      "media.poster_url",
      db.fn.avg("ratings.score").as("avg_score"),
    ])
    .groupBy(["media.id", "media.title", "media.type", "media.poster_url"])
    .having(db.fn.countAll(), ">=", 2)
    .orderBy("avg_score", "desc")
    .limit(1)
    .executeTakeFirst();

  // Most divisive media (highest std dev, min 3 ratings)
  const mostDivisive = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select([
      "media.id",
      "media.title",
      "media.type",
      sql<string>`stddev_pop(ratings.score)`.as("score_stddev"),
    ])
    .groupBy(["media.id", "media.title", "media.type"])
    .having(db.fn.countAll(), ">=", 3)
    .orderBy("score_stddev", "desc")
    .limit(1)
    .executeTakeFirst();

  // Last session date
  const lastSession = await db
    .selectFrom("watch_sessions")
    .select("date_watched")
    .where("date_watched", "is not", null)
    .orderBy("date_watched", "desc")
    .limit(1)
    .executeTakeFirst();

  // First session date — drives "N weeks in" on the Database masthead.
  const firstSession = await db
    .selectFrom("watch_sessions")
    .select("date_watched")
    .where("date_watched", "is not", null)
    .orderBy("date_watched", "asc")
    .limit(1)
    .executeTakeFirst();

  // Hours watched + average rating
  const [hoursWatched, avgRating] = await Promise.all([fetchHoursWatched(), fetchAvgRating()]);

  // Whole weeks since the group's first logged session. Shares deriveWeeksSince
  // with the timeline's "Wk N" labels so the masthead footnote and the timeline
  // rail agree at every week boundary (1-based; week one reads naturally).
  const firstWatched = firstSession?.date_watched ?? null;
  const weeksSinceFirstSession =
    firstWatched === null ? null : deriveWeeksSince(new Date(firstWatched).getTime(), Date.now());

  return successResponse({
    mediaWatched: Object.fromEntries(mediaCounts.map((m) => [m.type, Number(m.count)])),
    totalSessions: Number(totalSessions.count),
    totalRatings: Number(totalRatings.count),
    hoursWatched,
    avgRating,
    topPicker: topPicker
      ? {
          id: topPicker.id,
          username: topPicker.username,
          displayName: topPicker.display_name,
          avatarUrl: topPicker.avatar_url,
          pickCount: Number(topPicker.pick_count),
        }
      : null,
    topRater: topRater
      ? {
          id: topRater.id,
          username: topRater.username,
          displayName: topRater.display_name,
          avatarUrl: topRater.avatar_url,
          avgScore: Math.round(Number(topRater.avg_score) * 10) / 10,
        }
      : null,
    topAttendee: topAttendee
      ? {
          id: topAttendee.id,
          username: topAttendee.username,
          displayName: topAttendee.display_name,
          avatarUrl: topAttendee.avatar_url,
          attendanceCount: Number(topAttendee.attendance_count),
        }
      : null,
    highestRated: highestRated
      ? {
          id: highestRated.id,
          title: highestRated.title,
          type: highestRated.type,
          posterUrl: highestRated.poster_url,
          avgScore: Math.round(Number(highestRated.avg_score) * 10) / 10,
        }
      : null,
    mostDivisive: mostDivisive
      ? {
          id: mostDivisive.id,
          title: mostDivisive.title,
          type: mostDivisive.type,
          stddev: Math.round(Number(mostDivisive.score_stddev) * 100) / 100,
        }
      : null,
    lastSessionDate: lastSession?.date_watched ?? null,
    weeksSinceFirstSession,
  });
}
