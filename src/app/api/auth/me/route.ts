/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth";
import type { SafeUser } from "@/types/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const safeUser: SafeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    createdAt: user.created_at,
  };

  return successResponse(safeUser);
}
