/**
 * POST /api/sessions/[id]/attendees — Add attendees
 * DELETE /api/sessions/[id]/attendees?userId=... — Remove attendee
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addAttendeesSchema } from "@/lib/validations/sessions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const session = await db
    .selectFrom("watch_sessions")
    .select(["id", "picked_by_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!session) {
    return errorResponse("Session not found", 404);
  }

  if (user.role !== "admin" && user.id !== session.picked_by_user_id) {
    return errorResponse("Not authorized", 403);
  }

  const body: unknown = await req.json();
  const parsed = addAttendeesSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  // Insert attendees, ignoring duplicates via ON CONFLICT
  for (const userId of parsed.data.userIds) {
    await db
      .insertInto("session_attendees")
      .values({ session_id: id, user_id: userId })
      .onConflict((oc) => oc.constraint("session_attendees_unique").doNothing())
      .execute();
  }

  return successResponse(null, "Attendees added");
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  const userId = req.nextUrl.searchParams.get("userId") ?? "";
  if (userId.length === 0) {
    return errorResponse("userId query parameter is required", 400);
  }

  const session = await db
    .selectFrom("watch_sessions")
    .select(["id", "picked_by_user_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!session) {
    return errorResponse("Session not found", 404);
  }

  if (user.role !== "admin" && user.id !== session.picked_by_user_id) {
    return errorResponse("Not authorized", 403);
  }

  // Prevent removing last attendee
  const attendeeCount = await db
    .selectFrom("session_attendees")
    .select(db.fn.countAll().as("count"))
    .where("session_id", "=", id)
    .executeTakeFirstOrThrow();

  if (Number(attendeeCount.count) <= 1) {
    return errorResponse("Cannot remove the last attendee", 400);
  }

  await db
    .deleteFrom("session_attendees")
    .where("session_id", "=", id)
    .where("user_id", "=", userId)
    .execute();

  return successResponse(null, "Attendee removed");
}
