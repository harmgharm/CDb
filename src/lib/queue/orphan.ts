/**
 * Orphan-media decision for queue cleanup (pure).
 *
 * The import-dialog Propose flow imports a real `media` row so a title can be
 * queued (the queue keys on a non-null `media_id`). When a proposal is removed,
 * that media row may be left referenced by nothing — an orphan from a suggestion
 * that was never watched. Removing such rows keeps the database from accreting
 * never-watched imports.
 *
 * A row is an orphan ONLY when something real would be destroyed by keeping it
 * around — i.e. references whose loss is unrecoverable. Each guard matters:
 * - `sessionCount`  — `watch_sessions.media_id` is ON DELETE CASCADE, so deleting
 *   media with sessions would silently destroy those sessions and their ratings.
 * - `activeProposalCount` — another open/scheduled proposal still needs it.
 *
 * Watchlist entries are deliberately NOT a guard: since migration 0030 the
 * `watchlist.media_id` FK is ON DELETE SET NULL with external ids retained, so
 * reclaiming the media row downgrades a bookmark to external-only (still visible,
 * still re-proposable via re-import) rather than destroying it. We'd rather keep
 * the DB free of never-watched import-then-propose rows than pin a full media row
 * alive for a single bookmark.
 *
 * Kept DB-free so it is unit-testable; the route supplies the counts.
 */

export interface MediaReferenceCounts {
  /** Watch sessions logged against this media. */
  sessionCount: number;
  /** Active (proposed/scheduled) queue proposals for this media, excluding the
   *  one being removed. */
  activeProposalCount: number;
}

export function isMediaOrphaned(counts: MediaReferenceCounts): boolean {
  return counts.sessionCount === 0 && counts.activeProposalCount === 0;
}
