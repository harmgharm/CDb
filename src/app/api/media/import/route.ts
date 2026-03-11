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

async function checkDuplicate(
  column: "tmdb_id" | "mal_id",
  value: number,
  label: string,
): Promise<Response | null> {
  const existing = await db
    .selectFrom("media")
    .select("id")
    .where(column, "=", value)
    .executeTakeFirst();
  return existing ? errorResponse(`Media with this ${label} already exists`, 409) : null;
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

  // Check for duplicate
  if (tmdbId !== undefined) {
    const duplicate = await checkDuplicate("tmdb_id", tmdbId, "TMDB ID");
    if (duplicate !== null) return duplicate;
  }
  if (malId !== undefined) {
    const duplicate = await checkDuplicate("mal_id", malId, "MAL ID");
    if (duplicate !== null) return duplicate;
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

  return successResponse(media, "Media imported", 201);
}
