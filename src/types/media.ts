/**
 * Normalized media search result type
 *
 * Used as a unified format for search results from TMDB and Jikan.
 */

import type { MediaType } from "@/lib/db/types";

export interface MediaSearchResult {
  externalId: number;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  releaseYear: number | null;
  overview: string | null;
  source: "tmdb" | "jikan";
}
