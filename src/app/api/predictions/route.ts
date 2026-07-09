/**
 * POST /api/predictions
 *
 * Computes a predicted rating for a given media title based on the
 * user's rating history, similar users, and external signals.
 */

import { parseBody } from "@/lib/api/parse-body";
import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { predictRating } from "@/lib/predictions";
import { predictionRequestSchema } from "@/lib/validations/predictions";

export const POST = withAuth(async (req, user) => {
  const parsed = await parseBody(
    req,
    predictionRequestSchema,
    (error) => `Invalid request: ${error.message}`,
  );

  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const prediction = await predictRating(user.id, parsed.data);
    return successResponse({ prediction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute prediction";
    return errorResponse(message, 500);
  }
});
