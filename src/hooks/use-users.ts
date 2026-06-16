/**
 * SWR hooks for user data
 */

import useSWR, { type SWRConfiguration } from "swr";

import type { UserDetailedStatsResponse } from "@/types/detailed-stats";
import type {
  UserDetailedStats,
  UserGameStatsResponse,
  UserListItem,
  UserProfile,
} from "@/types/user-responses";

export function useUserList(config?: SWRConfiguration<UserListItem[]>) {
  return useSWR<UserListItem[]>("/api/users", config);
}

export function useUserProfile(id: string | null) {
  return useSWR<UserProfile>(id === null ? null : `/api/users/${id}`);
}

export function useUserStats(id: string | null) {
  return useSWR<UserDetailedStats>(id === null ? null : `/api/users/${id}/stats`);
}

export function useUserDetailedStats(id: string | null) {
  return useSWR<UserDetailedStatsResponse>(id === null ? null : `/api/users/${id}/stats/detailed`);
}

export function useUserGameStats(id: string | null) {
  return useSWR<UserGameStatsResponse>(id === null ? null : `/api/users/${id}/games/stats`);
}
