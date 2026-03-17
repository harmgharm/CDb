/**
 * Leaderboard data access
 *
 * Updates stats after each completed game and provides
 * paginated leaderboard queries.
 */

import { db } from "@/lib/db";

interface GameResult {
  userId: string;
  roundsWon: number;
  totalScore: number;
  bestStreak: number;
  /** Average guess time for correct answers only (ms) */
  avgGuessTimeMs: number;
  /** Whether this player won the overall game (highest score) */
  isWinner: boolean;
}

/**
 * Update leaderboard after a completed game.
 * Uses upsert — creates entry on first game, updates on subsequent games.
 */
export async function updateLeaderboard(result: GameResult): Promise<void> {
  const existing = await db
    .selectFrom("game_leaderboard")
    .select([
      "games_played",
      "games_won",
      "rounds_won",
      "total_score",
      "best_streak",
      "avg_guess_time_ms",
    ])
    .where("user_id", "=", result.userId)
    .executeTakeFirst();

  if (existing === undefined) {
    // First game — insert
    await db
      .insertInto("game_leaderboard")
      .values({
        user_id: result.userId,
        games_played: 1,
        games_won: result.isWinner ? 1 : 0,
        rounds_won: result.roundsWon,
        total_score: result.totalScore,
        best_streak: result.bestStreak,
        avg_guess_time_ms: result.avgGuessTimeMs,
      })
      .execute();
    return;
  }

  // Compute new running average for guess time
  const totalGamesPlayed = existing.games_played + 1;
  const newAvgTime = Math.round(
    (existing.avg_guess_time_ms * existing.games_played + result.avgGuessTimeMs) / totalGamesPlayed,
  );

  await db
    .updateTable("game_leaderboard")
    .set({
      games_played: totalGamesPlayed,
      games_won: existing.games_won + (result.isWinner ? 1 : 0),
      rounds_won: existing.rounds_won + result.roundsWon,
      total_score: existing.total_score + result.totalScore,
      best_streak: Math.max(existing.best_streak, result.bestStreak),
      avg_guess_time_ms: newAvgTime,
      updated_at: new Date(),
    })
    .where("user_id", "=", result.userId)
    .execute();
}

/**
 * Get paginated leaderboard sorted by total score.
 */
export async function getLeaderboard(
  page: number,
  limit: number,
): Promise<{
  entries: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    gamesPlayed: number;
    gamesWon: number;
    roundsWon: number;
    totalScore: number;
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
        "game_leaderboard.total_score as totalScore",
        "game_leaderboard.best_streak as bestStreak",
        "game_leaderboard.avg_guess_time_ms as avgGuessTimeMs",
      ])
      .orderBy("game_leaderboard.total_score", "desc")
      .limit(limit)
      .offset(offset)
      .execute(),
    db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow(),
  ]);

  return {
    entries,
    total: countResult.count,
  };
}
