/**
 * SWR hooks for notifications data and mutations
 */

import { useCallback, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { NotificationsResponse, UnreadCountResponse } from "@/types/notification-responses";

const UNREAD_COUNT_KEY = "/api/notifications/unread-count";
const NOTIFICATIONS_KEY = "/api/notifications";

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
