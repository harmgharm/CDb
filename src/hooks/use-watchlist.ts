/**
 * SWR hooks for watchlist data and mutations
 */

import { useCallback, useState } from "react";
import useSWR from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type {
  WatchlistGroupCounts,
  WatchlistItem,
  WatchlistResponse,
} from "@/types/watchlist-responses";

// ============================================
// Read Hooks
// ============================================

interface WatchlistQueryParams {
  userId?: string;
  mediaId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

function buildWatchlistKey(params: WatchlistQueryParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  }
  return `/api/watchlist?${searchParams.toString()}`;
}

export function useWatchlist(params: WatchlistQueryParams) {
  return useSWR<WatchlistResponse>(buildWatchlistKey(params));
}

function buildGroupCountsKey(mediaIds: readonly string[]): string {
  const searchParams = new URLSearchParams();
  for (const id of mediaIds) {
    searchParams.append("mediaIds[]", id);
  }
  return `/api/watchlist/group-counts?${searchParams.toString()}`;
}

export function useWatchlistGroupCounts(mediaIds: readonly string[]) {
  const key = mediaIds.length === 0 ? null : buildGroupCountsKey(mediaIds);
  return useSWR<WatchlistGroupCounts>(key);
}

// ============================================
// Mutation Hooks
// ============================================

interface AddToWatchlistParams {
  readonly mediaId?: string;
  readonly tmdbId?: number;
  readonly malId?: number;
  readonly extTitle?: string;
  readonly extPosterUrl?: string | null;
  readonly extMediaType?: string;
  readonly status?: string;
  readonly notes?: string;
}

export function useAddToWatchlist() {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToWatchlist = useCallback(
    async (params: AddToWatchlistParams): Promise<WatchlistItem | null> => {
      setIsAdding(true);
      setError(null);
      try {
        const response = await fetchWithAuth("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const json = (await response.json()) as ApiResponse<WatchlistItem>;
        if (json.error !== null) {
          setError(json.error);
          return null;
        }
        return json.data;
      } catch {
        setError("Failed to add to watchlist");
        return null;
      } finally {
        setIsAdding(false);
      }
    },
    [],
  );

  return { addToWatchlist, isAdding, error };
}

interface UpdateWatchlistParams {
  readonly status?: string;
  readonly notes?: string | null;
}

export function useUpdateWatchlistEntry() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateEntry = useCallback(
    async (entryId: string, params: UpdateWatchlistParams): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const response = await fetchWithAuth(`/api/watchlist/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const json = (await response.json()) as ApiResponse<unknown>;
        return json.error === null;
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { updateEntry, isUpdating };
}

export function useRemoveFromWatchlist() {
  const [isRemoving, setIsRemoving] = useState(false);

  const removeFromWatchlist = useCallback(async (entryId: string): Promise<boolean> => {
    setIsRemoving(true);
    try {
      const response = await fetchWithAuth(`/api/watchlist/${entryId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsRemoving(false);
    }
  }, []);

  return { removeFromWatchlist, isRemoving };
}
