/**
 * DELETE /api/queue/[id] — Remove a proposal from the queue (any member)
 *
 * Full-trust: any member may remove any proposal. Destructive, so audit-logged.
 * Votes cascade away with the row.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const deleted = await db
    .deleteFrom("queue_proposals")
    .where("id", "=", id)
    .returning(["id", "media_id", "status"])
    .executeTakeFirst();

  if (deleted === undefined) {
    return errorResponse("Proposal not found", 404);
  }

  await logAudit({
    userId: user.id,
    action: "queue.removed",
    entityType: "queue_proposal",
    entityId: deleted.id,
    metadata: { mediaId: deleted.media_id, status: deleted.status },
  });

  return successResponse({ id: deleted.id }, "Proposal removed");
}
