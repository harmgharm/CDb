/**
 * POST /api/queue/propose — Propose a title to the group queue
 *
 * Body `{ mediaId }`. If an active proposal already exists for that media this
 * is a no-op that returns the existing proposal (surfaced to the UI as
 * already-proposed); otherwise a new `proposed` row is created and audit-logged.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import type { QueueProposal } from "@/lib/db/types";
import { publishToQueue } from "@/lib/notifications";
import { ensureScheduledFilled } from "@/lib/queue/ensure-scheduled";
import { QUEUE_EVENTS } from "@/lib/queue/realtime";
import { proposeSchema } from "@/lib/validations/queue";

function findActiveProposal(mediaId: string): Promise<QueueProposal | undefined> {
  return db
    .selectFrom("queue_proposals")
    .selectAll()
    .where("media_id", "=", mediaId)
    .where("status", "in", ["proposed", "scheduled"])
    .executeTakeFirst();
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = proposeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }
  const { mediaId } = parsed.data;

  const media = await db
    .selectFrom("media")
    .select("id")
    .where("id", "=", mediaId)
    .executeTakeFirst();
  if (media === undefined) {
    return errorResponse("Media not found", 404);
  }

  // Already actively queued -> no-op, return the existing proposal.
  const existing = await findActiveProposal(mediaId);
  if (existing !== undefined) {
    return successResponse(existing, "Already proposed");
  }

  let created: QueueProposal;
  let scheduledProposalId: string | null;
  try {
    // Create the proposal and, in the same transaction, fill the scheduled slot
    // if it's empty (the first proposal on a fresh queue schedules itself).
    ({ created, scheduledProposalId } = await withTransaction(async (trx) => {
      const row = await trx
        .insertInto("queue_proposals")
        .values({ media_id: mediaId, proposed_by: user.id, status: "proposed" })
        .returningAll()
        .executeTakeFirstOrThrow();
      const fill = await ensureScheduledFilled(trx);
      return { created: row, scheduledProposalId: fill.scheduledProposalId };
    }));
  } catch (error) {
    // Lost a race against a concurrent proposer — surface the winner.
    if (isUniqueViolation(error)) {
      const winner = await findActiveProposal(mediaId);
      if (winner !== undefined) {
        return successResponse(winner, "Already proposed");
      }
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    action: "queue.proposed",
    entityType: "queue_proposal",
    entityId: created.id,
    metadata: { mediaId },
  });

  // A fill promoted a proposal into an empty slot — record the auto-schedule.
  if (scheduledProposalId !== null) {
    await logAudit({
      userId: user.id,
      action: "queue.advanced",
      entityType: "queue_proposal",
      entityId: scheduledProposalId,
      metadata: { scheduledProposalId, reason: "slot_filled_on_propose" },
    });
  }

  // Broadcast so every client revalidates the canonical GET (fire-and-forget; a
  // dropped publish re-syncs on next load). A single `proposed` event covers an
  // auto-fill too: clients refetch the full state, which already reflects the
  // promotion. (`advanced` is reserved for the watch path's watched->promote.)
  publishToQueue(QUEUE_EVENTS.proposed, { proposalId: created.id, mediaId });

  return successResponse(created, "Proposed", 201);
}
