/**
 * GET /api/users/[id] — User profile with basic stats
 * PATCH /api/users/[id] — Update own profile (displayName, avatarUrl)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations/users";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  await requireAuth();
  const { id } = await params;

  const user = await db
    .selectFrom("users")
    .select(["id", "username", "display_name", "avatar_url", "role", "created_at"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!user) {
    return errorResponse("User not found", 404);
  }

  // Basic stats
  const sessionCount = await db
    .selectFrom("session_attendees")
    .select(db.fn.countAll().as("count"))
    .where("user_id", "=", id)
    .executeTakeFirstOrThrow();

  const ratingStats = await db
    .selectFrom("ratings")
    .select([db.fn.countAll().as("count"), db.fn.avg("score").as("avg_score")])
    .where("user_id", "=", id)
    .executeTakeFirstOrThrow();

  const pickCount = await db
    .selectFrom("watch_sessions")
    .select(db.fn.countAll().as("count"))
    .where("picked_by_user_id", "=", id)
    .executeTakeFirstOrThrow();

  return successResponse({
    ...user,
    stats: {
      sessionsAttended: Number(sessionCount.count),
      ratingsGiven: Number(ratingStats.count),
      avgScore:
        Number(ratingStats.count) > 0 ? Math.round(Number(ratingStats.avg_score) * 10) / 10 : null,
      pickCount: Number(pickCount.count),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAuth();
  const { id } = await params;

  if (user.id !== id) {
    return errorResponse("You can only update your own profile", 403);
  }

  const body: unknown = await req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const data = parsed.data;
  const updated = await db
    .updateTable("users")
    .set({
      ...(data.displayName !== undefined && { display_name: data.displayName }),
      ...(data.avatarUrl !== undefined && { avatar_url: data.avatarUrl }),
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .returning(["id", "username", "display_name", "avatar_url", "role", "created_at"])
    .executeTakeFirstOrThrow();

  return successResponse(updated);
}
