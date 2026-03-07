/**
 * Response types for the recommendations API
 */

import type { MediaType, RecommendationType } from "@/lib/db/types";

export interface RecommendationReason {
  tag: string;
  detail: string;
}

export interface RecommendationItem {
  mediaId: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string | null;
  mediaType: MediaType;
  overview: string | null;
  releaseYear: number | null;
  voteAverage: number | null;
  score: number;
  recType: RecommendationType;
  reasons: RecommendationReason[];
  watchlistEntryId?: string;
  watchlistCount?: number;
}

export interface RecommendationsMeta {
  type: RecommendationType | "all";
  computedAt: string;
  isPersonalized: boolean;
  ratingCount: number;
  ratingsNeeded: number;
}

export interface RecommendationsResponse {
  items: RecommendationItem[];
  meta: RecommendationsMeta;
}
