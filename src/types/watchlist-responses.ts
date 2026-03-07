/**
 * Frontend types for watchlist API responses
 */

import type { MediaType, WatchlistStatus } from "@/lib/db/types";

/** Single watchlist entry with resolved display fields */
export interface WatchlistItem {
  id: string;
  user_id: string;
  status: WatchlistStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  // Resolved display fields (from media table OR ext_* columns)
  title: string;
  poster_url: string | null;
  media_type: MediaType;
  // Only set for imported titles
  media_id: string | null;
  // Only set for unimported titles
  tmdb_id: number | null;
  mal_id: number | null;
}

/** Paginated watchlist response */
export interface WatchlistResponse {
  items: WatchlistItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Group interest counts: mediaId → count */
export type WatchlistGroupCounts = Record<string, number>;
