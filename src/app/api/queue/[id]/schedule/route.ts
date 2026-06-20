/**
 * PATCH /api/queue/[id]/schedule — Set or change the scheduled pick's date
 *
 * Body `{ scheduledDate }` (a date, or `null` to clear back to dateless). Only
 * the scheduled pick carries a date, so this rejects non-scheduled proposals.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scheduleSchema } from "@/lib/validations/queue";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  await requireAuth();
  const { id } = await params;

  const body: unknown = await req.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
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
}
