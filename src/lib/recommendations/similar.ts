/**
 * Find Similar — recommendation engine
 *
 * Given 1-5 user-selected source titles, fetches similar/recommended titles
 * from TMDB (both /similar and /recommendations) and Jikan (/recommendations),
 * then merges, deduplicates, scores, and filters results.
 */

import { getAnimeRecommendations } from "@/lib/api/jikan";
import {
  getMovieRecommendations,
  getMovieSimilar,
  getTvRecommendations,
  getTvSimilar,
  tmdbImageUrl,
} from "@/lib/api/tmdb";
import { mapMovieGenreIds, mapTvGenreIds } from "@/lib/api/tmdb-genres";
import type { SimilarSource } from "@/lib/validations/recommendations/similar.schema";
import type { JikanRecommendationEntry } from "@/types/jikan";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

import { getUserDismissedIds } from "./dismissed";
import { addScoreJitter, randomPage, randomSample } from "./random";
import { cacheRecommendations, getCachedRecommendations } from "./tmdb-recs";
import type { RecommendationItem, WatchedIds } from "./types";
import { sliceWithTypeDepth } from "./types";
import {
  getUserWatchedAnimeTitles,
  getUserWatchedIds,
  isAlreadyWatched,
  isWatchedAnimeTitle,
  mergeWatchedIds,
} from "./watched";

/** A fetched result set tagged with its source title and endpoint origin */
interface SourceResult {
  sourceTitle: string;
  /** "similar" for /similar endpoint, "recs" for /recommendations */
  endpoint: "similar" | "recs";
  items: RecommendationItem[];
}

/**
 * Compute recommendations similar to user-selected source titles.
 * Uses both TMDB /similar and /recommendations endpoints for movies/TV,
 * and Jikan /recommendations for anime.
 */
export async function computeSimilarRecommendations(
  userId: string,
  sources: SimilarSource[],
  limit = 20,
): Promise<RecommendationItem[]> {
  const [watchedIds, dismissedIds, animeTitles] = await Promise.all([
    getUserWatchedIds(userId),
    getUserDismissedIds(userId),
    getUserWatchedAnimeTitles(userId),
  ]);
  const watched = mergeWatchedIds(watchedIds, dismissedIds);

  // Fetch results from all sources in parallel
  const resultPromises: Promise<SourceResult[]>[] = sources.map((source) => fetchForSource(source));
  const nestedResults = await Promise.all(resultPromises);
  const allResults = nestedResults.flat();

  // Build source ID set to filter out source titles from results
  const sourceIds = buildSourceIdSet(sources);

  // Merge, score, filter, and sample
  const merged = mergeAndScore({ allResults, watched, sourceIds, animeTitles });
  const jittered = addScoreJitter(merged);
  const pool = randomSample(jittered, Math.max(limit, 60));
  return sliceWithTypeDepth(pool, limit);
}

/** Build a set of source IDs to exclude source titles from results */
function buildSourceIdSet(sources: SimilarSource[]): { tmdbIds: Set<number>; malIds: Set<number> } {
  const tmdbIds = new Set<number>();
  const malIds = new Set<number>();
  for (const source of sources) {
    if (source.tmdbId !== undefined) tmdbIds.add(source.tmdbId);
    if (source.malId !== undefined) malIds.add(source.malId);
  }
  return { tmdbIds, malIds };
}

/** Fetch similar + recommended titles for a single source */
async function fetchForSource(source: SimilarSource): Promise<SourceResult[]> {
  const results: SourceResult[] = [];

  if (source.mediaType === "anime" && source.malId !== undefined) {
    const animeRecs = await fetchAnimeRecs(source);
    results.push({ sourceTitle: source.title, endpoint: "recs", items: animeRecs });
    return results;
  }

  if (source.tmdbId !== undefined) {
    if (source.mediaType === "movie") {
      const [similar, recs] = await Promise.all([
        fetchMovieSimilar(source.tmdbId, source.title),
        fetchMovieRecs(source.tmdbId, source.title),
      ]);
      results.push(
        { sourceTitle: source.title, endpoint: "similar", items: similar },
        { sourceTitle: source.title, endpoint: "recs", items: recs },
      );
    } else {
      const [similar, recs] = await Promise.all([
        fetchTvSimilar(source.tmdbId, source.title),
        fetchTvRecs(source.tmdbId, source.title),
      ]);
      results.push(
        { sourceTitle: source.title, endpoint: "similar", items: similar },
        { sourceTitle: source.title, endpoint: "recs", items: recs },
      );
    }
  }

  return results;
}

// ── Fetch helpers ──────────────────────────────────────────────────

async function fetchMovieSimilar(
  tmdbId: number,
  sourceTitle: string,
): Promise<RecommendationItem[]> {
  const cached = await getCachedRecommendations("movie-similar", tmdbId, null);
  if (cached !== null) {
    return (cached as TmdbMovieSearchResult[]).map((item) => movieToItem(item, sourceTitle));
  }

  try {
    const page = randomPage(5);
    const response = await getMovieSimilar(tmdbId, Number(page));
    await cacheRecommendations({
      sourceType: "movie-similar",
      tmdbId,
      malId: null,
      recommendations: response.results,
    });
    return response.results.map((item) => movieToItem(item, sourceTitle));
  } catch {
    return [];
  }
}

async function fetchMovieRecs(tmdbId: number, sourceTitle: string): Promise<RecommendationItem[]> {
  const cached = await getCachedRecommendations("movie", tmdbId, null);
  if (cached !== null) {
    return (cached as TmdbMovieSearchResult[]).map((item) => movieToItem(item, sourceTitle));
  }

  try {
    const page = randomPage(5);
    const response = await getMovieRecommendations(tmdbId, Number(page));
    await cacheRecommendations({
      sourceType: "movie",
      tmdbId,
      malId: null,
      recommendations: response.results,
    });
    return response.results.map((item) => movieToItem(item, sourceTitle));
  } catch {
    return [];
  }
}

async function fetchTvSimilar(tmdbId: number, sourceTitle: string): Promise<RecommendationItem[]> {
  const cached = await getCachedRecommendations("tv-similar", tmdbId, null);
  if (cached !== null) {
    return (cached as TmdbTvSearchResult[]).map((item) => tvToItem(item, sourceTitle));
  }

  try {
    const page = randomPage(5);
    const response = await getTvSimilar(tmdbId, Number(page));
    await cacheRecommendations({
      sourceType: "tv-similar",
      tmdbId,
      malId: null,
      recommendations: response.results,
    });
    return response.results.map((item) => tvToItem(item, sourceTitle));
  } catch {
    return [];
  }
}

async function fetchTvRecs(tmdbId: number, sourceTitle: string): Promise<RecommendationItem[]> {
  const cached = await getCachedRecommendations("tv", tmdbId, null);
  if (cached !== null) {
    return (cached as TmdbTvSearchResult[]).map((item) => tvToItem(item, sourceTitle));
  }

  try {
    const page = randomPage(5);
    const response = await getTvRecommendations(tmdbId, Number(page));
    await cacheRecommendations({
      sourceType: "tv",
      tmdbId,
      malId: null,
      recommendations: response.results,
    });
    return response.results.map((item) => tvToItem(item, sourceTitle));
  } catch {
    return [];
  }
}

async function fetchAnimeRecs(source: SimilarSource): Promise<RecommendationItem[]> {
  if (source.malId === undefined) return [];

  const cached = await getCachedRecommendations("anime", null, source.malId);
  if (cached !== null) {
    return (cached as JikanRecommendationEntry[]).map((item) => animeToItem(item, source.title));
  }

  try {
    const response = await getAnimeRecommendations(source.malId);
    await cacheRecommendations({
      sourceType: "anime",
      tmdbId: null,
      malId: source.malId,
      recommendations: response.data,
    });
    return response.data.map((item) => animeToItem(item, source.title));
  } catch {
    return [];
  }
}

// ── Result parsers ─────────────────────────────────────────────────

function movieToItem(item: TmdbMovieSearchResult, sourceTitle: string): RecommendationItem {
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
    recType: "tmdb",
    reasons: [{ tag: "Similar to", detail: sourceTitle }],
  };
}

function tvToItem(item: TmdbTvSearchResult, sourceTitle: string): RecommendationItem {
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
    recType: "tmdb",
    reasons: [{ tag: "Similar to", detail: sourceTitle }],
  };
}

function animeToItem(item: JikanRecommendationEntry, sourceTitle: string): RecommendationItem {
  return {
    mediaId: null,
    tmdbId: null,
    malId: item.entry.mal_id,
    title: item.entry.title,
    posterUrl: item.entry.images.jpg.large_image_url,
    mediaType: "anime",
    overview: null,
    releaseYear: null,
    voteAverage: null,
    genres: [],
    score: 0,
    recType: "jikan",
    reasons: [{ tag: "Similar to", detail: sourceTitle }],
  };
}

// ── Merge and scoring ──────────────────────────────────────────────

function getItemKey(item: RecommendationItem): string {
  return item.tmdbId === null ? `mal-${String(item.malId)}` : `tmdb-${String(item.tmdbId)}`;
}

function isSourceTitle(
  item: RecommendationItem,
  sourceIds: { tmdbIds: Set<number>; malIds: Set<number> },
): boolean {
  if (item.tmdbId !== null && sourceIds.tmdbIds.has(item.tmdbId)) return true;
  if (item.malId !== null && sourceIds.malIds.has(item.malId)) return true;
  return false;
}

interface MergeState {
  bestItems: Map<string, RecommendationItem>;
  sourceFrequency: Map<string, Set<string>>;
  endpointBreadth: Map<string, Set<string>>;
}

/** Merge a single item into the accumulator, tracking frequency and reasons */
function mergeItem(
  state: MergeState,
  context: { item: RecommendationItem; sourceTitle: string; endpoint: string },
): void {
  const { item, sourceTitle, endpoint } = context;
  const key = getItemKey(item);

  // Track which source titles recommend this item
  const sources = state.sourceFrequency.get(key) ?? new Set<string>();
  sources.add(sourceTitle);
  state.sourceFrequency.set(key, sources);

  // Track which endpoints found this item
  const endpoints = state.endpointBreadth.get(key) ?? new Set<string>();
  endpoints.add(`${sourceTitle}-${endpoint}`);
  state.endpointBreadth.set(key, endpoints);

  // Keep or merge item
  const existing = state.bestItems.get(key);
  if (existing === undefined) {
    state.bestItems.set(key, { ...item });
    return;
  }

  // Merge reason tags (deduplicate by detail)
  const existingDetails = new Set(existing.reasons.map((r) => r.detail));
  for (const reason of item.reasons) {
    if (!existingDetails.has(reason.detail)) {
      existing.reasons.push(reason);
    }
  }

  // Keep higher voteAverage
  if (item.voteAverage !== null) {
    existing.voteAverage =
      existing.voteAverage === null
        ? item.voteAverage
        : Math.max(existing.voteAverage, item.voteAverage);
  }
}

/** Assign final scores to all merged items */
function scoreItems(state: MergeState, totalSources: number): void {
  const maxEndpoints = totalSources * 2;

  for (const [key, item] of state.bestItems) {
    const frequency = state.sourceFrequency.get(key)?.size ?? 1;
    const breadth = state.endpointBreadth.get(key)?.size ?? 1;
    const normalizedVote = (item.voteAverage ?? 0) / 10;
    const normalizedFrequency = totalSources > 1 ? frequency / totalSources : 0.5;
    const normalizedBreadth = breadth / Math.max(1, maxEndpoints);

    item.score =
      Math.round(
        (0.4 * normalizedVote + 0.3 * normalizedFrequency + 0.3 * normalizedBreadth) * 1000,
      ) / 1000;
  }
}

/**
 * Merge results from all sources/endpoints, deduplicate, and score.
 *
 * Scoring weights:
 * - 0.4 x normalizedVoteAvg (quality signal)
 * - 0.3 x cross-source frequency (how many input titles recommend this)
 * - 0.3 x endpoint breadth (appears in both /similar and /recommendations)
 */
function mergeAndScore(options: {
  allResults: SourceResult[];
  watched: WatchedIds;
  sourceIds: { tmdbIds: Set<number>; malIds: Set<number> };
  animeTitles: Set<string>;
}): RecommendationItem[] {
  const { allResults, watched, sourceIds, animeTitles } = options;
  const state: MergeState = {
    bestItems: new Map(),
    sourceFrequency: new Map(),
    endpointBreadth: new Map(),
  };

  for (const { sourceTitle, endpoint, items } of allResults) {
    for (const item of items) {
      if (isAlreadyWatched(watched, item)) continue;
      if (isSourceTitle(item, sourceIds)) continue;
      if (item.mediaType !== "anime" && isWatchedAnimeTitle(item.title, animeTitles)) continue;
      mergeItem(state, { item, sourceTitle, endpoint });
    }
  }

  const totalSources = new Set(allResults.map((r) => r.sourceTitle)).size;
  scoreItems(state, totalSources);

  return [...state.bestItems.values()].toSorted((a, b) => b.score - a.score);
}
