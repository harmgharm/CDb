/**
 * Raw external-API response cache (tmdb_recommendation_cache table).
 *
 * Caches per-source recommendation payloads (TMDB movie/TV recs, Jikan anime
 * recs) and per-anime detail payloads ("anime-full") so refreshes don't
 * re-fetch the same upstream data for 7 days. Extracted from tmdb-recs.ts so
 * anime hydration can share it without an import cycle.
 */

import { sql } from "kysely";

import { db } from "@/lib/db";

export const REC_SOURCE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getCachedRecommendations(
  sourceType: string,
  tmdbId: number | null,
  malId: number | null,
): Promise<unknown[] | null> {
  let query = db
    .selectFrom("tmdb_recommendation_cache")
    .select("recommendations")
    .where("source_type", "=", sourceType)
    .where("expires_at", ">", new Date());

  if (tmdbId !== null) {
    query = query.where("source_tmdb_id", "=", tmdbId);
  } else if (malId !== null) {
    query = query.where("source_mal_id", "=", malId);
  }

  const row = await query.executeTakeFirst();
  if (row === undefined) return null;

  const recs =
    typeof row.recommendations === "string"
      ? (JSON.parse(row.recommendations) as unknown[])
      : row.recommendations;

  return recs;
}

export async function cacheRecommendations(options: {
  sourceType: string;
  tmdbId: number | null;
  malId: number | null;
  recommendations: unknown[];
}): Promise<void> {
  const { sourceType, tmdbId, malId, recommendations } = options;
  const expiresAt = new Date(Date.now() + REC_SOURCE_CACHE_TTL_MS);

  // Upsert: delete any existing entry, then insert
  let deleteQuery = db
    .deleteFrom("tmdb_recommendation_cache")
    .where("source_type", "=", sourceType);

  if (tmdbId !== null) {
    deleteQuery = deleteQuery.where("source_tmdb_id", "=", tmdbId);
  } else if (malId !== null) {
    deleteQuery = deleteQuery.where("source_mal_id", "=", malId);
  }

  await deleteQuery.execute();

  await db
    .insertInto("tmdb_recommendation_cache")
    .values({
      source_type: sourceType,
      source_tmdb_id: tmdbId,
      source_mal_id: malId,
      recommendations: JSON.stringify(recommendations),
      fetched_at: sql`now()`,
      expires_at: expiresAt,
    })
    .execute();
}
