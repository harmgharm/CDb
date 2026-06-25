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

/**
 * Whether a watchlist entry is already in the group's active queue, so the
 * preview dialog renders the disabled "Proposed" state instead of "Propose"
 * (mirrors the import dialog's row-level `isAlreadyProposed`).
 *
 * Two signals, because the queue keys on a real `media_id`:
 * - `queuedMediaIds` — the live scheduled-pick + open-proposal media ids. Once
 *   an entry has a `media_id` (imported, or backfilled after an import-then-
 *   propose), this is the source of truth and persists across a close/reopen.
 * - `locallyProposed` — set when *this* session proposed the entry. Only a
 *   bridge for the brief window where an external-only entry has been proposed
 *   (and imported) but its freshly-minted `media_id` hasn't landed on this card
 *   yet, so `queuedMediaIds` can't match it. Once the entry carries a
 *   `media_id`, the live queue wins — so a later watch (which removes the title
 *   from the queue) correctly flips this back to `false` instead of the local
 *   flag pinning it "proposed" forever.
 */
export function isWatchlistEntryProposed(
  entry: WatchlistItem,
  queuedMediaIds: ReadonlySet<string>,
  locallyProposed: boolean,
): boolean {
  // Imported / backfilled entry: trust the live queue exclusively.
  if (entry.media_id !== null) return queuedMediaIds.has(entry.media_id);
  // External-only entry the queue can't key yet: the local flag bridges the gap.
  return locallyProposed;
}
