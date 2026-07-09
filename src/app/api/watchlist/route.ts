/**
 * GET /api/watchlist — List watchlist entries (own or another user's)
 * POST /api/watchlist — Add a title to your watchlist
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser, logAudit } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import type { MediaType } from "@/lib/db/types";
import { addToWatchlistSchema, watchlistQuerySchema } from "@/lib/validations/watchlist";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = watchlistQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { status, mediaId, page, limit } = parsed.data;
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

  if (mediaId !== undefined) {
    query = query.where("watchlist.media_id", "=", mediaId);
  }

  // Count total for pagination
  let countQuery = db
    .selectFrom("watchlist")
    .select(db.fn.countAll().as("count"))
    .where("user_id", "=", userId);

  if (status !== undefined) {
    countQuery = countQuery.where("status", "=", status);
  }

  if (mediaId !== undefined) {
    countQuery = countQuery.where("media_id", "=", mediaId);
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
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const body: unknown = await req.json();
  const parsed = addToWatchlistSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { mediaId, tmdbId, malId, extTitle, extPosterUrl, extMediaType, status, notes } =
    parsed.data;

  // For imported media, mirror the title's external ids + display fields onto
  // the entry as a deletion fallback. If the media is ever deleted the FK goes
  // to null (migration 0030) and the row downgrades to external-only instead of
  // being destroyed. The lookup also verifies the media exists.
  let mediaFallback: {
    tmdb_id: number | null;
    mal_id: number | null;
    ext_title: string;
    ext_poster_url: string | null;
    ext_media_type: MediaType;
  } | null = null;
  if (mediaId !== undefined) {
    const media = await db
      .selectFrom("media")
      .select(["tmdb_id", "mal_id", "title", "poster_url", "type"])
      .where("id", "=", mediaId)
      .executeTakeFirst();
    if (media === undefined) {
      return errorResponse("Media not found", 404);
    }
    mediaFallback = {
      tmdb_id: media.tmdb_id,
      mal_id: media.mal_id,
      ext_title: media.title,
      ext_poster_url: media.poster_url,
      ext_media_type: media.type,
    };
  }

  const insertValues = {
    user_id: user.id,
    media_id: mediaId ?? null,
    // Imported rows take their fallback from media; external-only rows take
    // the client-supplied ext_* values.
    tmdb_id: mediaFallback?.tmdb_id ?? tmdbId ?? null,
    mal_id: mediaFallback?.mal_id ?? malId ?? null,
    ext_title: mediaFallback?.ext_title ?? extTitle ?? null,
    ext_poster_url: mediaFallback?.ext_poster_url ?? extPosterUrl ?? null,
    ext_media_type: mediaFallback?.ext_media_type ?? extMediaType ?? null,
    status,
    notes: notes ?? null,
  };

  try {
    const entry = await withTransaction(async (trx) => {
      // An imported row now also carries the title's external ids as a deletion
      // fallback. If the user already has the same title as an external-only
      // entry, the two would share (user_id, tmdb_id/mal_id) — invisible to the
      // partial unique indexes (scoped `media_id IS NULL`) while this row has a
      // media_id, but a later media delete sets media_id null and the rows then
      // collide, failing the delete. Supersede the external-only row with the
      // richer imported one, carrying over its status/notes so re-adding a title
      // you'd already bookmarked doesn't reset your progress. Skipped for
      // external-only adds.
      if (mediaId !== undefined) {
        const { tmdb_id, mal_id } = insertValues;
        const superseded = await trx
          .deleteFrom("watchlist")
          .where("user_id", "=", user.id)
          .where("media_id", "is", null)
          .where((eb) =>
            // Match the external-only row(s) sharing this title's id(s). The
            // media CHECK guarantees ≥1 of tmdb_id/mal_id is non-null, so this
            // OR-list is never empty (an empty `or([])` is SQL `false`).
            eb.or(
              [
                tmdb_id === null ? null : eb("tmdb_id", "=", tmdb_id),
                mal_id === null ? null : eb("mal_id", "=", mal_id),
              ].filter((c) => c !== null),
            ),
          )
          .returning(["status", "notes"])
          .executeTakeFirst();

        // Inherit the superseded row's status/notes unless this request actively
        // set its own (a non-default status, or any notes). Lets an explicit
        // re-add still override, but a bare add preserves prior progress.
        if (superseded !== undefined) {
          if (insertValues.status === "planning") insertValues.status = superseded.status;
          insertValues.notes ??= superseded.notes;
        }
      }

      return trx
        .insertInto("watchlist")
        .values(insertValues)
        .returningAll()
        .executeTakeFirstOrThrow();
    });

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
