/**
 * Notification preferences — per-user opt-out for notification types
 *
 * Opt-out model: missing keys default to enabled (true).
 * JSONB column stores { "session.created": false, ... } for disabled types.
 */

import { db } from "@/lib/db";
import type { NotificationType } from "@/lib/db/types";

/**
 * Pure function — returns true unless the user explicitly disabled this type.
 */
export function shouldNotify(
  preferences: Record<string, boolean>,
  type: NotificationType,
): boolean {
  return preferences[type] !== false;
}

/**
 * Batch-load preferences for multiple users in a single query.
 * Users without a preferences row get an empty object (all enabled).
 */
export async function getPreferencesForUsers(
  userIds: readonly string[],
): Promise<Map<string, Record<string, boolean>>> {
  const result = new Map<string, Record<string, boolean>>();

  if (userIds.length === 0) {
    return result;
  }

  const rows = await db
    .selectFrom("notification_preferences")
    .select(["user_id", "preferences"])
    .where("user_id", "in", [...userIds])
    .execute();

  // Seed all requested users with empty (all enabled)
  for (const userId of userIds) {
    result.set(userId, {});
  }

  // Override with stored preferences
  for (const row of rows) {
    const prefs =
      typeof row.preferences === "string"
        ? (JSON.parse(row.preferences) as Record<string, boolean>)
        : row.preferences;
    result.set(row.user_id, prefs);
  }

  return result;
}

/**
 * Single-user convenience wrapper.
 */
export async function getUserNotificationPreferences(
  userId: string,
): Promise<Record<string, boolean>> {
  const map = await getPreferencesForUsers([userId]);
  return map.get(userId) ?? {};
}

/**
 * Upsert notification preferences for a user.
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Record<string, boolean>,
): Promise<void> {
  const prefsJson = JSON.stringify(preferences);

  await db
    .insertInto("notification_preferences")
    .values({
      user_id: userId,
      preferences: prefsJson,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column("user_id").doUpdateSet({
        preferences: prefsJson,
        updated_at: new Date(),
      }),
    )
    .execute();
}
