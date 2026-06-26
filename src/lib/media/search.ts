/**
 * Fault-isolated orchestration for unified media search.
 *
 * The search fans out to several external sources (TMDB movies, TMDB TV, Jikan
 * anime). These are independent third-party APIs — Jikan in particular is a
 * free community service that intermittently returns 504s. A failure in one
 * source must NOT fail the others: TMDB results should still come back when
 * Jikan is down.
 *
 * `collectSearchResults` runs each source concurrently and independently,
 * concatenating successes in declaration order and reporting any source that
 * threw via `failedSources`, so callers can surface a notice instead of an
 * outright error.
 */

import type { MediaType } from "@/lib/db/types";
import type { MediaSearchResult } from "@/types/media";

/** One external source to query, keyed by the media type it produces. */
export interface SearchSource {
  key: MediaType;
  run: () => Promise<MediaSearchResult[]>;
}

/** A source that failed, paired with the error it threw (for logging). */
export interface FailedSource {
  key: MediaType;
  error: unknown;
}

/**
 * Like {@link MediaSearchResponse} but carries the raw errors so the caller can
 * log *why* each source failed (504 vs auth vs a parse/TypeError bug), not just
 * which. The client-facing shape only needs the `key`s, so the route maps
 * `failures` down to `failedSources` after logging.
 */
export interface CollectedSearch {
  results: MediaSearchResult[];
  failures: FailedSource[];
}

export async function collectSearchResults(sources: SearchSource[]): Promise<CollectedSearch> {
  // Run each source independently, catching its own failure so a rejection in
  // one (e.g. a Jikan 504) never rejects the whole batch. Each outcome carries
  // its source key, so we never have to index back into `sources` to attribute
  // a failure.
  const outcomes = await Promise.all(
    sources.map(async (source) => {
      try {
        return { key: source.key, items: await source.run(), ok: true as const };
      } catch (error) {
        // Keep the error: the route logs it so an operator can tell a transient
        // 504 from a hard misconfiguration or a code bug throwing per-request.
        return { key: source.key, error, ok: false as const };
      }
    }),
  );

  const results: MediaSearchResult[] = [];
  const failures: FailedSource[] = [];

  for (const outcome of outcomes) {
    if (outcome.ok) {
      results.push(...outcome.items);
    } else {
      failures.push({ key: outcome.key, error: outcome.error });
    }
  }

  return { results, failures };
}
