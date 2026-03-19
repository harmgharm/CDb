/**
 * Typed interfaces for per-game round data, guess data, and result data.
 *
 * These are the shapes stored in JSONB columns (round_data, guess_data)
 * and returned in API response resultData fields. Each game engine casts
 * Record<string, unknown> to/from these at the boundary.
 */

// ── Poster Reveal ─────────────────────────────────────────────────

export interface PosterRevealRoundData {
  posterUrl: string;
  title: string;
  mediaId: string | null;
  tmdbId: number | null;
  malId: number | null;
}

export interface PosterRevealResultData {
  correctTitle: string;
  correctPosterUrl: string;
}

// ── Rating Guess ─────────────────────────────────────────────────

export interface RatingGuessRoundData {
  mediaId: string | null;
  title: string;
  posterUrl: string;
  correctRating: number;
  ratingCount: number;
  tmdbId: number | null;
  malId: number | null;
}

export interface RatingGuessResultData {
  correctRating: number;
  guessedRating: number;
  difference: number;
}

export interface RatingGuessGuessData {
  guessedRating: number;
}
