/**
 * POST /api/media/[id]/refresh
 *
 * Refresh a single media entry's metadata from TMDB/Jikan.
 */

import {
  fetchAnimeMetadata,
  fetchMovieMetadata,
  fetchTvMetadata,
  metadataToDbFields,
} from "@/lib/api/metadata";
import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireModerator } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParameters {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParameters) {
  const user = await requireModerator();
  const { id } = await params;

  const media = await db
    .selectFrom("media")
    .select(["id", "title", "type", "tmdb_id", "mal_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (media === undefined) {
    return errorResponse("Media not found", 404);
  }

  let metadata;
  if (media.type === "movie" && media.tmdb_id !== null) {
    metadata = await fetchMovieMetadata(media.tmdb_id);
  } else if (media.type === "tv" && media.tmdb_id !== null) {
    metadata = await fetchTvMetadata(media.tmdb_id);
  } else if (media.type === "anime" && media.mal_id !== null) {
    metadata = await fetchAnimeMetadata(media.mal_id);
  } else {
    return errorResponse("No valid external ID for refresh", 400);
  }

  const updated = await db
    .updateTable("media")
    .set({ ...metadataToDbFields(metadata), updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "media.updated",
    entityType: "media",
    entityId: id,
    metadata: { title: metadata.title, source: "refresh" },
  });

  return successResponse(updated, "Media refreshed");
}
