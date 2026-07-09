/**
 * GET /api/games/[id] — Get game state
 *
 * Returns full game state with redacted rounds for anti-cheat.
 * Solo: only the creator can view.
 * Multiplayer: any game_player can view, includes player list + per-player scores.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import { getEngine } from "@/lib/games";
import type {
  GameGuessResponse,
  GamePlayerResponse,
  GameRoundResponse,
  GameSessionResponse,
} from "@/types/game-responses";

function getRoundPhase(isStarted: boolean, isEnded: boolean): "not_started" | "active" | "ended" {
  if (isEnded) return "ended";
  if (isStarted) return "active";
  return "not_started";
}

interface AuthorizeViewOptions {
  isMultiplayer: boolean;
  gameId: string;
  userId: string;
  creatorId: string;
}

/**
 * Authorize the user to view the game.
 */
async function authorizeView(options: AuthorizeViewOptions): Promise<string | null> {
  if (options.isMultiplayer) {
    const player = await db
      .selectFrom("game_players")
      .select("id")
      .where("game_id", "=", options.gameId)
      .where("user_id", "=", options.userId)
      .executeTakeFirst();
    return player === undefined ? "You are not in this game" : null;
  }
  return options.creatorId === options.userId ? null : "Not authorized";
}

/**
 * Compute per-player scores from guesses for the multiplayer scoreboard.
 */
function computePlayerScores(
  guesses: { user_id: string; score_awarded: number; is_correct: boolean }[],
  userId: string,
): { totalScore: number; roundsWon: number; currentStreak: number } {
  let totalScore = 0;
  let roundsWon = 0;
  let currentStreak = 0;

  for (const guess of guesses) {
    if (guess.user_id === userId) {
      totalScore += guess.score_awarded;
      if (guess.is_correct) {
        roundsWon += 1;
        currentStreak += 1;
      } else {
        currentStreak = 0;
      }
    }
  }

  return { totalScore, roundsWon, currentStreak };
}

export const GET = withAuth<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  const engine = getEngine(session.game_type);
  const isMultiplayer = session.mode === "multiplayer";

  const authError = await authorizeView({
    isMultiplayer,
    gameId: id,
    userId: user.id,
    creatorId: session.created_by_user_id,
  });
  if (authError !== null) {
    return errorResponse(authError, 403);
  }

  const rounds = await db
    .selectFrom("game_rounds")
    .selectAll()
    .where("game_id", "=", id)
    .orderBy("round_number", "asc")
    .execute();

  const roundIds = rounds.map((round) => round.id);

  // For multiplayer, include username in guesses
  const guesses =
    roundIds.length > 0
      ? await db
          .selectFrom("game_guesses")
          .innerJoin("users", "users.id", "game_guesses.user_id")
          .select([
            "game_guesses.id",
            "game_guesses.round_id",
            "game_guesses.user_id",
            "users.username",
            "game_guesses.guess_text",
            "game_guesses.guess_data",
            "game_guesses.is_correct",
            "game_guesses.time_from_start_ms",
            "game_guesses.score_awarded",
            "game_guesses.created_at",
          ])
          .where("game_guesses.round_id", "in", roundIds)
          .orderBy("game_guesses.created_at", "asc")
          .execute()
      : [];

  // Group raw guesses by round (guess_data included conditionally when building responses)
  const rawGuessesByRound = new Map<string, typeof guesses>();
  for (const guess of guesses) {
    const roundGuesses = rawGuessesByRound.get(guess.round_id) ?? [];
    roundGuesses.push(guess);
    rawGuessesByRound.set(guess.round_id, roundGuesses);
  }

  // Calculate current user's total score and streak
  const { totalScore, currentStreak } = computePlayerScores(guesses, user.id);

  const roundResponses: GameRoundResponse[] = rounds.map((round) => {
    const isStarted = round.started_at !== null;
    const isEnded = round.ended_at !== null;
    const phase = getRoundPhase(isStarted, isEnded);
    const roundData = round.round_data;
    const masked = engine.maskRoundData(roundData, phase);

    const rawGuesses = rawGuessesByRound.get(round.id) ?? [];
    const mappedGuesses: GameGuessResponse[] = rawGuesses.map((guess) => ({
      id: guess.id,
      userId: guess.user_id,
      ...(isMultiplayer ? { username: guess.username } : {}),
      guessText: guess.guess_text ?? "",
      isCorrect: guess.is_correct,
      timeFromStartMs: guess.time_from_start_ms,
      scoreAwarded: guess.score_awarded,
      createdAt: guess.created_at.toISOString(),
      // Only include guess_data for ended rounds (anti-cheat: hides guessed ratings during active)
      ...(isEnded && guess.guess_data !== null ? { guessData: guess.guess_data } : {}),
    }));

    return {
      id: round.id,
      roundNumber: round.round_number,
      roundData: masked,
      startedAt: round.started_at?.toISOString() ?? null,
      endedAt: round.ended_at?.toISOString() ?? null,
      firstCorrectAt: round.first_correct_at?.toISOString() ?? null,
      guesses: mappedGuesses,
    };
  });

  // Build multiplayer player list with scores
  let players: GamePlayerResponse[] | undefined;
  if (isMultiplayer) {
    const gamePlayers = await db
      .selectFrom("game_players")
      .innerJoin("users", "users.id", "game_players.user_id")
      .select([
        "game_players.user_id",
        "game_players.is_host",
        "game_players.joined_at",
        "users.username",
        "users.display_name",
        "users.avatar_url",
      ])
      .where("game_id", "=", id)
      .execute();

    players = gamePlayers.map((player) => {
      const scores = computePlayerScores(guesses, player.user_id);
      return {
        userId: player.user_id,
        username: player.username,
        displayName: player.display_name,
        avatarUrl: player.avatar_url,
        isHost: player.is_host,
        joinedAt: player.joined_at.toISOString(),
        totalScore: scores.totalScore,
        roundsWon: scores.roundsWon,
        currentStreak: scores.currentStreak,
      };
    });
  }

  const response: GameSessionResponse = {
    id: session.id,
    gameType: session.game_type,
    mode: session.mode,
    difficulty: session.difficulty,
    status: session.status,
    roundCount: session.round_count,
    currentRound: session.current_round,
    createdByUserId: session.created_by_user_id,
    isRanked: session.is_ranked,
    timeLimitSeconds: session.time_limit_seconds,
    startedAt: session.started_at?.toISOString() ?? null,
    finishedAt: session.finished_at?.toISOString() ?? null,
    createdAt: session.created_at.toISOString(),
    rounds: roundResponses,
    totalScore,
    currentStreak,
    ...(players === undefined ? {} : { players }),
  };

  return successResponse(response);
});
