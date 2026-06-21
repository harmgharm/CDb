/**
 * DELETE /api/queue/[id] — Remove a proposal from the queue (any member)
 *
 * Full-trust: any member may remove any proposal. Destructive, so audit-logged.
 * Votes cascade away with the row.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import { withTransaction } from "@/lib/db/transaction";
import { publishToQueue } from "@/lib/notifications";
import { ensureScheduledFilled } from "@/lib/queue/ensure-scheduled";
import { isMediaOrphaned } from "@/lib/queue/orphan";
import { QUEUE_EVENTS } from "@/lib/queue/realtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Delete the media row left behind by a removed proposal IF nothing else
 * references it (no sessions, no other active proposals, no watchlist entries) —
 * reclaiming an import-then-propose orphan. Returns true when it deleted media.
 * Runs in the same transaction as the proposal delete so it's all-or-nothing.
 */
async function cleanupOrphanedMedia(trx: DatabaseTransaction, mediaId: string): Promise<boolean> {
  const count = async (table: "watch_sessions" | "queue_proposals" | "watchlist") => {
    let query = trx
      .selectFrom(table)
      .select((eb) => eb.fn.countAll().as("c"))
      .where("media_id", "=", mediaId);
    // Only active proposals keep the media alive; watched history doesn't (a
    // watched proposal already implies a session, which is counted separately).
    if (table === "queue_proposals") {
      query = query.where("status", "in", ["proposed", "scheduled"]);
    }
    const row = await query.executeTakeFirstOrThrow();
    return Number(row.c);
  };

  const [sessionCount, activeProposalCount, watchlistCount] = await Promise.all([
    count("watch_sessions"),
    count("queue_proposals"),
    count("watchlist"),
  ]);

  if (!isMediaOrphaned({ sessionCount, activeProposalCount, watchlistCount })) {
    return false;
  }

  await trx.deleteFrom("media").where("id", "=", mediaId).execute();
  return true;
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
    // Reclaim the media row if this removal left it referenced by nothing (an
    // import-then-propose suggestion that was never watched). Runs after the
    // delete + fill so the just-removed/just-promoted rows are counted correctly.
    const mediaDeleted = await cleanupOrphanedMedia(trx, deleted.media_id);
    return { deleted, filled: fill.scheduledProposalId, mediaDeleted };
  });

  if (result.deleted === undefined) {
    return errorResponse("Proposal not found", 404);
  }

  // Audit after commit (same as the sessions route): a crash between commit and
  // these writes can under-report the advance, which we accept rather than
  // couple audit durability — and audit latency — to the user-facing write.
  await logAudit({
    userId: user.id,
    action: "queue.removed",
    entityType: "queue_proposal",
    entityId: result.deleted.id,
    metadata: { mediaId: result.deleted.media_id, status: result.deleted.status },
  });

  // The removal left an orphaned media row, which we reclaimed (no sessions /
  // active proposals / watchlist entries referenced it). Trail it so a vanished
  // media row isn't mysterious.
  if (result.mediaDeleted) {
    await logAudit({
      userId: user.id,
      action: "media.deleted",
      entityType: "media",
      entityId: result.deleted.media_id,
      metadata: { reason: "orphaned_after_queue_removal" },
    });
  }

  if (result.filled !== null) {
    await logAudit({
      userId: user.id,
      action: "queue.advanced",
      entityType: "queue_proposal",
      entityId: result.filled,
      metadata: { scheduledProposalId: result.filled, reason: "slot_filled_on_remove" },
    });
  }

  // Broadcast the removal so every client revalidates. A single `removed` event
  // covers an escape-hatch re-fill too — clients refetch the full state, which
  // already reflects any promotion into the freed slot.
  publishToQueue(QUEUE_EVENTS.removed, { proposalId: result.deleted.id });

  return successResponse({ id: result.deleted.id }, "Proposal removed");
}
