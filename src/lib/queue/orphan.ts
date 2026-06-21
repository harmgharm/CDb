/**
 * Orphan-media decision for queue cleanup (pure).
 *
 * The import-dialog Propose flow imports a real `media` row so a title can be
 * queued (the queue keys on a non-null `media_id`). When a proposal is removed,
 * that media row may be left referenced by nothing — an orphan from a suggestion
 * that was never watched. Removing such rows keeps the database from accreting
 * never-watched imports.
 *
 * A row is an orphan ONLY when nothing real points at it. Each guard matters:
 * - `sessionCount`  — `watch_sessions.media_id` is ON DELETE CASCADE, so deleting
 *   media with sessions would silently destroy those sessions and their ratings.
 * - `activeProposalCount` — another open/scheduled proposal still needs it.
 * - `watchlistCount` — `watchlist.media_id` is ON DELETE CASCADE too, so deleting
 *   would silently drop someone's personal bookmark (an imported watchlist entry
 *   stores `media_id`, not external ids).
 *
 * Kept DB-free so it is unit-testable; the route supplies the counts.
 */

export interface MediaReferenceCounts {
  /** Watch sessions logged against this media. */
  sessionCount: number;
  /** Active (proposed/scheduled) queue proposals for this media, excluding the
   *  one being removed. */
  activeProposalCount: number;
  /** Watchlist entries pointing at this media by `media_id`. */
  watchlistCount: number;
}

export function isMediaOrphaned(counts: MediaReferenceCounts): boolean {
  return (
    counts.sessionCount === 0 && counts.activeProposalCount === 0 && counts.watchlistCount === 0
  );
}
