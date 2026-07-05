/**
 * Shared queue promotion primitive.
 *
 * `promoteTopProposal` is the single place that turns the top `proposed` row
 * into the `scheduled` pick (dateless, with the frozen vote tally). Both the
 * watch-advance path (`advanceQueueOnWatch`) and the slot-fill path
 * (`ensureScheduledFilled`) promote through here so the ranking, tie-break, and
 * tally-freeze rules live in exactly one query.
 */

import type { DatabaseTransaction } from "@/lib/db/transaction";

import { capturePromotionTally, pickNextScheduled } from "./ranking";

/**
 * Promote the top-ranked `proposed` row (votes DESC, oldest `proposed_at` first)
 * into the scheduled slot, dateless, freezing its winning + runner-up tally.
 * Returns the promoted proposal's id, or `null` if there is nothing to promote.
 *
 * Assumes the caller has already ensured the slot is empty (the single-scheduled
 * partial unique index will otherwise reject the update).
 */
export async function promoteTopProposal(trx: DatabaseTransaction): Promise<string | null> {
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

  const rankable = candidates.map((c) => ({
    id: c.id,
    proposedAt: c.proposedAt,
    voteCount: Number(c.voteCount),
  }));

  const next = pickNextScheduled(rankable);
  if (!next) {
    return null;
  }

  const tally = capturePromotionTally(rankable);

  // The status predicate guards a cross-media race: a concurrent session log
  // can close (mark `watched`) the very proposal picked above between our read
  // and this write. A bare id-match UPDATE would drag that watched row back to
  // `scheduled`; with the predicate the update no-ops instead and the slot
  // stays empty (the next propose/vote re-fills it via ensureScheduledFilled).
  const result = await trx
    .updateTable("queue_proposals")
    .set({
      status: "scheduled",
      scheduled_at: new Date(),
      scheduled_date: null,
      won_votes: tally?.wonVotes ?? null,
      runner_up_votes: tally?.runnerUpVotes ?? null,
    })
    .where("id", "=", next.id)
    .where("status", "=", "proposed")
    .executeTakeFirst();

  if (Number(result.numUpdatedRows) === 0) {
    return null;
  }

  return next.id;
}
