/**
 * Backfill decision for thin recommendation sections.
 *
 * When dismissals thin a cached section below the display threshold, one
 * recompute can restock it. But recomputing on every request is wasteful for
 * sections that legitimately cannot produce more items (small groups, sparse
 * data) — the fresh result is just as thin, so nothing improves. Backfill only
 * fires for a cached result that is old enough that a re-roll could plausibly
 * pick up new data.
 */

/** If dismissal filtering drops a section below this, consider a backfill. */
export const BACKFILL_THRESHOLD = 15;

/** Minimum cache age before a thin section is recomputed again. */
export const BACKFILL_MIN_CACHE_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface BackfillContext {
  /** The request already forced a recompute. */
  refresh: boolean;
  /** Items surviving dismissal filtering. */
  filteredCount: number;
  /** Whether the served items came from cache (vs computed this request). */
  fromCache: boolean;
  /** When the cached items were computed; null when freshly computed. */
  computedAt: Date | null;
  now: Date;
}

export function shouldBackfill(context: BackfillContext): boolean {
  const { refresh, filteredCount, fromCache, computedAt, now } = context;
  if (refresh) return false;
  if (filteredCount >= BACKFILL_THRESHOLD) return false;
  if (!fromCache || computedAt === null) return false;
  return now.getTime() - computedAt.getTime() >= BACKFILL_MIN_CACHE_AGE_MS;
}
