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
import { db, isUniqueViolation } from "@/lib/db";

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

  try {
    await db.insertInto("queue_votes").values({ proposal_id: id, user_id: user.id }).execute();
  } catch (error) {
    // Already voted — idempotent, fall through to return the current count.
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }

  return successResponse({ proposalId: id, voteCount: await countVotes(id), hasVoted: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  if (!(await proposalExists(id))) {
    return errorResponse("Proposal not found", 404);
  }

  await db
    .deleteFrom("queue_votes")
    .where("proposal_id", "=", id)
    .where("user_id", "=", user.id)
    .execute();

  return successResponse({ proposalId: id, voteCount: await countVotes(id), hasVoted: false });
}
