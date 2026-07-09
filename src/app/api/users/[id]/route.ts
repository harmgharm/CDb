/**
 * GET /api/users/[id] — User profile with basic stats
 * PATCH /api/users/[id] — Update own profile (displayName, avatarUrl, username, email)
 */

import { parseBody } from "@/lib/api/parse-body";
import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { fetchTaglineInputs } from "@/lib/users/stats";
import { deriveTagline } from "@/lib/users/tagline";
import { updateProfileSchema } from "@/lib/validations/users";

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

export const GET = withAuth<{ id: string }>(async (_req, _user, { params }) => {
  const { id } = await params;

  const user = await db
    .selectFrom("users")
    .select(["id", "username", "display_name", "avatar_url", "role", "created_at"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!user) {
    return errorResponse("User not found", 404);
  }

  const taglineInputs = await fetchTaglineInputs(id, user.created_at);

  return successResponse({
    ...user,
    stats: {
      sessionsAttended: taglineInputs.sessionsAttended,
      ratingsGiven: taglineInputs.ratingsGiven,
      avgScore: taglineInputs.ratingsGiven > 0 ? taglineInputs.avgScore : null,
      pickCount: taglineInputs.pickCount,
    },
    tagline: deriveTagline(taglineInputs),
  });
});

export const PATCH = withAuth<{ id: string }>(async (req, user, { params }) => {
  const { id } = await params;

  if (user.id !== id) {
    return errorResponse("You can only update your own profile", 403);
  }

  const parsed = await parseBody(req, updateProfileSchema);
  if (!parsed.success) {
    return parsed.response;
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
});
