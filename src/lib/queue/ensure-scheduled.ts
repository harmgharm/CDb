/**
 * ensureScheduledFilled — keep the scheduled slot occupied when fillable.
 *
 * Invariant: *if the scheduled slot is empty and a proposal exists, the top
 * proposal occupies it.* Called inside the propose + vote write transactions so
 * a brand-new queue schedules its first pick (closing the bootstrap gap where
 * promotion only ever fired on watch-advance). An occupied slot is left stable —
 * the scheduled pick never changes just because the vote ranking shifted.
 */

import type { DatabaseTransaction } from "@/lib/db/transaction";

import { promoteTopProposal } from "./promote";

export interface FillResult {
  /** The proposal promoted into the slot, or null if no fill happened. */
  scheduledProposalId: string | null;
}

/**
 * If the scheduled slot is empty, promote the top `proposed` row into it. No-op
 * when a pick is already scheduled (stable slot) or when there are no proposals.
 * Returns the promoted proposal id when a fill occurred, else null.
 */
export async function ensureScheduledFilled(trx: DatabaseTransaction): Promise<FillResult> {
  const existing = await trx
    .selectFrom("queue_proposals")
    .select("id")
    .where("status", "=", "scheduled")
    // Lock the (absence of a) scheduled row so concurrent writes serialize here
    // rather than racing two promotions into the single-scheduled unique index.
    .forUpdate()
    .executeTakeFirst();

  if (existing !== undefined) {
    return { scheduledProposalId: null };
  }

  const promotedId = await promoteTopProposal(trx);
  return { scheduledProposalId: promotedId };
}
