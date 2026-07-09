/**
 * POST /api/games/[id]/rounds/next — Advance to the next round or finish the game
 *
 * Solo: only creator can advance.
 * Multiplayer: any player can advance (resilience if host disconnects).
 * Server validates that the countdown period has elapsed before allowing.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import type { GameType } from "@/lib/db/types";
import { getEngine } from "@/lib/games";
import { updateLeaderboard } from "@/lib/games/leaderboard";
import { toLeaderboardCategory } from "@/lib/games/ranked-presets";
import { publishToGameAsync } from "@/lib/notifications/ably";
import type { GameEndedEvent, RoundEndedEvent, RoundStartedEvent } from "@/types/game-responses";

interface AuthorizeAdvanceOptions {
  isMultiplayer: boolean;
  gameId: string;
  userId: string;
  creatorId: string;
}

/**
 * Authorize the user to advance rounds.
 * Multiplayer: any game_player. Solo: creator only.
 */
async function authorizeAdvance(options: AuthorizeAdvanceOptions): Promise<string | null> {
  if (options.isMultiplayer) {
    const player = await db
      .selectFrom("game_players")
      .select("id")
      .where("game_id", "=", options.gameId)
      .where("user_id", "=", options.userId)
      .executeTakeFirst();
    return player === undefined ? "You are not in this game" : null;
  }
  return options.creatorId === options.userId ? null : "Only the game creator can advance rounds";
}

interface ValidatePlayersOptions {
  gameId: string;
  roundId: string;
  roundStartedAt: Date | null;
  totalWindowMs: number;
}

/**
 * Validate that all players have guessed (or skipped) before allowing round advancement.
 * Falls back to a time-based check: if enough time has elapsed since the round started
 * (engine timer + buffer), allow advancement regardless — covers disconnects and failed auto-submits.
 */
async function validateAllPlayersFinished(options: ValidatePlayersOptions): Promise<boolean> {
  const { gameId, roundId, roundStartedAt, totalWindowMs } = options;

  // Time-based fallback: if the round timer + buffer has elapsed, allow advancement
  if (roundStartedAt !== null) {
    const elapsed = Date.now() - roundStartedAt.getTime();
    const bufferMs = 10_000; // 10s buffer for network latency / slow auto-submits
    if (elapsed >= totalWindowMs + bufferMs) {
      return true;
    }
  }

  const playerCount = await db
    .selectFrom("game_players")
    .select(({ fn }) => fn.countAll<number>().as("count"))
    .where("game_id", "=", gameId)
    .executeTakeFirstOrThrow();

  const finishedGuessers = await db
    .selectFrom("game_guesses")
    .select("user_id")
    .where("round_id", "=", roundId)
    .where((eb) => eb.or([eb("is_correct", "=", true), eb("guess_text", "=", "(skipped)")]))
    .groupBy("user_id")
    .execute();

  return finishedGuessers.length >= playerCount.count;
}

export const POST = withAuth<{ id: string }>(async (_req, user, { params }) => {
  const { id: gameId } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (session.status !== "active") {
    return errorResponse("Game is not active", 400);
  }

  const isMultiplayer = session.mode === "multiplayer";

  const authError = await authorizeAdvance({
    isMultiplayer,
    gameId,
    userId: user.id,
    creatorId: session.created_by_user_id,
  });
  if (authError !== null) {
    return errorResponse(authError, 403);
  }

  const currentRound = await db
    .selectFrom("game_rounds")
    .selectAll()
    .where("game_id", "=", gameId)
    .where("round_number", "=", session.current_round)
    .executeTakeFirst();

  if (currentRound === undefined) {
    return errorResponse("Current round not found", 500);
  }

  // Multiplayer: validate all players have finished before advancing
  if (isMultiplayer && currentRound.ended_at === null) {
    const engine = getEngine(session.game_type);
    const totalWindowMs =
      session.time_limit_seconds === null
        ? engine.totalWindowMs
        : session.time_limit_seconds * 1000;
    const canAdvance = await validateAllPlayersFinished({
      gameId,
      roundId: currentRound.id,
      roundStartedAt: currentRound.started_at,
      totalWindowMs,
    });
    if (!canAdvance) {
      return errorResponse("Not all players have finished", 400);
    }
  }

  const now = new Date();
  const nextRoundNumber = session.current_round + 1;
  const isLastRound = nextRoundNumber >= session.round_count;

  await withTransaction(async (trx) => {
    // End the current round
    await trx
      .updateTable("game_rounds")
      .set({ ended_at: now })
      .where("game_id", "=", gameId)
      .where("round_number", "=", session.current_round)
      .execute();

    if (isLastRound) {
      await trx
        .updateTable("game_sessions")
        .set({
          status: "finished",
          finished_at: now,
        })
        .where("id", "=", gameId)
        .execute();
    } else {
      await trx
        .updateTable("game_sessions")
        .set({ current_round: nextRoundNumber })
        .where("id", "=", gameId)
        .execute();

      await trx
        .updateTable("game_rounds")
        .set({ started_at: now })
        .where("game_id", "=", gameId)
        .where("round_number", "=", nextRoundNumber)
        .execute();
    }
  });

  // Publish multiplayer events (round-ended, round-started)
  if (isMultiplayer) {
    await publishMultiplayerRoundEvents({
      gameId,
      gameType: session.game_type,
      currentRound,
      currentRoundNumber: session.current_round,
      nextRoundNumber,
      isLastRound,
      now,
    });
  }

  // Game finished — update leaderboard + publish game-ended
  // Must await for multiplayer too: on Vercel's serverless runtime, fire-and-forget
  // promises may not complete before the function terminates after the response is sent.
  let isNewPersonalBest = false;
  if (isLastRound) {
    isNewPersonalBest = await handleGameFinished(session, isMultiplayer);
  }

  return successResponse({ advanced: !isLastRound, finished: isLastRound, isNewPersonalBest });
});

interface RoundEventOptions {
  gameId: string;
  gameType: GameType;
  currentRound: { id: string; round_data: Record<string, unknown> };
  currentRoundNumber: number;
  nextRoundNumber: number;
  isLastRound: boolean;
  now: Date;
}

/**
 * Publish multiplayer round-ended + round-started Ably events.
 */
async function publishMultiplayerRoundEvents(options: RoundEventOptions): Promise<void> {
  const { gameId, gameType, currentRound, currentRoundNumber, nextRoundNumber, isLastRound, now } =
    options;
  const engine = getEngine(gameType);
  const currentRoundData = currentRound.round_data;
  const roundGuesses = await db
    .selectFrom("game_guesses")
    .innerJoin("users", "users.id", "game_guesses.user_id")
    .select([
      "game_guesses.user_id",
      "users.username",
      "game_guesses.is_correct",
      "game_guesses.score_awarded",
      "game_guesses.time_from_start_ms",
      "game_guesses.guess_data",
    ])
    .where("game_guesses.round_id", "=", currentRound.id)
    .execute();

  const correctGuesses = roundGuesses
    .filter((guess) => guess.is_correct)
    .toSorted((a, b) => a.time_from_start_ms - b.time_from_start_ms);
  const firstCorrectUserId = correctGuesses[0]?.user_id ?? null;

  const players = await db
    .selectFrom("game_players")
    .innerJoin("users", "users.id", "game_players.user_id")
    .select(["game_players.user_id", "users.username"])
    .where("game_id", "=", gameId)
    .execute();

  const guessMap = new Map(roundGuesses.map((guess) => [guess.user_id, guess]));

  const scores = players.map((player) => {
    const guess = guessMap.get(player.user_id);
    return {
      userId: player.user_id,
      username: player.username,
      scoreAwarded: guess?.score_awarded ?? 0,
      isCorrect: guess?.is_correct ?? false,
      isFirstCorrect: player.user_id === firstCorrectUserId,
      timeFromStartMs: guess?.time_from_start_ms ?? null,
      guessData: guess?.guess_data ?? null,
    };
  });

  const roundEndedEvent: RoundEndedEvent = {
    roundNumber: currentRoundNumber,
    roundData: engine.buildRoundEndedData(currentRoundData),
    scores,
  };
  await publishToGameAsync(gameId, "round-ended", roundEndedEvent);

  if (isLastRound) return;

  const nextRound = await db
    .selectFrom("game_rounds")
    .selectAll()
    .where("game_id", "=", gameId)
    .where("round_number", "=", nextRoundNumber)
    .executeTakeFirst();

  if (nextRound !== undefined) {
    const roundStartedEvent: RoundStartedEvent = {
      roundNumber: nextRoundNumber,
      roundId: nextRound.id,
      startedAt: now.toISOString(),
      roundData: engine.buildRoundStartedData(nextRound.round_data),
    };
    await publishToGameAsync(gameId, "round-started", roundStartedEvent);
  }
}

/**
 * Handle post-game leaderboard update and audit log.
 * Returns whether a new personal best was achieved (solo only).
 */
async function handleGameFinished(
  session: {
    id: string;
    created_by_user_id: string;
    difficulty: string;
    is_ranked: boolean;
    game_type: GameType;
  },
  isMultiplayer: boolean,
): Promise<boolean> {
  let isNewPersonalBest = false;

  try {
    if (isMultiplayer) {
      await updateMultiplayerLeaderboard(session);
    } else {
      isNewPersonalBest = await updateSoloLeaderboard(session);
    }

    await logAudit({
      userId: session.created_by_user_id,
      action: "game.finished",
      entityType: "game_session",
      entityId: session.id,
    });
  } catch (error: unknown) {
    console.error("Failed to update leaderboard:", error);
  }

  if (isMultiplayer) {
    let standings: Awaited<ReturnType<typeof computeFinalStandings>> = [];
    try {
      standings = await computeFinalStandings(session.id);
    } catch (error: unknown) {
      console.error("Failed to compute final standings:", error);
    }
    // Always publish game-ended so clients transition even if standings failed
    const gameEndedEvent: GameEndedEvent = { finalStandings: standings };
    await publishToGameAsync(session.id, "game-ended", gameEndedEvent);
  }

  return isNewPersonalBest;
}

/**
 * Update leaderboard for a solo game. Returns true if new personal best.
 */
async function updateSoloLeaderboard(session: {
  id: string;
  created_by_user_id: string;
  difficulty: string;
  is_ranked: boolean;
  game_type: GameType;
}): Promise<boolean> {
  if (!session.is_ranked) return false;

  const guesses = await db
    .selectFrom("game_guesses")
    .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
    .select([
      "game_guesses.is_correct",
      "game_guesses.score_awarded",
      "game_guesses.time_from_start_ms",
    ])
    .where("game_rounds.game_id", "=", session.id)
    .where("game_guesses.user_id", "=", session.created_by_user_id)
    .execute();

  let totalScore = 0;
  let roundsWon = 0;
  let bestStreak = 0;
  let currentStreak = 0;
  let totalCorrectTime = 0;
  let correctCount = 0;

  for (const guess of guesses) {
    totalScore += guess.score_awarded;
    if (guess.is_correct) {
      roundsWon += 1;
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      totalCorrectTime += guess.time_from_start_ms;
      correctCount += 1;
    } else {
      currentStreak = 0;
    }
  }

  const avgGuessTimeMs = correctCount > 0 ? Math.round(totalCorrectTime / correctCount) : 0;
  const category = toLeaderboardCategory(session.difficulty as "normal" | "hard");

  return updateLeaderboard({
    userId: session.created_by_user_id,
    gameId: session.id,
    gameType: session.game_type,
    category,
    roundsWon,
    totalScore,
    bestStreak,
    avgGuessTimeMs,
    isWinner: true,
  });
}

/**
 * Update leaderboard for all players in a multiplayer game.
 */
async function updateMultiplayerLeaderboard(session: {
  id: string;
  difficulty: string;
  is_ranked: boolean;
  game_type: GameType;
}): Promise<void> {
  if (!session.is_ranked) return;

  const category = toLeaderboardCategory(session.difficulty as "normal" | "hard");
  const gameType = session.game_type;

  const players = await db
    .selectFrom("game_players")
    .select("user_id")
    .where("game_id", "=", session.id)
    .execute();

  // Compute per-player stats
  const playerStats = await Promise.all(
    players.map(async (player) => {
      const guesses = await db
        .selectFrom("game_guesses")
        .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
        .select([
          "game_guesses.is_correct",
          "game_guesses.score_awarded",
          "game_guesses.time_from_start_ms",
        ])
        .where("game_rounds.game_id", "=", session.id)
        .where("game_guesses.user_id", "=", player.user_id)
        .orderBy("game_rounds.round_number", "asc")
        .execute();

      let totalScore = 0;
      let roundsWon = 0;
      let bestStreak = 0;
      let currentStreak = 0;
      let totalCorrectTime = 0;
      let correctCount = 0;

      for (const guess of guesses) {
        totalScore += guess.score_awarded;
        if (guess.is_correct) {
          roundsWon += 1;
          currentStreak += 1;
          bestStreak = Math.max(bestStreak, currentStreak);
          totalCorrectTime += guess.time_from_start_ms;
          correctCount += 1;
        } else {
          currentStreak = 0;
        }
      }

      return {
        userId: player.user_id,
        totalScore,
        roundsWon,
        bestStreak,
        avgGuessTimeMs: correctCount > 0 ? Math.round(totalCorrectTime / correctCount) : 0,
      };
    }),
  );

  // Determine winner (highest total score)
  const maxScore = Math.max(...playerStats.map((s) => s.totalScore));

  await Promise.all(
    playerStats.map(async (stats) =>
      updateLeaderboard({
        userId: stats.userId,
        gameId: session.id,
        gameType,
        category,
        roundsWon: stats.roundsWon,
        totalScore: stats.totalScore,
        bestStreak: stats.bestStreak,
        avgGuessTimeMs: stats.avgGuessTimeMs,
        isWinner: stats.totalScore === maxScore && maxScore > 0,
      }),
    ),
  );
}

/**
 * Compute final standings for the game-ended Ably event.
 */
async function computeFinalStandings(gameId: string) {
  const players = await db
    .selectFrom("game_players")
    .innerJoin("users", "users.id", "game_players.user_id")
    .select(["game_players.user_id", "users.username", "users.display_name", "users.avatar_url"])
    .where("game_id", "=", gameId)
    .execute();

  const standings = await Promise.all(
    players.map(async (player) => {
      const guesses = await db
        .selectFrom("game_guesses")
        .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
        .select([
          "game_guesses.is_correct",
          "game_guesses.score_awarded",
          "game_guesses.time_from_start_ms",
        ])
        .where("game_rounds.game_id", "=", gameId)
        .where("game_guesses.user_id", "=", player.user_id)
        .orderBy("game_rounds.round_number", "asc")
        .execute();

      let totalScore = 0;
      let roundsWon = 0;
      let bestStreak = 0;
      let currentStreak = 0;
      let totalCorrectTime = 0;
      let correctCount = 0;

      for (const guess of guesses) {
        totalScore += guess.score_awarded;
        if (guess.is_correct) {
          roundsWon += 1;
          currentStreak += 1;
          bestStreak = Math.max(bestStreak, currentStreak);
          totalCorrectTime += guess.time_from_start_ms;
          correctCount += 1;
        } else {
          currentStreak = 0;
        }
      }

      return {
        userId: player.user_id,
        username: player.username,
        displayName: player.display_name,
        avatarUrl: player.avatar_url,
        totalScore,
        roundsWon,
        bestStreak,
        avgGuessTimeMs: correctCount > 0 ? Math.round(totalCorrectTime / correctCount) : 0,
      };
    }),
  );

  return standings
    .toSorted((a, b) => b.totalScore - a.totalScore)
    .map((standing, index) => ({
      rank: index + 1,
      ...standing,
    }));
}
