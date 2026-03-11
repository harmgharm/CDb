/**
 * Filtered Recommendations
 *
 * When users apply genre/decade/type filters, we bypass the generic cache and
 * compute results on-the-fly using TMDB discover with filter-matching params.
 * This ensures a full set of results for any filter combination.
 */

import { discoverAnime } from "@/lib/api/jikan";
import { getMalGenreId } from "@/lib/api/jikan-genres";
import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import {
  getMovieGenreId,
  getTvGenreId,
  mapMovieGenreIds,
  mapTvGenreIds,
} from "@/lib/api/tmdb-genres";
import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

import { getUserDismissedIds } from "./dismissed";
import { addScoreJitter, randomPage, randomSample } from "./random";
import type { RecommendationItem, WatchedIds } from "./types";
import { getUserWatchedIds, isAlreadyWatched, mergeWatchedIds } from "./watched";

export interface RecommendationFilters {
  mediaType?: MediaType;
  genre?: string;
  decade?: string;
}

interface DecadeRange {
  gte: string;
  lte: string;
}

function decadeToDateRange(decade: string): DecadeRange | null {
  if (decade === "older") {
    return { gte: "1900-01-01", lte: "1979-12-31" };
  }
  const start = Number(decade);
  if (Number.isNaN(start)) return null;
  return { gte: `${String(start)}-01-01`, lte: `${String(start + 9)}-12-31` };
}

/**
 * Compute filtered recommendations on-the-fly using TMDB/Jikan discover
 * with the user's filter params baked in. No caching — always fresh.
 */
export async function computeFilteredRecommendations(
  userId: string,
  filters: RecommendationFilters,
  limit = 60,
): Promise<RecommendationItem[]> {
  const watched = mergeWatchedIds(
    await getUserWatchedIds(userId),
    await getUserDismissedIds(userId),
  );

  // Determine which genre to use — prefer user-selected filter, fall back to user's top genres
  const genre = filters.genre ?? (await getUserTopGenre(userId));
  const dateRange = filters.decade === undefined ? null : decadeToDateRange(filters.decade);
  const mediaTypes =
    filters.mediaType === undefined ? ["movie", "tv", "anime"] : [filters.mediaType];

  const results: RecommendationItem[] = [];

  for (const type of mediaTypes) {
    switch (type) {
      case "movie": {
        const items = await discoverFilteredMovies({ genre, dateRange, watched });
        results.push(...items);
        break;
      }
      case "tv": {
        const items = await discoverFilteredTv({ genre, dateRange, watched });
        results.push(...items);
        break;
      }
      case "anime": {
        const items = await discoverFilteredAnime({ genre, dateRange, watched });
        results.push(...items);
        break;
      }
    }
  }

  // Jitter + sample for variety
  const jittered = addScoreJitter(results);
  return randomSample(jittered, limit);
}

async function getUserTopGenre(userId: string): Promise<string | undefined> {
  const ratings = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.genres", "ratings.score"])
    .where("ratings.user_id", "=", userId)
    .execute();

  const genreTotals = new Map<string, { total: number; count: number }>();
  for (const row of ratings) {
    const score = Number(row.score);
    for (const g of row.genres) {
      const existing = genreTotals.get(g) ?? { total: 0, count: 0 };
      existing.total += score;
      existing.count += 1;
      genreTotals.set(g, existing);
    }
  }

  let best: { genre: string; avg: number } | undefined;
  for (const [genre, data] of genreTotals) {
    const avg = data.total / data.count;
    if (best === undefined || avg > best.avg) {
      best = { genre, avg };
    }
  }

  return best?.genre;
}

interface DiscoverOptions {
  genre: string | undefined;
  dateRange: DecadeRange | null;
  watched: WatchedIds;
}

async function discoverFilteredMovies(options: DiscoverOptions): Promise<RecommendationItem[]> {
  const { genre, dateRange, watched } = options;
  const params: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_count.gte": "100",
    page: randomPage(5),
  };

  if (genre !== undefined) {
    const genreId = getMovieGenreId(genre);
    if (genreId !== null) {
      params.with_genres = genreId.toString();
    }
  }

  if (dateRange !== null) {
    params["primary_release_date.gte"] = dateRange.gte;
    params["primary_release_date.lte"] = dateRange.lte;
  }

  try {
    // Fetch 2 pages for a bigger pool
    const results: RecommendationItem[] = [];
    for (let offset = 0; offset < 2; offset += 1) {
      const response = await discoverMovies({
        ...params,
        page: String(Number(params.page) + offset),
      });
      for (const item of response.results) {
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;
        results.push(parseMovieToItem(item, genre));
      }
      if (response.results.length === 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

async function discoverFilteredTv(options: DiscoverOptions): Promise<RecommendationItem[]> {
  const { genre, dateRange, watched } = options;
  const params: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_count.gte": "100",
    page: randomPage(5),
  };

  if (genre !== undefined) {
    const genreId = getTvGenreId(genre);
    if (genreId !== null) {
      params.with_genres = genreId.toString();
    }
  }

  if (dateRange !== null) {
    params["first_air_date.gte"] = dateRange.gte;
    params["first_air_date.lte"] = dateRange.lte;
  }

  try {
    const results: RecommendationItem[] = [];
    for (let offset = 0; offset < 2; offset += 1) {
      const response = await discoverTv({
        ...params,
        page: String(Number(params.page) + offset),
      });
      for (const item of response.results) {
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;
        results.push(parseTvToItem(item, genre));
      }
      if (response.results.length === 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

async function discoverFilteredAnime(options: DiscoverOptions): Promise<RecommendationItem[]> {
  const { genre, dateRange, watched } = options;
  const params: Record<string, string> = {
    order_by: "score",
    sort: "desc",
    min_score: "7",
    page: randomPage(3),
  };

  if (genre !== undefined) {
    const malGenreId = getMalGenreId(genre);
    if (malGenreId !== null) {
      params.genres = malGenreId.toString();
    }
  }

  if (dateRange !== null) {
    // Jikan uses start_date/end_date in YYYY-MM-DD format
    params.start_date = dateRange.gte;
    params.end_date = dateRange.lte;
  }

  try {
    const response = await discoverAnime(params);
    const results: RecommendationItem[] = [];
    for (const anime of response.data) {
      if (isAlreadyWatched(watched, { malId: anime.mal_id })) continue;
      results.push({
        mediaId: null,
        tmdbId: null,
        malId: anime.mal_id,
        title: anime.title_english ?? anime.title,
        posterUrl: anime.images.jpg.large_image_url,
        mediaType: "anime",
        overview: anime.synopsis,
        releaseYear: anime.year,
        voteAverage: anime.score,
        genres: anime.genres.map((g) => g.name),
        score: (anime.score ?? 7) / 10,
        recType: "content",
        reasons: [
          {
            tag: "Filtered pick",
            detail: genre === undefined ? "Highly rated anime" : `Top ${genre} anime`,
          },
        ],
      });
    }
    return results;
  } catch {
    return [];
  }
}

function parseMovieToItem(
  item: TmdbMovieSearchResult,
  genre: string | undefined,
): RecommendationItem {
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
    score: item.vote_average / 10,
    recType: "content",
    reasons: [
      {
        tag: "Filtered pick",
        detail: genre === undefined ? "Highly rated movie" : `Top ${genre} movies`,
      },
    ],
  };
}

function parseTvToItem(item: TmdbTvSearchResult, genre: string | undefined): RecommendationItem {
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
    score: item.vote_average / 10,
    recType: "content",
    reasons: [
      {
        tag: "Filtered pick",
        detail: genre === undefined ? "Highly rated TV show" : `Top ${genre} TV shows`,
      },
    ],
  };
}
