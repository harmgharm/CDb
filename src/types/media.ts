/**
 * Normalized media search result type
 *
 * Used as a unified format for search results from TMDB and Jikan.
 */

import type { MediaType } from "@/lib/db/types";

/** Detail metadata fetched on-demand for the media preview dialog */
export interface MediaPreviewDetail {
  runtime: number | null;
  episodeCount: number | null;
  seasonCount: number | null;
  director: string | null;
  creator: string | null;
  studios: string[];
  status: string | null;
  tagline: string | null;
  trailerUrl: string | null;
}

export interface MediaSearchResult {
  externalId: number;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  releaseYear: number | null;
  overview: string | null;
  source: "tmdb" | "jikan";
  /** Set when this media already exists in the database */
  existingMediaId?: string;
  /** Average rating from TMDB or MAL (0-10 scale) */
  voteAverage?: number | null;
  /** Genre names resolved from TMDB genre IDs or Jikan genre objects */
  genres?: string[];
  /** Episode count (anime from Jikan search, TV/movies from detail fetch) */
  episodeCount?: number | null;
  /** Studio names (anime only, from Jikan search) */
  studios?: string[];
  /** True when a TMDB movie/TV result appears to be anime (Animation genre + Japanese) */
  isPossibleAnime?: boolean;
}

/**
 * Unified search response.
 *
 * `failedSources` lists any external source (TMDB movie/TV, Jikan anime) that
 * errored while the others succeeded. A flaky source no longer fails the whole
 * search — its results are simply absent and it is reported here so the client
 * can decide whether to surface a notice (e.g. when the user filtered to a
 * source that is currently down).
 *
 * `attemptedSources` lists every source the request actually queried (driven by
 * the type filter). The client compares it against `failedSources` to tell a
 * *total outage* (every attempted source down → blocking error) apart from a
 * *partial failure* (one flaky source down → soft notice), which otherwise look
 * identical when a query also happens to have no matches.
 */
export interface MediaSearchResponse {
  results: MediaSearchResult[];
  failedSources: MediaType[];
  attemptedSources: MediaType[];
}
