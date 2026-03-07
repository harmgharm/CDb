"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

import type { ApiResponse } from "@/lib/api/response";
import type { RecommendationType } from "@/lib/db/types";
import type { RecommendationsResponse } from "@/types/recommendation-responses";

interface RecommendationQueryParams {
  type?: RecommendationType;
  limit?: number;
}

function buildRecommendationKey(params: RecommendationQueryParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs.length > 0 ? `/api/recommendations?${qs}` : "/api/recommendations";
}

export function useRecommendations(params: RecommendationQueryParams = {}) {
  return useSWR<RecommendationsResponse>(buildRecommendationKey(params));
}

export function useRecommendationsByType(type: RecommendationType) {
  return useSWR<RecommendationsResponse>(`/api/recommendations?type=${type}`);
}

export function useRefreshRecommendations() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (type?: RecommendationType): Promise<boolean> => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ refresh: "true" });
      if (type !== undefined) {
        params.set("type", type);
      }
      const response = await fetch(`/api/recommendations?${params.toString()}`);
      const json = (await response.json()) as ApiResponse<RecommendationsResponse>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { refresh, isRefreshing };
}
