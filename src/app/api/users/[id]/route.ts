/**
 * GET /api/users/[id] — User profile with basic stats
 * PATCH /api/users/[id] — Update own profile (displayName, avatarUrl, username, email)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations/users";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const FIELD_LABELS: Record<string, string> = {
  username: "Username",
  email: "Email",
  display_name: "Display name",
};

async function checkFieldUniqueness(
  field: "username" | "email" | "display_name",
  value: string,
  excludeUserId: string,
): Promise<string | null> {
  const existing = await db
    .selectFrom("users")
    .select("id")
    .where(field, "=", value)
    .where("id", "!=", excludeUserId)
    .executeTakeFirst();

  if (existing !== undefined) {
    return `${String(FIELD_LABELS[field])} already taken`;
  }
  return null;
}

async function validateUniqueness(
  data: { username?: string; email?: string; displayName?: string },
  excludeUserId: string,
): Promise<string | null> {
  const checks: Promise<string | null>[] = [];
  if (data.username !== undefined) {
    checks.push(checkFieldUniqueness("username", data.username, excludeUserId));
  }
  if (data.email !== undefined) {
    checks.push(checkFieldUniqueness("email", data.email, excludeUserId));
  }
  if (data.displayName !== undefined && data.displayName.length > 0) {
    checks.push(checkFieldUniqueness("display_name", data.displayName, excludeUserId));
  }

  const results = await Promise.all(checks);
  return results.find((r): r is string => r !== null) ?? null;
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

  // Uniqueness checks
  const conflict = await validateUniqueness(data, id);
  if (conflict !== null) {
    return errorResponse(conflict, 409);
  }

  let updated;
  try {
    updated = await db
      .updateTable("users")
      .set({
        ...(data.displayName !== undefined && { display_name: data.displayName }),
        ...(data.avatarUrl !== undefined && { avatar_url: data.avatarUrl }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.email !== undefined && { email: data.email }),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returning(["id", "username", "email", "display_name", "avatar_url", "role", "created_at"])
      .executeTakeFirstOrThrow();
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return errorResponse("Username, email, or display name already taken", 409);
    }
    throw error;
  }

  await logAudit({
    userId: id,
    action: "user.updated",
    entityType: "user",
    entityId: id,
    metadata: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.username !== undefined && { username: data.username }),
      ...(data.email !== undefined && { email: data.email }),
    },
  });

  return successResponse(updated);
}
