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
import { isCorrectGuess } from "@/lib/games/matching";
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
 * Check if the guessed media ID matches the round's answer by direct ID or external IDs.
 */
async function checkMediaIdMatch(mediaId: string, round: GameRound): Promise<boolean> {
  if (round.media_id !== null && mediaId === round.media_id) {
    return true;
  }

  const selectedMedia = await db
    .selectFrom("media")
    .select(["tmdb_id", "mal_id"])
    .where("id", "=", mediaId)
    .executeTakeFirst();

  if (selectedMedia === undefined) return false;

  const tmdbMatch =
    round.tmdb_id !== null &&
    selectedMedia.tmdb_id !== null &&
    round.tmdb_id === selectedMedia.tmdb_id;
  const malMatch =
    round.mal_id !== null && selectedMedia.mal_id !== null && round.mal_id === selectedMedia.mal_id;

  return tmdbMatch || malMatch;
}

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
 * Returns an error response string if unauthorized, null if OK.
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
 * Handle multiplayer-specific side effects after a guess is saved:
 * first-correct tracking, countdown events, player-guessed broadcast.
 */
async function handleMultiplayerGuessEffects(
  options: MultiplayerGuessEffectsOptions,
): Promise<void> {
  const { gameId, roundId, userId, username, correct, totalAward, isFirstCorrect } = options;
  // Set first_correct_at if this is the first correct guess
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

  // Broadcast player-guessed
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

/**
 * Determine if a guess is correct by media ID match or fuzzy text match.
 */
async function determineCorrectness(
  guessText: string,
  mediaId: string | undefined,
  round: GameRound,
): Promise<boolean> {
  if (mediaId !== undefined) {
    const idMatch = await checkMediaIdMatch(mediaId, round);
    if (idMatch) return true;
  }
  return isCorrectGuess(guessText, round.title);
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
}

/**
 * Compute all scoring components for a guess.
 */
async function computeGuessScoring(options: GuessScoringOptions): Promise<GuessScoring> {
  const { correct, timeFromStartMs, gameId, userId, isMultiplayer, round } = options;
  const roundScore = correct ? calculateRoundScore(timeFromStartMs) : 0;

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

  const { roundId, guessText, mediaId, timeFromStartMs } = parsed.data;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) return errorResponse("Game not found", 404);

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

  // Determine correctness
  const correct = await determineCorrectness(guessText, mediaId, round);

  // Calculate scoring
  const { roundScore, streakBonus, currentStreak, isFirstCorrect, firstCorrectBonus, totalAward } =
    await computeGuessScoring({
      correct,
      timeFromStartMs,
      gameId,
      userId: user.id,
      isMultiplayer,
      round,
    });

  // Save guess
  await db
    .insertInto("game_guesses")
    .values({
      round_id: roundId,
      user_id: user.id,
      guess_text: guessText,
      matched_media_id: mediaId ?? null,
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

  const response: GuessResultResponse = {
    isCorrect: correct,
    scoreAwarded: totalAward,
    streakBonus,
    currentStreak,
    correctTitle: round.title,
    correctPosterUrl: round.poster_url,
    roundScore,
    ...(isMultiplayer ? { isFirstCorrect, firstCorrectBonus } : {}),
  };

  return successResponse(response);
}
