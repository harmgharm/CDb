/**
 * advanceQueueOnWatch — Approach A advance hook
 *
 * Called inside the `POST /api/sessions` transaction (adjacent to the watchlist
 * auto-removal). Any current watch of a queued title closes its active proposal
 * (marks it `watched`, linked to the new session): the group saw it, so it must
 * not keep sitting in the vote list — or worse, get promoted later. Only when
 * the closed proposal was the scheduled pick does the queue also promote the
 * next top-voted proposal into the slot; closing a vote-list row leaves the
 * slot's occupant untouched. Atomic with the session insert: log + close commit
 * together or both roll back.
 *
 * Two watches never touch the queue (`decideWatchClose` in ranking.ts is the
 * pure decision): a media with no active proposal, and a historical backfill —
 * a session dated well before the proposal existed (someone logging an old
 * watch must not kill a title the group still plans to watch).
 *
 * Returns a structured result so the caller can audit-log `queue.advanced` and
 * broadcast the `queue:advanced` event. A no-op returns `{ advanced: false }`.
 */

import type { DatabaseTransaction } from "@/lib/db/transaction";

import { promoteTopProposal } from "./promote";
import { decideWatchClose } from "./ranking";

export interface AdvanceResult {
  /** Whether an active proposal for the logged media was closed. */
  advanced: boolean;
  /** The proposal marked `watched`, when a close happened. */
  watchedProposalId?: string;
  /** Whether the closed proposal was the scheduled pick (promotion ran). */
  wasScheduled?: boolean;
  /** The proposal promoted into the scheduled slot, or `null` if none remained. */
  scheduledProposalId?: string | null;
}

export interface AdvanceInput {
  /** The logged session's media. */
  mediaId: string;
  /** The freshly-inserted `watch_sessions` row, linked onto the watched proposal. */
  sessionId: string;
  /** The session's member-entered calendar day (`YYYY-MM-DD`) or null; drives the backfill guard. */
  dateWatched: string | null;
}

/**
 * Close the logged media's active queue proposal (and advance the slot when it
 * was the scheduled pick).
 */
export async function advanceQueueOnWatch(
  trx: DatabaseTransaction,
  input: AdvanceInput,
): Promise<AdvanceResult> {
  const { mediaId, sessionId, dateWatched } = input;
  // The media's single active proposal (the active-per-media unique index
  // guarantees at most one).
  //
  // FOR UPDATE locks that row so two concurrent session logs of the same media
  // serialize here. Without it, both would pass the check, both would try to
  // close (and, for the scheduled pick, promote) — and the second's promotion
  // would collide with the single-scheduled unique index (23505), rolling back
  // an otherwise-valid watch log. With the lock, the second waits, then
  // re-reads: the proposal is now `watched` (filtered out below), so it falls
  // through to a clean no-op instead of failing the log.
  const active = await trx
    .selectFrom("queue_proposals")
    .select(["id", "status", "proposed_at"])
    .where("media_id", "=", mediaId)
    .where("status", "in", ["proposed", "scheduled"])
    .forUpdate()
    .executeTakeFirst();

  if (active === undefined) {
    return { advanced: false };
  }

  const action = decideWatchClose({
    // The status filter above narrows to the two active statuses; the column
    // type still includes 'watched', hence the cast.
    proposal: {
      status: active.status as "proposed" | "scheduled",
      proposedAt: active.proposed_at,
    },
    dateWatched,
  });

  if (action === "none") {
    return { advanced: false };
  }

  // Mark the proposal watched, linked to its real session.
  await trx
    .updateTable("queue_proposals")
    .set({ status: "watched", watched_session_id: sessionId })
    .where("id", "=", active.id)
    .execute();

  if (action === "close") {
    return { advanced: true, watchedProposalId: active.id, wasScheduled: false };
  }

  // The scheduled pick was closed: promote the next top-voted proposal into the
  // now-empty slot (shared primitive: votes DESC, oldest tie-break, frozen
  // tally). Returns null when no proposals remain, leaving the slot empty
  // (drives the empty state).
  const scheduledProposalId = await promoteTopProposal(trx);

  return {
    advanced: true,
    watchedProposalId: active.id,
    wasScheduled: true,
    scheduledProposalId,
  };
}
