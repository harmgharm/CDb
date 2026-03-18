/**
 * Leaderboard data access
 *
 * Updates best-score-per-category after each completed ranked game
 * and provides paginated leaderboard queries.
 */

import { db } from "@/lib/db";
import type { LeaderboardCategory } from "@/lib/db/types";

interface GameResult {
  userId: string;
  gameId: string;
  category: LeaderboardCategory;
  roundsWon: number;
  totalScore: number;
  bestStreak: number;
  /** Average guess time for correct answers only (ms) */
  avgGuessTimeMs: number;
  /** Whether this player won the overall game (highest score) */
  isWinner: boolean;
}

/**
 * Update leaderboard after a completed ranked game.
 * Only replaces best_score if this game scored higher.
 * Returns true if this game set a new personal best.
 */
export async function updateLeaderboard(result: GameResult): Promise<boolean> {
  const existing = await db
    .selectFrom("game_leaderboard")
    .select([
      "best_score",
      "games_played",
      "games_won",
      "rounds_won",
      "best_streak",
      "avg_guess_time_ms",
    ])
    .where("user_id", "=", result.userId)
    .where("category", "=", result.category)
    .executeTakeFirst();

  if (existing === undefined) {
    // First ranked game in this category
    await db
      .insertInto("game_leaderboard")
      .values({
        user_id: result.userId,
        category: result.category,
        best_score: result.totalScore,
        best_score_game_id: result.gameId,
        games_played: 1,
        games_won: result.isWinner ? 1 : 0,
        rounds_won: result.roundsWon,
        best_streak: result.bestStreak,
        avg_guess_time_ms: result.avgGuessTimeMs,
      })
      .execute();
    return true;
  }

  const isNewBest = result.totalScore > existing.best_score;
  const totalGamesPlayed = existing.games_played + 1;
  const newAvgTime = Math.round(
    (existing.avg_guess_time_ms * existing.games_played + result.avgGuessTimeMs) / totalGamesPlayed,
  );

  await db
    .updateTable("game_leaderboard")
    .set({
      best_score: isNewBest ? result.totalScore : existing.best_score,
      best_score_game_id: isNewBest ? result.gameId : undefined,
      games_played: totalGamesPlayed,
      games_won: existing.games_won + (result.isWinner ? 1 : 0),
      rounds_won: existing.rounds_won + result.roundsWon,
      best_streak: Math.max(existing.best_streak, result.bestStreak),
      avg_guess_time_ms: newAvgTime,
      updated_at: new Date(),
    })
    .where("user_id", "=", result.userId)
    .where("category", "=", result.category)
    .execute();

  return isNewBest;
}

/**
 * Get paginated leaderboard sorted by best score (ties broken by faster avg time).
 */
export async function getLeaderboard(
  page: number,
  limit: number,
  category: LeaderboardCategory = "normal_ranked",
): Promise<{
  entries: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    gamesPlayed: number;
    gamesWon: number;
    roundsWon: number;
    bestScore: number;
    bestScoreGameId: string | null;
    bestStreak: number;
    avgGuessTimeMs: number;
  }[];
  total: number;
}> {
  const offset = (page - 1) * limit;

  const [entries, countResult] = await Promise.all([
    db
      .selectFrom("game_leaderboard")
      .innerJoin("users", "users.id", "game_leaderboard.user_id")
      .select([
        "game_leaderboard.user_id as userId",
        "users.username",
        "users.display_name as displayName",
        "users.avatar_url as avatarUrl",
        "game_leaderboard.games_played as gamesPlayed",
        "game_leaderboard.games_won as gamesWon",
        "game_leaderboard.rounds_won as roundsWon",
        "game_leaderboard.best_score as bestScore",
        "game_leaderboard.best_score_game_id as bestScoreGameId",
        "game_leaderboard.best_streak as bestStreak",
        "game_leaderboard.avg_guess_time_ms as avgGuessTimeMs",
      ])
      .where("game_leaderboard.category", "=", category)
      .orderBy("game_leaderboard.best_score", "desc")
      .orderBy("game_leaderboard.avg_guess_time_ms", "asc")
      .limit(limit)
      .offset(offset)
      .execute(),
    db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("category", "=", category)
      .executeTakeFirstOrThrow(),
  ]);

  return {
    entries,
    total: countResult.count,
  };
}
