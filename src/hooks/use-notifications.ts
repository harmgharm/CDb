/**
 * SWR hooks for notifications data and mutations
 */

import { useCallback, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type {
  NotificationPreferencesResponse,
  NotificationsResponse,
  UnreadCountResponse,
} from "@/types/notification-responses";

const UNREAD_COUNT_KEY = "/api/notifications/unread-count";
const NOTIFICATIONS_KEY = "/api/notifications";
const PREFERENCES_KEY = "/api/settings/notifications";

// ============================================
// Read Hooks
// ============================================

export function useUnreadCount() {
  return useSWR<UnreadCountResponse>(UNREAD_COUNT_KEY, {
    refreshInterval: 60_000, // Fallback poll every 60s in case Ably reconnects
  });
}

export function useNotifications(page = 1, limit = 20) {
  return useSWR<NotificationsResponse>(
    `${NOTIFICATIONS_KEY}?page=${String(page)}&limit=${String(limit)}`,
  );
}

export function useNotificationPreferences() {
  return useSWR<NotificationPreferencesResponse>(PREFERENCES_KEY);
}

// ============================================
// Mutation Hooks
// ============================================

export function useMarkAsRead() {
  const { mutate } = useSWRConfig();

  const markAsRead = useCallback(
    async (notificationId: string): Promise<boolean> => {
      try {
        const response = await fetchWithAuth(`/api/notifications/${notificationId}`, {
          method: "PATCH",
        });
        const json = (await response.json()) as ApiResponse<{ id: string }>;
        if (json.error !== null) return false;

        // Revalidate both the list and the unread count
        void mutate((key: unknown) => typeof key === "string" && key.startsWith(NOTIFICATIONS_KEY));
        void mutate(UNREAD_COUNT_KEY);
        return true;
      } catch {
        return false;
      }
    },
    [mutate],
  );

  return { markAsRead };
}

export function useMarkAllAsRead() {
  const [isMarking, setIsMarking] = useState(false);
  const { mutate } = useSWRConfig();

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    setIsMarking(true);
    try {
      const response = await fetchWithAuth("/api/notifications/mark-all-read", {
        method: "POST",
      });
      const json = (await response.json()) as ApiResponse<{ success: boolean }>;
      if (json.error !== null) return false;

      void mutate((key: unknown) => typeof key === "string" && key.startsWith(NOTIFICATIONS_KEY));
      void mutate(UNREAD_COUNT_KEY);
      return true;
    } catch {
      return false;
    } finally {
      setIsMarking(false);
    }
  }, [mutate]);

  return { markAllAsRead, isMarking };
}

export function useDeleteNotification() {
  const { mutate } = useSWRConfig();

  const deleteNotification = useCallback(
    async (notificationId: string): Promise<boolean> => {
      try {
        const response = await fetchWithAuth(`/api/notifications/${notificationId}`, {
          method: "DELETE",
        });
        const json = (await response.json()) as ApiResponse<{ id: string }>;
        if (json.error !== null) return false;

        void mutate((key: unknown) => typeof key === "string" && key.startsWith(NOTIFICATIONS_KEY));
        void mutate(UNREAD_COUNT_KEY);
        return true;
      } catch {
        return false;
      }
    },
    [mutate],
  );

  return { deleteNotification };
}

export function useClearAllNotifications() {
  const [isClearing, setIsClearing] = useState(false);
  const { mutate } = useSWRConfig();

  const clearAll = useCallback(async (): Promise<boolean> => {
    setIsClearing(true);
    try {
      const response = await fetchWithAuth("/api/notifications/clear-all", {
        method: "POST",
      });
      const json = (await response.json()) as ApiResponse<{ success: boolean }>;
      if (json.error !== null) return false;

      void mutate((key: unknown) => typeof key === "string" && key.startsWith(NOTIFICATIONS_KEY));
      void mutate(UNREAD_COUNT_KEY);
      return true;
    } catch {
      return false;
    } finally {
      setIsClearing(false);
    }
  }, [mutate]);

  return { clearAll, isClearing };
}

export function useUpdateNotificationPreferences() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { mutate } = useSWRConfig();

  const updatePreferences = useCallback(
    async (preferences: Record<string, boolean>): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const response = await fetchWithAuth(PREFERENCES_KEY, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences }),
        });
        const json = (await response.json()) as ApiResponse<NotificationPreferencesResponse>;
        if (json.error !== null) return false;

        void mutate(PREFERENCES_KEY);
        return true;
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [mutate],
  );

  return { updatePreferences, isUpdating };
}
