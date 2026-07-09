/**
 * POST /api/predictions
 *
 * Computes a predicted rating for a given media title based on the
 * user's rating history, similar users, and external signals.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { predictRating } from "@/lib/predictions";
import { predictionRequestSchema } from "@/lib/validations/predictions";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const body: unknown = await req.json();
  const parsed = predictionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`, 400);
  }

  try {
    const prediction = await predictRating(user.id, parsed.data);
    return successResponse({ prediction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute prediction";
    return errorResponse(message, 500);
  }
}
