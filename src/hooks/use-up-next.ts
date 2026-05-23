/**
 * SWR hook backing the sidebar Up Next card.
 *
 * Source order:
 *   1. "in-progress" — top watching entry from the current user's watchlist
 *   2. "watchlist"   — top planning entry from the current user's watchlist
 *   3. null          — both empty
 *
 * Reuses /api/watchlist; no new API route.
 */

import useSWR from "swr";

import { useAuth } from "@/components/providers/auth-provider";
import type { MediaType, WatchlistStatus } from "@/lib/db/types";
import type { WatchlistItem, WatchlistResponse } from "@/types/watchlist-responses";

export type UpNextSource = "in-progress" | "watchlist";

export interface UpNextItem {
  readonly mediaId: string | null;
  readonly title: string;
  readonly posterUrl: string | null;
  readonly mediaType: MediaType;
  readonly href: string;
}

export interface UseUpNextResult {
  readonly data: UpNextItem | null;
  readonly source: UpNextSource | null;
  readonly isLoading: boolean;
}

function buildKey(userId: string, status: WatchlistStatus): string {
  const params = new URLSearchParams({ userId, status, limit: "1" });
  return `/api/watchlist?${params.toString()}`;
}

function toUpNextItem(entry: WatchlistItem): UpNextItem {
  return {
    mediaId: entry.media_id,
    title: entry.title,
    posterUrl: entry.poster_url,
    mediaType: entry.media_type,
    href: entry.media_id === null ? "/watchlist" : `/database/${entry.media_id}`,
  };
}

export function useUpNext(): UseUpNextResult {
  const { user } = useAuth();
  const userId = user?.id;

  const watching = useSWR<WatchlistResponse>(
    userId === undefined ? null : buildKey(userId, "watching"),
  );
  const planning = useSWR<WatchlistResponse>(
    userId === undefined ? null : buildKey(userId, "planning"),
  );

  if (userId === undefined) {
    return { data: null, source: null, isLoading: false };
  }

  const watchingItem = watching.data?.items[0];
  if (watchingItem !== undefined) {
    return { data: toUpNextItem(watchingItem), source: "in-progress", isLoading: false };
  }

  const planningItem = planning.data?.items[0];
  if (planningItem !== undefined) {
    return { data: toUpNextItem(planningItem), source: "watchlist", isLoading: false };
  }

  const isLoading = watching.isLoading || planning.isLoading;
  return { data: null, source: null, isLoading };
}
