/**
 * GET /api/users — List all users (public info only)
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  await requireAuth();

  const users = await db
    .selectFrom("users")
    .select(["id", "username", "display_name", "avatar_url", "role", "created_at"])
    .orderBy("username", "asc")
    .execute();

  return successResponse(users);
}
