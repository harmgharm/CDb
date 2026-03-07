/**
 * Shared types for the recommendation engine
 */

import type { MediaType, RecommendationType } from "@/lib/db/types";

export interface RecommendationReason {
  tag: string;
  detail: string;
}

export interface RecommendationItem {
  /** Internal DB media ID (if already imported) */
  mediaId: string | null;
  /** TMDB ID for movies/TV (if external) */
  tmdbId: number | null;
  /** MAL ID for anime (if external) */
  malId: number | null;
  /** Display fields */
  title: string;
  posterUrl: string | null;
  mediaType: MediaType;
  overview: string | null;
  releaseYear: number | null;
  voteAverage: number | null;
  /** Normalized 0–1 recommendation score */
  score: number;
  /** Which algorithm produced this recommendation */
  recType: RecommendationType;
  /** Human-readable explanations for why this was recommended */
  reasons: RecommendationReason[];
  /** User's watchlist entry ID (if already on their watchlist) */
  watchlistEntryId?: string;
  /** Number of group members who have this on their watchlist */
  watchlistCount?: number;
}

/** Threshold: users need this many ratings for personalized recs */
export const MIN_RATINGS_FOR_PERSONALIZED = 5;

/** Watched IDs collected from the database for exclusion filtering */
export interface WatchedIds {
  tmdbIds: Set<number>;
  malIds: Set<number>;
  mediaIds: Set<string>;
}

/**
 * Slice items with type-depth guarantee.
 * Ensures up to `perType` items of each media type survive the limit,
 * so client-side type filtering finds enough results.
 */
export function sliceWithTypeDepth(
  items: RecommendationItem[],
  limit: number,
  perType = 20,
): RecommendationItem[] {
  const byType = new Map<string, RecommendationItem[]>();

  for (const item of items) {
    const group = byType.get(item.mediaType) ?? [];
    group.push(item);
    byType.set(item.mediaType, group);
  }

  const result: RecommendationItem[] = [];

  for (const group of byType.values()) {
    const sorted = group.toSorted((a, b) => b.score - a.score);
    result.push(...sorted.slice(0, perType));
  }

  return result.toSorted((a, b) => b.score - a.score).slice(0, limit);
}
