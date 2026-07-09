/**
 * GET /api/queue — Current queue state (scheduled pick + ranked proposals)
 */

import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { getQueueState } from "@/lib/queue/queries";

export const GET = withAuth(async (_req, user) => {
  const state = await getQueueState(user.id);
  return successResponse(state);
});
