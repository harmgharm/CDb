/**
 * ensureScheduledFilled — keep the scheduled slot occupied when fillable.
 *
 * Invariant: *if the scheduled slot is empty and a proposal exists, the top
 * proposal occupies it.* Called inside the propose + vote write transactions so
 * a brand-new queue schedules its first pick (closing the bootstrap gap where
 * promotion only ever fired on watch-advance). An occupied slot is left stable —
 * the scheduled pick never changes just because the vote ranking shifted.
 */

import { sql } from "kysely";

import type { DatabaseTransaction } from "@/lib/db/transaction";

import { promoteTopProposal } from "./promote";

export interface FillResult {
  /** The proposal promoted into the slot, or null if no fill happened. */
  scheduledProposalId: string | null;
}

/**
 * A fixed, arbitrary key identifying the "queue scheduled slot" for the
 * transaction-scoped advisory lock below. Any constant works; it just has to be
 * the same everywhere that fills the slot.
 */
const QUEUE_SLOT_LOCK_KEY = 920_240_601;

/**
 * If the scheduled slot is empty, promote the top `proposed` row into it. No-op
 * when a pick is already scheduled (stable slot) or when there are no proposals.
 * Returns the promoted proposal id when a fill occurred, else null.
 *
 * Concurrency: the "is the slot empty?" check can't be guarded by `FOR UPDATE`
 * (it returns zero rows, and you can't lock an absent row), so two concurrent
 * fills could both see an empty slot and race two promotions into the
 * `single-scheduled` unique index — the loser raising 23505, which would abort
 * its whole transaction. A transaction-scoped advisory lock serializes all fills
 * instead: the second waits for the first to commit, then sees the now-filled
 * slot and cleanly no-ops. The lock releases automatically at transaction end.
 */
export async function ensureScheduledFilled(trx: DatabaseTransaction): Promise<FillResult> {
  await sql`select pg_advisory_xact_lock(${QUEUE_SLOT_LOCK_KEY})`.execute(trx);

  const existing = await trx
    .selectFrom("queue_proposals")
    .select("id")
    .where("status", "=", "scheduled")
    .executeTakeFirst();

  if (existing !== undefined) {
    return { scheduledProposalId: null };
  }

  const promotedId = await promoteTopProposal(trx);
  return { scheduledProposalId: promotedId };
}
