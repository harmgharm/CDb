"use client";

import useSWR from "swr";

import type { PlayHubResponse } from "@/types/game-responses";

const PLAY_HUB_KEY = "/api/games/hub";

/**
 * Play hub's "Game leaderboard" + "Live now" data. Polled via SWR (no Ably
 * presence — see docs/superpowers/specs/2026-06-28-design-system-second-pass.md,
 * "Play hub" judgment calls).
 */
export function usePlayHub() {
  const { data, isLoading } = useSWR<PlayHubResponse>(PLAY_HUB_KEY, {
    refreshInterval: 15_000,
  });

  return {
    leaderboard: data?.leaderboard ?? [],
    liveSessions: data?.liveSessions ?? [],
    isLoading,
  };
}
