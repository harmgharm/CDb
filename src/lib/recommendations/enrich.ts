/**
 * Recommendation Enrichment
 *
 * Enriches recommendation items with:
 * - Watchlist state (user's entry ID + group counts)
 * - Friend watch data (who watched it + their ratings)
 */

import { db } from "@/lib/db";

import type { FriendWatch, RecommendationItem } from "./types";

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

  // 3. Get friend watch data for items that match imported media
  const friendWatchMap = await getFriendWatchData({
    mediaIds,
    tmdbIds,
    malIds,
    currentUserId: userId,
  });

  // 4. Enrich each item
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

    // Set friend watch data
    const friendKey = resolveFriendWatchKey(item, friendWatchMap);
    if (friendKey !== undefined) {
      enriched.watchedByFriends = friendWatchMap.get(friendKey);
    }

    return enriched;
  });
}

// ── Friend watch data ──────────────────────────────────────────────

interface FriendWatchQuery {
  mediaIds: string[];
  tmdbIds: number[];
  malIds: number[];
  currentUserId: string;
}

/**
 * Get friend watch data for recommendation items.
 * Matches by media_id directly, or by tmdb_id/mal_id through the media table.
 * Returns a map from media_id (or tmdb-/mal- key) → FriendWatch[].
 */
async function getFriendWatchData(query: FriendWatchQuery): Promise<Map<string, FriendWatch[]>> {
  const { allMediaIds, tmdbToMediaId, malToMediaId } = await resolveExternalIds(query);

  const mediaIdArray = [...allMediaIds];
  if (mediaIdArray.length === 0) return new Map();

  const result = await queryFriendSessions(mediaIdArray, query.currentUserId);

  // Index by tmdb-/mal- keys so unimported items can be matched
  indexByExternalIds(result, tmdbToMediaId, "tmdb-");
  indexByExternalIds(result, malToMediaId, "mal-");

  return result;
}

async function resolveExternalIds(query: FriendWatchQuery) {
  const allMediaIds = new Set(query.mediaIds);
  const tmdbToMediaId = new Map<number, string>();
  const malToMediaId = new Map<number, string>();

  if (query.tmdbIds.length > 0) {
    const rows = await db
      .selectFrom("media")
      .select(["id", "tmdb_id"])
      .where("tmdb_id", "in", query.tmdbIds)
      .execute();
    for (const row of rows) {
      if (row.tmdb_id !== null) {
        tmdbToMediaId.set(row.tmdb_id, row.id);
        allMediaIds.add(row.id);
      }
    }
  }

  if (query.malIds.length > 0) {
    const rows = await db
      .selectFrom("media")
      .select(["id", "mal_id"])
      .where("mal_id", "in", query.malIds)
      .execute();
    for (const row of rows) {
      if (row.mal_id !== null) {
        malToMediaId.set(row.mal_id, row.id);
        allMediaIds.add(row.id);
      }
    }
  }

  return { allMediaIds, tmdbToMediaId, malToMediaId };
}

async function queryFriendSessions(
  mediaIdArray: string[],
  currentUserId: string,
): Promise<Map<string, FriendWatch[]>> {
  const result = new Map<string, FriendWatch[]>();

  const rows = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .innerJoin("users", "users.id", "session_attendees.user_id")
    .leftJoin("ratings", (join) =>
      join
        .onRef("ratings.session_id", "=", "session_attendees.session_id")
        .onRef("ratings.user_id", "=", "session_attendees.user_id"),
    )
    .select(["watch_sessions.media_id", "users.username", "users.display_name", "ratings.score"])
    .where("watch_sessions.media_id", "in", mediaIdArray)
    .where("session_attendees.user_id", "!=", currentUserId)
    .execute();

  for (const row of rows) {
    const existing = result.get(row.media_id) ?? [];
    // Avoid duplicate entries for the same user (multiple sessions)
    if (existing.some((f) => f.username === row.username)) continue;

    existing.push({
      username: row.username,
      displayName: row.display_name,
      score: row.score === null ? 0 : Number(row.score),
    });
    result.set(row.media_id, existing);
  }

  return result;
}

function indexByExternalIds(
  result: Map<string, FriendWatch[]>,
  idMap: Map<number, string>,
  prefix: string,
): void {
  for (const [externalId, mediaId] of idMap) {
    const friends = result.get(mediaId);
    if (friends !== undefined) {
      result.set(`${prefix}${String(externalId)}`, friends);
    }
  }
}

function resolveFriendWatchKey(
  item: RecommendationItem,
  friendWatchMap: Map<string, FriendWatch[]>,
): string | undefined {
  if (item.mediaId !== null && friendWatchMap.has(item.mediaId)) return item.mediaId;
  if (item.tmdbId !== null) {
    const key = `tmdb-${String(item.tmdbId)}`;
    if (friendWatchMap.has(key)) return key;
  }
  if (item.malId !== null) {
    const key = `mal-${String(item.malId)}`;
    if (friendWatchMap.has(key)) return key;
  }
  return undefined;
}

// ── Watchlist counts ───────────────────────────────────────────────

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
