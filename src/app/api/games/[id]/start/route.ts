/**
 * POST /api/games/[id]/start — Host starts a multiplayer game
 *
 * Builds the media pool, creates rounds, transitions lobby → active,
 * and publishes game-started via Ably.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { buildMediaPool } from "@/lib/games/media-pool";
import { publishToGame } from "@/lib/notifications/ably";
import type {
  GameRoundResponse,
  GameSessionResponse,
  GameStartedEvent,
} from "@/types/game-responses";

const MIN_PLAYERS = 2;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id: gameId } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (session.created_by_user_id !== user.id) {
    return errorResponse("Only the host can start the game", 403);
  }

  if (session.mode !== "multiplayer") {
    return errorResponse("Solo games start automatically", 400);
  }

  if (session.status !== "lobby") {
    return errorResponse("Game has already started", 400);
  }

  // Check minimum players
  const players = await db
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
    .where("game_id", "=", gameId)
    .execute();

  if (players.length < MIN_PLAYERS) {
    return errorResponse(`Need at least ${String(MIN_PLAYERS)} players to start`, 400);
  }

  // Build media pool
  let pool;
  try {
    pool = await buildMediaPool(session.difficulty, session.round_count);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build media pool";
    return errorResponse(message, 400);
  }

  const now = new Date();

  const result = await withTransaction(async (trx) => {
    // Update session to active
    const updatedSession = await trx
      .updateTable("game_sessions")
      .set({
        status: "active",
        started_at: now,
      })
      .where("id", "=", gameId)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create all rounds
    const roundValues = pool.map((item, index) => ({
      game_id: gameId,
      round_number: index,
      media_id: item.id,
      tmdb_id: item.tmdbId,
      mal_id: item.malId,
      poster_url: item.posterUrl,
      title: item.title,
      started_at: index === 0 ? now : null,
    }));

    const rounds = await trx.insertInto("game_rounds").values(roundValues).returningAll().execute();

    return { session: updatedSession, rounds };
  });

  void logAudit({
    userId: user.id,
    action: "game.started",
    entityType: "game_session",
    entityId: gameId,
    metadata: { playerCount: players.length },
  });

  // Publish game-started to all players via Ably
  const firstRound = result.rounds[0];
  if (firstRound !== undefined) {
    const gameStartedEvent: GameStartedEvent = {
      currentRound: 0,
      roundId: firstRound.id,
      posterUrl: firstRound.poster_url,
      startedAt: now.toISOString(),
    };
    publishToGame(gameId, "game-started", gameStartedEvent);
  }

  // Build response with player data
  const roundResponses: GameRoundResponse[] = result.rounds.map((round) => ({
    id: round.id,
    roundNumber: round.round_number,
    posterUrl: round.round_number === 0 ? round.poster_url : null,
    title: null,
    mediaId: round.round_number === 0 ? round.media_id : null,
    tmdbId: round.round_number === 0 ? round.tmdb_id : null,
    malId: round.round_number === 0 ? round.mal_id : null,
    startedAt: round.started_at?.toISOString() ?? null,
    endedAt: round.ended_at?.toISOString() ?? null,
    firstCorrectAt: null,
    guesses: [],
  }));

  const response: GameSessionResponse = {
    id: result.session.id,
    gameType: result.session.game_type,
    mode: result.session.mode,
    difficulty: result.session.difficulty,
    status: result.session.status,
    roundCount: result.session.round_count,
    currentRound: result.session.current_round,
    createdByUserId: result.session.created_by_user_id,
    startedAt: result.session.started_at?.toISOString() ?? null,
    finishedAt: result.session.finished_at?.toISOString() ?? null,
    createdAt: result.session.created_at.toISOString(),
    rounds: roundResponses,
    totalScore: 0,
    currentStreak: 0,
    players: players.map((player) => ({
      userId: player.user_id,
      username: player.username,
      displayName: player.display_name,
      avatarUrl: player.avatar_url,
      isHost: player.is_host,
      joinedAt: player.joined_at.toISOString(),
      totalScore: 0,
      roundsWon: 0,
      currentStreak: 0,
    })),
  };

  return successResponse(response, "Game started");
}
