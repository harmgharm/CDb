/**
 * POST /api/games — Create a game (solo auto-starts, multiplayer creates lobby)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { withTransaction } from "@/lib/db/transaction";
import type { GameRound } from "@/lib/db/types";
import { buildMediaPool } from "@/lib/games/media-pool";
import { isRankedGame } from "@/lib/games/ranked-presets";
import { createGameSchema } from "@/lib/validations/games";
import type { GameRoundResponse, GameSessionResponse, MediaPoolItem } from "@/types/game-responses";

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { mode, difficulty, roundCount } = parsed.data;
  const isMultiplayer = mode === "multiplayer";
  const ranked = isRankedGame(difficulty, roundCount);

  // Solo: build media pool now. Multiplayer: defer to /start
  let pool: MediaPoolItem[] | undefined;
  if (!isMultiplayer) {
    try {
      pool = await buildMediaPool(difficulty, roundCount);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to build media pool";
      return errorResponse(message, 400);
    }
  }

  const now = new Date();

  const result = await withTransaction(async (trx) => {
    // Create game session
    const session = await trx
      .insertInto("game_sessions")
      .values({
        game_type: "poster_reveal",
        mode,
        difficulty,
        status: isMultiplayer ? "lobby" : "active",
        round_count: roundCount,
        current_round: 0,
        created_by_user_id: user.id,
        is_ranked: ranked,
        started_at: isMultiplayer ? null : now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Multiplayer: add host as first player
    if (isMultiplayer) {
      await trx
        .insertInto("game_players")
        .values({
          game_id: session.id,
          user_id: user.id,
          is_host: true,
        })
        .execute();
    }

    // Solo: create all rounds upfront
    let rounds: GameRound[] = [];
    if (!isMultiplayer && pool !== undefined) {
      const roundValues = pool.map((item, index) => ({
        game_id: session.id,
        round_number: index,
        media_id: item.id,
        tmdb_id: item.tmdbId,
        mal_id: item.malId,
        poster_url: item.posterUrl,
        title: item.title,
        started_at: index === 0 ? now : null,
      }));

      rounds = await trx.insertInto("game_rounds").values(roundValues).returningAll().execute();
    }

    return { session, rounds };
  });

  void logAudit({
    userId: user.id,
    action: "game.created",
    entityType: "game_session",
    entityId: result.session.id,
    metadata: { difficulty, roundCount, mode },
  });

  // Build response
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
    isRanked: result.session.is_ranked,
    startedAt: result.session.started_at?.toISOString() ?? null,
    finishedAt: result.session.finished_at?.toISOString() ?? null,
    createdAt: result.session.created_at.toISOString(),
    rounds: roundResponses,
    totalScore: 0,
    currentStreak: 0,
    ...(isMultiplayer
      ? {
          players: [
            {
              userId: user.id,
              username: user.username,
              displayName: user.display_name,
              avatarUrl: user.avatar_url,
              isHost: true,
              joinedAt: new Date().toISOString(),
              totalScore: 0,
              roundsWon: 0,
              currentStreak: 0,
            },
          ],
        }
      : {}),
  };

  return successResponse(response, "Game created", 201);
}
