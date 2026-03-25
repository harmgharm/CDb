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
 * Get normalized anime titles that a specific user has watched in sessions.
 * Used to filter TMDB movie/TV results that are actually anime the user already watched via Jikan.
 */
export async function getUserWatchedAnimeTitles(userId: string): Promise<Set<string>> {
  const rows = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.title", "media.original_title"])
    .where("session_attendees.user_id", "=", userId)
    .where("media.type", "=", "anime")
    .execute();

  return buildAnimeTitleSet(rows);
}

/**
 * Get normalized anime titles that the entire group has watched.
 * Used to filter TMDB results in group recommendations.
 */
export async function getGroupWatchedAnimeTitles(): Promise<Set<string>> {
  const rows = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.title", "media.original_title"])
    .where("media.type", "=", "anime")
    .distinct()
    .execute();

  return buildAnimeTitleSet(rows);
}

function buildAnimeTitleSet(rows: { title: string; original_title: string | null }[]): Set<string> {
  const titles = new Set<string>();
  for (const row of rows) {
    titles.add(normalizeTitle(row.title));
    if (row.original_title !== null) {
      titles.add(normalizeTitle(row.original_title));
    }
  }
  return titles;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim();
}

/**
 * Check if a title matches a known watched anime title.
 */
export function isWatchedAnimeTitle(title: string, animeTitles: Set<string>): boolean {
  return animeTitles.has(normalizeTitle(title));
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
