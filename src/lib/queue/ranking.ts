/**
 * Queue ranking & promotion logic (pure functions)
 *
 * The single source of ranking/tie-break truth for the group queue. The GET
 * route and `advanceQueueOnWatch` both rank with these functions so the rule —
 * votes DESC, then oldest proposal (`proposed_at` ASC) — lives in exactly one
 * place. Kept free of DB access so it is unit-testable without a live database.
 */

export interface RankableProposal {
  id: string;
  voteCount: number;
  proposedAt: Date;
}

/**
 * Rank proposals by total votes (descending), breaking ties in favour of the
 * oldest proposal (`proposed_at` ascending). Returns a new array; the input is
 * not mutated.
 */
export function rankProposals<T extends RankableProposal>(proposals: readonly T[]): T[] {
  return proposals.toSorted((a, b) => {
    if (a.voteCount !== b.voteCount) {
      return b.voteCount - a.voteCount;
    }
    return a.proposedAt.getTime() - b.proposedAt.getTime();
  });
}

/**
 * The proposal that should be promoted into the scheduled slot next, or `null`
 * when there are no proposals to promote (drives the empty state).
 */
export function pickNextScheduled<T extends RankableProposal>(proposals: readonly T[]): T | null {
  return rankProposals(proposals)[0] ?? null;
}

/**
 * Whether logging a watch of `watchedMediaId` should advance the queue: only
 * when it matches the currently-scheduled pick. Logging an off-queue watch (or
 * any watch while nothing is scheduled) leaves the queue untouched.
 */
export function decideAdvance(options: {
  scheduledMediaId: string | null;
  watchedMediaId: string;
}): boolean {
  return options.scheduledMediaId !== null && options.scheduledMediaId === options.watchedMediaId;
}
