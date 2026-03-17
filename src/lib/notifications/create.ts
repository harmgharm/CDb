/**
 * Notification creation — DB insert + real-time push
 *
 * Low-level: createNotification (single, no preference check)
 * High-level: createNotificationsWithPreferences (batch, respects opt-out)
 * Helpers: type-specific creators for session.created, rating.submitted, etc.
 */

import { db } from "@/lib/db";
import type { NotificationType } from "@/lib/db/types";

import { publishToUser } from "./ably";
import { getPreferencesForUsers, shouldNotify } from "./preferences";
import type { CreateNotificationParams } from "./types";

// ============================================
// LOW-LEVEL
// ============================================

/**
 * Create a notification: persist to DB, then push via Ably (fire-and-forget).
 * Does NOT check user preferences — use createNotificationsWithPreferences for that.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const notification = await db
    .insertInto("notifications")
    .values({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      metadata: params.metadata === undefined ? null : JSON.stringify(params.metadata),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Push real-time event (best-effort — DB is the source of truth)
  publishToUser(params.userId, "notification", {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    isRead: false,
    metadata: notification.metadata,
    createdAt: notification.created_at.toISOString(),
  });
}

// ============================================
// BATCH WITH PREFERENCES
// ============================================

interface BatchNotificationItem {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create notifications for multiple users, respecting per-user preferences.
 * Loads all preferences in a single DB query, then filters.
 */
async function createNotificationsWithPreferences(
  items: readonly BatchNotificationItem[],
): Promise<void> {
  if (items.length === 0) return;

  const userIds = [...new Set(items.map((item) => item.userId))];
  const prefsMap = await getPreferencesForUsers(userIds);

  const allowed = items.filter((item) => {
    const prefs = prefsMap.get(item.userId) ?? {};
    return shouldNotify(prefs, item.type);
  });

  if (allowed.length === 0) return;

  await Promise.all(allowed.map((item) => createNotification(item)));
}

// ============================================
// TYPE-SPECIFIC HELPERS
// ============================================

interface RatePendingOptions {
  sessionId: string;
  mediaId: string;
  mediaTitle: string;
  attendeeIds: readonly string[];
  ratedUserIds: readonly string[];
}

/**
 * Create rate-pending notifications for session attendees who didn't rate inline.
 */
export async function createRatePendingNotifications(options: RatePendingOptions): Promise<void> {
  const { sessionId, mediaId, mediaTitle, attendeeIds, ratedUserIds } = options;
  const unratedUserIds = attendeeIds.filter((id) => !ratedUserIds.includes(id));

  await createNotificationsWithPreferences(
    unratedUserIds.map((userId) => ({
      userId,
      type: "session.rate_pending" as const,
      title: `Rate: ${mediaTitle}`,
      body: `You watched \u201C${mediaTitle}\u201D \u2014 don\u2019t forget to rate it!`,
      link: `/database/${mediaId}`,
      metadata: { sessionId, mediaId, mediaTitle },
    })),
  );
}

interface SessionCreatedOptions {
  sessionId: string;
  mediaId: string;
  mediaTitle: string;
  creatorUserId: string;
  creatorDisplayName: string;
  pickedByUserId: string | null;
}

/**
 * Notify all members (except creator) when a new session is logged.
 */
export async function createSessionCreatedNotifications(
  options: SessionCreatedOptions,
): Promise<void> {
  const { sessionId, mediaId, mediaTitle, creatorUserId, creatorDisplayName, pickedByUserId } =
    options;

  const allUsers = await db.selectFrom("users").select("id").execute();
  const recipientIds = allUsers.map((u) => u.id).filter((id) => id !== creatorUserId);

  await createNotificationsWithPreferences(
    recipientIds.map((userId) => ({
      userId,
      type: "session.created" as const,
      title: `New Session: ${mediaTitle}`,
      body: `${creatorDisplayName} logged a session for \u201C${mediaTitle}\u201D`,
      link: `/database/${mediaId}`,
      metadata: { sessionId, mediaId, pickedByUserId },
    })),
  );
}

interface RatingSubmittedOptions {
  sessionId: string;
  mediaId: string;
  mediaTitle: string;
  raterUserId: string;
  raterDisplayName: string;
  score: number;
  pickedByUserId: string;
}

/**
 * Notify the session picker when someone rates their pick.
 * Skips if the rater IS the picker.
 */
export async function createRatingSubmittedNotification(
  options: RatingSubmittedOptions,
): Promise<void> {
  const { sessionId, mediaId, mediaTitle, raterUserId, raterDisplayName, score, pickedByUserId } =
    options;

  if (raterUserId === pickedByUserId) return;

  await createNotificationsWithPreferences([
    {
      userId: pickedByUserId,
      type: "rating.submitted" as const,
      title: `New Rating on ${mediaTitle}`,
      body: `${raterDisplayName} rated \u201C${mediaTitle}\u201D ${String(score)}/10`,
      link: `/database/${mediaId}`,
      metadata: { sessionId, mediaId, raterUserId, score },
    },
  ]);
}

interface WatchlistFriendWatchedOptions {
  sessionId: string;
  mediaId: string;
  mediaTitle: string;
  attendeeIds: readonly string[];
}

/**
 * Notify users who have this media on their watchlist (excluding attendees).
 */
export async function createWatchlistFriendWatchedNotifications(
  options: WatchlistFriendWatchedOptions,
): Promise<void> {
  const { sessionId, mediaId, mediaTitle, attendeeIds } = options;

  const watchlistUsers = await db
    .selectFrom("watchlist")
    .select("user_id")
    .where("media_id", "=", mediaId)
    .where("user_id", "not in", [...attendeeIds])
    .execute();

  if (watchlistUsers.length === 0) return;

  await createNotificationsWithPreferences(
    watchlistUsers.map((row) => ({
      userId: row.user_id,
      type: "watchlist.friend_watched" as const,
      title: `Watchlist Update: ${mediaTitle}`,
      body: `Your friends watched \u201C${mediaTitle}\u201D \u2014 check out their ratings!`,
      link: `/database/${mediaId}`,
      metadata: { sessionId, mediaId, attendeeCount: attendeeIds.length },
    })),
  );
}
