/**
 * advanceQueueOnWatch — Approach A advance hook
 *
 * Called inside the `POST /api/sessions` transaction (adjacent to the watchlist
 * auto-removal). When the logged media is the currently-scheduled queue pick it
 * marks that pick `watched` (linked to the new session) and promotes the next
 * top-voted proposal into the dateless scheduled slot. Atomic with the session
 * insert: log + advance commit together or both roll back.
 *
 * Returns a structured result so the caller can audit-log `queue.advanced` and
 * (slice 3) broadcast the `queue:advanced` event. A no-op returns
 * `{ advanced: false }` — logging an off-queue watch never disturbs the queue.
 */

import type { DatabaseTransaction } from "@/lib/db/transaction";

import { pickNextScheduled } from "./ranking";

export interface AdvanceResult {
  /** Whether the logged media was the scheduled pick (i.e. the queue advanced). */
  advanced: boolean;
  /** The proposal marked `watched`, when an advance happened. */
  watchedProposalId?: string;
  /** The proposal promoted into the scheduled slot, or `null` if none remained. */
  scheduledProposalId?: string | null;
}

/**
 * Advance the group queue when `mediaId` is the scheduled pick. `sessionId` is
 * the freshly-inserted `watch_sessions` row, linked onto the watched proposal.
 */
export async function advanceQueueOnWatch(
  trx: DatabaseTransaction,
  mediaId: string,
  sessionId: string,
): Promise<AdvanceResult> {
  // 1. Is the logged media the scheduled pick? (decideAdvance, inlined as a query)
  //
  // FOR UPDATE locks the scheduled row so two concurrent session logs of the
  // same pick serialize here. Without it, both would pass this check, both would
  // try to promote a next pick, and the second's promotion would collide with the
  // single-scheduled unique index (23505) — rolling back an otherwise-valid watch
  // log. With the lock, the second waits, then re-reads: the old pick is now
  // `watched` (no longer matches) and the freshly-promoted pick is a different
  // media, so it falls through to a clean no-op instead of failing the log.
  const scheduled = await trx
    .selectFrom("queue_proposals")
    .select(["id", "media_id"])
    .where("status", "=", "scheduled")
    .forUpdate()
    .executeTakeFirst();

  if (scheduled?.media_id !== mediaId) {
    return { advanced: false };
  }

  // Mark the scheduled pick watched, linked to its real session.
  await trx
    .updateTable("queue_proposals")
    .set({ status: "watched", watched_session_id: sessionId })
    .where("id", "=", scheduled.id)
    .execute();

  // 2. Promote the next top-voted proposal (votes DESC, oldest proposal wins).
  const candidates = await trx
    .selectFrom("queue_proposals")
    .leftJoin("queue_votes", "queue_votes.proposal_id", "queue_proposals.id")
    .select((eb) => [
      "queue_proposals.id as id",
      "queue_proposals.proposed_at as proposedAt",
      eb.fn.count("queue_votes.id").as("voteCount"),
    ])
    .where("queue_proposals.status", "=", "proposed")
    .groupBy(["queue_proposals.id", "queue_proposals.proposed_at"])
    .execute();

  const next = pickNextScheduled(
    candidates.map((c) => ({
      id: c.id,
      proposedAt: c.proposedAt,
      voteCount: Number(c.voteCount),
    })),
  );

  // 3. No proposals remain — the slot is left empty (drives the empty state).
  if (!next) {
    return { advanced: true, watchedProposalId: scheduled.id, scheduledProposalId: null };
  }

  await trx
    .updateTable("queue_proposals")
    .set({ status: "scheduled", scheduled_at: new Date(), scheduled_date: null })
    .where("id", "=", next.id)
    .execute();

  return {
    advanced: true,
    watchedProposalId: scheduled.id,
    scheduledProposalId: next.id,
  };
}
