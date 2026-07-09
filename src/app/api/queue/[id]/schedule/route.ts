/**
 * PATCH /api/queue/[id]/schedule — Set or change the scheduled pick's date
 *
 * Body `{ scheduledDate }` (a date, or `null` to clear back to dateless). Only
 * the scheduled pick carries a date, so this rejects non-scheduled proposals.
 */

import { parseBody } from "@/lib/api/parse-body";
import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import { publishToQueue } from "@/lib/notifications";
import { QUEUE_EVENTS } from "@/lib/queue/realtime";
import { scheduleSchema } from "@/lib/validations/queue";

export const PATCH = withAuth<{ id: string }>(async (req, _user, { params }) => {
  const { id } = await params;

  const parsed = await parseBody(req, scheduleSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  // Atomic guarded update: only the scheduled pick can be dated. Filtering on
  // status in the UPDATE closes the TOCTOU between a separate check and write.
  const updated = await db
    .updateTable("queue_proposals")
    .set({ scheduled_date: parsed.data.scheduledDate, updated_at: new Date() })
    .where("id", "=", id)
    .where("status", "=", "scheduled")
    .returningAll()
    .executeTakeFirst();

  if (updated !== undefined) {
    // Broadcast the date change; the validated input carries the literal
    // "YYYY-MM-DD" (or null), avoiding a TZ round-trip through the stored Date.
    publishToQueue(QUEUE_EVENTS.scheduled, {
      proposalId: id,
      scheduledDate: parsed.data.scheduledDate,
    });
    return successResponse(updated, "Schedule updated");
  }

  // Zero rows updated: either the proposal doesn't exist (404) or it exists but
  // isn't the scheduled pick (409). One existence check disambiguates.
  const exists = await db
    .selectFrom("queue_proposals")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();

  return exists === undefined
    ? errorResponse("Proposal not found", 404)
    : errorResponse("Only the scheduled pick can be dated", 409);
});
