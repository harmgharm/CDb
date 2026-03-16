/**
 * Internal types for the notification service
 */

import type { NotificationType } from "@/lib/db/types";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}
