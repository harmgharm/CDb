/**
 * GET /api/sessions — List sessions with filters
 * POST /api/sessions — Create session with attendees
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { isModeratorOrAdmin, logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import type { User, UserRole, WatchSession } from "@/lib/db/types";
import {
  createRatePendingNotifications,
  createSessionCreatedNotifications,
  createWatchlistFriendWatchedNotifications,
} from "@/lib/notifications";
import {
  invalidateGroupRecommendations,
  invalidateUserRecommendations,
} from "@/lib/recommendations";
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
      "users.avatar_url as picker_avatar_url",
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
    .orderBy(sql`watch_sessions.date_watched desc nulls last`)
    .offset(offset)
    .limit(limit)
    .execute();

  return successResponse({ items: results, page, limit });
}

interface InlineRating {
  userId: string;
  score: number;
}

interface ValidateRatingsOptions {
  ratings: InlineRating[];
  attendeeIds: string[];
  currentUserId: string;
  currentUserRole: UserRole;
}

function validateInlineRatings(options: ValidateRatingsOptions): string | null {
  for (const r of options.ratings) {
    if (!options.attendeeIds.includes(r.userId)) {
      return "Rating user must be an attendee";
    }
    if (r.userId !== options.currentUserId && !isModeratorOrAdmin(options.currentUserRole)) {
      return "Only admins and moderators can submit ratings on behalf of other users";
    }
  }
  return null;
}

interface PostSessionCreationOptions {
  user: User;
  session: WatchSession;
  mediaId: string;
  mediaTitle: string;
  attendeeIds: string[];
  ratings: InlineRating[] | undefined;
}

async function handlePostSessionCreation(options: PostSessionCreationOptions): Promise<void> {
  const { user, session, mediaId, mediaTitle, attendeeIds, ratings } = options;
  await logAudit({
    userId: user.id,
    action: "session.created",
    entityType: "session",
    entityId: session.id,
    metadata: { mediaId, attendeeCount: attendeeIds.length },
  });

  if (ratings !== undefined && ratings.length > 0) {
    await Promise.all(
      ratings.map((r) =>
        logAudit({
          userId: user.id,
          action: "rating.created",
          entityType: "rating",
          entityId: session.id,
          metadata: {
            sessionId: session.id,
            score: r.score,
            onBehalfOf: r.userId === user.id ? undefined : r.userId,
          },
        }),
      ),
    );

    for (const r of ratings) {
      void invalidateUserRecommendations(r.userId).catch((error: unknown) => {
        console.error("Failed to invalidate user recommendations:", error);
      });
    }
  }

  void invalidateGroupRecommendations().catch((error: unknown) => {
    console.error("Failed to invalidate group recommendations:", error);
  });

  const ratedUserIds = ratings === undefined ? [] : ratings.map((r) => r.userId);
  void createRatePendingNotifications({
    sessionId: session.id,
    mediaId,
    mediaTitle,
    attendeeIds,
    ratedUserIds,
  }).catch((error: unknown) => {
    console.error("Failed to create rate-pending notifications:", error);
  });

  // Notify all members about new session
  void createSessionCreatedNotifications({
    sessionId: session.id,
    mediaId,
    mediaTitle,
    creatorUserId: user.id,
    creatorDisplayName: user.display_name ?? user.username,
    pickedByUserId: session.picked_by_user_id,
  }).catch((error: unknown) => {
    console.error("Failed to create session.created notifications:", error);
  });

  // Notify users who have this media on their watchlist
  void createWatchlistFriendWatchedNotifications({
    sessionId: session.id,
    mediaId,
    mediaTitle,
    attendeeIds,
  }).catch((error: unknown) => {
    console.error("Failed to create watchlist.friend_watched notifications:", error);
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { mediaId, dateWatched, timeWatchedAt, pickedByUserId, attendeeIds, notes, ratings } =
    parsed.data;

  // Verify media exists (also fetch title for notifications)
  const media = await db
    .selectFrom("media")
    .select(["id", "title"])
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

  // Validate inline ratings
  if (ratings !== undefined && ratings.length > 0) {
    const ratingError = validateInlineRatings({
      ratings,
      attendeeIds,
      currentUserId: user.id,
      currentUserRole: user.role,
    });
    if (ratingError !== null) {
      const status = ratingError.includes("admins") ? 403 : 400;
      return errorResponse(ratingError, status);
    }
  }

  const session = await withTransaction(async (trx) => {
    const newSession = await trx
      .insertInto("watch_sessions")
      .values({
        media_id: mediaId,
        date_watched: dateWatched ?? null,
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

    // Insert inline ratings
    if (ratings !== undefined && ratings.length > 0) {
      await trx
        .insertInto("ratings")
        .values(
          ratings.map((r) => ({
            session_id: newSession.id,
            user_id: r.userId,
            score: r.score,
            review: null,
          })),
        )
        .execute();
    }

    // Auto-remove from attendees' watchlists for this media
    await trx
      .deleteFrom("watchlist")
      .where("media_id", "=", mediaId)
      .where("user_id", "in", attendeeIds)
      .execute();

    return newSession;
  });

  // Fire post-creation side effects (audit, cache invalidation, notifications)
  await handlePostSessionCreation({
    user,
    session,
    mediaId,
    mediaTitle: media.title,
    attendeeIds,
    ratings,
  });

  return successResponse(session, "Session created", 201);
}
