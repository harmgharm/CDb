/**
 * GET /api/users/[id]/games/stats — Game performance stats for a user profile
 *
 * Returns per-game-type stats with per-category best scores, global ranks,
 * and recent game history.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { GameType } from "@/lib/db/types";
import type { GameTypeStats, UserGameStatsResponse, UserRecentGame } from "@/types/user-responses";

async function buildGameTypeStats(
  userId: string,
  gameType: GameType,
  recentGames: UserRecentGame[],
): Promise<GameTypeStats | null> {
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
    .where("game_type", "=", gameType)
    .execute();

  const normalEntry = leaderboardEntries.find((entry) => entry.category === "normal_ranked");
  const hardEntry = leaderboardEntries.find((entry) => entry.category === "hard_ranked");

  const gamesPlayed = (normalEntry?.games_played ?? 0) + (hardEntry?.games_played ?? 0);

  // If user has no leaderboard entries AND no recent games for this type, skip
  if (gamesPlayed === 0 && recentGames.length === 0) {
    return null;
  }

  const gamesWon = (normalEntry?.games_won ?? 0) + (hardEntry?.games_won ?? 0);
  const roundsWon = (normalEntry?.rounds_won ?? 0) + (hardEntry?.rounds_won ?? 0);
  const bestStreak = Math.max(normalEntry?.best_streak ?? 0, hardEntry?.best_streak ?? 0);

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

  let globalRankNormal: number | null = null;
  if (normalEntry !== undefined) {
    const rankResult = await db
      .selectFrom("game_leaderboard")
      // Typed <string> to match the runtime: Neon returns count as a string, so
      // the type must say so or `Number(...) + 1` below reads as unnecessary. Any
      // <number> cast is a lie that makes `count + 1` concatenate ("1"+1="11").
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("game_type", "=", gameType)
      .where("category", "=", "normal_ranked")
      .where("best_score", ">", normalEntry.best_score)
      .executeTakeFirstOrThrow();
    globalRankNormal = Number(rankResult.count) + 1;
  }

  let globalRankHard: number | null = null;
  if (hardEntry !== undefined) {
    const rankResult = await db
      .selectFrom("game_leaderboard")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("game_type", "=", gameType)
      .where("category", "=", "hard_ranked")
      .where("best_score", ">", hardEntry.best_score)
      .executeTakeFirstOrThrow();
    globalRankHard = Number(rankResult.count) + 1;
  }

  return {
    gamesPlayed,
    gamesWon,
    roundsWon,
    bestScoreNormal: normalEntry?.best_score ?? null,
    bestScoreHard: hardEntry?.best_score ?? null,
    bestStreak,
    avgGuessTimeMs,
    globalRankNormal,
    globalRankHard,
    recentGames,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _user = await getAuthUser();
  if (!_user) {
    return errorResponse("Not authenticated", 401);
  }
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

  // Get recent finished games this user participated in (all game types)
  const recentGames = await db
    .selectFrom("game_sessions")
    .leftJoin("game_players", (join) =>
      join
        .onRef("game_players.game_id", "=", "game_sessions.id")
        .on("game_players.user_id", "=", userId),
    )
    .select([
      "game_sessions.id",
      "game_sessions.game_type",
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
    .limit(20)
    .execute();

  // For each recent game, compute the user's score and correctness
  const recentGamesWithStats: UserRecentGame[] = await Promise.all(
    recentGames.map(async (game) => {
      const guesses = await db
        .selectFrom("game_guesses")
        .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
        .select([
          "game_guesses.is_correct",
          "game_guesses.score_awarded",
          "game_guesses.guess_data",
        ])
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

      // For rating guesser, compute average difference from correct rating
      let avgDifference: number | undefined;
      if (game.game_type === "rating_guess") {
        const differences = guesses
          .map((guess) => {
            const data = guess.guess_data as { guessedRating?: number; difference?: number } | null;
            return data?.difference;
          })
          .filter((d): d is number => d !== undefined);
        if (differences.length > 0) {
          avgDifference =
            Math.round((differences.reduce((sum, d) => sum + d, 0) / differences.length) * 10) / 10;
        }
      }

      const result: UserRecentGame = {
        gameId: game.id,
        gameType: game.game_type,
        mode: game.mode,
        difficulty: game.difficulty,
        roundCount: game.round_count,
        finishedAt: game.finished_at?.toISOString() ?? null,
        totalScore,
        correctCount,
        isWinner,
        isRanked: game.is_ranked,
      };

      if (avgDifference !== undefined) {
        result.avgDifference = avgDifference;
      }

      return result;
    }),
  );

  // Partition recent games by game type (10 per type)
  const posterRevealRecent = recentGamesWithStats
    .filter((game) => game.gameType === "poster_reveal")
    .slice(0, 10);
  const ratingGuessRecent = recentGamesWithStats
    .filter((game) => game.gameType === "rating_guess")
    .slice(0, 10);
  const yearGuessRecent = recentGamesWithStats
    .filter((game) => game.gameType === "year_guess")
    .slice(0, 10);

  // Build per-game-type stats in parallel
  const [posterReveal, ratingGuess, yearGuess] = await Promise.all([
    buildGameTypeStats(userId, "poster_reveal", posterRevealRecent),
    buildGameTypeStats(userId, "rating_guess", ratingGuessRecent),
    buildGameTypeStats(userId, "year_guess", yearGuessRecent),
  ]);

  const response: UserGameStatsResponse = {
    posterReveal,
    ratingGuess,
    yearGuess,
  };

  return successResponse(response);
}
