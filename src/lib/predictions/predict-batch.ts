/**
 * Batch prediction engine for watchlist items.
 *
 * Optimized to load user affinity and collaborative data ONCE,
 * then compute lightweight predictions for multiple items.
 */

import type { PredictionSummary } from "@/types/prediction-responses";

import type { PredictionRequestInput } from "../validations/predictions";
import { resolveMedia } from "./resolve-media";
import {
  computeCollaborativeSignal,
  computeDirectorSignal,
  computeEraSignal,
  computeExternalSignal,
  computeGenreSignal,
  computeGroupSignal,
} from "./signals";
import type { ResolvedMedia, SignalResult } from "./types";
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

function combineSignals(
  signals: Record<string, SignalResult>,
  ratingCount: number,
  overallAvg: number,
): PredictionSummary {
  const available: { weight: number; score: number }[] = [];
  let totalWeight = 0;

  for (const [name, signal] of Object.entries(signals)) {
    if (signal.score !== null) {
      const w = DEFAULT_WEIGHTS[name] ?? 0;
      available.push({ weight: w, score: signal.score });
      totalWeight += w;
    }
  }

  let predictedScore: number;
  if (available.length === 0) {
    predictedScore = ratingCount > 0 ? overallAvg : 5.5;
  } else {
    let weightedSum = 0;
    for (const { weight, score } of available) {
      weightedSum += score * (weight / totalWeight);
    }
    predictedScore = weightedSum;
  }

  predictedScore = Math.round(Math.max(1, Math.min(10, predictedScore)) * 10) / 10;

  return {
    predictedScore,
    confidence: computeConfidence(available.length, ratingCount),
    verdict: computeVerdict(predictedScore),
  };
}

interface BatchItem {
  key: string;
  input: PredictionRequestInput;
}

interface BatchResult {
  key: string;
  prediction: PredictionSummary | null;
}

/**
 * Compute predictions for multiple items efficiently.
 * Loads user affinity once, then iterates items.
 */
export async function predictBatch(userId: string, items: BatchItem[]): Promise<BatchResult[]> {
  // Load user data once
  const affinity = await loadUserAffinity(userId);

  const results: BatchResult[] = [];

  for (const item of items) {
    try {
      const prediction = await predictSingleWithAffinity(userId, item.input, affinity);
      results.push({ key: item.key, prediction });
    } catch {
      results.push({ key: item.key, prediction: null });
    }
  }

  return results;
}

async function predictSingleWithAffinity(
  userId: string,
  input: PredictionRequestInput,
  affinity: Awaited<ReturnType<typeof loadUserAffinity>>,
): Promise<PredictionSummary> {
  const media: ResolvedMedia = await resolveMedia(input);

  // Compute async signals in parallel
  const [collaborativeSignal, groupSignal] = await Promise.all([
    computeCollaborativeSignal(userId, media),
    computeGroupSignal(media),
  ]);

  // Sync signals use pre-loaded affinity
  const genreSignal = computeGenreSignal(affinity, media);
  const directorSignal = computeDirectorSignal(affinity, media);
  const externalSignal = computeExternalSignal(media);
  const eraSignal = computeEraSignal(affinity, media);

  return combineSignals(
    {
      collaborative: collaborativeSignal,
      genre: genreSignal,
      director: directorSignal,
      external: externalSignal,
      group: groupSignal,
      era: eraSignal,
    },
    affinity.ratingCount,
    affinity.overallAvg,
  );
}
