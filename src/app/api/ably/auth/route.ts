/**
 * GET /api/ably/auth — Issue scoped Ably token for client-side subscriptions
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { createTokenRequest } from "@/lib/notifications";

export async function GET() {
  const user = await requireAuth();
  const tokenRequest = await createTokenRequest(user.id);
  return successResponse(tokenRequest);
}
