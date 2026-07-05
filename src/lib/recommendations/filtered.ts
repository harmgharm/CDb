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
import { addScoreJitter, randomPage, weightedSampleByScore } from "./random";
import type { RecommendationItem, WatchedIds } from "./types";
import {
  getUserWatchedAnimeTitles,
  getUserWatchedIds,
  isAlreadyWatched,
  isWatchedAnimeTitle,
  mergeWatchedIds,
} from "./watched";

export interface RecommendationFilters {
  mediaType?: MediaType[];
  genre?: string[];
  decade?: string[];
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
  const [watchedIds, dismissedIds, animeTitles] = await Promise.all([
    getUserWatchedIds(userId),
    getUserDismissedIds(userId),
    getUserWatchedAnimeTitles(userId),
  ]);
  const watched = mergeWatchedIds(watchedIds, dismissedIds);

  // Determine which genres to use — prefer user-selected filter, fall back to user's top genre.
  // Only an explicit selection is a hard constraint; the top-genre fallback is a quality seed,
  // so verticals it doesn't map to still get queried unfiltered.
  const genreFilterActive = filters.genre !== undefined && filters.genre.length > 0;
  const genres = genreFilterActive
    ? (filters.genre ?? [])
    : await getUserTopGenre(userId).then((g) => (g === undefined ? [] : [g]));
  const dateRanges =
    filters.decade !== undefined && filters.decade.length > 0
      ? filters.decade.map((d) => decadeToDateRange(d)).filter((r): r is DecadeRange => r !== null)
      : [];
  const mediaTypes =
    filters.mediaType !== undefined && filters.mediaType.length > 0
      ? filters.mediaType
      : (["movie", "tv", "anime"] as const);

  const results: RecommendationItem[] = [];

  const options: DiscoverOptions = { genres, genreFilterActive, dateRanges, watched, animeTitles };

  for (const type of mediaTypes) {
    switch (type) {
      case "movie": {
        results.push(...(await discoverFilteredMovies(options)));
        break;
      }
      case "tv": {
        results.push(...(await discoverFilteredTv(options)));
        break;
      }
      case "anime": {
        results.push(...(await discoverFilteredAnime(options)));
        break;
      }
    }
  }

  // Jitter + score-weighted sample: the pool now reaches deep pages, so bias
  // the final pick toward higher-rated titles instead of sampling uniformly.
  const jittered = addScoreJitter(results);
  return weightedSampleByScore(jittered, limit);
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
  genres: string[];
  /** True when the genres came from an explicit user filter, not the top-genre seed. */
  genreFilterActive: boolean;
  dateRanges: DecadeRange[];
  watched: WatchedIds;
  animeTitles: Set<string>;
}

function genreLabel(genres: string[]): string {
  if (genres.length === 0) return "";
  if (genres.length === 1) return genres[0] ?? "";
  return `${genres.slice(0, -1).join(", ")} & ${genres.at(-1) ?? ""}`;
}

interface FetchPagesOptions {
  baseParams: Record<string, string>;
  dateRange: DecadeRange | null;
  watched: WatchedIds;
  animeTitles: Set<string>;
  seen: Set<number>;
  label: string;
}

/** Anchor-fetch window: the genre's headline pages. */
const ANCHOR_PAGE_WINDOW = 5;
/** Explorer-fetch cap: ~top 500 titles at 20/page. The rating floor keeps the
 * deep tail watchable; narrow filters self-limit via their real total_pages. */
const DEEP_PAGE_CAP = 25;

/**
 * Fetch 2 pages for a single date range: an anchor page from the top of the
 * ordering, then an explorer page drawn from the catalog's real depth
 * (min(total_pages, cap)) so broad filters don't recycle the same top titles.
 */
async function fetchMoviePages(options: FetchPagesOptions): Promise<RecommendationItem[]> {
  const { baseParams, dateRange, watched, animeTitles, seen, label } = options;
  const params: Record<string, string> = { ...baseParams };
  if (dateRange !== null) {
    params["primary_release_date.gte"] = dateRange.gte;
    params["primary_release_date.lte"] = dateRange.lte;
  }
  const results: RecommendationItem[] = [];
  const collect = (items: TmdbMovieSearchResult[]) => {
    for (const item of items) {
      if (seen.has(item.id) || isAlreadyWatched(watched, { tmdbId: item.id })) continue;
      if (isWatchedAnimeTitle(item.title, animeTitles)) continue;
      seen.add(item.id);
      results.push(parseMovieToItem(item, label));
    }
  };

  const anchorPage = randomPage(ANCHOR_PAGE_WINDOW);
  const anchor = await discoverMovies({ ...params, page: anchorPage });
  collect(anchor.results);

  const deepPage = randomPage(Math.min(Math.max(anchor.total_pages, 1), DEEP_PAGE_CAP));
  if (deepPage !== anchorPage) {
    const deep = await discoverMovies({ ...params, page: deepPage });
    collect(deep.results);
  }
  return results;
}

async function discoverFilteredMovies(options: DiscoverOptions): Promise<RecommendationItem[]> {
  const { genres, genreFilterActive, dateRanges, watched, animeTitles } = options;
  const baseParams: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_count.gte": "100",
    "vote_average.gte": "6.5",
  };

  const mappedGenres = genres.filter((g) => getMovieGenreId(g) !== null);
  const genreIds = mappedGenres
    .map((g) => getMovieGenreId(g))
    .filter((id): id is number => id !== null);
  // A selected genre that maps to nothing for this vertical (e.g. a MAL-only genre)
  // means no movie can match — skip instead of returning unfiltered top titles.
  if (genreFilterActive && genreIds.length === 0) return [];
  if (genreIds.length > 0) {
    baseParams.with_genres = genreIds.join("|");
  }

  // Label with the genres that actually constrained this vertical's query.
  const label = genreLabel(mappedGenres);
  const rangesToQuery = dateRanges.length > 0 ? dateRanges : [null];
  const seen = new Set<number>();
  const results: RecommendationItem[] = [];

  try {
    for (const dateRange of rangesToQuery) {
      results.push(
        ...(await fetchMoviePages({ baseParams, dateRange, watched, animeTitles, seen, label })),
      );
    }
    return results;
  } catch {
    return [];
  }
}

/** Anchor + explorer paging for TV — see fetchMoviePages. */
async function fetchTvPages(options: FetchPagesOptions): Promise<RecommendationItem[]> {
  const { baseParams, dateRange, watched, animeTitles, seen, label } = options;
  const params: Record<string, string> = { ...baseParams };
  if (dateRange !== null) {
    params["first_air_date.gte"] = dateRange.gte;
    params["first_air_date.lte"] = dateRange.lte;
  }
  const results: RecommendationItem[] = [];
  const collect = (items: TmdbTvSearchResult[]) => {
    for (const item of items) {
      if (seen.has(item.id) || isAlreadyWatched(watched, { tmdbId: item.id })) continue;
      if (isWatchedAnimeTitle(item.name, animeTitles)) continue;
      seen.add(item.id);
      results.push(parseTvToItem(item, label));
    }
  };

  const anchorPage = randomPage(ANCHOR_PAGE_WINDOW);
  const anchor = await discoverTv({ ...params, page: anchorPage });
  collect(anchor.results);

  const deepPage = randomPage(Math.min(Math.max(anchor.total_pages, 1), DEEP_PAGE_CAP));
  if (deepPage !== anchorPage) {
    const deep = await discoverTv({ ...params, page: deepPage });
    collect(deep.results);
  }
  return results;
}

async function discoverFilteredTv(options: DiscoverOptions): Promise<RecommendationItem[]> {
  const { genres, genreFilterActive, dateRanges, watched, animeTitles } = options;
  const baseParams: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_count.gte": "100",
    "vote_average.gte": "6.5",
  };

  const mappedGenres = genres.filter((g) => getTvGenreId(g) !== null);
  const genreIds = mappedGenres
    .map((g) => getTvGenreId(g))
    .filter((id): id is number => id !== null);
  if (genreFilterActive && genreIds.length === 0) return [];
  if (genreIds.length > 0) {
    baseParams.with_genres = genreIds.join("|");
  }

  const label = genreLabel(mappedGenres);
  const rangesToQuery = dateRanges.length > 0 ? dateRanges : [null];
  const seen = new Set<number>();
  const results: RecommendationItem[] = [];

  try {
    for (const dateRange of rangesToQuery) {
      results.push(
        ...(await fetchTvPages({ baseParams, dateRange, watched, animeTitles, seen, label })),
      );
    }
    return results;
  } catch {
    return [];
  }
}

interface FetchAnimeOptions {
  baseParams: Record<string, string>;
  dateRange: DecadeRange | null;
  watched: WatchedIds;
  seen: Set<number>;
  label: string;
}

async function fetchAnimeResults(options: FetchAnimeOptions): Promise<RecommendationItem[]> {
  const { baseParams, dateRange, watched, seen, label } = options;
  const params: Record<string, string> = { ...baseParams, page: randomPage(5) };
  if (dateRange !== null) {
    params.start_date = dateRange.gte;
    params.end_date = dateRange.lte;
  }
  const response = await discoverAnime(params);
  const results: RecommendationItem[] = [];
  for (const anime of response.data) {
    if (seen.has(anime.mal_id) || isAlreadyWatched(watched, { malId: anime.mal_id })) continue;
    seen.add(anime.mal_id);
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
          detail: label.length === 0 ? "Highly rated anime" : `Top ${label} anime`,
        },
      ],
    });
  }
  return results;
}

async function discoverFilteredAnime(options: DiscoverOptions): Promise<RecommendationItem[]> {
  const { genres, genreFilterActive, dateRanges, watched } = options;
  const baseParams: Record<string, string> = {
    order_by: "score",
    sort: "desc",
    min_score: "7",
  };

  const mappedGenres = genres.filter((g) => getMalGenreId(g) !== null);
  const genreIds = mappedGenres
    .map((g) => getMalGenreId(g))
    .filter((id): id is number => id !== null);
  if (genreFilterActive && genreIds.length === 0) return [];

  // Jikan doesn't support OR for genres natively — query each genre separately and merge
  const genreQueries =
    genreIds.length > 1 ? genreIds.map(String) : [genreIds.length === 1 ? String(genreIds[0]) : ""];

  const label = genreLabel(mappedGenres);
  const rangesToQuery = dateRanges.length > 0 ? dateRanges : [null];
  const seen = new Set<number>();
  const results: RecommendationItem[] = [];

  try {
    for (const genreId of genreQueries) {
      const genreParams = { ...baseParams };
      if (genreId.length > 0) {
        genreParams.genres = genreId;
      }
      for (const dateRange of rangesToQuery) {
        results.push(
          ...(await fetchAnimeResults({
            baseParams: genreParams,
            dateRange,
            watched,
            seen,
            label,
          })),
        );
      }
    }
    return results;
  } catch {
    return [];
  }
}

function parseMovieToItem(item: TmdbMovieSearchResult, label: string): RecommendationItem {
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
        detail: label.length === 0 ? "Highly rated movie" : `Top ${label} movies`,
      },
    ],
  };
}

function parseTvToItem(item: TmdbTvSearchResult, label: string): RecommendationItem {
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
        detail: label.length === 0 ? "Highly rated TV show" : `Top ${label} TV shows`,
      },
    ],
  };
}
