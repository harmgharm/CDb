/**
 * GET /api/admin/users — List all users with full details (admin only)
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAdminUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const _user = await getAdminUser();
  if (!_user) {
    return errorResponse("Not authorized", 403);
  }

  const users = await db
    .selectFrom("users")
    .select(["id", "username", "email", "display_name", "avatar_url", "role", "created_at"])
    .orderBy("created_at", "asc")
    .execute();

  return successResponse(users);
}
