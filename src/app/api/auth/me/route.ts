/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user.
 */

import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import type { SafeUser } from "@/types/auth";

export const GET = withAuth((_req, user) => {
  const safeUser: SafeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    createdAt: user.created_at,
  };

  return Promise.resolve(successResponse(safeUser));
});
