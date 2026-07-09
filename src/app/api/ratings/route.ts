/**
 * GET /api/ratings — List ratings with filters
 * POST /api/ratings — Submit a rating for a session
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser, isModeratorOrAdmin, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRatingSubmittedNotification } from "@/lib/notifications";
import { invalidateUserRecommendations } from "@/lib/recommendations";
import { ratingSchema } from "@/lib/validations/sessions";

export async function GET(req: NextRequest) {
  const _user = await getAuthUser();
  if (!_user) {
    return errorResponse("Not authenticated", 401);
  }

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
      "users.avatar_url",
    ]);

  if (sessionId !== undefined) {
    query = query.where("ratings.session_id", "=", sessionId);
  }
  if (userId !== undefined) {
    query = query.where("ratings.user_id", "=", userId);
  }

  const results = await query.orderBy("ratings.created_at", "desc").execute();

  return successResponse(results.map((r) => ({ ...r, score: Number(r.score) })));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const body: unknown = await req.json();
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { sessionId, score, review, userId: targetUserId } = parsed.data;

  // Determine who the rating is for
  const ratingUserId = targetUserId ?? user.id;

  // Only admins/mods can submit ratings on behalf of other users
  if (targetUserId !== undefined && targetUserId !== user.id && !isModeratorOrAdmin(user.role)) {
    return errorResponse(
      "Only admins and moderators can submit ratings on behalf of other users",
      403,
    );
  }

  // Verify session exists + fetch picker/media info for notifications
  const session = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select([
      "watch_sessions.id",
      "watch_sessions.picked_by_user_id",
      "media.id as media_id",
      "media.title as media_title",
    ])
    .where("watch_sessions.id", "=", sessionId)
    .executeTakeFirst();
  if (!session) {
    return errorResponse("Session not found", 404);
  }

  // Verify target user is an attendee
  const attendance = await db
    .selectFrom("session_attendees")
    .select("id")
    .where("session_id", "=", sessionId)
    .where("user_id", "=", ratingUserId)
    .executeTakeFirst();

  if (!attendance) {
    return errorResponse("User must be an attendee of this session to rate it", 403);
  }

  // Check for existing rating (unique constraint)
  const existing = await db
    .selectFrom("ratings")
    .select("id")
    .where("session_id", "=", sessionId)
    .where("user_id", "=", ratingUserId)
    .executeTakeFirst();

  if (existing) {
    return errorResponse("This user has already rated this session", 409);
  }

  const rating = await db
    .insertInto("ratings")
    .values({
      session_id: sessionId,
      user_id: ratingUserId,
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
    metadata: { sessionId, score, onBehalfOf: targetUserId ?? undefined },
  });

  // Invalidate recommendation cache for the rating user
  void invalidateUserRecommendations(ratingUserId).catch((error: unknown) => {
    console.error("Failed to invalidate user recommendations:", error);
  });

  // Auto-dismiss rate-pending notifications for this session
  void db
    .updateTable("notifications")
    .set({ is_read: true })
    .where("user_id", "=", ratingUserId)
    .where("type", "=", "session.rate_pending")
    .where("is_read", "=", false)
    .where(sql<boolean>`metadata @> ${JSON.stringify({ sessionId })}::jsonb`)
    .execute()
    .catch((error: unknown) => {
      console.error("Failed to auto-dismiss rate-pending notification:", error);
    });

  // Notify the picker about this rating
  if (session.picked_by_user_id !== null) {
    void createRatingSubmittedNotification({
      sessionId,
      mediaId: session.media_id,
      mediaTitle: session.media_title,
      raterUserId: ratingUserId,
      raterDisplayName: user.display_name ?? user.username,
      score,
      pickedByUserId: session.picked_by_user_id,
    }).catch((error: unknown) => {
      console.error("Failed to create rating.submitted notification:", error);
    });
  }

  return successResponse({ ...rating, score: Number(rating.score) }, "Rating submitted", 201);
}
