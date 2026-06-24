/**
 * Pure decision for proposing a watchlist entry to the group queue.
 *
 * The queue's `queue_proposals.media_id` is a NOT NULL FK to `media`, so an
 * un-imported watchlist entry (external `tmdb_id`/`mal_id` only, `media_id`
 * null) can't be proposed directly — it must be imported first, then proposed
 * by the new id. This function decides which path applies; the action hook
 * (`useProposeWatchlistItem`) carries it out.
 */

import type { WatchlistItem } from "@/types/watchlist-responses";

/** Import params for `useMediaImport`, mirroring the import dialog's shape. */
export interface WatchlistImportParams {
  type: string;
  tmdbId?: number;
  malId?: number;
}

export type WatchlistProposePlan =
  /** Imported entry: propose its media id directly, no import round-trip. */
  | { kind: "direct"; mediaId: string }
  /** External-only entry: import these params first, then propose the new id. */
  | { kind: "import"; params: WatchlistImportParams }
  /** No media id and no external id — nothing to anchor a proposal to. */
  | { kind: "unproposable" };

export function planWatchlistPropose(entry: WatchlistItem): WatchlistProposePlan {
  if (entry.media_id !== null) {
    return { kind: "direct", mediaId: entry.media_id };
  }
  if (entry.tmdb_id !== null) {
    return { kind: "import", params: { type: entry.media_type, tmdbId: entry.tmdb_id } };
  }
  if (entry.mal_id !== null) {
    return { kind: "import", params: { type: entry.media_type, malId: entry.mal_id } };
  }
  return { kind: "unproposable" };
}
