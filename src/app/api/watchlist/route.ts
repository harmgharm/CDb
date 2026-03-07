/**
 * GET /api/watchlist — List watchlist entries (own or another user's)
 * POST /api/watchlist — Add a title to your watchlist
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { addToWatchlistSchema, watchlistQuerySchema } from "@/lib/validations/watchlist";

export async function GET(req: NextRequest) {
  const user = await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = watchlistQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { status, page, limit } = parsed.data;
  const userId = parsed.data.userId ?? user.id;
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("watchlist")
    .leftJoin("media", "media.id", "watchlist.media_id")
    .select([
      "watchlist.id",
      "watchlist.user_id",
      "watchlist.media_id",
      "watchlist.tmdb_id",
      "watchlist.mal_id",
      "watchlist.status",
      "watchlist.notes",
      "watchlist.created_at",
      "watchlist.updated_at",
      // Resolve display fields: prefer media table, fall back to ext_* columns
      sql<string>`COALESCE(media.title, watchlist.ext_title)`.as("title"),
      sql<string | null>`COALESCE(media.poster_url, watchlist.ext_poster_url)`.as("poster_url"),
      sql<string>`COALESCE(media.type, watchlist.ext_media_type)`.as("media_type"),
    ])
    .where("watchlist.user_id", "=", userId);

  if (status !== undefined) {
    query = query.where("watchlist.status", "=", status);
  }

  // Count total for pagination
  let countQuery = db
    .selectFrom("watchlist")
    .select(db.fn.countAll().as("count"))
    .where("user_id", "=", userId);

  if (status !== undefined) {
    countQuery = countQuery.where("status", "=", status);
  }

  const countResult = await countQuery.executeTakeFirstOrThrow();

  const total = Number(countResult.count);

  const items = await query
    .orderBy("watchlist.created_at", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  return successResponse({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = addToWatchlistSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { mediaId, tmdbId, malId, extTitle, extPosterUrl, extMediaType, status, notes } =
    parsed.data;

  // If adding imported media, verify it exists
  if (mediaId !== undefined) {
    const media = await db
      .selectFrom("media")
      .select("id")
      .where("id", "=", mediaId)
      .executeTakeFirst();
    if (media === undefined) {
      return errorResponse("Media not found", 404);
    }
  }

  try {
    const entry = await db
      .insertInto("watchlist")
      .values({
        user_id: user.id,
        media_id: mediaId ?? null,
        tmdb_id: tmdbId ?? null,
        mal_id: malId ?? null,
        ext_title: extTitle ?? null,
        ext_poster_url: extPosterUrl ?? null,
        ext_media_type: extMediaType ?? null,
        status,
        notes: notes ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAudit({
      userId: user.id,
      action: "watchlist.added",
      entityType: "watchlist",
      entityId: entry.id,
      metadata: { title: extTitle ?? mediaId },
    });

    return successResponse(entry, "Added to watchlist", 201);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return errorResponse("Already in your watchlist", 409);
    }
    throw error;
  }
}
