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
 * Which proposal (if any) should fill the scheduled slot right now. The slot is
 * filled from the top proposal *only when it is empty* — an occupied slot is
 * left stable, so the scheduled pick never changes just because the vote ranking
 * shifted (it only changes when the current pick is logged watched). Returns
 * `null` when the slot is occupied or there is nothing to promote.
 */
export function decideFill<T extends RankableProposal>(options: {
  hasScheduled: boolean;
  candidates: readonly T[];
}): T | null {
  if (options.hasScheduled) {
    return null;
  }
  return pickNextScheduled(options.candidates);
}

const GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a session's watch date marks it as a historical backfill relative to
 * a proposal — a log of a watch that happened before the group queued the title
 * (e.g. "oh right, I saw this in May"). Backfills must not close a live
 * proposal the group still plans to watch.
 *
 * `dateWatched` is the member-entered calendar day (`YYYY-MM-DD`, their local
 * timezone); `proposedAt` is a UTC instant. A same-evening watch can therefore
 * be dated one calendar day before the proposal's UTC day (a 10pm EDT proposal
 * is already "tomorrow" in UTC), so one day of grace is allowed: only a watch
 * dated two or more days before the proposal counts as a backfill. An undated
 * session means "logged now" — never a backfill.
 */
export function isHistoricalBackfill(dateWatched: string | null, proposedAt: Date): boolean {
  if (dateWatched === null) {
    return false;
  }
  const graceDay = new Date(proposedAt.getTime() - GRACE_MS).toISOString().slice(0, 10);
  return dateWatched < graceDay;
}

export type WatchCloseAction = "none" | "close" | "close-and-promote";

/**
 * What logging a watch should do to the watched media's active proposal (there
 * is at most one — the active-per-media unique index). Any current watch closes
 * the proposal (marks it watched): the group saw the title, so it must not keep
 * sitting in the vote list — or worse, get promoted later. Only closing the
 * scheduled pick also promotes the next pick (a vote-list closure leaves the
 * slot's occupant untouched). Historical backfills (see `isHistoricalBackfill`)
 * and media with no active proposal leave the queue alone.
 */
export function decideWatchClose(options: {
  proposal: { status: "proposed" | "scheduled"; proposedAt: Date } | null;
  dateWatched: string | null;
}): WatchCloseAction {
  const { proposal, dateWatched } = options;
  if (proposal === null || isHistoricalBackfill(dateWatched, proposal.proposedAt)) {
    return "none";
  }
  return proposal.status === "scheduled" ? "close-and-promote" : "close";
}

export interface PromotionTally {
  /** The promoted pick's vote count, frozen at promotion time. */
  wonVotes: number;
  /** The runner-up's vote count at promotion, or 0 if it ran unopposed. */
  runnerUpVotes: number;
}

/**
 * The vote tally to freeze onto a pick when it is promoted: the winner's count
 * and the ranked runner-up's count. Frozen because both proposals stay votable
 * after promotion, so a live `COUNT` would drift away from "the race it won".
 * Returns `null` when there is nothing to promote.
 */
export function capturePromotionTally(
  proposals: readonly RankableProposal[],
): PromotionTally | null {
  const ranked = rankProposals(proposals);
  const winner = ranked[0];
  if (winner === undefined) {
    return null;
  }
  return {
    wonVotes: winner.voteCount,
    runnerUpVotes: ranked[1]?.voteCount ?? 0,
  };
}
