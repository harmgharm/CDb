/**
 * GET /api/ratings — List ratings with filters
 * POST /api/ratings — Submit a rating for a session
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ratingSchema } from "@/lib/validations/sessions";

export async function GET(req: NextRequest) {
  await requireAuth();

  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
  const userId = req.nextUrl.searchParams.get("userId") ?? undefined;

  let query = db
    .selectFrom("ratings")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "ratings.id",
      "ratings.session_id",
      "ratings.score",
      "ratings.review",
      "ratings.created_at",
      "users.id as user_id",
      "users.username",
      "users.display_name",
    ]);

  if (sessionId !== undefined) {
    query = query.where("ratings.session_id", "=", sessionId);
  }
  if (userId !== undefined) {
    query = query.where("ratings.user_id", "=", userId);
  }

  const results = await query.orderBy("ratings.created_at", "desc").execute();

  return successResponse(results);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { sessionId, score, review } = parsed.data;

  // Verify session exists
  const session = await db
    .selectFrom("watch_sessions")
    .select("id")
    .where("id", "=", sessionId)
    .executeTakeFirst();
  if (!session) {
    return errorResponse("Session not found", 404);
  }

  // Verify user is an attendee
  const attendance = await db
    .selectFrom("session_attendees")
    .select("id")
    .where("session_id", "=", sessionId)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (!attendance) {
    return errorResponse("You must be an attendee of this session to rate it", 403);
  }

  // Check for existing rating (unique constraint)
  const existing = await db
    .selectFrom("ratings")
    .select("id")
    .where("session_id", "=", sessionId)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (existing) {
    return errorResponse("You have already rated this session", 409);
  }

  const rating = await db
    .insertInto("ratings")
    .values({
      session_id: sessionId,
      user_id: user.id,
      score,
      review: review ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "rating.created",
    entityType: "rating",
    entityId: rating.id,
    metadata: { sessionId, score },
  });

  return successResponse(rating, "Rating submitted", 201);
}
