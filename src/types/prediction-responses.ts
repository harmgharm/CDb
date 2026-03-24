/**
 * Prediction API response types
 */

import type { MediaType } from "@/lib/db/types";

export interface PredictionSignal {
  name: string;
  score: number | null;
  weight: number;
  detail: string;
}

export interface PredictionResult {
  predictedScore: number;
  confidence: "low" | "medium" | "high";
  verdict: string;
  signals: PredictionSignal[];
  groupAverage: number | null;
  groupRatingCount: number;
  title: string;
  posterUrl: string | null;
  mediaType: MediaType;
  releaseYear: number | null;
  genres: string[];
  directors: string[];
  overview: string | null;
  voteAverage: number | null;
  trailerUrl: string | null;
}

export interface PredictionResponse {
  prediction: PredictionResult;
}

/** Lightweight prediction for batch/watchlist use — no full signal breakdown */
export interface PredictionSummary {
  predictedScore: number;
  confidence: "low" | "medium" | "high";
  verdict: string;
}

export interface BatchPredictionItem {
  /** Key to match back to the requesting item (watchlist entry ID, etc.) */
  key: string;
  prediction: PredictionSummary | null;
}

export interface BatchPredictionResponse {
  predictions: BatchPredictionItem[];
}
