/**
 * GET /api/sessions — List sessions with filters
 * POST /api/sessions — Create session with attendees
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { invalidateGroupRecommendations } from "@/lib/recommendations";
import { createSessionSchema, sessionQuerySchema } from "@/lib/validations/sessions";

export async function GET(req: NextRequest) {
  await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = sessionQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { mediaId, userId, pickedBy, dateFrom, dateTo, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .leftJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "watch_sessions.id",
      "watch_sessions.date_watched",
      "watch_sessions.time_watched_at",
      "watch_sessions.notes",
      "watch_sessions.created_at",
      "media.id as media_id",
      "media.title as media_title",
      "media.type as media_type",
      "media.poster_url as media_poster_url",
      "users.id as picker_id",
      "users.username as picker_username",
      "users.display_name as picker_display_name",
    ]);

  if (mediaId !== undefined) {
    query = query.where("watch_sessions.media_id", "=", mediaId);
  }
  if (pickedBy !== undefined) {
    query = query.where("watch_sessions.picked_by_user_id", "=", pickedBy);
  }
  if (dateFrom !== undefined) {
    query = query.where("watch_sessions.date_watched", ">=", dateFrom);
  }
  if (dateTo !== undefined) {
    query = query.where("watch_sessions.date_watched", "<=", dateTo);
  }
  if (userId !== undefined) {
    query = query
      .innerJoin("session_attendees", "session_attendees.session_id", "watch_sessions.id")
      .where("session_attendees.user_id", "=", userId);
  }

  const results = await query
    .orderBy("watch_sessions.date_watched", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  return successResponse({ items: results, page, limit });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { mediaId, dateWatched, timeWatchedAt, pickedByUserId, attendeeIds, notes } = parsed.data;

  // Verify media exists
  const media = await db
    .selectFrom("media")
    .select("id")
    .where("id", "=", mediaId)
    .executeTakeFirst();
  if (!media) {
    return errorResponse("Media not found", 404);
  }

  // Verify picker is in attendees (if a picker was selected)
  if (
    pickedByUserId !== null &&
    pickedByUserId !== undefined &&
    !attendeeIds.includes(pickedByUserId)
  ) {
    return errorResponse("Picker must be an attendee", 400);
  }

  const session = await withTransaction(async (trx) => {
    const newSession = await trx
      .insertInto("watch_sessions")
      .values({
        media_id: mediaId,
        date_watched: dateWatched,
        time_watched_at: timeWatchedAt ?? null,
        picked_by_user_id: pickedByUserId ?? null,
        created_by_user_id: user.id,
        notes: notes ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Insert attendees
    await trx
      .insertInto("session_attendees")
      .values(
        attendeeIds.map((uid) => ({
          session_id: newSession.id,
          user_id: uid,
        })),
      )
      .execute();

    // Auto-remove from attendees' watchlists for this media
    await trx
      .deleteFrom("watchlist")
      .where("media_id", "=", mediaId)
      .where("user_id", "in", attendeeIds)
      .execute();

    return newSession;
  });

  await logAudit({
    userId: user.id,
    action: "session.created",
    entityType: "session",
    entityId: session.id,
    metadata: { mediaId, attendeeCount: attendeeIds.length },
  });

  // Invalidate group recommendation cache
  void invalidateGroupRecommendations().catch((error: unknown) => {
    console.error("Failed to invalidate group recommendations:", error);
  });

  return successResponse(session, "Session created", 201);
}
