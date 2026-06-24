/**
 * POST /api/media/import
 *
 * Import media from TMDB or Jikan by external ID.
 * Fetches full metadata and creates the media entry.
 */

import type { NextRequest } from "next/server";

import type { MediaMetadata } from "@/lib/api/metadata";
import {
  fetchAnimeMetadata,
  fetchMovieMetadata,
  fetchTvMetadata,
  metadataToDbFields,
} from "@/lib/api/metadata";
import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { NewMedia } from "@/lib/db/types";
import { importMediaSchema } from "@/lib/validations/media";

/**
 * If a media row with this external ID already exists, return it (the full row,
 * so the caller can hand back the same shape as a fresh import). Returns `null`
 * when the title hasn't been imported yet. The watchlist import-then-propose
 * path has no search step to pre-resolve an already-imported title to its media
 * id, so the import endpoint surfaces the existing row instead of a 409 — a
 * usable id to propose.
 */
async function findExisting(column: "tmdb_id" | "mal_id", value: number) {
  return db.selectFrom("media").selectAll().where(column, "=", value).executeTakeFirst();
}

async function fetchMetadata(
  type: string,
  tmdbId: number | undefined,
  malId: number | undefined,
): Promise<MediaMetadata | null> {
  if (type === "movie" && tmdbId !== undefined) return fetchMovieMetadata(tmdbId);
  if (type === "tv" && tmdbId !== undefined) return fetchTvMetadata(tmdbId);
  if (type === "anime" && malId !== undefined) return fetchAnimeMetadata(malId);
  return null;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = importMediaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input. Provide tmdbId or malId with type.", 400);
  }

  const { tmdbId, malId, type } = parsed.data;

  // Already imported? Hand back the existing row (a usable id to propose /
  // watchlist), flagged `alreadyExisted`, instead of erroring. Short-circuits
  // before the external API, so a duplicate import costs no TMDB/Jikan call.
  const existing =
    (tmdbId === undefined ? undefined : await findExisting("tmdb_id", tmdbId)) ??
    (malId === undefined ? undefined : await findExisting("mal_id", malId));
  if (existing !== undefined) {
    return successResponse({ ...existing, alreadyExisted: true }, "Media already imported", 200);
  }

  // Fetch metadata from external API
  const metadata = await fetchMetadata(type, tmdbId, malId);
  if (metadata === null) {
    return errorResponse("Invalid type/ID combination", 400);
  }

  const media = await db
    .insertInto("media")
    .values({
      type,
      tmdb_id: tmdbId ?? null,
      mal_id: malId ?? null,
      ...metadataToDbFields(metadata),
    } as NewMedia)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Link existing watchlist entries (added via external ID) to the new media record.
  // Must clear external IDs to satisfy the watchlist_anchor_check constraint
  // (media_id XOR external IDs).
  if (tmdbId !== undefined) {
    await db
      .updateTable("watchlist")
      .set({ media_id: media.id, tmdb_id: null, mal_id: null })
      .where("tmdb_id", "=", tmdbId)
      .where("media_id", "is", null)
      .execute();
  }
  if (malId !== undefined) {
    await db
      .updateTable("watchlist")
      .set({ media_id: media.id, tmdb_id: null, mal_id: null })
      .where("mal_id", "=", malId)
      .where("media_id", "is", null)
      .execute();
  }

  await logAudit({
    userId: user.id,
    action: "media.created",
    entityType: "media",
    entityId: media.id,
    metadata: { title: metadata.title, type, tmdbId, malId, source: "import" },
  });

  return successResponse({ ...media, alreadyExisted: false }, "Media imported", 201);
}
