/**
 * GET /api/queue — Current queue state (scheduled pick + ranked proposals)
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { getQueueState } from "@/lib/queue/queries";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }
  const state = await getQueueState(user.id);
  return successResponse(state);
}
