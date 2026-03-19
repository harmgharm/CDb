/**
 * Rating pool builder for the Rating Guesser game
 *
 * Normal mode: random media from the group's watched history with 2+ raters.
 * Hard mode: popular TMDB movies/TV + Jikan anime (no DB media).
 *
 * Hard mode uses an in-memory cache (24h TTL) for external media to
 * avoid API calls during gameplay.
 */

import { sql } from "kysely";

import { discoverAnime } from "@/lib/api/jikan";
import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import { db } from "@/lib/db";
import { randomPage, randomSample, shuffle } from "@/lib/recommendations/random";

// ── Types ────────────────────────────────────────────────────────

export interface RatingPoolItem {
  id: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string;
  /** The correct rating to guess (1-10 scale, 1 decimal) */
  correctRating: number;
  /** Number of raters (group count for normal, vote count for hard) */
  ratingCount: number;
}

// ── In-memory cache for hard mode external media ─────────────────

interface CachedPool {
  items: RatingPoolItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let externalPoolCache: CachedPool | null = null;

// ── DB media pool (normal mode) ─────────────────────────────────

async function getDbRatingPool(): Promise<RatingPoolItem[]> {
  const rows = await db
    .selectFrom("media")
    .innerJoin("watch_sessions", "watch_sessions.media_id", "media.id")
    .innerJoin("ratings", "ratings.session_id", "watch_sessions.id")
    .select(["media.id", "media.title", "media.poster_url", "media.tmdb_id", "media.mal_id"])
    .select(({ fn }) => [
      fn.avg<string>("ratings.score").as("avg_rating"),
      sql<string>`count(distinct ratings.user_id)`.as("rater_count"),
    ])
    .where("media.poster_url", "is not", null)
    .groupBy("media.id")
    .having(sql<number>`count(distinct ratings.user_id)`, ">=", 2)
    .execute();

  return rows.map((row) => ({
    id: row.id,
    tmdbId: row.tmdb_id,
    malId: row.mal_id,
    title: row.title,
    posterUrl: row.poster_url as string,
    correctRating: Math.round(Number(row.avg_rating) * 10) / 10,
    ratingCount: Number(row.rater_count),
  }));
}

// ── External media pool (hard mode) ─────────────────────────────

async function fetchExternalPool(): Promise<RatingPoolItem[]> {
  const items: RatingPoolItem[] = [];

  try {
    const movies = await discoverMovies({
      sort_by: "popularity.desc",
      "vote_count.gte": "500",
      page: randomPage(5),
    });

    for (const movie of movies.results) {
      const posterUrl = tmdbImageUrl(movie.poster_path, "w500");
      if (posterUrl !== null && movie.vote_average > 0) {
        items.push({
          id: null,
          tmdbId: movie.id,
          malId: null,
          title: movie.title,
          posterUrl,
          correctRating: Math.round(movie.vote_average * 10) / 10,
          ratingCount: movie.vote_count,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch TMDB movies for rating pool:", error);
  }

  try {
    const tvShows = await discoverTv({
      sort_by: "popularity.desc",
      "vote_count.gte": "200",
      page: randomPage(5),
    });

    for (const show of tvShows.results) {
      const posterUrl = tmdbImageUrl(show.poster_path, "w500");
      if (posterUrl !== null && show.vote_average > 0) {
        items.push({
          id: null,
          tmdbId: show.id,
          malId: null,
          title: show.name,
          posterUrl,
          correctRating: Math.round(show.vote_average * 10) / 10,
          ratingCount: show.vote_count,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch TMDB TV for rating pool:", error);
  }

  try {
    const anime = await discoverAnime({
      order_by: "score",
      sort: "desc",
      min_scored_by: "5000",
      page: randomPage(3),
    });

    for (const item of anime.data) {
      const posterUrl = item.images.jpg.large_image_url;
      if (item.score !== null && item.scored_by !== null && posterUrl.length > 0) {
        items.push({
          id: null,
          tmdbId: null,
          malId: item.mal_id,
          title: item.title_english ?? item.title,
          posterUrl,
          correctRating: Math.round(item.score * 10) / 10,
          ratingCount: item.scored_by,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch Jikan anime for rating pool:", error);
  }

  return items;
}

async function getExternalPool(): Promise<RatingPoolItem[]> {
  const now = Date.now();

  if (externalPoolCache !== null && now - externalPoolCache.fetchedAt < CACHE_TTL_MS) {
    return externalPoolCache.items;
  }

  const items = await fetchExternalPool();
  externalPoolCache = { items, fetchedAt: now };
  return items;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Build a rating pool and select `count` items for game rounds.
 *
 * Normal: all from DB (2+ raters). Hard: all from external APIs.
 * Throws if not enough media available.
 */
export async function buildRatingPool(
  difficulty: "normal" | "hard",
  count: number,
): Promise<RatingPoolItem[]> {
  if (difficulty === "normal") {
    const dbPool = await getDbRatingPool();
    if (dbPool.length < count) {
      throw new Error(
        `Not enough rated media in database (${String(dbPool.length)} available, ${String(count)} needed). ` +
          "Media needs at least 2 ratings to appear in normal mode.",
      );
    }
    return randomSample(dbPool, count);
  }

  // Hard mode: external sources only
  const externalPool = await getExternalPool();
  if (externalPool.length < count) {
    throw new Error(
      `Not enough external media available (${String(externalPool.length)} available, ${String(count)} needed)`,
    );
  }
  return shuffle(randomSample(externalPool, count));
}
