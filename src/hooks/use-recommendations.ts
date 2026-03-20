"use client";

import { useCallback, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { RecommendationType } from "@/lib/db/types";
import type {
  DismissedRecommendationsResponse,
  RecommendationsResponse,
} from "@/types/recommendation-responses";

interface RecommendationQueryParams {
  type?: RecommendationType;
  limit?: number;
  mediaType?: string[];
  genre?: string[];
  decade?: string[];
}

function buildRecommendationKey(params: RecommendationQueryParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) searchParams.set(key, value.join(","));
    } else if (String(value).length > 0) {
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

/**
 * Fetch filtered recommendations server-side.
 * Returns null key (disabled SWR) when no filters are active.
 */
export function useFilteredRecommendations(filters: {
  mediaType?: string[];
  genre?: string[];
  decade?: string[];
}) {
  const hasFilters =
    (filters.mediaType !== undefined && filters.mediaType.length > 0) ||
    (filters.genre !== undefined && filters.genre.length > 0) ||
    (filters.decade !== undefined && filters.decade.length > 0);

  const key = hasFilters ? buildRecommendationKey(filters) : null;
  return useSWR<RecommendationsResponse>(key);
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
      const response = await fetchWithAuth(`/api/recommendations?${params.toString()}`);
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

const DISMISSALS_KEY = "/api/recommendations/dismissals";

export function useDismissedRecommendations() {
  return useSWR<DismissedRecommendationsResponse>(DISMISSALS_KEY);
}

export function useDismissRecommendation() {
  const [isDismissing, setIsDismissing] = useState(false);
  const { mutate } = useSWRConfig();

  const dismiss = useCallback(
    async (body: {
      mediaId?: string;
      tmdbId?: number;
      malId?: number;
      extTitle?: string;
      extPosterUrl?: string | null;
      extMediaType?: string;
    }): Promise<boolean> => {
      setIsDismissing(true);
      try {
        const response = await fetchWithAuth(DISMISSALS_KEY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          void mutate(DISMISSALS_KEY);
          void mutate(
            (key: unknown) => typeof key === "string" && key.startsWith("/api/recommendations"),
          );
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsDismissing(false);
      }
    },
    [mutate],
  );

  return { dismiss, isDismissing };
}

export function useUndismissRecommendation() {
  const [isUndismissing, setIsUndismissing] = useState(false);
  const { mutate } = useSWRConfig();

  const undismiss = useCallback(
    async (id: string): Promise<boolean> => {
      setIsUndismissing(true);
      try {
        const response = await fetchWithAuth(`${DISMISSALS_KEY}/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          void mutate(DISMISSALS_KEY);
          void mutate(
            (key: unknown) => typeof key === "string" && key.startsWith("/api/recommendations"),
          );
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsUndismissing(false);
      }
    },
    [mutate],
  );

  return { undismiss, isUndismissing };
}

export function useRefreshSection(type: RecommendationType) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { mutate } = useSWRConfig();

  const refresh = useCallback(async (): Promise<boolean> => {
    setIsRefreshing(true);
    try {
      const response = await fetchWithAuth(`/api/recommendations?type=${type}&refresh=true`);
      const json = (await response.json()) as ApiResponse<RecommendationsResponse>;
      if (json.error === null) {
        void mutate(`/api/recommendations?type=${type}`);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [type, mutate]);

  return { refresh, isRefreshing };
}
