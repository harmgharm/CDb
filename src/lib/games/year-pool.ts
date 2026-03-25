/**
 * Year pool builder for the Year Guesser game
 *
 * Normal mode: random media from the group's database with a known release year.
 * Hard mode: popular TMDB movies/TV + Jikan anime (no DB media).
 *
 * Hard mode uses an in-memory cache (24h TTL) for external media to
 * avoid API calls during gameplay.
 */

import { discoverAnime } from "@/lib/api/jikan";
import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import { db } from "@/lib/db";
import { randomPage, randomSample, shuffle } from "@/lib/recommendations/random";

// ── Types ────────────────────────────────────────────────────────

export interface YearPoolItem {
  id: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string;
  /** The correct release year */
  correctYear: number;
}

// ── In-memory cache for hard mode external media ─────────────────

interface CachedPool {
  items: YearPoolItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let externalPoolCache: CachedPool | null = null;

// ── DB media pool (normal mode) ─────────────────────────────────

async function getDbYearPool(): Promise<YearPoolItem[]> {
  const rows = await db
    .selectFrom("media")
    .select(["id", "title", "poster_url", "tmdb_id", "mal_id", "release_year"])
    .where("poster_url", "is not", null)
    .where("release_year", "is not", null)
    .execute();

  return rows.map((row) => ({
    id: row.id,
    tmdbId: row.tmdb_id,
    malId: row.mal_id,
    title: row.title,
    posterUrl: row.poster_url as string,
    correctYear: row.release_year as number,
  }));
}

// ── External media pool (hard mode) ─────────────────────────────

function extractYear(dateString: string | null | undefined): number | null {
  if (dateString === null || dateString === undefined || dateString.length === 0) return null;
  const year = Number.parseInt(dateString.slice(0, 4), 10);
  if (Number.isNaN(year) || year < 1900) return null;
  return year;
}

async function fetchExternalPool(): Promise<YearPoolItem[]> {
  const items: YearPoolItem[] = [];

  try {
    const movies = await discoverMovies({
      sort_by: "popularity.desc",
      "vote_count.gte": "500",
      page: randomPage(5),
    });

    for (const movie of movies.results) {
      const posterUrl = tmdbImageUrl(movie.poster_path, "w500");
      const year = extractYear(movie.release_date);
      if (posterUrl !== null && year !== null) {
        items.push({
          id: null,
          tmdbId: movie.id,
          malId: null,
          title: movie.title,
          posterUrl,
          correctYear: year,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch TMDB movies for year pool:", error);
  }

  try {
    const tvShows = await discoverTv({
      sort_by: "popularity.desc",
      "vote_count.gte": "200",
      page: randomPage(5),
    });

    for (const show of tvShows.results) {
      const posterUrl = tmdbImageUrl(show.poster_path, "w500");
      const year = extractYear(show.first_air_date);
      if (posterUrl !== null && year !== null) {
        items.push({
          id: null,
          tmdbId: show.id,
          malId: null,
          title: show.name,
          posterUrl,
          correctYear: year,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch TMDB TV for year pool:", error);
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
      const year = item.year ?? extractYear(item.aired.from);
      if (year !== null && posterUrl.length > 0) {
        items.push({
          id: null,
          tmdbId: null,
          malId: item.mal_id,
          title: item.title_english ?? item.title,
          posterUrl,
          correctYear: year,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch Jikan anime for year pool:", error);
  }

  return items;
}

async function getExternalPool(): Promise<YearPoolItem[]> {
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
 * Build a year pool and select `count` items for game rounds.
 *
 * Normal: all from DB (with release_year). Hard: all from external APIs.
 * Throws if not enough media available.
 */
export async function buildYearPool(
  difficulty: "normal" | "hard",
  count: number,
): Promise<YearPoolItem[]> {
  if (difficulty === "normal") {
    const dbPool = await getDbYearPool();
    if (dbPool.length < count) {
      throw new Error(
        `Not enough media with release years in database (${String(dbPool.length)} available, ${String(count)} needed).`,
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
