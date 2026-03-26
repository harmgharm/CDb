/**
 * Shared query helpers for stats endpoints.
 *
 * Each function accepts an optional `userId` to scope results
 * to a specific user (for user profile stats).
 */

import { sql } from "kysely";

import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";

import type { SessionDay } from "./streak";

/** Kysely aggregate return types */
type KyselyCount = string | number | bigint;
type KyselyAggregate = string | number;

// ============================================
// Hours Watched
// ============================================

/**
 * Total hours watched. Movies use runtime_minutes directly.
 * TV/anime use episode_count * runtime_minutes for the full season.
 * One addition per session (not per attendee).
 */
export async function fetchHoursWatched(userId?: string): Promise<number> {
  let query = db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id");

  if (userId !== undefined) {
    query = query
      .innerJoin("session_attendees", "session_attendees.session_id", "watch_sessions.id")
      .where("session_attendees.user_id", "=", userId);
  }

  const result = await query
    .select(
      sql<string>`SUM(
        CASE
          WHEN media.type = 'movie' THEN COALESCE(media.runtime_minutes, 0)
          ELSE COALESCE(media.episode_count, 1) * COALESCE(media.runtime_minutes, 0)
        END
      )`.as("total_minutes"),
    )
    .executeTakeFirstOrThrow();

  return Math.round((Number(result.total_minutes) / 60) * 10) / 10;
}

// ============================================
// Ranked Media (Highest / Lowest Rated)
// ============================================

interface RankedMediaRow {
  id: string;
  title: string;
  type: string;
  poster_url: string | null;
  avg_score: KyselyAggregate;
  rating_count: KyselyCount;
}

export async function fetchRankedMedia(
  order: "asc" | "desc",
  limit: number,
  userId?: string,
): Promise<RankedMediaRow[]> {
  let query = db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id");

  if (userId !== undefined) {
    query = query.where("ratings.user_id", "=", userId);
  }

  const minRatings = userId === undefined ? 2 : 1;

  return query
    .select([
      "media.id",
      "media.title",
      "media.type",
      "media.poster_url",
      db.fn.avg("ratings.score").as("avg_score"),
      db.fn.countAll().as("rating_count"),
    ])
    .groupBy(["media.id", "media.title", "media.type", "media.poster_url"])
    .having(db.fn.countAll(), ">=", minRatings)
    .orderBy("avg_score", order)
    .limit(limit)
    .execute();
}

export function formatRankedMedia(rows: readonly RankedMediaRow[]) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type as MediaType,
    posterUrl: r.poster_url,
    avgScore: Math.round(Number(r.avg_score) * 10) / 10,
    ratingCount: Number(r.rating_count),
  }));
}

// ============================================
// Most Divisive Media
// ============================================

export async function fetchDivisiveMedia(limit: number) {
  const rows = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select([
      "media.id",
      "media.title",
      "media.type",
      "media.poster_url",
      db.fn.avg("ratings.score").as("avg_score"),
      sql<string>`stddev_pop(ratings.score)`.as("score_stddev"),
    ])
    .groupBy(["media.id", "media.title", "media.type", "media.poster_url"])
    .having(db.fn.countAll(), ">=", 3)
    .orderBy("score_stddev", "desc")
    .limit(limit)
    .execute();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    posterUrl: r.poster_url,
    avgScore: Math.round(Number(r.avg_score) * 10) / 10,
    stddev: Math.round(Number(r.score_stddev) * 100) / 100,
  }));
}

// ============================================
// Genre Stats
// ============================================

interface GenreStatsRow {
  genre: string;
  watch_count: string;
  avg_score: string | null;
  rating_count: string;
}

export async function fetchGenreStats(userId?: string) {
  const userJoin =
    userId === undefined
      ? sql``
      : sql`JOIN session_attendees sa ON sa.session_id = ws.id AND sa.user_id = ${userId}`;

  const userRatingFilter = userId === undefined ? sql`` : sql`AND r.user_id = ${userId}`;

  const rows = await sql<GenreStatsRow>`
    SELECT
      g.genre,
      COUNT(DISTINCT ws.id) as watch_count,
      AVG(r.score) as avg_score,
      COUNT(r.id) as rating_count
    FROM watch_sessions ws
    JOIN media m ON m.id = ws.media_id
    ${userJoin}
    CROSS JOIN LATERAL jsonb_array_elements_text(m.genres) AS g(genre)
    LEFT JOIN ratings r ON r.session_id = ws.id ${userRatingFilter}
    GROUP BY g.genre
    ORDER BY watch_count DESC
  `.execute(db);

  return rows.rows;
}

export function formatGenreStats(rows: readonly GenreStatsRow[], minRatings = 2) {
  return rows.map((r) => ({
    genre: r.genre,
    count: Number(r.watch_count),
    avgScore:
      Number(r.rating_count) >= minRatings ? Math.round(Number(r.avg_score) * 10) / 10 : null,
  }));
}

// ============================================
// Director Stats
// ============================================

interface DirectorStatsRow {
  director: string;
  watch_count: string;
  avg_score: string | null;
  rating_count: string;
}

export async function fetchDirectorStats(userId?: string) {
  const userJoin =
    userId === undefined
      ? sql``
      : sql`JOIN session_attendees sa ON sa.session_id = ws.id AND sa.user_id = ${userId}`;

  const userRatingFilter = userId === undefined ? sql`` : sql`AND r.user_id = ${userId}`;

  const rows = await sql<DirectorStatsRow>`
    SELECT
      d.director,
      COUNT(DISTINCT ws.id) as watch_count,
      AVG(r.score) as avg_score,
      COUNT(r.id) as rating_count
    FROM watch_sessions ws
    JOIN media m ON m.id = ws.media_id
    ${userJoin}
    CROSS JOIN LATERAL jsonb_array_elements_text(m.directors) AS d(director)
    LEFT JOIN ratings r ON r.session_id = ws.id ${userRatingFilter}
    WHERE m.directors IS NOT NULL
    GROUP BY d.director
    ORDER BY watch_count DESC
  `.execute(db);

  return rows.rows;
}

export function formatDirectorStats(rows: readonly DirectorStatsRow[], minRatings = 2) {
  return rows.map((r) => ({
    director: r.director,
    count: Number(r.watch_count),
    avgScore:
      Number(r.rating_count) >= minRatings ? Math.round(Number(r.avg_score) * 10) / 10 : null,
  }));
}

// ============================================
// Cast Stats
// ============================================

interface CastStatsRow {
  actor: string;
  watch_count: string;
  avg_score: string | null;
  rating_count: string;
}

export async function fetchCastStats(userId?: string) {
  const userJoin =
    userId === undefined
      ? sql``
      : sql`JOIN session_attendees sa ON sa.session_id = ws.id AND sa.user_id = ${userId}`;

  const userRatingFilter = userId === undefined ? sql`` : sql`AND r.user_id = ${userId}`;

  const rows = await sql<CastStatsRow>`
    SELECT
      c->>'name' AS actor,
      COUNT(DISTINCT ws.id) as watch_count,
      AVG(r.score) as avg_score,
      COUNT(r.id) as rating_count
    FROM watch_sessions ws
    JOIN media m ON m.id = ws.media_id
    ${userJoin}
    CROSS JOIN LATERAL jsonb_array_elements(m.top_cast) AS c
    LEFT JOIN ratings r ON r.session_id = ws.id ${userRatingFilter}
    WHERE m.top_cast IS NOT NULL
    GROUP BY c->>'name'
    ORDER BY watch_count DESC
  `.execute(db);

  return rows.rows;
}

export function formatCastStats(rows: readonly CastStatsRow[], minRatings = 2) {
  return rows.map((r) => ({
    actor: r.actor,
    count: Number(r.watch_count),
    avgScore:
      Number(r.rating_count) >= minRatings ? Math.round(Number(r.avg_score) * 10) / 10 : null,
  }));
}

// ============================================
// Year Stats
// ============================================

export async function fetchYearStats(userId?: string) {
  let query = db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .leftJoin("ratings", "ratings.session_id", "watch_sessions.id");

  if (userId !== undefined) {
    query = query
      .innerJoin("session_attendees", "session_attendees.session_id", "watch_sessions.id")
      .where("session_attendees.user_id", "=", userId);
  }

  const rows = await query
    .select([
      "media.release_year",
      db.fn.count("watch_sessions.id").distinct().as("watch_count"),
      db.fn.avg("ratings.score").as("avg_score"),
      db.fn.count("ratings.id").as("rating_count"),
    ])
    .where("media.release_year", "is not", null)
    .groupBy("media.release_year")
    .orderBy("watch_count", "desc")
    .execute();

  return rows;
}

export function formatYearStats(
  rows: readonly {
    release_year: number | null;
    watch_count: KyselyCount;
    avg_score: KyselyAggregate | null;
    rating_count: KyselyCount;
  }[],
  minRatings = 2,
) {
  return rows
    .filter((r): r is typeof r & { release_year: number } => r.release_year !== null)
    .map((r) => ({
      year: r.release_year,
      count: Number(r.watch_count),
      avgScore:
        Number(r.rating_count) >= minRatings ? Math.round(Number(r.avg_score) * 10) / 10 : null,
    }));
}

// ============================================
// Average Rating
// ============================================

export async function fetchAvgRating(userId?: string): Promise<number | null> {
  let query = db.selectFrom("ratings").select(db.fn.avg("ratings.score").as("avg_score"));

  if (userId !== undefined) {
    query = query.where("ratings.user_id", "=", userId);
  }

  const result = await query.executeTakeFirst();

  if (result?.avg_score === undefined) return null;
  return Math.round(Number(result.avg_score) * 10) / 10;
}

// ============================================
// Session Times (for average start time)
// ============================================

export async function fetchAvgStartTime(): Promise<string | null> {
  const rows = await db
    .selectFrom("watch_sessions")
    .select("time_watched_at")
    .where("time_watched_at", "is not", null)
    .execute();

  if (rows.length === 0) return null;

  // Use circular mean to handle times that wrap around midnight.
  // Convert each time to an angle on a 24-hour clock, average the
  // sin/cos components, then convert back to a time.
  const TWO_PI = 2 * Math.PI;
  const MINUTES_IN_DAY = 24 * 60;
  let sinSum = 0;
  let cosSum = 0;

  for (const row of rows) {
    if (row.time_watched_at === null) continue;
    const [hoursString = "0", minutesString = "0"] = row.time_watched_at.split(":");
    const minutes = Number(hoursString) * 60 + Number(minutesString);
    const angle = (minutes / MINUTES_IN_DAY) * TWO_PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }

  const avgAngle = Math.atan2(sinSum / rows.length, cosSum / rows.length);
  let avgMinutes = Math.round(
    ((avgAngle < 0 ? avgAngle + TWO_PI : avgAngle) / TWO_PI) * MINUTES_IN_DAY,
  );
  // Clamp to valid range
  avgMinutes = ((avgMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// ============================================
// Streak Data
// ============================================

export async function fetchStreakData(): Promise<SessionDay[]> {
  const rows = await db
    .selectFrom("watch_sessions")
    .select([
      sql<string>`date_watched::date::text`.as("d"),
      sql<string | null>`MIN(time_watched_at)`.as("earliest_time"),
      sql<string | null>`MAX(time_watched_at)`.as("latest_time"),
    ])
    .where("date_watched", "is not", null)
    .groupBy(sql`date_watched::date`)
    .orderBy("d", "asc")
    .execute();

  return rows.map((r) => ({
    date: r.d,
    earliestTime: r.earliest_time,
    latestTime: r.latest_time,
  }));
}

// ============================================
// Picker Leaderboard
// ============================================

interface PickerRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  pick_count: KyselyCount;
  avg_pick_rating: KyselyAggregate | null;
}

interface PickerTopPickRow {
  picked_by_user_id: string;
  id: string;
  title: string;
  type: string;
  poster_url: string | null;
  avg_score: string;
  rating_count: string;
}

export async function fetchPickerLeaderboard(limit = 5) {
  const pickers = await db
    .selectFrom("watch_sessions")
    .innerJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .leftJoin("ratings", "ratings.session_id", "watch_sessions.id")
    .select([
      "users.id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
      db.fn.count("watch_sessions.id").distinct().as("pick_count"),
      db.fn.avg("ratings.score").as("avg_pick_rating"),
    ])
    .where("watch_sessions.picked_by_user_id", "is not", null)
    .groupBy(["users.id", "users.username", "users.display_name", "users.avatar_url"])
    .orderBy("avg_pick_rating", "desc")
    .limit(limit)
    .execute();

  if (pickers.length === 0) return [];

  const pickerIds = pickers.map((p) => p.id);

  // Fetch top 3 picks per picker using window function
  const topPickRows = await sql<PickerTopPickRow>`
    SELECT * FROM (
      SELECT
        ws.picked_by_user_id,
        m.id, m.title, m.type, m.poster_url,
        AVG(r.score)::text as avg_score,
        COUNT(r.id)::text as rating_count,
        ROW_NUMBER() OVER (
          PARTITION BY ws.picked_by_user_id
          ORDER BY AVG(r.score) DESC
        ) as rn
      FROM watch_sessions ws
      JOIN media m ON m.id = ws.media_id
      LEFT JOIN ratings r ON r.session_id = ws.id
      WHERE ws.picked_by_user_id = ANY(${pickerIds})
      GROUP BY ws.picked_by_user_id, ws.id, m.id, m.title, m.type, m.poster_url
      HAVING COUNT(r.id) >= 1
    ) sub WHERE rn <= 3
  `.execute(db);

  // Group top picks by picker
  const picksByUser = new Map<string, PickerTopPickRow[]>();
  for (const row of topPickRows.rows) {
    const existing = picksByUser.get(row.picked_by_user_id) ?? [];
    existing.push(row);
    picksByUser.set(row.picked_by_user_id, existing);
  }

  return pickers.map((p: PickerRow) => ({
    userId: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    pickCount: Number(p.pick_count),
    avgPickRating:
      p.avg_pick_rating === null ? null : Math.round(Number(p.avg_pick_rating) * 10) / 10,
    topPicks: (picksByUser.get(p.id) ?? []).map((tp) => ({
      id: tp.id,
      title: tp.title,
      type: tp.type as MediaType,
      posterUrl: tp.poster_url,
      avgScore: Math.round(Number(tp.avg_score) * 10) / 10,
      ratingCount: Number(tp.rating_count),
    })),
  }));
}

// ============================================
// User-specific: Pick Rating + Win Rate
// ============================================

interface WinStatsRow {
  total: string;
  wins: string;
}

export async function fetchPickerStats(userId: string) {
  // Average rating of ALL ratings on sessions this user picked
  const pickRatingResult = await db
    .selectFrom("watch_sessions")
    .innerJoin("ratings", "ratings.session_id", "watch_sessions.id")
    .select(db.fn.avg("ratings.score").as("avg_score"))
    .where("watch_sessions.picked_by_user_id", "=", userId)
    .executeTakeFirst();

  const pickRating =
    pickRatingResult?.avg_score === undefined
      ? null
      : Math.round(Number(pickRatingResult.avg_score) * 10) / 10;

  // Win rate: picks where avg group rating >= 7.0
  const winRows = await sql<WinStatsRow>`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE avg_score >= 7.0) as wins
    FROM (
      SELECT ws.id, AVG(r.score) as avg_score
      FROM watch_sessions ws
      JOIN ratings r ON r.session_id = ws.id
      WHERE ws.picked_by_user_id = ${userId}
      GROUP BY ws.id
      HAVING COUNT(r.id) >= 2
    ) sub
  `.execute(db);

  const winStats = winRows.rows[0];
  const totalPicks = Number(winStats?.total ?? 0);
  const winCount = Number(winStats?.wins ?? 0);
  const winRate = totalPicks > 0 ? Math.round((winCount / totalPicks) * 1000) / 10 : null;

  return { pickRating, winRate, totalPicks, winCount };
}

// ============================================
// Attendance Rate
// ============================================

export async function fetchAttendanceRate(userId: string) {
  const [totalResult, attendedResult] = await Promise.all([
    db.selectFrom("watch_sessions").select(db.fn.countAll().as("count")).executeTakeFirstOrThrow(),
    db
      .selectFrom("session_attendees")
      .select(db.fn.countAll().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow(),
  ]);

  const total = Number(totalResult.count);
  const attended = Number(attendedResult.count);
  const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

  return { attendanceRate: rate, totalSessionsGlobal: total };
}

// ============================================
// Most Watched Genre (single, for public stats)
// ============================================

export async function fetchMostWatchedGenre(): Promise<string | null> {
  const rows = await sql<{ genre: string; watch_count: string }>`
    SELECT
      g.genre,
      COUNT(DISTINCT ws.id) as watch_count
    FROM watch_sessions ws
    JOIN media m ON m.id = ws.media_id
    CROSS JOIN LATERAL jsonb_array_elements_text(m.genres) AS g(genre)
    GROUP BY g.genre
    ORDER BY watch_count DESC
    LIMIT 1
  `.execute(db);

  return rows.rows[0]?.genre ?? null;
}
