/**
 * Anime item hydration.
 *
 * Jikan's /recommendations endpoint returns bare entries (no genres, year, or
 * score), so "MAL suggests" items land with empty genres — they can never
 * contribute a genre word or match a genre filter, and their cards show no
 * year. This fills those fields from per-anime detail lookups, cached for 7
 * days in the shared source cache under sourceType "anime-full" (10-char
 * column limit).
 *
 * Live fetches per call are capped: Jikan is throttled to ~3 req/sec, so a
 * cold cache with dozens of anime would stall a serverless request. Items
 * beyond the cap stay unhydrated this round and get picked up on a later
 * compute once their details are cached.
 */

import { getAnimeDetails } from "@/lib/api/jikan";
import type { JikanAnime } from "@/types/jikan";

import { cacheRecommendations, getCachedRecommendations } from "./rec-source-cache";
import type { RecommendationItem } from "./types";

const ANIME_DETAILS_SOURCE_TYPE = "anime-full";
const DEFAULT_MAX_LIVE_FETCHES = 10;
/** Wall-clock ceiling for live fetches: a slow-but-healthy Jikan (up to ~4s
 * per call) must not stack its full fetch cap onto a serverless request. */
const LIVE_FETCH_TIME_BUDGET_MS = 5000;

export async function hydrateAnimeItems(
  items: RecommendationItem[],
  maxLiveFetches = DEFAULT_MAX_LIVE_FETCHES,
): Promise<RecommendationItem[]> {
  const startedAt = Date.now();
  let liveFetchesUsed = 0;
  let jikanFailed = false;
  const hydrated: RecommendationItem[] = [];

  for (const item of items) {
    if (item.mediaType !== "anime" || item.malId === null || item.genres.length > 0) {
      hydrated.push(item);
      continue;
    }

    // One failed fetch means Jikan is unhealthy; each further attempt would
    // burn its full timeout, so fall back to cache-only for the rest. The
    // time budget bounds the slow-success case the same way.
    const canFetch =
      !jikanFailed &&
      liveFetchesUsed < maxLiveFetches &&
      Date.now() - startedAt < LIVE_FETCH_TIME_BUDGET_MS;
    const { anime, fetchedLive, failed } = await getAnimeFullDetails(item.malId, canFetch);
    if (fetchedLive) liveFetchesUsed += 1;
    if (failed) jikanFailed = true;

    hydrated.push(anime === null ? item : applyDetails(item, anime));
  }

  return hydrated;
}

async function getAnimeFullDetails(
  malId: number,
  canFetch: boolean,
): Promise<{ anime: JikanAnime | null; fetchedLive: boolean; failed: boolean }> {
  const cached = await getCachedRecommendations(ANIME_DETAILS_SOURCE_TYPE, null, malId);
  const cachedAnime = cached?.[0];
  if (cachedAnime !== undefined) {
    return { anime: cachedAnime as JikanAnime, fetchedLive: false, failed: false };
  }

  if (!canFetch) return { anime: null, fetchedLive: false, failed: false };

  try {
    const response = await getAnimeDetails(malId);
    await cacheRecommendations({
      sourceType: ANIME_DETAILS_SOURCE_TYPE,
      tmdbId: null,
      malId,
      recommendations: [response.data],
    });
    return { anime: response.data, fetchedLive: true, failed: false };
  } catch {
    return { anime: null, fetchedLive: true, failed: true };
  }
}

function applyDetails(item: RecommendationItem, anime: JikanAnime): RecommendationItem {
  const genres = [...anime.genres, ...anime.themes, ...anime.demographics].map((g) => g.name);
  return {
    ...item,
    genres,
    releaseYear: item.releaseYear ?? anime.year,
    voteAverage: item.voteAverage ?? anime.score,
  };
}
