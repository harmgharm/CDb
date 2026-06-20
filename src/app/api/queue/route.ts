/**
 * GET /api/queue — Current queue state (scheduled pick + ranked proposals)
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { getQueueState } from "@/lib/queue/queries";

export async function GET() {
  const user = await requireAuth();
  const state = await getQueueState(user.id);
  return successResponse(state);
}
