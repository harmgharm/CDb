/**
 * Already-watched set builders for exclusion filtering
 */

import { db } from "@/lib/db";

import type { WatchedIds } from "./types";

/**
 * Get all media IDs (internal, TMDB, MAL) that a specific user has watched.
 * A user is considered to have watched media if they attended a session for it.
 */
export async function getUserWatchedIds(userId: string): Promise<WatchedIds> {
  const rows = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.id", "media.tmdb_id", "media.mal_id"])
    .where("session_attendees.user_id", "=", userId)
    .execute();

  return buildWatchedIds(rows);
}

/**
 * Get all media IDs that the entire group has watched (any session).
 */
export async function getGroupWatchedIds(): Promise<WatchedIds> {
  const rows = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.id", "media.tmdb_id", "media.mal_id"])
    .distinct()
    .execute();

  return buildWatchedIds(rows);
}

function buildWatchedIds(
  rows: { id: string; tmdb_id: number | null; mal_id: number | null }[],
): WatchedIds {
  const tmdbIds = new Set<number>();
  const malIds = new Set<number>();
  const mediaIds = new Set<string>();

  for (const row of rows) {
    mediaIds.add(row.id);
    if (row.tmdb_id !== null) tmdbIds.add(row.tmdb_id);
    if (row.mal_id !== null) malIds.add(row.mal_id);
  }

  return { tmdbIds, malIds, mediaIds };
}

/**
 * Merge two WatchedIds sets (e.g., watched + dismissed).
 */
export function mergeWatchedIds(a: WatchedIds, b: WatchedIds): WatchedIds {
  return {
    tmdbIds: new Set([...a.tmdbIds, ...b.tmdbIds]),
    malIds: new Set([...a.malIds, ...b.malIds]),
    mediaIds: new Set([...a.mediaIds, ...b.mediaIds]),
  };
}

/**
 * Check if a recommendation item is already watched.
 */
export function isAlreadyWatched(
  watched: WatchedIds,
  item: { mediaId?: string | null; tmdbId?: number | null; malId?: number | null },
): boolean {
  if (item.mediaId !== undefined && item.mediaId !== null && watched.mediaIds.has(item.mediaId)) {
    return true;
  }
  if (item.tmdbId !== undefined && item.tmdbId !== null && watched.tmdbIds.has(item.tmdbId)) {
    return true;
  }
  if (item.malId !== undefined && item.malId !== null && watched.malIds.has(item.malId)) {
    return true;
  }
  return false;
}
