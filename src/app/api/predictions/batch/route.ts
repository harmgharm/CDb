/**
 * POST /api/predictions/batch
 *
 * Computes predicted ratings for multiple media items in a single request.
 * Optimized for watchlist use — loads user data once, iterates items.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { predictBatch } from "@/lib/predictions";
import { batchPredictionRequestSchema } from "@/lib/validations/predictions";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const body: unknown = await req.json();
  const parsed = batchPredictionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`, 400);
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
}
