/**
 * GET /api/ably/auth — Issue scoped Ably token for client-side subscriptions
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { createTokenRequest } from "@/lib/notifications";

export const GET = withAuth(async (_req, user) => {
  try {
    const tokenRequest = await createTokenRequest(user.id);
    return successResponse(tokenRequest);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown Ably error";
    console.error("Ably token request failed:", message);
    return errorResponse(`Ably token request failed: ${message}`, 500);
  }
});
