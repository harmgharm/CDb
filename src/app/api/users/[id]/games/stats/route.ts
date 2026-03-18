/**
 * GET /api/users/[id]/games/stats — Game performance stats for a user profile
 *
 * Returns leaderboard stats + recent game history.
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

  // Get leaderboard entry
  const leaderboard = await db
    .selectFrom("game_leaderboard")
    .select([
      "games_played",
      "games_won",
      "rounds_won",
      "total_score",
      "best_streak",
      "avg_guess_time_ms",
    ])
    .where("user_id", "=", userId)
    .executeTakeFirst();

  // Get recent finished games this user participated in (via game_players or solo created_by)
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
      };
    }),
  );

  // Compute global rank
  let globalRank: number | null = null;
  if (leaderboard !== undefined) {
    const rankResult = await db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("total_score", ">", leaderboard.total_score)
      .executeTakeFirstOrThrow();

    globalRank = rankResult.count + 1;
  }

  const response: UserGameStatsResponse = {
    gamesPlayed: leaderboard?.games_played ?? 0,
    gamesWon: leaderboard?.games_won ?? 0,
    roundsWon: leaderboard?.rounds_won ?? 0,
    totalScore: leaderboard?.total_score ?? 0,
    bestStreak: leaderboard?.best_streak ?? 0,
    avgGuessTimeMs: leaderboard?.avg_guess_time_ms ?? 0,
    globalRank,
    recentGames: recentGamesWithStats,
  };

  return successResponse(response);
}
