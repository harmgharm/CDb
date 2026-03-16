/**
 * Lazy notification cleanup — removes notifications older than 30 days.
 * Called as fire-and-forget from the notifications list endpoint.
 */

import { db } from "@/lib/db";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function cleanupOldNotifications(): Promise<void> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  await db.deleteFrom("notifications").where("created_at", "<", cutoff).execute();
}
