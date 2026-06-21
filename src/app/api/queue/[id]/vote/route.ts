/**
 * POST   /api/queue/[id]/vote — Add the current user's vote (idempotent)
 * DELETE /api/queue/[id]/vote — Remove the current user's vote (idempotent)
 *
 * Toggle is driven by the unique (proposal_id, user_id) constraint: a duplicate
 * insert is swallowed and a missing delete is a no-op, so both verbs converge on
 * the intended state regardless of the prior one.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { publishToQueue } from "@/lib/notifications";
import { ensureScheduledFilled } from "@/lib/queue/ensure-scheduled";
import { QUEUE_EVENTS } from "@/lib/queue/realtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function countVotes(proposalId: string): Promise<number> {
  const row = await db
    .selectFrom("queue_votes")
    .select((eb) => eb.fn.countAll().as("c"))
    .where("proposal_id", "=", proposalId)
    .executeTakeFirstOrThrow();
  return Number(row.c);
}

async function proposalExists(id: string): Promise<boolean> {
  const row = await db
    .selectFrom("queue_proposals")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();
  return row !== undefined;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  if (!(await proposalExists(id))) {
    return errorResponse("Proposal not found", 404);
  }

  await withTransaction(async (trx) => {
    // ON CONFLICT DO NOTHING keeps the insert idempotent without raising 23505 —
    // a thrown unique violation would poison the surrounding transaction and
    // abort the ensureScheduledFilled call below.
    await trx
      .insertInto("queue_votes")
      .values({ proposal_id: id, user_id: user.id })
      .onConflict((oc) => oc.constraint("queue_votes_proposal_user_unique").doNothing())
      .execute();
    // A vote may be the first activity on a queue with an empty slot — fill it.
    await ensureScheduledFilled(trx);
  });

  const voteCount = await countVotes(id);
  // Broadcast the new tally so other clients revalidate (the actor flips
  // optimistically). Fire-and-forget: a dropped vote re-syncs on next load.
  publishToQueue(QUEUE_EVENTS.voted, { proposalId: id, voteCount });
  return successResponse({ proposalId: id, voteCount, hasVoted: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  if (!(await proposalExists(id))) {
    return errorResponse("Proposal not found", 404);
  }

  await withTransaction(async (trx) => {
    await trx
      .deleteFrom("queue_votes")
      .where("proposal_id", "=", id)
      .where("user_id", "=", user.id)
      .execute();
    // Keep the slot-filled invariant enforced on every write.
    await ensureScheduledFilled(trx);
  });

  const voteCount = await countVotes(id);
  publishToQueue(QUEUE_EVENTS.voted, { proposalId: id, voteCount });
  return successResponse({ proposalId: id, voteCount, hasVoted: false });
}
