/**
 * GET /api/stats/feed — Recent activity feed
 */

import type { NextRequest } from "next/server";

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { paginationSchema } from "@/lib/validations/common";

export async function GET(req: NextRequest) {
  await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const { page, limit } = paginationSchema.parse(params);
  const offset = (page - 1) * limit;

  // Recent sessions
  const recentSessions = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .leftJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "watch_sessions.id",
      "watch_sessions.created_at",
      "media.title as media_title",
      "media.type as media_type",
      "media.poster_url as media_poster_url",
      "users.username as picker_username",
      "users.display_name as picker_display_name",
    ])
    .orderBy("watch_sessions.created_at", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  // Recent ratings
  const recentRatings = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "ratings.id",
      "ratings.score",
      "ratings.review",
      "ratings.created_at",
      "media.title as media_title",
      "media.type as media_type",
      "users.username",
      "users.display_name",
    ])
    .orderBy("ratings.created_at", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  // Merge and sort by created_at
  type NormalizedRating = Omit<(typeof recentRatings)[number], "score"> & { score: number };
  type FeedItem =
    | { type: "session"; data: (typeof recentSessions)[number]; createdAt: Date }
    | { type: "rating"; data: NormalizedRating; createdAt: Date };

  const feed: FeedItem[] = [
    ...recentSessions.map((s) => ({ type: "session" as const, data: s, createdAt: s.created_at })),
    ...recentRatings.map((r) => ({
      type: "rating" as const,
      data: { ...r, score: Number(r.score) },
      createdAt: r.created_at,
    })),
  ];

  feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return successResponse({
    items: feed.slice(0, limit),
    page,
    limit,
  });
}
