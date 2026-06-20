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
import type { QueueProposal } from "@/lib/db/types";
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
  try {
    created = await db
      .insertInto("queue_proposals")
      .values({ media_id: mediaId, proposed_by: user.id, status: "proposed" })
      .returningAll()
      .executeTakeFirstOrThrow();
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

  return successResponse(created, "Proposed", 201);
}
