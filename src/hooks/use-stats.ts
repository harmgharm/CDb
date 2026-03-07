/**
 * SWR hooks for stats data
 */

import useSWR from "swr";

import type { GroupDetailedStats } from "@/types/detailed-stats";
import type { ActivityFeed, DashboardStats } from "@/types/stats";

export function useDashboardStats() {
  return useSWR<DashboardStats>("/api/stats");
}

export function useActivityFeed(page = 1, limit = 20) {
  return useSWR<ActivityFeed>(`/api/stats/feed?page=${String(page)}&limit=${String(limit)}`);
}

export function useGroupDetailedStats() {
  return useSWR<GroupDetailedStats>("/api/stats/detailed");
}
