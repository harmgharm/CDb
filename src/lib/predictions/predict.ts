/**
 * Prediction engine — ensemble combiner.
 *
 * Combines six prediction signals into a single predicted score (1-10)
 * with confidence level, verdict, and reasoning breakdown.
 */

import type { PredictionResult, PredictionSignal } from "@/types/prediction-responses";

import type { PredictionRequestInput } from "../validations/predictions";
import { resolveMedia } from "./resolve-media";
import {
  computeCollaborativeSignal,
  computeDirectorSignal,
  computeEraSignal,
  computeExternalSignal,
  computeGenreSignal,
  computeGroupSignal,
  getGroupRatingData,
} from "./signals";
import type { SignalResult } from "./types";
import { loadUserAffinity } from "./user-affinity";

const DEFAULT_WEIGHTS: Record<string, number> = {
  collaborative: 0.3,
  genre: 0.25,
  director: 0.15,
  external: 0.1,
  group: 0.1,
  era: 0.1,
};

function computeConfidence(
  availableSignals: number,
  ratingCount: number,
): "low" | "medium" | "high" {
  if (availableSignals >= 4 && ratingCount >= 10) return "high";
  if (availableSignals >= 2 || ratingCount >= 5) return "medium";
  return "low";
}

function computeVerdict(score: number): string {
  if (score >= 8) return "Highly recommended";
  if (score >= 6.5) return "You'll probably enjoy this";
  if (score >= 5) return "Mixed signals";
  return "Might not be for you";
}

/**
 * Predict a user's rating for a given media title.
 */
export async function predictRating(
  userId: string,
  input: PredictionRequestInput,
): Promise<PredictionResult> {
  // 1. Resolve media metadata
  const media = await resolveMedia(input);

  // 2. Load user affinity data
  const affinity = await loadUserAffinity(userId);

  // 3. Compute all signals
  const [collaborativeSignal, groupSignal, groupRatingData] = await Promise.all([
    computeCollaborativeSignal(userId, media),
    computeGroupSignal(media),
    getGroupRatingData(media),
  ]);

  const genreSignal = computeGenreSignal(affinity, media);
  const directorSignal = computeDirectorSignal(affinity, media);
  const externalSignal = computeExternalSignal(media);
  const eraSignal = computeEraSignal(affinity, media);

  const signalMap: Record<string, SignalResult> = {
    collaborative: collaborativeSignal,
    genre: genreSignal,
    director: directorSignal,
    external: externalSignal,
    group: groupSignal,
    era: eraSignal,
  };

  // 4. Weight redistribution
  const availableSignals: { name: string; signal: SignalResult; defaultWeight: number }[] = [];
  let totalAvailableWeight = 0;

  for (const [name, signal] of Object.entries(signalMap)) {
    if (signal.score !== null) {
      const defaultWeight = DEFAULT_WEIGHTS[name] ?? 0;
      availableSignals.push({ name, signal, defaultWeight });
      totalAvailableWeight += defaultWeight;
    }
  }

  // 5. Compute weighted average
  let predictedScore: number;

  if (availableSignals.length === 0) {
    // No signals at all — fall back to overall average or 5.5
    predictedScore = affinity.ratingCount > 0 ? affinity.overallAvg : 5.5;
  } else {
    let weightedSum = 0;
    for (const { signal, defaultWeight } of availableSignals) {
      // Redistribute: scale each weight so they sum to 1.0
      const effectiveWeight = defaultWeight / totalAvailableWeight;
      signal.weight = Math.round(effectiveWeight * 1000) / 1000;
      weightedSum += (signal.score ?? 0) * effectiveWeight;
    }
    predictedScore = weightedSum;
  }

  // Clamp to 1-10 and round to 1 decimal
  predictedScore = Math.round(Math.max(1, Math.min(10, predictedScore)) * 10) / 10;

  // 6. Build signal breakdown for response
  const signals: PredictionSignal[] = [
    buildSignal("collaborative", signalMap.collaborative),
    buildSignal("genre", signalMap.genre),
    buildSignal("director", signalMap.director),
    buildSignal("external", signalMap.external),
    buildSignal("group", signalMap.group),
    buildSignal("era", signalMap.era),
  ];

  // 7. Confidence and verdict
  const confidence = computeConfidence(availableSignals.length, affinity.ratingCount);
  const verdict = computeVerdict(predictedScore);

  return {
    predictedScore,
    confidence,
    verdict,
    signals,
    groupAverage: groupRatingData.average,
    groupRatingCount: groupRatingData.count,
    title: media.title,
    posterUrl: media.posterUrl,
    mediaType: media.mediaType,
    releaseYear: media.releaseYear,
    genres: media.genres,
    directors: media.directors,
    overview: media.overview,
    voteAverage: media.voteAverage,
  };
}

function buildSignal(name: string, result: SignalResult | undefined): PredictionSignal {
  if (result === undefined) {
    return { name, score: null, weight: 0, detail: "Signal unavailable" };
  }
  return {
    name,
    score: result.score,
    weight: result.weight,
    detail: result.detail,
  };
}
