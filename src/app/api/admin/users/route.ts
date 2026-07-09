/**
 * GET /api/admin/users — List all users with full details (admin only)
 */

import { successResponse } from "@/lib/api/response";
import { withAdmin } from "@/lib/api/with-auth";
import { db } from "@/lib/db";

export const GET = withAdmin(async () => {
  const users = await db
    .selectFrom("users")
    .select(["id", "username", "email", "display_name", "avatar_url", "role", "created_at"])
    .orderBy("created_at", "asc")
    .execute();

  return successResponse(users);
});
