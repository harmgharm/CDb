/**
 * Leaderboard data access
 *
 * Updates best-score-per-category after each completed ranked game
 * and provides paginated leaderboard queries.
 */

import { db } from "@/lib/db";
import type { GameType, LeaderboardCategory } from "@/lib/db/types";

interface GameResult {
  userId: string;
  gameId: string;
  gameType: GameType;
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
    .where("game_type", "=", result.gameType)
    .where("category", "=", result.category)
    .executeTakeFirst();

  if (existing === undefined) {
    // First ranked game in this category
    await db
      .insertInto("game_leaderboard")
      .values({
        user_id: result.userId,
        game_type: result.gameType,
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
    .where("game_type", "=", result.gameType)
    .where("category", "=", result.category)
    .execute();

  return isNewBest;
}

interface GroupLeaderboardRawEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  gamesWon: number;
  gamesPlayed: number;
}

export interface GroupLeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  gamesWon: number;
  gamesPlayed: number;
  /** Rounded percentage (0-100). 0 for a user with no games played, not NaN. */
  winRate: number;
}

/**
 * Rank raw per-user win/played totals into a win-rate leaderboard. Pure so the
 * ranking logic is unit-tested without a database. Users with zero games
 * played are excluded (nothing to rank), ties broken by games played
 * descending (more games played is more proven at the same win rate).
 */
export function rankGroupLeaderboardEntries(
  entries: readonly GroupLeaderboardRawEntry[],
  limit = 5,
): GroupLeaderboardEntry[] {
  return entries
    .filter((entry) => entry.gamesPlayed > 0)
    .map((entry) => ({
      ...entry,
      winRate: Math.round((entry.gamesWon / entry.gamesPlayed) * 100),
    }))
    .toSorted((a, b) => b.winRate - a.winRate || b.gamesPlayed - a.gamesPlayed)
    .slice(0, limit);
}

/**
 * Get the top group members by win rate across all game types and
 * categories combined (all-time, not time-windowed). Powers the Play hub's
 * "Game leaderboard" card.
 */
export async function fetchGroupLeaderboard(limit = 5): Promise<GroupLeaderboardEntry[]> {
  const rows = await db
    .selectFrom("game_leaderboard")
    .innerJoin("users", "users.id", "game_leaderboard.user_id")
    .select(({ fn }) => [
      "game_leaderboard.user_id as userId",
      "users.username",
      "users.display_name as displayName",
      "users.avatar_url as avatarUrl",
      fn.sum<string>("game_leaderboard.games_won").as("gamesWon"),
      fn.sum<string>("game_leaderboard.games_played").as("gamesPlayed"),
    ])
    .groupBy([
      "game_leaderboard.user_id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
    ])
    .execute();

  return rankGroupLeaderboardEntries(
    rows.map((row) => ({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      gamesWon: Number(row.gamesWon),
      gamesPlayed: Number(row.gamesPlayed),
    })),
    limit,
  );
}

/**
 * Get paginated leaderboard sorted by best score (ties broken by faster avg time).
 */
export async function getLeaderboard(options: {
  page: number;
  limit: number;
  category?: LeaderboardCategory;
  gameType?: GameType;
}): Promise<{
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
  const { page, limit, category = "normal_ranked", gameType = "poster_reveal" } = options;
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
      .where("game_leaderboard.game_type", "=", gameType)
      .where("game_leaderboard.category", "=", category)
      .orderBy("game_leaderboard.best_score", "desc")
      .orderBy("game_leaderboard.avg_guess_time_ms", "asc")
      .limit(limit)
      .offset(offset)
      .execute(),
    db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("game_type", "=", gameType)
      .where("category", "=", category)
      .executeTakeFirstOrThrow(),
  ]);

  return {
    entries,
    total: countResult.count,
  };
}
