/**
 * Tagline-input fetchers.
 *
 * Each helper assembles a `TaglineInputs` object that `deriveTagline()` consumes.
 * Two entry points: `fetchTaglineInputs(userId)` for the profile route (rich,
 * 4 queries), and `fetchTaglineInputsBatch()` for the list route (lean,
 * 3 grouped queries regardless of N users).
 */

import { sql } from "kysely";

import { db } from "@/lib/db";
import { fetchGenreStats } from "@/lib/stats/queries";

import type { TaglineInputs } from "./tagline";

const RECENT_STREAK_WINDOW = 8;

interface BaseStatsRow {
  sessions_attended: string;
  ratings_given: string;
  avg_score: string | null;
  pick_count: string;
}

interface MediaLeanRow {
  user_id: string;
  movie_count: string;
  tv_count: string;
  anime_count: string;
}

interface StreakGenreRow {
  genre: string;
  hits: string;
}

/**
 * Full tagline inputs for one user. Used by GET /api/users/[id].
 * Fires 4 parallel queries on top of the single existing user-row fetch.
 */
export async function fetchTaglineInputs(userId: string, createdAt: Date): Promise<TaglineInputs> {
  const [baseStats, totalSessionsGlobal, mediaTypeBreakdown, topGenre, recentStreak] =
    await Promise.all([
      fetchBaseStatsForUser(userId),
      fetchTotalSessionsGlobal(),
      fetchMediaTypeBreakdownForUser(userId),
      fetchTopGenreForUser(userId),
      fetchRecentStreakForUser(userId),
    ]);

  return {
    ratingsGiven: Number(baseStats.ratings_given),
    avgScore:
      baseStats.avg_score === null ? null : Math.round(Number(baseStats.avg_score) * 10) / 10,
    sessionsAttended: Number(baseStats.sessions_attended),
    pickCount: Number(baseStats.pick_count),
    totalSessionsGlobal,
    mediaTypeBreakdown,
    topGenre,
    recentStreak,
    daysSinceJoined: daysBetween(createdAt, new Date()),
  };
}

/**
 * Lean tagline inputs per user for GET /api/users.
 * Three grouped queries return one row per user, folded into a Map.
 * `topGenre` and `recentStreak` are left null — list taglines fall through
 * to the cheaper branches in `deriveTagline()`.
 */
export async function fetchTaglineInputsBatch(
  users: readonly { id: string; created_at: Date }[],
): Promise<Map<string, TaglineInputs>> {
  if (users.length === 0) return new Map();

  const userIds = users.map((u) => u.id);

  const [totalSessionsGlobal, baseRows, leanRows] = await Promise.all([
    fetchTotalSessionsGlobal(),
    fetchBaseStatsBatch(userIds),
    fetchMediaLeanBatch(userIds),
  ]);

  const baseByUser = new Map(baseRows.map((r) => [r.user_id, r]));
  const leanByUser = new Map(leanRows.map((r) => [r.user_id, r]));

  const now = new Date();
  const result = new Map<string, TaglineInputs>();

  for (const u of users) {
    const base = baseByUser.get(u.id);
    const lean = leanByUser.get(u.id);

    result.set(u.id, {
      ratingsGiven: base === undefined ? 0 : Number(base.ratings_given),
      avgScore: base?.avg_score == null ? null : Math.round(Number(base.avg_score) * 10) / 10,
      sessionsAttended: base === undefined ? 0 : Number(base.sessions_attended),
      pickCount: base === undefined ? 0 : Number(base.pick_count),
      totalSessionsGlobal,
      mediaTypeBreakdown: lean === undefined ? null : buildBreakdown(lean),
      topGenre: null,
      recentStreak: null,
      daysSinceJoined: daysBetween(u.created_at, now),
    });
  }

  return result;
}

// ─── per-user fetchers ────────────────────────────────────────────────────

async function fetchBaseStatsForUser(userId: string): Promise<BaseStatsRow> {
  const row = await sql<BaseStatsRow>`
    SELECT
      (SELECT COUNT(*) FROM session_attendees WHERE user_id = ${userId})::text AS sessions_attended,
      (SELECT COUNT(*) FROM ratings WHERE user_id = ${userId})::text AS ratings_given,
      (SELECT AVG(score) FROM ratings WHERE user_id = ${userId})::text AS avg_score,
      (SELECT COUNT(*) FROM watch_sessions WHERE picked_by_user_id = ${userId})::text AS pick_count
  `.execute(db);
  return (
    row.rows[0] ?? {
      sessions_attended: "0",
      ratings_given: "0",
      avg_score: null,
      pick_count: "0",
    }
  );
}

async function fetchTotalSessionsGlobal(): Promise<number> {
  const result = await db
    .selectFrom("watch_sessions")
    .select(db.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();
  return Number(result.count);
}

async function fetchMediaTypeBreakdownForUser(
  userId: string,
): Promise<TaglineInputs["mediaTypeBreakdown"]> {
  const rows = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.type", db.fn.count("watch_sessions.id").distinct().as("count")])
    .where("session_attendees.user_id", "=", userId)
    .groupBy("media.type")
    .execute();

  if (rows.length === 0) return null;
  return foldBreakdown(rows.map((r) => ({ type: r.type, n: Number(r.count) })));
}

async function fetchTopGenreForUser(userId: string): Promise<TaglineInputs["topGenre"]> {
  const rows = await fetchGenreStats(userId);
  const top = rows[0];
  if (top === undefined) return null;
  const count = Number(top.watch_count);
  if (count <= 0) return null;
  return { name: top.genre, count };
}

async function fetchRecentStreakForUser(userId: string): Promise<TaglineInputs["recentStreak"]> {
  // One query returns:
  //   - the dominant genre across the user's last N sessions, and
  //   - the actual session count in that window (≤ N).
  // We attach window_size to every row so we can read it off any one.
  const rows = await sql<StreakGenreRow & { window_size: string }>`
    WITH recent AS (
      SELECT ws.id, m.genres
      FROM session_attendees sa
      JOIN watch_sessions ws ON ws.id = sa.session_id
      JOIN media m ON m.id = ws.media_id
      WHERE sa.user_id = ${userId}
      ORDER BY ws.date_watched DESC NULLS LAST, ws.created_at DESC
      LIMIT ${RECENT_STREAK_WINDOW}
    )
    SELECT
      g.genre,
      COUNT(*)::text AS hits,
      (SELECT COUNT(*) FROM recent)::text AS window_size
    FROM recent
    CROSS JOIN LATERAL jsonb_array_elements_text(recent.genres) AS g(genre)
    GROUP BY g.genre
    ORDER BY hits DESC
    LIMIT 1
  `.execute(db);

  const top = rows.rows[0];
  if (top === undefined) return null;

  const window = Number(top.window_size);
  if (window === 0) return null;

  return {
    genre: top.genre,
    hits: Number(top.hits),
    window,
  };
}

// ─── batch fetchers for the list endpoint ─────────────────────────────────

interface BaseStatsBatchRow extends BaseStatsRow {
  user_id: string;
}

async function fetchBaseStatsBatch(
  userIds: readonly string[],
): Promise<readonly BaseStatsBatchRow[]> {
  const rows = await sql<BaseStatsBatchRow>`
    SELECT
      u.id AS user_id,
      (SELECT COUNT(*) FROM session_attendees sa WHERE sa.user_id = u.id)::text AS sessions_attended,
      (SELECT COUNT(*) FROM ratings r WHERE r.user_id = u.id)::text AS ratings_given,
      (SELECT AVG(r.score) FROM ratings r WHERE r.user_id = u.id)::text AS avg_score,
      (SELECT COUNT(*) FROM watch_sessions ws WHERE ws.picked_by_user_id = u.id)::text AS pick_count
    FROM users u
    WHERE u.id = ANY(${userIds})
  `.execute(db);
  return rows.rows;
}

async function fetchMediaLeanBatch(userIds: readonly string[]): Promise<readonly MediaLeanRow[]> {
  const rows = await sql<MediaLeanRow>`
    SELECT
      sa.user_id,
      (COUNT(DISTINCT ws.id) FILTER (WHERE m.type = 'movie'))::text AS movie_count,
      (COUNT(DISTINCT ws.id) FILTER (WHERE m.type = 'tv'))::text AS tv_count,
      (COUNT(DISTINCT ws.id) FILTER (WHERE m.type = 'anime'))::text AS anime_count
    FROM session_attendees sa
    JOIN watch_sessions ws ON ws.id = sa.session_id
    JOIN media m ON m.id = ws.media_id
    WHERE sa.user_id = ANY(${userIds})
    GROUP BY sa.user_id
  `.execute(db);
  return rows.rows;
}

// ─── shared helpers ───────────────────────────────────────────────────────

function foldBreakdown(
  rows: readonly { type: string; n: number }[],
): TaglineInputs["mediaTypeBreakdown"] {
  let movie = 0;
  let tv = 0;
  let anime = 0;
  for (const r of rows) {
    switch (r.type) {
      case "movie": {
        movie += r.n;
        break;
      }
      case "tv": {
        tv += r.n;
        break;
      }
      case "anime": {
        anime += r.n;
        break;
      }
    }
  }
  const total = movie + tv + anime;
  if (total === 0) return null;
  return { movie: movie / total, tv: tv / total, anime: anime / total };
}

function buildBreakdown(row: MediaLeanRow): TaglineInputs["mediaTypeBreakdown"] {
  const movie = Number(row.movie_count);
  const tv = Number(row.tv_count);
  const anime = Number(row.anime_count);
  const total = movie + tv + anime;
  if (total === 0) return null;
  return { movie: movie / total, tv: tv / total, anime: anime / total };
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
