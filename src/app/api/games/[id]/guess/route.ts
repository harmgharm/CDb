/**
 * POST /api/games/[id]/guess — Submit a guess for the current round
 *
 * Solo: same as before.
 * Multiplayer: tracks first-correct per round, awards +200 "First!" bonus,
 * publishes player-guessed + round-countdown events via Ably.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { GameRound, GameSession } from "@/lib/db/types";
import type { GameEngine } from "@/lib/games";
import { getEngine } from "@/lib/games";
import {
  calculateRoundScore,
  calculateStreakBonus,
  COUNTDOWN_DURATION_MS,
  FIRST_CORRECT_BONUS,
} from "@/lib/games/scoring";
import { publishToGame } from "@/lib/notifications/ably";
import { submitGuessSchema } from "@/lib/validations/games";
import type {
  GuessResultResponse,
  PlayerGuessedEvent,
  RoundCountdownEvent,
} from "@/types/game-responses";

/**
 * Calculate the current streak from previous guesses (most recent consecutive correct).
 */
function calculateCurrentStreak(
  previousGuesses: { is_correct: boolean; round_number: number }[],
  isCurrentCorrect: boolean,
): number {
  if (!isCurrentCorrect) return 0;

  let streak = 1;
  const sorted = previousGuesses.toSorted((a, b) => b.round_number - a.round_number);

  for (const previous of sorted) {
    if (previous.is_correct) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Validate that the game and round are in a valid state for guessing.
 */
function validateGameState(session: GameSession, round: GameRound): string | null {
  if (session.status !== "active") return "Game is not active";
  if (round.round_number !== session.current_round) return "This is not the current round";
  if (round.started_at === null) return "Round has not started";
  if (round.ended_at !== null) return "Round has already ended";
  return null;
}

/**
 * Authorize the user for the given game session.
 */
async function authorizePlayer(
  session: GameSession,
  userId: string,
  gameId: string,
): Promise<string | null> {
  if (session.mode === "multiplayer") {
    const player = await db
      .selectFrom("game_players")
      .select("id")
      .where("game_id", "=", gameId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return player === undefined ? "You are not in this game" : null;
  }
  return session.created_by_user_id === userId ? null : "Not authorized";
}

interface MultiplayerGuessEffectsOptions {
  gameId: string;
  roundId: string;
  round: GameRound;
  userId: string;
  username: string;
  correct: boolean;
  totalAward: number;
  isFirstCorrect: boolean;
}

/**
 * Handle multiplayer-specific side effects after a guess is saved.
 */
async function handleMultiplayerGuessEffects(
  options: MultiplayerGuessEffectsOptions,
): Promise<void> {
  const { gameId, roundId, userId, username, correct, totalAward, isFirstCorrect } = options;

  if (correct && isFirstCorrect) {
    const now = new Date();
    await db
      .updateTable("game_rounds")
      .set({ first_correct_at: now })
      .where("id", "=", roundId)
      .where("first_correct_at", "is", null)
      .execute();

    const countdownEvent: RoundCountdownEvent = {
      endsAt: new Date(now.getTime() + COUNTDOWN_DURATION_MS).toISOString(),
      allGuessed: false,
    };
    publishToGame(gameId, "round-countdown", countdownEvent);
  }

  const guessedEvent: PlayerGuessedEvent = {
    userId,
    username,
    isCorrect: correct,
    scoreAwarded: totalAward,
    isFirstCorrect,
  };
  publishToGame(gameId, "player-guessed", guessedEvent);

  // Check if all players are done
  const playerCount = await db
    .selectFrom("game_players")
    .select(({ fn }) => fn.countAll<number>().as("count"))
    .where("game_id", "=", gameId)
    .executeTakeFirstOrThrow();

  const uniqueGuessers = await db
    .selectFrom("game_guesses")
    .select("user_id")
    .where("round_id", "=", roundId)
    .where((eb) => eb.or([eb("is_correct", "=", true), eb("guess_text", "=", "(skipped)")]))
    .groupBy("user_id")
    .execute();

  if (uniqueGuessers.length >= playerCount.count) {
    const allGuessedEvent: RoundCountdownEvent = {
      endsAt: new Date().toISOString(),
      allGuessed: true,
    };
    publishToGame(gameId, "round-countdown", allGuessedEvent);
  }
}

interface GuessScoring {
  roundScore: number;
  streakBonus: number;
  currentStreak: number;
  isFirstCorrect: boolean;
  firstCorrectBonus: number;
  totalAward: number;
}

interface GuessScoringOptions {
  correct: boolean;
  timeFromStartMs: number;
  gameId: string;
  userId: string;
  isMultiplayer: boolean;
  round: GameRound;
  engine: GameEngine;
  guessData: Record<string, unknown> | undefined;
}

/**
 * Compute all scoring components for a guess.
 */
async function computeGuessScoring(options: GuessScoringOptions): Promise<GuessScoring> {
  const { correct, timeFromStartMs, gameId, userId, isMultiplayer, round, engine, guessData } =
    options;

  let roundScore: number;
  if (engine.calculateScore === undefined) {
    roundScore = correct ? calculateRoundScore(timeFromStartMs, engine.totalWindowMs) : 0;
  } else {
    roundScore = engine.calculateScore({
      guessData,
      roundData: round.round_data,
      timeFromStartMs,
    });
  }

  const previousGuesses = await db
    .selectFrom("game_guesses")
    .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
    .select(["game_guesses.is_correct", "game_rounds.round_number"])
    .where("game_rounds.game_id", "=", gameId)
    .where("game_guesses.user_id", "=", userId)
    .orderBy("game_rounds.round_number", "asc")
    .execute();

  const currentStreak = calculateCurrentStreak(previousGuesses, correct);
  const streakBonus = correct ? calculateStreakBonus(currentStreak) : 0;

  let isFirstCorrect = false;
  let firstCorrectBonus = 0;

  if (isMultiplayer && correct) {
    isFirstCorrect = round.first_correct_at === null;
    firstCorrectBonus = isFirstCorrect ? FIRST_CORRECT_BONUS : 0;
  }

  const totalAward = roundScore + streakBonus + firstCorrectBonus;
  return { roundScore, streakBonus, currentStreak, isFirstCorrect, firstCorrectBonus, totalAward };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id: gameId } = await params;

  const body: unknown = await req.json();
  const parsed = submitGuessSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { roundId, guessText, mediaId, timeFromStartMs, guessData } = parsed.data;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) return errorResponse("Game not found", 404);

  const engine = getEngine(session.game_type);
  const isMultiplayer = session.mode === "multiplayer";

  // Authorization
  const authError = await authorizePlayer(session, user.id, gameId);
  if (authError !== null) {
    return errorResponse(authError, 403);
  }

  const round = await db
    .selectFrom("game_rounds")
    .selectAll()
    .where("id", "=", roundId)
    .where("game_id", "=", gameId)
    .executeTakeFirst();

  if (round === undefined) return errorResponse("Round not found", 404);

  const validationError = validateGameState(session, round);
  if (validationError !== null) {
    return errorResponse(validationError, 400);
  }

  // Check if user already guessed correctly this round
  const existingCorrectGuess = await db
    .selectFrom("game_guesses")
    .select("id")
    .where("round_id", "=", roundId)
    .where("user_id", "=", user.id)
    .where("is_correct", "=", true)
    .executeTakeFirst();

  if (existingCorrectGuess !== undefined) {
    return errorResponse("You already guessed correctly this round", 400);
  }

  // Determine correctness via engine
  const roundData = round.round_data;
  const correctnessResult = await engine.checkCorrectness({
    guessText: guessText ?? null,
    guessMediaId: mediaId ?? null,
    guessData,
    roundData,
  });
  const correct = correctnessResult.isCorrect;

  // Calculate scoring
  const { roundScore, streakBonus, currentStreak, isFirstCorrect, firstCorrectBonus, totalAward } =
    await computeGuessScoring({
      correct,
      timeFromStartMs,
      gameId,
      userId: user.id,
      isMultiplayer,
      round,
      engine,
      guessData,
    });

  // Save guess
  await db
    .insertInto("game_guesses")
    .values({
      round_id: roundId,
      user_id: user.id,
      guess_text: guessText ?? null,
      matched_media_id: mediaId ?? null,
      guess_data:
        Object.keys(correctnessResult.details).length > 0
          ? JSON.stringify(correctnessResult.details)
          : null,
      is_correct: correct,
      time_from_start_ms: timeFromStartMs,
      score_awarded: totalAward,
    })
    .execute();

  // Multiplayer: broadcast events and handle first-correct countdown
  if (isMultiplayer) {
    await handleMultiplayerGuessEffects({
      gameId,
      roundId,
      round,
      userId: user.id,
      username: user.username,
      correct,
      totalAward,
      isFirstCorrect,
    });
  }

  // Build game-specific result data via engine
  const resultData = engine.buildGuessResultData(roundData, correctnessResult.details);

  const response: GuessResultResponse = {
    isCorrect: correct,
    scoreAwarded: totalAward,
    streakBonus,
    currentStreak,
    roundScore,
    resultData,
    ...(isMultiplayer ? { isFirstCorrect, firstCorrectBonus } : {}),
  };

  return successResponse(response);
}
