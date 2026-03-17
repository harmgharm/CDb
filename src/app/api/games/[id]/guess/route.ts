/**
 * POST /api/games/[id]/guess — Submit a guess for the current round
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { GameRound, GameSession } from "@/lib/db/types";
import { isCorrectGuess } from "@/lib/games/matching";
import { calculateRoundScore, calculateStreakBonus } from "@/lib/games/scoring";
import { submitGuessSchema } from "@/lib/validations/games";
import type { GuessResultResponse } from "@/types/game-responses";

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

  let streak = 1; // Current correct guess counts as 1
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
function validateGameState(session: GameSession, round: GameRound, userId: string): string | null {
  if (session.status !== "active") return "Game is not active";
  if (session.mode === "solo" && session.created_by_user_id !== userId) return "Not authorized";
  if (round.round_number !== session.current_round) return "This is not the current round";
  if (round.started_at === null) return "Round has not started";
  if (round.ended_at !== null) return "Round has already ended";
  return null;
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

  const round = await db
    .selectFrom("game_rounds")
    .selectAll()
    .where("id", "=", roundId)
    .where("game_id", "=", gameId)
    .executeTakeFirst();

  if (round === undefined) return errorResponse("Round not found", 404);

  const validationError = validateGameState(session, round, user.id);
  if (validationError !== null) {
    const status = validationError === "Not authorized" ? 403 : 400;
    return errorResponse(validationError, status);
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

  // Determine correctness: autocomplete ID match, then fuzzy text fallback
  let correct = false;
  if (mediaId !== undefined) {
    correct = await checkMediaIdMatch(mediaId, round);
  }
  if (!correct) {
    correct = isCorrectGuess(guessText, round.title);
  }

  // Calculate scoring
  const roundScore = correct ? calculateRoundScore(timeFromStartMs) : 0;

  const previousGuesses = await db
    .selectFrom("game_guesses")
    .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
    .select(["game_guesses.is_correct", "game_rounds.round_number"])
    .where("game_rounds.game_id", "=", gameId)
    .where("game_guesses.user_id", "=", user.id)
    .orderBy("game_rounds.round_number", "asc")
    .execute();

  const currentStreak = calculateCurrentStreak(previousGuesses, correct);
  const streakBonus = correct ? calculateStreakBonus(currentStreak) : 0;
  const totalAward = roundScore + streakBonus;

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

  const response: GuessResultResponse = {
    isCorrect: correct,
    scoreAwarded: totalAward,
    streakBonus,
    currentStreak,
    correctTitle: round.title,
    correctPosterUrl: round.poster_url,
    roundScore,
  };

  return successResponse(response);
}
