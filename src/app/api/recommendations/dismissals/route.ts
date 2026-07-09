/**
 * GET /api/recommendations/dismissals — List dismissed recommendations
 * POST /api/recommendations/dismissals — Dismiss a recommendation
 */

import { parseBody } from "@/lib/api/parse-body";
import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { dismissRecommendationSchema } from "@/lib/validations/recommendations";

export const GET = withAuth(async (_req, user) => {
  const rows = await db
    .selectFrom("recommendation_dismissals")
    .select([
      "id",
      "media_id",
      "tmdb_id",
      "mal_id",
      "ext_title",
      "ext_poster_url",
      "ext_media_type",
      "created_at",
    ])
    .where("user_id", "=", user.id)
    .orderBy("created_at", "desc")
    .execute();

  const items = rows.map((row) => ({
    id: row.id,
    mediaId: row.media_id,
    tmdbId: row.tmdb_id,
    malId: row.mal_id,
    title: row.ext_title,
    posterUrl: row.ext_poster_url,
    mediaType: row.ext_media_type,
    createdAt: row.created_at.toISOString(),
  }));

  return successResponse({ items });
});

export const POST = withAuth(async (req, user) => {
  const parsed = await parseBody(req, dismissRecommendationSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { mediaId, tmdbId, malId, extTitle, extPosterUrl, extMediaType } = parsed.data;

  try {
    const entry = await db
      .insertInto("recommendation_dismissals")
      .values({
        user_id: user.id,
        media_id: mediaId ?? null,
        tmdb_id: tmdbId ?? null,
        mal_id: malId ?? null,
        ext_title: extTitle ?? null,
        ext_poster_url: extPosterUrl ?? null,
        ext_media_type: extMediaType ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAudit({
      userId: user.id,
      action: "recommendation.dismissed",
      entityType: "recommendation_dismissal",
      entityId: entry.id,
      metadata: { title: extTitle ?? mediaId },
    });

    return successResponse(entry, "Recommendation dismissed", 201);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return errorResponse("Already dismissed", 409);
    }
    throw error;
  }
});
