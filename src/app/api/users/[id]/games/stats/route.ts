/**
 * GET /api/users/[id]/games/stats — Game performance stats for a user profile
 *
 * Returns per-category best scores, global ranks, and recent game history.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserGameStatsResponse } from "@/types/user-responses";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id: userId } = await params;

  // Verify user exists
  const user = await db
    .selectFrom("users")
    .select("id")
    .where("id", "=", userId)
    .executeTakeFirst();

  if (user === undefined) {
    return errorResponse("User not found", 404);
  }

  // Get leaderboard entries for both categories
  const leaderboardEntries = await db
    .selectFrom("game_leaderboard")
    .select([
      "category",
      "best_score",
      "games_played",
      "games_won",
      "rounds_won",
      "best_streak",
      "avg_guess_time_ms",
    ])
    .where("user_id", "=", userId)
    .execute();

  const normalEntry = leaderboardEntries.find((entry) => entry.category === "normal_ranked");
  const hardEntry = leaderboardEntries.find((entry) => entry.category === "hard_ranked");

  // Aggregate stats across categories
  const gamesPlayed = (normalEntry?.games_played ?? 0) + (hardEntry?.games_played ?? 0);
  const gamesWon = (normalEntry?.games_won ?? 0) + (hardEntry?.games_won ?? 0);
  const roundsWon = (normalEntry?.rounds_won ?? 0) + (hardEntry?.rounds_won ?? 0);
  const bestStreak = Math.max(normalEntry?.best_streak ?? 0, hardEntry?.best_streak ?? 0);

  // Weighted average guess time across categories
  let avgGuessTimeMs = 0;
  if (gamesPlayed > 0) {
    const normalWeight = normalEntry?.games_played ?? 0;
    const hardWeight = hardEntry?.games_played ?? 0;
    avgGuessTimeMs = Math.round(
      ((normalEntry?.avg_guess_time_ms ?? 0) * normalWeight +
        (hardEntry?.avg_guess_time_ms ?? 0) * hardWeight) /
        gamesPlayed,
    );
  }

  // Compute global ranks per category
  let globalRankNormal: number | null = null;
  if (normalEntry !== undefined) {
    const rankResult = await db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("category", "=", "normal_ranked")
      .where("best_score", ">", normalEntry.best_score)
      .executeTakeFirstOrThrow();
    globalRankNormal = rankResult.count + 1;
  }

  let globalRankHard: number | null = null;
  if (hardEntry !== undefined) {
    const rankResult = await db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("category", "=", "hard_ranked")
      .where("best_score", ">", hardEntry.best_score)
      .executeTakeFirstOrThrow();
    globalRankHard = rankResult.count + 1;
  }

  // Get recent finished games this user participated in
  const recentGames = await db
    .selectFrom("game_sessions")
    .leftJoin("game_players", (join) =>
      join
        .onRef("game_players.game_id", "=", "game_sessions.id")
        .on("game_players.user_id", "=", userId),
    )
    .select([
      "game_sessions.id",
      "game_sessions.mode",
      "game_sessions.difficulty",
      "game_sessions.round_count",
      "game_sessions.finished_at",
      "game_sessions.is_ranked",
    ])
    .where("game_sessions.status", "=", "finished")
    .where((eb) =>
      eb.or([
        eb("game_players.user_id", "=", userId),
        eb.and([
          eb("game_sessions.mode", "=", "solo"),
          eb("game_sessions.created_by_user_id", "=", userId),
        ]),
      ]),
    )
    .orderBy("game_sessions.finished_at", "desc")
    .limit(10)
    .execute();

  // For each recent game, compute the user's score and correctness
  const recentGamesWithStats = await Promise.all(
    recentGames.map(async (game) => {
      const guesses = await db
        .selectFrom("game_guesses")
        .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
        .select(["game_guesses.is_correct", "game_guesses.score_awarded"])
        .where("game_rounds.game_id", "=", game.id)
        .where("game_guesses.user_id", "=", userId)
        .execute();

      const totalScore = guesses.reduce((sum, guess) => sum + guess.score_awarded, 0);
      const correctCount = guesses.filter((guess) => guess.is_correct).length;

      // For multiplayer, check if user won (had highest score)
      let isWinner = game.mode === "solo";
      if (game.mode === "multiplayer") {
        const allPlayerScores = await db
          .selectFrom("game_guesses")
          .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
          .select(["game_guesses.user_id"])
          .select((eb) => eb.fn.sum<number>("game_guesses.score_awarded").as("total"))
          .where("game_rounds.game_id", "=", game.id)
          .groupBy("game_guesses.user_id")
          .orderBy("total", "desc")
          .execute();

        isWinner = allPlayerScores[0]?.user_id === userId;
      }

      return {
        gameId: game.id,
        mode: game.mode,
        difficulty: game.difficulty,
        roundCount: game.round_count,
        finishedAt: game.finished_at?.toISOString() ?? null,
        totalScore,
        correctCount,
        isWinner,
        isRanked: game.is_ranked,
      };
    }),
  );

  const response: UserGameStatsResponse = {
    gamesPlayed,
    gamesWon,
    roundsWon,
    bestScoreNormal: normalEntry?.best_score ?? null,
    bestScoreHard: hardEntry?.best_score ?? null,
    bestStreak,
    avgGuessTimeMs,
    globalRankNormal,
    globalRankHard,
    recentGames: recentGamesWithStats,
  };

  return successResponse(response);
}
