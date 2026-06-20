/**
 * DELETE /api/queue/[id] — Remove a proposal from the queue (any member)
 *
 * Full-trust: any member may remove any proposal. Destructive, so audit-logged.
 * Votes cascade away with the row.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { withTransaction } from "@/lib/db/transaction";
import { ensureScheduledFilled } from "@/lib/queue/ensure-scheduled";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const result = await withTransaction(async (trx) => {
    const deleted = await trx
      .deleteFrom("queue_proposals")
      .where("id", "=", id)
      .returning(["id", "media_id", "status"])
      .executeTakeFirst();
    if (deleted === undefined) {
      return { deleted: undefined, filled: null };
    }
    // Removing the scheduled pick is the documented escape hatch — re-fill the
    // now-empty slot from the next proposal (no-op when a list item was removed).
    const fill = await ensureScheduledFilled(trx);
    return { deleted, filled: fill.scheduledProposalId };
  });

  if (result.deleted === undefined) {
    return errorResponse("Proposal not found", 404);
  }

  await logAudit({
    userId: user.id,
    action: "queue.removed",
    entityType: "queue_proposal",
    entityId: result.deleted.id,
    metadata: { mediaId: result.deleted.media_id, status: result.deleted.status },
  });

  if (result.filled !== null) {
    await logAudit({
      userId: user.id,
      action: "queue.advanced",
      entityType: "queue_proposal",
      entityId: result.filled,
      metadata: { scheduledProposalId: result.filled, reason: "slot_filled_on_remove" },
    });
  }

  return successResponse({ id: result.deleted.id }, "Proposal removed");
}
