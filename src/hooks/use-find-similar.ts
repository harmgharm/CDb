/**
 * Client hook for the "Find Similar" feature.
 *
 * One-shot action hook — not SWR-based since the input (arbitrary title
 * combinations) isn't URL-cacheable. Refresh simply re-calls the API
 * with the same sources; the backend uses random page selection to
 * produce different results each time.
 */

import { useCallback, useState } from "react";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type {
  RecommendationItem,
  SimilarRecommendationsResponse,
} from "@/types/recommendation-responses";

export interface SimilarSourceInput {
  tmdbId?: number;
  malId?: number;
  mediaType: "movie" | "tv" | "anime";
  title: string;
}

export function useFindSimilar() {
  const [results, setResults] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findSimilar = useCallback(async (sources: SimilarSourceInput[]): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth("/api/recommendations/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, limit: 20 }),
      });

      const json = (await response.json()) as ApiResponse<SimilarRecommendationsResponse>;

      if (json.error !== null) {
        setError(json.error);
        return false;
      }

      setResults(json.data.items);
      return true;
    } catch {
      setError("Failed to find similar titles. Please try again.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, isLoading, error, findSimilar, reset };
}
