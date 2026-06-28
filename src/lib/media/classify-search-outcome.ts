/**
 * Classifies a unified-search outcome so the client can tell a *total outage*
 * (every external source the request asked for is down) apart from a *partial
 * failure* (one flaky source down while the others answered) or a plain
 * *no-match* (everything answered, nothing matched).
 *
 * Why this exists: the import dialog used to show a blocking red "search
 * unavailable" box whenever there were zero results *and* any source failed.
 * That misfires on "All types" when Jikan 504s and the query simply has no TMDB
 * matches — TMDB answered fine, so it is NOT an outage, yet the user saw the red
 * box plus "No results found". A partial failure must stay soft (a per-filter
 * notice via failedSources); only a true total outage warrants the red box.
 *
 * "Total outage" therefore means: at least one source was attempted, every
 * attempted source failed, and nothing came back.
 */

import type { MediaType } from "@/lib/db/types";

export interface SearchOutcome {
  /** How many results came back across all surviving sources. */
  resultCount: number;
  /** Sources that errored (e.g. a Jikan 504). */
  failedSources: MediaType[];
  /** Every source the request actually queried (drives the outage test). */
  attemptedSources: MediaType[];
}

export function isTotalSearchOutage(outcome: SearchOutcome): boolean {
  const { resultCount, failedSources, attemptedSources } = outcome;
  if (attemptedSources.length === 0) return false;
  if (resultCount > 0) return false;
  return failedSources.length === attemptedSources.length;
}
