/**
 * Internal types for the prediction engine.
 */

import type { MediaType } from "@/lib/db/types";

/** Resolved metadata about the target media, whether from DB or external API */
export interface ResolvedMedia {
  mediaId: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string | null;
  mediaType: MediaType;
  releaseYear: number | null;
  genres: string[];
  directors: string[];
  overview: string | null;
  runtimeMinutes: number | null;
  episodeCount: number | null;
  voteAverage: number | null;
  trailerUrl: string | null;
}

/** Individual signal computation result */
export interface SignalResult {
  score: number | null;
  weight: number;
  detail: string;
}

/** Aggregated user preference data for signal computations */
export interface AffinityEntry {
  avg: number;
  count: number;
}

export interface UserAffinityData {
  genreScores: Map<string, AffinityEntry>;
  directorScores: Map<string, AffinityEntry>;
  decadeScores: Map<number, AffinityEntry>;
  formatScores: Map<MediaType, AffinityEntry>;
  runtimeBucketScores: Map<string, AffinityEntry>;
  overallAvg: number;
  ratingCount: number;
}
