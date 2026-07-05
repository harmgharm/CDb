/**
 * TMDB/Jikan API-Based Recommendations
 *
 * Aggregates recommendation results from TMDB and Jikan for the user's
 * top-rated media. Caches raw API responses in tmdb_recommendation_cache.
 */

import { sql } from "kysely";

import { getAnimeRecommendations } from "@/lib/api/jikan";
import { getMovieRecommendations, getTvRecommendations, tmdbImageUrl } from "@/lib/api/tmdb";
import { mapMovieGenreIds, mapTvGenreIds } from "@/lib/api/tmdb-genres";
import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";
import type { JikanRecommendationEntry } from "@/types/jikan";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

import { hydrateAnimeItems } from "./anime-hydrate";
import { getUserDismissedIds } from "./dismissed";
import { addScoreJitter, randomSample } from "./random";
import { cacheRecommendations, getCachedRecommendations } from "./rec-source-cache";
import type { RecommendationItem } from "./types";
import { sliceWithTypeDepth } from "./types";
import {
  getUserWatchedAnimeTitles,
  getUserWatchedIds,
  isAlreadyWatched,
  isWatchedAnimeTitle,
  mergeWatchedIds,
} from "./watched";

interface RatedMediaSource {
  mediaId: string;
  title: string;
  type: MediaType;
  tmdbId: number | null;
  malId: number | null;
  userScore: number;
}

/**
 * Compute TMDB/Jikan-based recommendations from user's top-rated media.
 * Max 5 external API calls on cold cache. Zero on warm cache.
 */
export async function computeTmdbRecommendations(
  userId: string,
  limit = 60,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  // 1. Get user's top rated media per type (score >= 7.5, widened from 8.0)
  // Fetch a wider pool for random source selection
  const topRated = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select([
      "media.id as media_id",
      "media.title",
      "media.type",
      "media.tmdb_id",
      "media.mal_id",
      "ratings.score",
    ])
    .where("ratings.user_id", "=", userId)
    .where(sql`ratings.score`, ">=", sql`7.5`)
    .orderBy("ratings.score", "desc")
    .limit(30)
    .execute();

  if (topRated.length === 0) return [];

  // Group by type, then randomly select 3–5 sources per type for variety
  const sourcesByType = new Map<string, RatedMediaSource[]>();
  for (const row of topRated) {
    const group = sourcesByType.get(row.type) ?? [];
    group.push({
      mediaId: row.media_id,
      title: row.title,
      type: row.type,
      tmdbId: row.tmdb_id,
      malId: row.mal_id,
      userScore: Number(row.score),
    });
    sourcesByType.set(row.type, group);
  }

  const sources: RatedMediaSource[] = [];
  for (const group of sourcesByType.values()) {
    sources.push(...randomSample(group, 5));
  }

  // 2. Fetch recommendations for each source (with caching)
  const [watchedIds, dismissedIds, animeTitles] = await Promise.all([
    getUserWatchedIds(userId),
    getUserDismissedIds(userId),
    getUserWatchedAnimeTitles(userId),
  ]);
  const watched = mergeWatchedIds(watchedIds, dismissedIds);
  const allResults: { source: RatedMediaSource; items: RecommendationItem[] }[] = [];

  for (const source of sources) {
    const items = await fetchRecommendationsForSource(source, forceRefresh);
    allResults.push({ source, items });
  }

  // 3. Merge, score, jitter, sample, and ensure type depth
  const merged = mergeAndScore(allResults, watched, animeTitles);
  const jittered = addScoreJitter(merged);
  const pool = randomSample(jittered, Math.max(limit, 100));
  const sliced = sliceWithTypeDepth(pool, limit);

  // Jikan's recommendations endpoint returns bare entries; fill in genres,
  // year, and score for the anime that made the final cut.
  return hydrateAnimeItems(sliced);
}

async function fetchRecommendationsForSource(
  source: RatedMediaSource,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  if (source.type === "anime" && source.malId !== null) {
    return fetchAnimeRecommendations(source, source.malId, forceRefresh);
  }
  if (source.tmdbId !== null) {
    return source.type === "movie"
      ? fetchMovieRecommendations(source, source.tmdbId, forceRefresh)
      : fetchTvRecommendations(source, source.tmdbId, forceRefresh);
  }
  return [];
}

async function fetchMovieRecommendations(
  source: RatedMediaSource,
  tmdbId: number,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  if (!forceRefresh) {
    const cached = await getCachedRecommendations("movie", tmdbId, null);
    if (cached !== null) {
      return (cached as TmdbMovieSearchResult[]).map((item) => movieResultToItem(item, source));
    }
  }

  try {
    const response = await getMovieRecommendations(tmdbId);
    await cacheRecommendations({
      sourceType: "movie",
      tmdbId,
      malId: null,
      recommendations: response.results,
    });
    return response.results.map((item) => movieResultToItem(item, source));
  } catch {
    return [];
  }
}

async function fetchTvRecommendations(
  source: RatedMediaSource,
  tmdbId: number,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  if (!forceRefresh) {
    const cached = await getCachedRecommendations("tv", tmdbId, null);
    if (cached !== null) {
      return (cached as TmdbTvSearchResult[]).map((item) => tvResultToItem(item, source));
    }
  }

  try {
    const response = await getTvRecommendations(tmdbId);
    await cacheRecommendations({
      sourceType: "tv",
      tmdbId,
      malId: null,
      recommendations: response.results,
    });
    return response.results.map((item) => tvResultToItem(item, source));
  } catch {
    return [];
  }
}

async function fetchAnimeRecommendations(
  source: RatedMediaSource,
  malId: number,
  forceRefresh = false,
): Promise<RecommendationItem[]> {
  if (!forceRefresh) {
    const cached = await getCachedRecommendations("anime", null, malId);
    if (cached !== null) {
      return (cached as JikanRecommendationEntry[]).map((item) => animeResultToItem(item, source));
    }
  }

  try {
    const response = await getAnimeRecommendations(malId);
    await cacheRecommendations({
      sourceType: "anime",
      tmdbId: null,
      malId,
      recommendations: response.data,
    });
    return response.data.map((item) => animeResultToItem(item, source));
  } catch {
    return [];
  }
}

// ── Result parsers ───────────────────────────────────────────────────

function movieResultToItem(
  item: TmdbMovieSearchResult,
  source: RatedMediaSource,
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
    score: 0, // Will be computed in mergeAndScore
    recType: "tmdb",
    reasons: [
      {
        tag: "TMDB suggests",
        detail: `Because you loved ${source.title} (${String(source.userScore)})`,
      },
    ],
  };
}

function tvResultToItem(item: TmdbTvSearchResult, source: RatedMediaSource): RecommendationItem {
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
    reasons: [
      {
        tag: "TMDB suggests",
        detail: `Because you loved ${source.title} (${String(source.userScore)})`,
      },
    ],
  };
}

function animeResultToItem(
  item: JikanRecommendationEntry,
  source: RatedMediaSource,
): RecommendationItem {
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
    reasons: [
      {
        tag: "MAL suggests",
        detail: `Because you loved ${source.title} (${String(source.userScore)})`,
      },
    ],
  };
}

// ── Merge and scoring ────────────────────────────────────────────────

function getItemKey(item: RecommendationItem): string {
  return item.tmdbId === null ? `mal-${String(item.malId)}` : `tmdb-${String(item.tmdbId)}`;
}

function collectUnwatchedItems(
  allResults: { source: RatedMediaSource; items: RecommendationItem[] }[],
  watched: { tmdbIds: Set<number>; malIds: Set<number>; mediaIds: Set<string> },
  animeTitles: Set<string>,
): { frequencyMap: Map<string, number>; bestItems: Map<string, RecommendationItem> } {
  const frequencyMap = new Map<string, number>();
  const bestItems = new Map<string, RecommendationItem>();

  for (const { source, items } of allResults) {
    for (const item of items) {
      if (isAlreadyWatched(watched, item)) continue;
      if (item.mediaType !== "anime" && isWatchedAnimeTitle(item.title, animeTitles)) continue;

      const key = getItemKey(item);
      frequencyMap.set(key, (frequencyMap.get(key) ?? 0) + 1);

      const existing = bestItems.get(key);
      if (existing === undefined) {
        bestItems.set(key, { ...item });
      } else {
        existing.reasons = [
          ...existing.reasons,
          {
            tag: item.reasons[0]?.tag ?? "Suggested",
            detail: `Because you loved ${source.title} (${String(source.userScore)})`,
          },
        ];
      }
    }
  }

  return { frequencyMap, bestItems };
}

function findMaxSourceScore(
  allResults: { source: RatedMediaSource; items: RecommendationItem[] }[],
  key: string,
): number {
  let maxScore = 0;
  for (const { source, items } of allResults) {
    const hasMatch = items.some((rec) => getItemKey(rec) === key);
    if (hasMatch && source.userScore > maxScore) {
      maxScore = source.userScore;
    }
  }
  return maxScore;
}

function mergeAndScore(
  allResults: { source: RatedMediaSource; items: RecommendationItem[] }[],
  watched: { tmdbIds: Set<number>; malIds: Set<number>; mediaIds: Set<string> },
  animeTitles: Set<string>,
): RecommendationItem[] {
  const { frequencyMap, bestItems } = collectUnwatchedItems(allResults, watched, animeTitles);
  const maxFrequency = Math.max(1, ...frequencyMap.values());

  for (const [key, item] of bestItems) {
    const frequency = frequencyMap.get(key) ?? 1;
    const sourceScore = findMaxSourceScore(allResults, key);

    const normalizedSourceScore = sourceScore / 10;
    const normalizedVote = (item.voteAverage ?? 0) / 10;
    const normalizedFrequency = frequency / maxFrequency;

    item.score =
      Math.round(
        (0.5 * normalizedSourceScore + 0.3 * normalizedVote + 0.2 * normalizedFrequency) * 1000,
      ) / 1000;
  }

  return [...bestItems.values()].toSorted((a, b) => b.score - a.score);
}
