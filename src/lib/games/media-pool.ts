/**
 * Media pool builder for the guessing game
 *
 * Normal mode: random media from the group's watched history.
 * Hard mode: mix of DB media (~60%) + popular TMDB/Jikan titles (~40%).
 *
 * Hard mode uses an in-memory cache (24h TTL) for external media to
 * avoid API calls during gameplay.
 */

import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import { db } from "@/lib/db";
import { randomPage, randomSample, shuffle } from "@/lib/recommendations/random";
import type { MediaPoolItem } from "@/types/game-responses";

// ── In-memory cache for hard mode external media ─────────────────

interface CachedPool {
  items: MediaPoolItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let externalPoolCache: CachedPool | null = null;

// ── DB media pool ────────────────────────────────────────────────

async function getDbMediaPool(): Promise<MediaPoolItem[]> {
  const rows = await db
    .selectFrom("media")
    .select(["id", "title", "type", "poster_url", "tmdb_id", "mal_id"])
    .where("poster_url", "is not", null)
    .execute();

  return rows.map((row) => ({
    id: row.id,
    tmdbId: row.tmdb_id,
    malId: row.mal_id,
    title: row.title,
    posterUrl: row.poster_url as string,
    type: row.type,
  }));
}

// ── External media pool (TMDB popular) ───────────────────────────

async function fetchExternalPool(): Promise<MediaPoolItem[]> {
  const items: MediaPoolItem[] = [];

  try {
    // Fetch popular movies from a random page
    const movies = await discoverMovies({
      sort_by: "popularity.desc",
      "vote_count.gte": "500",
      page: randomPage(5),
    });

    for (const movie of movies.results) {
      const posterUrl = tmdbImageUrl(movie.poster_path, "w500");
      if (posterUrl !== null) {
        items.push({
          id: null,
          tmdbId: movie.id,
          malId: null,
          title: movie.title,
          posterUrl,
          type: "movie",
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch TMDB movies for game pool:", error);
  }

  try {
    // Fetch popular TV shows from a random page
    const tvShows = await discoverTv({
      sort_by: "popularity.desc",
      "vote_count.gte": "200",
      page: randomPage(5),
    });

    for (const show of tvShows.results) {
      const posterUrl = tmdbImageUrl(show.poster_path, "w500");
      if (posterUrl !== null) {
        items.push({
          id: null,
          tmdbId: show.id,
          malId: null,
          title: show.name,
          posterUrl,
          type: "tv",
        });
      }
    }
  } catch (error: unknown) {
    console.error("Failed to fetch TMDB TV for game pool:", error);
  }

  return items;
}

async function getExternalPool(): Promise<MediaPoolItem[]> {
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
 * Build a media pool and select `count` items for game rounds.
 *
 * Normal: all from DB. Hard: ~60% DB, ~40% external.
 * Throws if not enough media available.
 */
export async function buildMediaPool(
  difficulty: "normal" | "hard",
  count: number,
): Promise<MediaPoolItem[]> {
  const dbPool = await getDbMediaPool();

  if (difficulty === "normal") {
    if (dbPool.length < count) {
      throw new Error(
        `Not enough media in database (${String(dbPool.length)} available, ${String(count)} needed)`,
      );
    }
    return randomSample(dbPool, count);
  }

  // Hard mode: mix DB + external
  const externalPool = await getExternalPool();
  const externalCount = Math.min(Math.ceil(count * 0.4), externalPool.length);
  const dbCount = count - externalCount;

  if (dbPool.length < dbCount) {
    throw new Error(
      `Not enough media in database (${String(dbPool.length)} available, ${String(dbCount)} needed)`,
    );
  }

  const dbItems = randomSample(dbPool, dbCount);
  const externalItems = randomSample(externalPool, externalCount);

  return shuffle([...dbItems, ...externalItems]);
}
