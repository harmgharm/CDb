/**
 * POST /api/predictions/batch
 *
 * Computes predicted ratings for multiple media items in a single request.
 * Optimized for watchlist use — loads user data once, iterates items.
 */

import { parseBody } from "@/lib/api/parse-body";
import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { predictBatch } from "@/lib/predictions";
import { batchPredictionRequestSchema } from "@/lib/validations/predictions";

export const POST = withAuth(async (req, user) => {
  const parsed = await parseBody(
    req,
    batchPredictionRequestSchema,
    (error) => `Invalid request: ${error.message}`,
  );

  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const predictions = await predictBatch(
      user.id,
      parsed.data.items.map((item) => ({
        key: item.key,
        input: {
          mediaId: item.mediaId,
          tmdbId: item.tmdbId,
          malId: item.malId,
          mediaType: item.mediaType,
        },
      })),
    );

    return successResponse({ predictions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute batch predictions";
    return errorResponse(message, 500);
  }
});
