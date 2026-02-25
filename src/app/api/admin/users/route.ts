/**
 * GET /api/admin/users — List all users with full details (admin only)
 */

import { successResponse } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  await requireAdmin();

  const users = await db
    .selectFrom("users")
    .select(["id", "username", "email", "display_name", "avatar_url", "role", "created_at"])
    .orderBy("created_at", "asc")
    .execute();

  return successResponse(users);
}
