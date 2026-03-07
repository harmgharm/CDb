/**
 * Watchlist Enrichment
 *
 * Enriches recommendation items with watchlist state:
 * - Whether the current user has this on their watchlist (watchlistEntryId)
 * - How many group members have this on their watchlist (watchlistCount)
 */

import { db } from "@/lib/db";

import type { RecommendationItem } from "./types";

/**
 * Enrich recommendation items with watchlist data for the current user.
 */
export async function enrichWithWatchlistData(
  items: RecommendationItem[],
  userId: string,
): Promise<RecommendationItem[]> {
  if (items.length === 0) return items;

  // 1. Get user's watchlist entries
  const userWatchlist = await db
    .selectFrom("watchlist")
    .select(["id", "media_id", "tmdb_id", "mal_id"])
    .where("user_id", "=", userId)
    .execute();

  // Build lookup maps
  const byMediaId = new Map<string, string>();
  const byTmdbId = new Map<number, string>();
  const byMalId = new Map<number, string>();

  for (const entry of userWatchlist) {
    if (entry.media_id !== null) byMediaId.set(entry.media_id, entry.id);
    if (entry.tmdb_id !== null) byTmdbId.set(entry.tmdb_id, entry.id);
    if (entry.mal_id !== null) byMalId.set(entry.mal_id, entry.id);
  }

  // 2. Get group watchlist counts for external IDs in the results
  const tmdbIds = items.flatMap((item) => (item.tmdbId === null ? [] : [item.tmdbId]));
  const malIds = items.flatMap((item) => (item.malId === null ? [] : [item.malId]));
  const mediaIds = items.flatMap((item) => (item.mediaId === null ? [] : [item.mediaId]));

  const groupCounts = await getGroupWatchlistCounts(mediaIds, tmdbIds, malIds);

  // 3. Enrich each item
  return items.map((item) => {
    const enriched = { ...item };

    // Check if user has this on their watchlist
    if (item.mediaId !== null && byMediaId.has(item.mediaId)) {
      enriched.watchlistEntryId = byMediaId.get(item.mediaId);
    } else if (item.tmdbId !== null && byTmdbId.has(item.tmdbId)) {
      enriched.watchlistEntryId = byTmdbId.get(item.tmdbId);
    } else if (item.malId !== null && byMalId.has(item.malId)) {
      enriched.watchlistEntryId = byMalId.get(item.malId);
    }

    // Set group watchlist count (if not already set by group recs)
    if (enriched.watchlistCount === undefined) {
      const key =
        item.mediaId ??
        (item.tmdbId === null ? `mal-${String(item.malId)}` : `tmdb-${String(item.tmdbId)}`);
      enriched.watchlistCount = groupCounts.get(key) ?? 0;
    }

    return enriched;
  });
}

async function countByMediaId(mediaIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (mediaIds.length === 0) return counts;

  const rows = await db
    .selectFrom("watchlist")
    .select(["media_id", db.fn.countAll().as("count")])
    .where("media_id", "in", mediaIds)
    .groupBy("media_id")
    .execute();

  for (const row of rows) {
    if (row.media_id === null) continue;
    counts.set(row.media_id, Number(row.count));
  }

  return counts;
}

async function countByExternalId(
  column: "tmdb_id" | "mal_id",
  ids: number[],
  prefix: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  const rows = await db
    .selectFrom("watchlist")
    .select([column, db.fn.countAll().as("count")])
    .where(column, "in", ids)
    .where("media_id", "is", null)
    .groupBy(column)
    .execute();

  for (const row of rows) {
    const value = row[column];
    if (value === null) continue;
    counts.set(`${prefix}${String(value)}`, Number(row.count));
  }

  return counts;
}

async function getGroupWatchlistCounts(
  mediaIds: string[],
  tmdbIds: number[],
  malIds: number[],
): Promise<Map<string, number>> {
  const [mediaCounts, tmdbCounts, malCounts] = await Promise.all([
    countByMediaId(mediaIds),
    countByExternalId("tmdb_id", tmdbIds, "tmdb-"),
    countByExternalId("mal_id", malIds, "mal-"),
  ]);

  const counts = new Map<string, number>();
  for (const [key, value] of mediaCounts) counts.set(key, value);
  for (const [key, value] of tmdbCounts) counts.set(key, value);
  for (const [key, value] of malCounts) counts.set(key, value);

  return counts;
}
