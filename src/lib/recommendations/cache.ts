/**
 * Recommendation Cache Manager
 *
 * Manages the lifecycle of cached recommendations:
 * - Check for valid cache before computing
 * - Store computed results with TTL
 * - Invalidate on relevant data changes (new ratings, sessions)
 */

import { db } from "@/lib/db";
import type { RecommendationType } from "@/lib/db/types";

import { computeCollaborativeRecommendations } from "./collaborative";
import { computeContentRecommendations } from "./content";
import { computeFallbackRecommendations } from "./fallback";
import { computeGroupRecommendations } from "./group";
import { computeTmdbRecommendations } from "./tmdb-recs";
import type { RecommendationItem, RecommendationReason } from "./types";

/** TTLs per recommendation type (in milliseconds) */
const CACHE_TTLS: Record<RecommendationType, number> = {
  content: 24 * 60 * 60 * 1000, // 24 hours
  collaborative: 24 * 60 * 60 * 1000, // 24 hours
  tmdb: 7 * 24 * 60 * 60 * 1000, // 7 days
  jikan: 7 * 24 * 60 * 60 * 1000, // 7 days
  group: 12 * 60 * 60 * 1000, // 12 hours
};

/**
 * Get cached recommendations or compute fresh ones.
 * Returns cached results if not expired. Otherwise recomputes and caches.
 */
export async function getOrComputeRecommendations(
  userId: string,
  type: RecommendationType,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  const isGroupType = type === "group";

  // 1. Check cache (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedResults(isGroupType ? null : userId, type);
    if (cached.length > 0) return cached;
  }

  // 2. Check if user has enough ratings for personalized recs
  const ratingCount = await getUserRatingCount(userId);

  // 3. Compute fresh recommendations
  let results: RecommendationItem[];

  if (isGroupType) {
    results = await computeGroupRecommendations();
  } else if (ratingCount < 5) {
    // Fallback mode for users with < 5 ratings
    results = await computeFallbackRecommendations(userId);
  } else {
    results = await computeByType(userId, type, forceRefresh);
  }

  // 4. Cache the results
  if (results.length > 0) {
    await cacheResults(isGroupType ? null : userId, type, results);
  }

  return results;
}

/**
 * Get the number of ratings a user has submitted.
 */
export async function getUserRatingCount(userId: string): Promise<number> {
  const result = await db
    .selectFrom("ratings")
    .select(db.fn.countAll().as("count"))
    .where("user_id", "=", userId)
    .executeTakeFirstOrThrow();

  return Number(result.count);
}

/**
 * Invalidate all cached recommendations for a specific user.
 * Called when a user submits a new rating.
 */
export async function invalidateUserRecommendations(userId: string): Promise<void> {
  await db.deleteFrom("recommendation_cache").where("user_id", "=", userId).execute();
}

/**
 * Invalidate group recommendations.
 * Called when any new session is created.
 */
export async function invalidateGroupRecommendations(): Promise<void> {
  await db.deleteFrom("recommendation_cache").where("rec_type", "=", "group").execute();
}

/**
 * Clean up all expired cache entries. Returns the number of deleted rows.
 */
export async function cleanExpiredCache(): Promise<number> {
  const result = await db
    .deleteFrom("recommendation_cache")
    .where("expires_at", "<", new Date())
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

// ── Internal helpers ─────────────────────────────────────────────────

async function computeByType(
  userId: string,
  type: RecommendationType,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  switch (type) {
    case "content": {
      return computeContentRecommendations(userId);
    }
    case "collaborative": {
      return computeCollaborativeRecommendations(userId);
    }
    case "tmdb":
    case "jikan": {
      return computeTmdbRecommendations(userId, 60, forceRefresh);
    }
    case "group": {
      return computeGroupRecommendations();
    }
  }
}

async function getCachedResults(
  userId: string | null,
  type: RecommendationType,
): Promise<RecommendationItem[]> {
  let query = db
    .selectFrom("recommendation_cache")
    .selectAll()
    .where("rec_type", "=", type)
    .where("expires_at", ">", new Date())
    .orderBy("score", "desc");

  query =
    userId === null ? query.where("user_id", "is", null) : query.where("user_id", "=", userId);

  const rows = await query.execute();

  return rows.map((row) => ({
    mediaId: row.media_id,
    tmdbId: row.tmdb_id,
    malId: row.mal_id,
    title: row.ext_title ?? "",
    posterUrl: row.ext_poster_url,
    mediaType: row.ext_media_type ?? "movie",
    overview: row.ext_overview,
    releaseYear: row.ext_release_year,
    voteAverage: row.ext_vote_average === null ? null : Number(row.ext_vote_average),
    score: Number(row.score),
    recType: row.rec_type,
    reasons: parseReasons(row.reasons),
  }));
}

async function cacheResults(
  userId: string | null,
  type: RecommendationType,
  items: RecommendationItem[],
): Promise<void> {
  const ttl = CACHE_TTLS[type];
  const expiresAt = new Date(Date.now() + ttl);

  // Clear old entries for this user+type
  let deleteQuery = db.deleteFrom("recommendation_cache").where("rec_type", "=", type);

  deleteQuery =
    userId === null
      ? deleteQuery.where("user_id", "is", null)
      : deleteQuery.where("user_id", "=", userId);

  await deleteQuery.execute();

  // Insert new entries
  if (items.length === 0) return;

  const values = items.map((item) => ({
    user_id: userId,
    rec_type: type,
    media_id: item.mediaId,
    tmdb_id: item.tmdbId,
    mal_id: item.malId,
    ext_title: item.title,
    ext_poster_url: item.posterUrl,
    ext_media_type: item.mediaType,
    ext_overview: item.overview,
    ext_release_year: item.releaseYear,
    ext_vote_average: item.voteAverage,
    score: item.score,
    reasons: JSON.stringify(item.reasons),
    computed_at: new Date(),
    expires_at: expiresAt,
  }));

  await db.insertInto("recommendation_cache").values(values).execute();
}

function parseReasons(raw: { tag: string; detail: string }[] | string): RecommendationReason[] {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as RecommendationReason[];
    } catch {
      return [];
    }
  }
  return raw;
}
