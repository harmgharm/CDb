"use client";

import { usePresenceListener } from "ably/react";

import { PRESENCE_CHANNEL } from "@/components/providers/ably-provider";

export interface OnlineUser {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Returns deduplicated list of currently online users via Ably presence.
 * Must be rendered inside the AblyProvider (which wraps a ChannelProvider for "presence:group").
 */
export function useOnlineUsers(): OnlineUser[] {
  const { presenceData } = usePresenceListener(PRESENCE_CHANNEL);

  // Deduplicate by userId (a user might have multiple connections/tabs)
  const uniqueUsers = new Map<string, OnlineUser>();
  for (const member of presenceData) {
    const data = member.data as OnlineUser;
    if (data.userId.length > 0 && !uniqueUsers.has(data.userId)) {
      uniqueUsers.set(data.userId, data);
    }
  }

  return [...uniqueUsers.values()];
}
