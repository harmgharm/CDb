/**
 * Ranked game presets
 *
 * Defines the canonical settings for ranked games. A game is ranked
 * when its settings exactly match one of these presets, otherwise it's
 * unranked (custom). Ranked scores are tracked on per-category leaderboards.
 */

import type { GameDifficulty, GameType } from "@/lib/db/types";

export type LeaderboardCategory = "normal_ranked" | "hard_ranked";

export const RANKED_ROUND_COUNT = 5;
export const RANKED_REVEAL_DURATION_MS = 10_000;
export const RANKED_GRACE_DURATION_MS = 5000;

/**
 * Check whether a game's settings qualify as ranked.
 * Currently only round count matters — reveal/grace duration are not
 * yet customizable, but this function is the single source of truth
 * so it's easy to extend later per game type.
 */
export function isRankedGame(
  _gameType: GameType,
  _difficulty: GameDifficulty,
  roundCount: number,
): boolean {
  return roundCount === RANKED_ROUND_COUNT;
}

/**
 * Map a game difficulty to its leaderboard category.
 * Only call this for games where `isRankedGame` returned true.
 */
export function toLeaderboardCategory(difficulty: GameDifficulty): LeaderboardCategory {
  return difficulty === "hard" ? "hard_ranked" : "normal_ranked";
}
