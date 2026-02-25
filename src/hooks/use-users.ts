/**
 * SWR hooks for user data
 */

import useSWR from "swr";

import type { UserDetailedStats, UserListItem, UserProfile } from "@/types/user-responses";

export function useUserList() {
  return useSWR<UserListItem[]>("/api/users");
}

export function useUserProfile(id: string | null) {
  return useSWR<UserProfile>(id === null ? null : `/api/users/${id}`);
}

export function useUserStats(id: string | null) {
  return useSWR<UserDetailedStats>(id === null ? null : `/api/users/${id}/stats`);
}
