/**
 * Notification creation — DB insert + real-time push
 */

import { db } from "@/lib/db";

import { publishToUser } from "./ably";
import type { CreateNotificationParams } from "./types";

/**
 * Create a notification: persist to DB, then push via Ably (fire-and-forget).
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

  await Promise.all(
    unratedUserIds.map((userId) =>
      createNotification({
        userId,
        type: "session.rate_pending",
        title: `Rate: ${mediaTitle}`,
        body: `You watched "${mediaTitle}" \u2014 don\u2019t forget to rate it!`,
        link: `/database/${mediaId}`,
        metadata: { sessionId, mediaId, mediaTitle },
      }),
    ),
  );
}
