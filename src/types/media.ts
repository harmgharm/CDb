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
