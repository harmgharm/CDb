/**
 * Group Recommendations
 *
 * Finds titles the whole group would likely enjoy, based on:
 * 1. Genre intersection — genres everyone rates highly
 * 2. Watchlist popularity — titles multiple members want to watch
 * 3. TMDB discover filtered by shared genres
 */

import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import {
  getMovieGenreId,
  getTvGenreId,
  mapMovieGenreIds,
  mapTvGenreIds,
} from "@/lib/api/tmdb-genres";
import { db } from "@/lib/db";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

import { addScoreJitter, randomPage, randomSample } from "./random";
import type { RecommendationItem, WatchedIds } from "./types";
import { sliceWithTypeDepth } from "./types";
import {
  getGroupWatchedAnimeTitles,
  getGroupWatchedIds,
  isAlreadyWatched,
  isWatchedAnimeTitle,
} from "./watched";

interface UserGenrePreference {
  userId: string;
  topGenres: Map<string, number>; // genre → avg rating
}

/**
 * Compute group recommendations.
 * Finds genres the whole group rates highly and surfaces unwatched titles.
 */
export async function computeGroupRecommendations(limit = 60): Promise<RecommendationItem[]> {
  // 1. Get active users (>= 3 ratings)
  const activeUsers = await db
    .selectFrom("ratings")
    .select(["ratings.user_id", db.fn.countAll().as("rating_count")])
    .groupBy("ratings.user_id")
    .having(db.fn.countAll(), ">=", 3)
    .execute();

  if (activeUsers.length < 2) return [];

  // 2. Compute per-user genre preferences
  const userPreferences = await computeAllUserPreferences(activeUsers);
  if (userPreferences.length < 2) return [];

  // 3. Find genre intersection (all users, falling back to a group majority)
  const { genres: sharedGenres, sharedByAll } = findSharedGenres(userPreferences);

  // 4. Get watched + watchlist data
  const [watched, animeTitles] = await Promise.all([
    getGroupWatchedIds(),
    getGroupWatchedAnimeTitles(),
  ]);
  const watchlistPopularity = await getWatchlistPopularity();
  const activeUserCount = activeUsers.length;

  // 5. Score discover results and add watchlist items
  const results = await scoreAndCollectResults({
    sharedGenres,
    sharedByAll,
    watched,
    animeTitles,
    watchlistPopularity,
    activeUserCount,
    userPreferences,
  });

  const deduplicated = deduplicateAndSort(results);
  const jittered = addScoreJitter(deduplicated);
  const pool = randomSample(jittered, Math.max(limit, 100));
  return sliceWithTypeDepth(pool, limit);
}

async function computeAllUserPreferences(
  activeUsers: { user_id: string }[],
): Promise<UserGenrePreference[]> {
  const userPreferences: UserGenrePreference[] = [];

  for (const user of activeUsers) {
    const preference = await computeSingleUserPreference(user.user_id);
    if (preference !== null) {
      userPreferences.push(preference);
    }
  }

  return userPreferences;
}

async function computeSingleUserPreference(userId: string): Promise<UserGenrePreference | null> {
  const ratings = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.genres", "ratings.score"])
    .where("ratings.user_id", "=", userId)
    .execute();

  const genreScores = new Map<string, { total: number; count: number }>();
  for (const row of ratings) {
    const score = Number(row.score);
    for (const genre of row.genres) {
      const existing = genreScores.get(genre) ?? { total: 0, count: 0 };
      existing.total += score;
      existing.count += 1;
      genreScores.set(genre, existing);
    }
  }

  const topGenres = new Map<string, number>();
  for (const [genre, data] of genreScores) {
    const avg = data.total / data.count;
    if (avg >= 7) {
      topGenres.set(genre, Math.round(avg * 10) / 10);
    }
  }

  if (topGenres.size === 0) return null;
  return { userId, topGenres };
}

async function scoreAndCollectResults(options: {
  sharedGenres: string[];
  sharedByAll: boolean;
  watched: WatchedIds;
  animeTitles: Set<string>;
  watchlistPopularity: WatchlistPopularItem[];
  activeUserCount: number;
  userPreferences: UserGenrePreference[];
}): Promise<RecommendationItem[]> {
  const {
    sharedGenres,
    sharedByAll,
    watched,
    animeTitles,
    watchlistPopularity,
    activeUserCount,
    userPreferences,
  } = options;
  const results: RecommendationItem[] = [];

  // TMDB discover with shared genres
  if (sharedGenres.length > 0) {
    const genreReason = `${sharedByAll ? "Everyone" : "Most of the group"} rates ${sharedGenres.join(", ")} highly`;
    const discoverResults = await fetchGroupDiscover(
      { sharedGenres, genreReason },
      watched,
      animeTitles,
    );
    const genreOverlap = sharedGenres.length / Math.max(1, getAllGenres(userPreferences).size);
    for (const item of discoverResults) {
      results.push(scoreDiscoverItem({ item, genreOverlap, watchlistPopularity, activeUserCount }));
    }
  }

  // Add popular watchlist items not yet from discover
  const watchlistResults = fetchWatchlistPopularItems({
    popularity: watchlistPopularity,
    watched,
    activeUserCount,
  });
  results.push(...watchlistResults);

  return results;
}

function scoreDiscoverItem(options: {
  item: RecommendationItem;
  genreOverlap: number;
  watchlistPopularity: WatchlistPopularItem[];
  activeUserCount: number;
}): RecommendationItem {
  const { item, genreOverlap, watchlistPopularity, activeUserCount } = options;
  const watchlistCount = getWatchlistCountForItem(watchlistPopularity, item);
  const voteScore = (item.voteAverage ?? 0) / 10;
  const watchlistScore = watchlistCount / activeUserCount;

  item.score =
    Math.round((0.3 * genreOverlap + 0.3 * voteScore + 0.4 * watchlistScore) * 1000) / 1000;

  if (watchlistCount > 0) {
    item.reasons.push({
      tag: "Watchlist popular",
      detail: `${String(watchlistCount)} member${watchlistCount === 1 ? "" : "s"} want${watchlistCount === 1 ? "s" : ""} to watch this`,
    });
  }
  item.watchlistCount = watchlistCount;
  return item;
}

export interface SharedGenresResult {
  genres: string[];
  /** True when every active user rates these highly; false for the majority fallback. */
  sharedByAll: boolean;
}

/**
 * Genres the group rates highly. Prefers the strict all-users intersection;
 * when one member's sparse or divergent ratings empty it (which otherwise
 * leaves the group section permanently empty), falls back to genres loved by
 * at least half the group (minimum 2 users).
 */
export function findSharedGenres(preferences: UserGenrePreference[]): SharedGenresResult {
  const strict = topGenresByMinimumFans(preferences, preferences.length);
  if (strict.length > 0) return { genres: strict, sharedByAll: true };

  const majority = Math.max(2, Math.ceil(preferences.length / 2));
  return { genres: topGenresByMinimumFans(preferences, majority), sharedByAll: false };
}

/** Top 3 genres (by average rating among their fans) loved by >= minFans users. */
function topGenresByMinimumFans(preferences: UserGenrePreference[], minFans: number): string[] {
  const fanCounts = new Map<string, { fans: number; sum: number }>();
  for (const pref of preferences) {
    for (const [genre, avg] of pref.topGenres) {
      const entry = fanCounts.get(genre) ?? { fans: 0, sum: 0 };
      entry.fans += 1;
      entry.sum += avg;
      fanCounts.set(genre, entry);
    }
  }

  return [...fanCounts.entries()]
    .filter(([, entry]) => entry.fans >= minFans)
    .map(([genre, entry]) => ({ genre, avg: entry.sum / entry.fans }))
    .toSorted((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((g) => g.genre);
}

function getAllGenres(preferences: UserGenrePreference[]): Set<string> {
  const all = new Set<string>();
  for (const pref of preferences) {
    for (const genre of pref.topGenres.keys()) {
      all.add(genre);
    }
  }
  return all;
}

async function fetchGroupDiscover(
  shared: { sharedGenres: string[]; genreReason: string },
  watched: WatchedIds,
  animeTitles: Set<string>,
): Promise<RecommendationItem[]> {
  // Build genre ID lists for movie and TV
  const movieGenreIds = shared.sharedGenres
    .map((g) => getMovieGenreId(g))
    .filter((id): id is number => id !== null);

  const tvGenreIds = shared.sharedGenres
    .map((g) => getTvGenreId(g))
    .filter((id): id is number => id !== null);

  const movieResults = await discoverMovieItems({
    genreIds: movieGenreIds,
    genreReason: shared.genreReason,
    watched,
    animeTitles,
  });
  const tvResults = await discoverTvItems({
    genreIds: tvGenreIds,
    genreReason: shared.genreReason,
    watched,
    animeTitles,
  });

  return [...movieResults, ...tvResults];
}

async function discoverMovieItems(options: {
  genreIds: number[];
  genreReason: string;
  watched: WatchedIds;
  animeTitles: Set<string>;
}): Promise<RecommendationItem[]> {
  const { genreIds, genreReason, watched, animeTitles } = options;
  if (genreIds.length === 0) return [];

  try {
    const results: RecommendationItem[] = [];
    // Two pages: one page (~20 results) minus already-watched titles can't
    // fill a 36-item section on its own.
    const startPage = Number(randomPage(3));
    for (let offset = 0; offset < 2; offset += 1) {
      const response = await discoverMovies({
        with_genres: genreIds.join(","),
        sort_by: "vote_average.desc",
        "vote_count.gte": "200",
        page: String(startPage + offset),
      });

      for (const item of response.results) {
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;
        if (isWatchedAnimeTitle(item.title, animeTitles)) continue;
        results.push(movieToGroupItem(item, genreReason));
      }
      if (response.results.length === 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

async function discoverTvItems(options: {
  genreIds: number[];
  genreReason: string;
  watched: WatchedIds;
  animeTitles: Set<string>;
}): Promise<RecommendationItem[]> {
  const { genreIds, genreReason, watched, animeTitles } = options;
  if (genreIds.length === 0) return [];

  try {
    const results: RecommendationItem[] = [];
    const startPage = Number(randomPage(3));
    for (let offset = 0; offset < 2; offset += 1) {
      const response = await discoverTv({
        with_genres: genreIds.join(","),
        sort_by: "vote_average.desc",
        "vote_count.gte": "200",
        page: String(startPage + offset),
      });

      for (const item of response.results) {
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;
        if (isWatchedAnimeTitle(item.name, animeTitles)) continue;
        results.push(tvToGroupItem(item, genreReason));
      }
      if (response.results.length === 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

function movieToGroupItem(item: TmdbMovieSearchResult, genreReason: string): RecommendationItem {
  return {
    mediaId: null,
    tmdbId: item.id,
    malId: null,
    title: item.title,
    posterUrl: tmdbImageUrl(item.poster_path),
    mediaType: "movie",
    overview: item.overview,
    releaseYear: item.release_date.length > 0 ? Number(item.release_date.slice(0, 4)) : null,
    voteAverage: item.vote_average,
    genres: mapMovieGenreIds(item.genre_ids),
    score: 0,
    recType: "group",
    reasons: [
      {
        tag: "Group genre",
        detail: genreReason,
      },
    ],
  };
}

function tvToGroupItem(item: TmdbTvSearchResult, genreReason: string): RecommendationItem {
  return {
    mediaId: null,
    tmdbId: item.id,
    malId: null,
    title: item.name,
    posterUrl: tmdbImageUrl(item.poster_path),
    mediaType: "tv",
    overview: item.overview,
    releaseYear: item.first_air_date.length > 0 ? Number(item.first_air_date.slice(0, 4)) : null,
    voteAverage: item.vote_average,
    genres: mapTvGenreIds(item.genre_ids),
    score: 0,
    recType: "group",
    reasons: [
      {
        tag: "Group genre",
        detail: genreReason,
      },
    ],
  };
}

// ── Watchlist popularity ─────────────────────────────────────────────

interface WatchlistPopularItem {
  mediaId: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string | null;
  mediaType: string | null;
  releaseYear: number | null;
  count: number;
}

async function getWatchlistPopularity(): Promise<WatchlistPopularItem[]> {
  // Count how many users have each title on their watchlist
  const rows = await db
    .selectFrom("watchlist")
    .leftJoin("media", "media.id", "watchlist.media_id")
    .select([
      "watchlist.media_id",
      "watchlist.tmdb_id",
      "watchlist.mal_id",
      db.fn.countAll().as("count"),
    ])
    .groupBy(["watchlist.media_id", "watchlist.tmdb_id", "watchlist.mal_id"])
    .having(db.fn.countAll(), ">=", 2)
    .orderBy("count", "desc")
    .execute();

  // Fetch display info for each
  const results: WatchlistPopularItem[] = [];
  for (const row of rows) {
    if (row.media_id === null) {
      // External watchlist entry — get display info from first entry
      let query = db
        .selectFrom("watchlist")
        .select([
          "watchlist.ext_title",
          "watchlist.ext_poster_url",
          "watchlist.ext_media_type",
          "watchlist.tmdb_id",
          "watchlist.mal_id",
        ]);

      if (row.tmdb_id !== null) {
        query = query.where("watchlist.tmdb_id", "=", row.tmdb_id);
      } else if (row.mal_id !== null) {
        query = query.where("watchlist.mal_id", "=", row.mal_id);
      }

      const entry = await query.executeTakeFirst();
      if (entry !== undefined) {
        results.push({
          mediaId: null,
          tmdbId: entry.tmdb_id,
          malId: entry.mal_id,
          title: entry.ext_title ?? "Unknown",
          posterUrl: entry.ext_poster_url,
          mediaType: entry.ext_media_type,
          releaseYear: null,
          count: Number(row.count),
        });
      }
    } else {
      const media = await db
        .selectFrom("media")
        .select(["id", "title", "poster_url", "type", "tmdb_id", "mal_id", "release_year"])
        .where("id", "=", row.media_id)
        .executeTakeFirst();

      if (media !== undefined) {
        results.push({
          mediaId: media.id,
          tmdbId: media.tmdb_id,
          malId: media.mal_id,
          title: media.title,
          posterUrl: media.poster_url,
          mediaType: media.type,
          releaseYear: media.release_year,
          count: Number(row.count),
        });
      }
    }
  }

  return results;
}

function getWatchlistCountForItem(
  popularity: WatchlistPopularItem[],
  item: RecommendationItem,
): number {
  for (const popular of popularity) {
    if (item.tmdbId !== null && popular.tmdbId === item.tmdbId) return popular.count;
    if (item.malId !== null && popular.malId === item.malId) return popular.count;
    if (item.mediaId !== null && popular.mediaId === item.mediaId) return popular.count;
  }
  return 0;
}

function fetchWatchlistPopularItems(options: {
  popularity: WatchlistPopularItem[];
  watched: WatchedIds;
  activeUserCount: number;
}): RecommendationItem[] {
  const { popularity, watched, activeUserCount } = options;
  const results: RecommendationItem[] = [];

  for (const popular of popularity) {
    if (isAlreadyWatched(watched, popular)) continue;

    const watchlistScore = popular.count / activeUserCount;

    results.push({
      mediaId: popular.mediaId,
      tmdbId: popular.tmdbId,
      malId: popular.malId,
      title: popular.title,
      posterUrl: popular.posterUrl,
      mediaType: popular.mediaType as "movie" | "tv" | "anime",
      overview: null,
      releaseYear: popular.releaseYear,
      voteAverage: null,
      genres: [],
      score: Math.round(watchlistScore * 1000) / 1000,
      recType: "group",
      watchlistCount: popular.count,
      reasons: [
        {
          tag: "Watchlist popular",
          detail: `${String(popular.count)} member${popular.count === 1 ? "" : "s"} want${popular.count === 1 ? "s" : ""} to watch this`,
        },
      ],
    });
  }

  return results;
}

function deduplicateAndSort(items: RecommendationItem[]): RecommendationItem[] {
  const seen = new Set<string>();
  const unique: RecommendationItem[] = [];

  for (const item of items) {
    const key =
      item.mediaId ??
      (item.tmdbId === null ? `mal-${String(item.malId)}` : `tmdb-${String(item.tmdbId)}`);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.toSorted((a, b) => b.score - a.score);
}
