/**
 * Dismissed recommendation set builder for exclusion filtering
 */

import { db } from "@/lib/db";

import type { WatchedIds } from "./types";

/**
 * Get all media IDs (internal, TMDB, MAL) that a user has dismissed.
 * Returns the same shape as getUserWatchedIds so it can be merged
 * and checked with isAlreadyWatched.
 */
export async function getUserDismissedIds(userId: string): Promise<WatchedIds> {
  const rows = await db
    .selectFrom("recommendation_dismissals")
    .select(["media_id", "tmdb_id", "mal_id"])
    .where("user_id", "=", userId)
    .execute();

  const tmdbIds = new Set<number>();
  const malIds = new Set<number>();
  const mediaIds = new Set<string>();

  for (const row of rows) {
    if (row.media_id !== null) mediaIds.add(row.media_id);
    if (row.tmdb_id !== null) tmdbIds.add(row.tmdb_id);
    if (row.mal_id !== null) malIds.add(row.mal_id);
  }

  return { tmdbIds, malIds, mediaIds };
}
