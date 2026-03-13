/**
 * Client hooks for the prediction feature.
 *
 * usePrediction — one-shot action for single title predictions
 * useWatchlistPredictions — batch predictions for watchlist items
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type {
  BatchPredictionItem,
  PredictionResult,
  PredictionSummary,
} from "@/types/prediction-responses";
import type { WatchlistItem } from "@/types/watchlist-responses";

interface PredictionInput {
  mediaId?: string;
  tmdbId?: number;
  malId?: number;
  mediaType: "movie" | "tv" | "anime";
}

interface PredictionApiData {
  prediction: PredictionResult;
}

export function usePrediction() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const predict = useCallback(async (input: PredictionInput): Promise<PredictionResult | null> => {
    setIsPredicting(true);
    setPredictionError(null);

    try {
      const response = await fetchWithAuth("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = (await response.json()) as ApiResponse<PredictionApiData>;

      if (json.error !== null) {
        setPredictionError(json.error);
        return null;
      }

      const prediction = json.data.prediction;
      setResult(prediction);
      return prediction;
    } catch {
      setPredictionError("Prediction failed. Please try again.");
      return null;
    } finally {
      setIsPredicting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setPredictionError(null);
  }, []);

  return { result, isPredicting, predictionError, predict, reset };
}

// ============================================
// Batch predictions for watchlist items
// ============================================

interface BatchApiData {
  predictions: BatchPredictionItem[];
}

/**
 * Fetch predicted scores for a list of watchlist items.
 * Loads predictions in a single batch request when items change.
 * Only fetches on the user's own profile (isOwnProfile).
 */
export function useWatchlistPredictions(items: WatchlistItem[] | undefined, isOwnProfile: boolean) {
  const [predictions, setPredictions] = useState<Map<string, PredictionSummary>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Stable key based on item IDs to avoid re-fetching when data doesn't change
  const itemKey = useMemo(() => {
    if (items === undefined || items.length === 0) return "";
    return items.map((item) => item.id).join(",");
  }, [items]);

  useEffect(() => {
    if (!isOwnProfile || items === undefined || items.length === 0) {
      setPredictions(new Map());
      return;
    }

    const state = { cancelled: false };
    setIsLoading(true);

    const batchItems = items.map((item) => ({
      key: item.id,
      mediaId: item.media_id ?? undefined,
      tmdbId: item.tmdb_id ?? undefined,
      malId: item.mal_id ?? undefined,
      mediaType: item.media_type,
    }));

    void (async () => {
      try {
        const response = await fetchWithAuth("/api/predictions/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batchItems }),
        });

        const json = (await response.json()) as ApiResponse<BatchApiData>;

        if (state.cancelled) return;

        if (json.error === null) {
          const map = new Map<string, PredictionSummary>();
          for (const entry of json.data.predictions) {
            if (entry.prediction !== null) {
              map.set(entry.key, entry.prediction);
            }
          }
          setPredictions(map);
        }
      } catch {
        // Silently fail — predictions are supplementary
      } finally {
        if (!state.cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      state.cancelled = true;
    };
  }, [itemKey, isOwnProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  return { predictions, isLoading };
}
