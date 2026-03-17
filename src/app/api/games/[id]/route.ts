/**
 * GET /api/games/[id] — Get game state
 *
 * Returns full game state. Rounds that haven't started yet have
 * their title and posterUrl redacted to prevent cheating.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type {
  GameGuessResponse,
  GameRoundResponse,
  GameSessionResponse,
} from "@/types/game-responses";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  // Solo games: only the creator can view
  if (session.mode === "solo" && session.created_by_user_id !== user.id) {
    return errorResponse("Not authorized", 403);
  }

  const rounds = await db
    .selectFrom("game_rounds")
    .selectAll()
    .where("game_id", "=", id)
    .orderBy("round_number", "asc")
    .execute();

  const roundIds = rounds.map((round) => round.id);

  const guesses =
    roundIds.length > 0
      ? await db
          .selectFrom("game_guesses")
          .selectAll()
          .where("round_id", "in", roundIds)
          .orderBy("created_at", "asc")
          .execute()
      : [];

  // Group guesses by round
  const guessesByRound = new Map<string, GameGuessResponse[]>();
  for (const guess of guesses) {
    const roundGuesses = guessesByRound.get(guess.round_id) ?? [];
    roundGuesses.push({
      id: guess.id,
      userId: guess.user_id,
      guessText: guess.guess_text,
      isCorrect: guess.is_correct,
      timeFromStartMs: guess.time_from_start_ms,
      scoreAwarded: guess.score_awarded,
      createdAt: guess.created_at.toISOString(),
    });
    guessesByRound.set(guess.round_id, roundGuesses);
  }

  // Calculate total score and current streak
  let totalScore = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  for (const guess of guesses) {
    if (guess.user_id === user.id) {
      totalScore += guess.score_awarded;
      if (guess.is_correct) {
        currentStreak += 1;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  }

  const roundResponses: GameRoundResponse[] = rounds.map((round) => {
    const isStarted = round.started_at !== null;
    const isEnded = round.ended_at !== null;

    return {
      id: round.id,
      roundNumber: round.round_number,
      // Reveal poster only for started rounds
      posterUrl: isStarted ? round.poster_url : null,
      // Reveal title only for ended rounds
      title: isEnded ? round.title : null,
      mediaId: isStarted ? round.media_id : null,
      tmdbId: isStarted ? round.tmdb_id : null,
      malId: isStarted ? round.mal_id : null,
      startedAt: round.started_at?.toISOString() ?? null,
      endedAt: round.ended_at?.toISOString() ?? null,
      guesses: guessesByRound.get(round.id) ?? [],
    };
  });

  const response: GameSessionResponse = {
    id: session.id,
    mode: session.mode,
    difficulty: session.difficulty,
    status: session.status,
    roundCount: session.round_count,
    currentRound: session.current_round,
    createdByUserId: session.created_by_user_id,
    startedAt: session.started_at?.toISOString() ?? null,
    finishedAt: session.finished_at?.toISOString() ?? null,
    createdAt: session.created_at.toISOString(),
    rounds: roundResponses,
    totalScore,
    currentStreak,
  };

  return successResponse(response);
}
