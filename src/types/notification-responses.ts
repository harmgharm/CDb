import type { NotificationType } from "@/lib/db/types";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferencesResponse {
  preferences: Record<string, boolean>;
}
